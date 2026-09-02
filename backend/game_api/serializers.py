from allauth.account.utils import user_pk_to_url_str
from dj_rest_auth.registration.serializers import RegisterSerializer as BaseRegisterSerializer
from dj_rest_auth.serializers import PasswordResetSerializer as BasePasswordResetSerializer
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import serializers

User = get_user_model()

class RegisterSerializer(BaseRegisterSerializer):
	def validate_email(self, email):
		email = super().validate_email(email)
		if email and User.objects.filter(email__iexact=email).exists():
			raise serializers.ValidationError("A user is already registered with this e-mail address.")
		
		return email

def _frontend_password_reset_url(request, user, temp_key) -> str:
	uid = user_pk_to_url_str(user)
	return f"{settings.FRONTEND_URL}/reset-password/{uid}/{temp_key}/"

class PasswordResetSerializer(BasePasswordResetSerializer):
	def get_email_options(self):
		return {"url_generator": _frontend_password_reset_url}