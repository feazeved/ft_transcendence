from allauth.account.adapter import DefaultAccountAdapter
from django.conf import settings

class AccountAdapter(DefaultAccountAdapter):
	def get_reset_password_from_key_url(self, key: str) -> str:
		return f"{settings.FRONTEND_URL}/reset-password/{key}/"
	def get_email_confirmation_url(self, request, emailconfirmation) -> str:
		return f"{settings.FRONTEND_URL}/confirm-email/{emailconfirmation.key}/"