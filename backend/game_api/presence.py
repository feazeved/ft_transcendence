import redis

from django.conf import settings

_redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

# A key is deleted when its socket closes, so the expiry only covers the closes
# that never happen: a backend that is killed leaves counters behind with nothing
# to decrement them. The client beats every 30s (HEARTBEAT_MS in lib/chat.js).
TTL_SECONDS = 90

def _key(user_id) -> str:
	return f"presence:connections:{user_id}"

def register_connection(user_id) -> int:
	key = _key(user_id)
	# INCR keeps the key's existing TTL, so the expiry is set again every time.
	count = _redis_client.incr(key)
	_redis_client.expire(key, TTL_SECONDS)
	return count

def unregister_connection(user_id) -> int:
	new_value = _redis_client.decr(_key(user_id))

	if new_value <= 0:
		_redis_client.delete(_key(user_id))
		return 0

	return new_value

def touch(user_id) -> None:
	"""Renew a live connection's key. A no-op if there is none."""
	_redis_client.expire(_key(user_id), TTL_SECONDS)

def is_online(user_id) -> bool:
	"""Whether this person has at least one presence socket open right now."""
	return bool(_redis_client.exists(_key(user_id)))
