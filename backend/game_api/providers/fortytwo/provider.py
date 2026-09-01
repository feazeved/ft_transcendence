from allauth.socialaccount.providers.base import ProviderAccount
from allauth.socialaccount.providers.oauth2.provider import OAuth2Provider

from .views import FortyTwoOAuth2Adapter

class FortyTwoAccount(ProviderAccount):
	def get_profile_url(self):
		return self.account.extra_data.get("url")

	def get_avatar_url(self):
		image = self.account.extra_data.get("image") or {}
		return image.get("link")

class FortyTwoProvider(OAuth2Provider):
	id = "fortytwo"
	name = "42"
	account_class = FortyTwoAccount
	oauth2_adapter_class = FortyTwoOAuth2Adapter

	def get_default_scope(self):
		return ["public"]

	def extract_uid(self, data):
		return str(data["id"])

	def extract_common_fields(self, data):
		return {
			"username": data.get("login"),
			"email": data.get("email"),
			"first_name": data.get("first_name"),
			"last_name": data.get("last_name"),
		}

provider_classes = [FortyTwoProvider]