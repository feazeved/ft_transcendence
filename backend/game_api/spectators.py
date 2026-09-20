import logging

import redis

from django.conf import settings

logger = logging.getLogger(__name__)

_redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

# How many people are watching each room, kept in Redis because it is per
# connection and not worth a row.
#
# **Every call here answers even when Redis does not.** The count is a nicety —
# it decorates a room card and the game header — but it used to be reached once
# per room from inside `GET /api/games/`, so one unreachable Redis raised and
# took the whole room list with it: Home showed nothing at all, and the only way
# in was closed, over a number that could have read zero. A missing count is a
# missing count; it is never worth an empty page. Failures are logged, at
# warning, so this degrades loudly in the log and quietly on screen.

def _key(game_id) -> str:
	return f"spectators:{game_id}"

def register_spectator(game_id) -> int:
	try:
		return _redis_client.incr(_key(game_id))
	except redis.RedisError:
		logger.warning("Redis unreachable: not counting a spectator joining game %s", game_id, exc_info=True)
		return 0

def unregister_spectator(game_id) -> int:
	try:
		new_value = _redis_client.decr(_key(game_id))
		if new_value <= 0:
			_redis_client.delete(_key(game_id))
			return 0
		return new_value
	except redis.RedisError:
		logger.warning("Redis unreachable: not counting a spectator leaving game %s", game_id, exc_info=True)
		return 0

def spectator_count(game_id) -> int:
	try:
		value = _redis_client.get(_key(game_id))
	except redis.RedisError:
		logger.warning("Redis unreachable: reporting 0 spectators for game %s", game_id, exc_info=True)
		return 0
	return int(value) if value else 0

def spectator_counts(game_ids) -> dict:
	"""
	The counts for a whole list of rooms in one round trip.

	`GET /api/games/` renders every open room, so asking per row meant one
	network call per room on the one request Home cannot do without. `MGET`
	makes it one, whatever the list costs.

	Returns a `{game_id: int}` with an entry for every id asked for, so a caller
	can index it without a default and a room that Redis has never heard of
	reads 0 like any other.
	"""
	game_ids = list(game_ids)
	if not game_ids:
		return {}

	try:
		values = _redis_client.mget([_key(game_id) for game_id in game_ids])
	except redis.RedisError:
		logger.warning("Redis unreachable: reporting 0 spectators for %d games", len(game_ids), exc_info=True)
		return {game_id: 0 for game_id in game_ids}

	return {game_id: int(value) if value else 0 for game_id, value in zip(game_ids, values)}
