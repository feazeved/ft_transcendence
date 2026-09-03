import redis

from django.conf import settings

_redis_client = redis.Redis.from_url(settings.REDIS_URL, decode_responses=True)

def _key(user_id) -> str:
	return f"presence:connections:{user_id}"

def register_connection(user_id) -> int:
	return _redis_client.incr(_key(user_id))

def unregister_connection(user_id) -> int:
	new_value = _redis_client.decr(_key(user_id))

	if new_value <= 0:
		_redis_client.delete(_key(user_id))
		return 0

	return new_value