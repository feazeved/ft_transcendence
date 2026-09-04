from allauth.account.utils import user_pk_to_url_str
from dj_rest_auth.registration.serializers import RegisterSerializer as BaseRegisterSerializer
from dj_rest_auth.serializers import PasswordResetSerializer as BasePasswordResetSerializer
from dj_rest_auth.serializers import UserDetailsSerializer as BaseUserDetailsSerializer
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Friendship, Game, GamePlayer, MODIFIER_FIELDS as _MODIFIER_FIELDS

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

class PublicProfileSerializer(serializers.ModelSerializer):
	class Meta:
		model = User
		fields = ("public_id", "username", "display_name", "avatar_url", "is_online", "date_joined")
		read_only_fields = fields

class UserDetailsSerializer(BaseUserDetailsSerializer):
	avatar = serializers.ImageField(write_only=True, required=False, allow_null=True)

	class Meta(BaseUserDetailsSerializer.Meta):
		fields = BaseUserDetailsSerializer.Meta.fields + (
			"public_id",
			"display_name",
			"avatar",
			"avatar_url",
			"language",
			"theme",
			"last_seen_at",
			"is_online",
			"date_joined",
		)
		read_only_fields = BaseUserDetailsSerializer.Meta.read_only_fields + (
			"public_id",
			"avatar_url",
			"last_seen_at",
			"is_online",
			"date_joined",
		)

class FriendshipSerializer(serializers.ModelSerializer):
	requester = PublicProfileSerializer(read_only=True)
	addressee = PublicProfileSerializer(read_only=True)

	class Meta:
		model = Friendship
		fields = ("id", "requester", "addressee", "status", "created_at")
		read_only_fields = fields

class FriendshipTargetSerializer(serializers.Serializer):
	username = serializers.CharField()

	def validate_username(self, username):
		try:
			target = User.objects.get(username=username)
		except User.DoesNotExist:
			raise serializers.ValidationError("No such user.")

		request = self.context["request"]

		if target.pk == request.user.pk:
			raise serializers.ValidationError("You can't do that with your own account.")

		self.target = target

		return username

class GamePlayerSerializer(serializers.ModelSerializer):
	user = PublicProfileSerializer(read_only=True)

	class Meta:
		model = GamePlayer
		fields = ("id", "user", "kind", "seat", "display_name", "is_connected", "finish_position")
		read_only_fields = fields

class GameListSerializer(serializers.ModelSerializer):
	host = PublicProfileSerializer(read_only=True)
	player_count = serializers.SerializerMethodField()

	class Meta:
		model = Game
		fields = ("public_id", "host", "status", "mode", "max_seats", "player_count", *_MODIFIER_FIELDS, "created_at")
		read_only_fields = fields

	def get_player_count(self, game):
		return game.players.count()

class GameDetailSerializer(GameListSerializer):
	players = GamePlayerSerializer(many=True, read_only=True)
	winner = PublicProfileSerializer(read_only=True)

	class Meta(GameListSerializer.Meta):
		fields = GameListSerializer.Meta.fields + ("starting_hand_size", "turn_timer_seconds", "players", "winner", "finished_at")
		read_only_fields = fields

class GameCreateSerializer(serializers.ModelSerializer):
	class Meta:
		model = Game
		fields = ("mode", "max_seats", "starting_hand_size", "turn_timer_seconds", *_MODIFIER_FIELDS)
		extra_kwargs = {"max_seats": {"default": 4}, "starting_hand_size": {"default": 7}}