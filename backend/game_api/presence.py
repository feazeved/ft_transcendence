import logging

import redis

from django.conf import settings

logger = logging.getLogger(__name__)

_redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

# A key is deleted when its socket closes, so the expiry only covers the closes
# that never happen: a backend that is killed leaves counters behind with nothing
# to decrement them. The client beats every 30s (HEARTBEAT_MS in lib/chat.js).
TTL_SECONDS = 90

# **Every call here answers even when Redis does not**, same reasoning as
# spectators.py: is_online() is read by UserDetailsSerializer, so one
# unreachable Redis used to 500 every login instead of just showing "offline".

def _key(user_id) -> str:
	return f"presence:connections:{user_id}"

def register_connection(user_id) -> int:
	key = _key(user_id)
	try:
		# INCR keeps the key's existing TTL, so the expiry is set again every time.
		count = _redis_client.incr(key)
		_redis_client.expire(key, TTL_SECONDS)
		return count
	except redis.RedisError:
		logger.warning("Redis unreachable: not counting a connection for user %s", user_id, exc_info=True)
		return 0

def unregister_connection(user_id) -> int:
	try:
		new_value = _redis_client.decr(_key(user_id))
	except redis.RedisError:
		logger.warning("Redis unreachable: not counting a disconnection for user %s", user_id, exc_info=True)
		return 0

	if new_value <= 0:
		try:
			_redis_client.delete(_key(user_id))
		except redis.RedisError:
			logger.warning("Redis unreachable: could not clear presence key for user %s", user_id, exc_info=True)
		return 0

	return new_value

def touch(user_id) -> None:
	"""Renew a live connection's key. A no-op if there is none."""
	try:
		_redis_client.expire(_key(user_id), TTL_SECONDS)
	except redis.RedisError:
		logger.warning("Redis unreachable: could not renew presence for user %s", user_id, exc_info=True)

def is_online(user_id) -> bool:
	"""Whether this person has at least one presence socket open right now."""
	try:
		return bool(_redis_client.exists(_key(user_id)))
	except redis.RedisError:
		logger.warning("Redis unreachable: reporting user %s as offline", user_id, exc_info=True)
		return False
