import logging
import threading

from django.conf import settings
from django.db import connections

logger = logging.getLogger(__name__)

def run_in_background(func, *args, **kwargs) -> None:
	"""
	Run func off the request thread.

	A thread, not a queue — there is no worker process in this project. It only
	suits work the response doesn't depend on and nobody waits for: an SMTP
	round-trip, downloading an avatar from a provider's CDN.

	Callers must pass data the thread can use on its own (a primary key rather
	than a model instance, an already-rendered email). Anything that reads
	allauth's request context has to happen before this call, because that
	context is a ContextVar and a new thread doesn't inherit it.
	"""
	if not settings.RUN_TASKS_IN_BACKGROUND:
		func(*args, **kwargs)
		return

	threading.Thread(target=_run, args=(func, args, kwargs), daemon=True).start()

def _run(func, args, kwargs) -> None:
	try:
		func(*args, **kwargs)
	except Exception:
		# The response went out long ago, so there is nobody left to raise to.
		logger.exception('Background task %s failed', getattr(func, '__name__', func))
	finally:
		# Django only closes connections at the end of a request, and this
		# thread never had one. Without this, every task that touched the ORM
		# leaks a Postgres connection.
		connections.close_all()
