from django.contrib.auth.hashers import Argon2PasswordHasher

class Argon2Hasher(Argon2PasswordHasher):
	"""
	Argon2id at OWASP's recommended minimum rather than Django's defaults.

	Django asks for 100 MiB and 8 lanes per hash, which is more than a small
	Render instance running several uvicorn workers can afford. These settings
	keep the same algorithm at a cost the box can actually pay.
	"""
	time_cost = 2
	memory_cost = 19456
	parallelism = 1
