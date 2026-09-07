import redis

from django.conf import settings

_redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

def _key(game_id) -> str:
	return f"spectators:{game_id}"

def register_spectator(game_id) -> int:
	return _redis_client.incr(_key(game_id))

def unregister_spectator(game_id) -> int:
	new_value = _redis_client.decr(_key(game_id))

	if new_value <= 0:
		_redis_client.delete(_key(game_id))
		return 0
	return new_value

def spectator_count(game_id) -> int:
	value = _redis_client.get(_key(game_id))
	return int(value) if value else 0