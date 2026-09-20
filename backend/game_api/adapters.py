import logging
import requests
from allauth.account.adapter import DefaultAccountAdapter
from allauth.core import context as allauth_context
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.utils import generate_unique_username
from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.sites.shortcuts import get_current_site
from django.core.files.base import ContentFile

from .background import run_in_background

logger = logging.getLogger(__name__)

class AccountAdapter(DefaultAccountAdapter):
	def get_reset_password_from_key_url(self, key: str) -> str:
		return f"{settings.FRONTEND_URL}/reset-password/{key}/"
	def get_email_confirmation_url(self, request, emailconfirmation) -> str:
		return f"{settings.FRONTEND_URL}/confirm-email/{emailconfirmation.key}/"
	def get_login_redirect_url(self, request) -> str:
		return f"{settings.FRONTEND_URL}/oauth/callback"
	def get_signup_redirect_url(self, request) -> str:
		# A new Google/42 account (first-ever login) goes through allauth's
		# signup redirect instead of the login one. The `first=1` tells the
		# frontend this is the one login where the provider picture is still
		# downloading, so it waits for it instead of storing the default.
		return f"{settings.FRONTEND_URL}/oauth/callback?first=1"

	def send_mail(self, template_prefix: str, email: str, context: dict) -> None:
		# The context allauth would have built, except the send is handed to a
		# thread — a signup was waiting on the whole Gmail round-trip. Rendering
		# stays here, where allauth's request context still exists.
		request = allauth_context.request
		ctx = {
			"request": request,
			"email": email,
			"current_site": get_current_site(request),
		}
		ctx.update(context)
		message = self.render_mail(template_prefix, email, ctx)
		run_in_background(message.send)

def _save_avatar_from_provider(user_pk, avatar_url: str) -> None:
	# Runs off the request thread, so it re-reads the user instead of reusing
	# the instance signup built, and writes only the avatar column — the login
	# it was started from is still saving that same row.
	try:
		resp = requests.get(avatar_url, timeout=5)
		resp.raise_for_status()
	except requests.RequestException as exc:
		# Returning silently here is why a missing picture used to look like a
		# frontend bug: nothing anywhere said the download had failed.
		logger.warning("Could not download the provider avatar %s: %s", avatar_url, exc)
		return
	user = get_user_model().objects.filter(pk=user_pk).first()
	if user is None or user.avatar:
		return
	ext = avatar_url.split("?")[0].rsplit(".", 1)[-1].lower()
	if ext not in ("png", "jpg", "jpeg"):
		ext = "jpg"
	user.avatar.save(f"{user.public_id}.{ext}", ContentFile(resp.content), save=False)
	user.save(update_fields=["avatar"])

class SocialAccountAdapter(DefaultSocialAccountAdapter):
	def populate_user(self, request, sociallogin, data):
		# Google/42 don't ask for a username during signup, so one from
		# whatever the provider gave us and let
		# allauth append a numeric suffix if that name is already taken.
		user = super().populate_user(request, sociallogin, data)
		candidates = [
			data.get("username"),
			user.first_name,
			user.last_name,
			user.email,
			"user",
		]
		user.username = generate_unique_username(candidates)
		return user

	def save_user(self, request, sociallogin, form=None):
		# Only runs on first-time signup (allauth calls save_user, not
		# populate_user, when linking a provider to an already-existing user),
		# so a returning user's avatar is never silently overwritten.
		user = super().save_user(request, sociallogin, form)
		avatar_url = sociallogin.account.get_avatar_url()
		if avatar_url and not user.avatar:
			# The provider's CDN answers when it feels like it, and this is
			# inside the OAuth callback the user is already waiting on. The
			# avatar appears on one of the next page loads instead.
			run_in_background(_save_avatar_from_provider, user.pk, avatar_url)
		return user
