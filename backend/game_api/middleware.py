from datetime import timedelta
from django.contrib.auth import get_user_model
from django.utils import timezone

UPDATE_INTERVAL = timedelta(seconds=60)

class UpdateLastSeenMiddleware:
	def __init__(self, get_response):
		self.get_response = get_response

	def __call__(self, request):
		response = self.get_response(request)
		user = getattr(request, "user", None)

		if user is not None and getattr(user, "is_authenticated", False):
			now = timezone.now()
			if user.last_seen_at is None or now - user.last_seen_at >= UPDATE_INTERVAL:
				get_user_model().objects.filter(pk=user.pk).update(last_seen_at=now)

		return response