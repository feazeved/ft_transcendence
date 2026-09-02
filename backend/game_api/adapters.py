from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter
from allauth.utils import generate_unique_username
from django.conf import settings

class AccountAdapter(DefaultAccountAdapter):
	def get_reset_password_from_key_url(self, key: str) -> str:
		return f"{settings.FRONTEND_URL}/reset-password/{key}/"
	def get_email_confirmation_url(self, request, emailconfirmation) -> str:
		return f"{settings.FRONTEND_URL}/confirm-email/{emailconfirmation.key}/"
	def get_login_redirect_url(self, request) -> str:
		return f"{settings.FRONTEND_URL}/oauth/callback"
	def get_signup_redirect_url(self, request) -> str:
		# A new Google/42 account (first-ever login) goes through allauth's
		# signup redirect instead of the login one — same destination either way.
		return f"{settings.FRONTEND_URL}/oauth/callback"

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