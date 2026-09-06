from allauth.account.utils import user_pk_to_url_str
from dj_rest_auth.registration.serializers import RegisterSerializer as BaseRegisterSerializer
from dj_rest_auth.serializers import PasswordResetSerializer as BasePasswordResetSerializer
from dj_rest_auth.serializers import UserDetailsSerializer as BaseUserDetailsSerializer
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import serializers

from .models import Friendship, Game, GamePlayer, GameStatus, ChatMessage, Conversation, ConversationRead, MODIFIER_FIELDS as _MODIFIER_FIELDS

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

class MatchHistoryEntrySerializer(serializers.ModelSerializer):
	players = GamePlayerSerializer(many=True, read_only=True)
	winner = PublicProfileSerializer(read_only=True)
	won = serializers.SerializerMethodField()

	class Meta:
		model = Game
		fields = ("public_id", "mode", "players", "winner", "won", "finished_at", *_MODIFIER_FIELDS)
		read_only_fields = fields

	def get_won(self, game):
		return game.winner_id == self.context["viewed_user"].id

class UserStatsSerializer(serializers.Serializer):
	def to_representation(self, user):
		played = user.game_seats.filter(game__status=GameStatus.FINISHED).count()
		won = user.games_won.count()
		return {
			"games_played": played,
			"games_won": won,
			"games_lost": played - won,
			"win_rate": round(won / played * 100, 1) if played > 0 else 0.0
		}

class LeaderboardEntrySerializer(serializers.ModelSerializer):
	games_played = serializers.IntegerField(source="games_played_count")
	games_won = serializers.IntegerField(source="games_won_count")
	win_rate = serializers.SerializerMethodField()

	class Meta:
		model = User
		fields = ("public_id", "username", "display_name", "avatar_url", "games_played", "games_won", "win_rate")
		read_only_fields = fields

	def get_win_rate(self, user):
		if user.games_played_count == 0:
			return 0.0
		return round(user.games_won_count / user.games_played_count * 100, 1)

class ChatMessageSerializer(serializers.ModelSerializer):
	user = PublicProfileSerializer(read_only=True)
	invited_game = GameListSerializer(read_only=True)

	class Meta:
		model = ChatMessage
		fields = ("id", "user", "message_type", "body", "invited_game", "created_at")
		read_only_fields = fields


class ConversationSerializer(serializers.ModelSerializer):
	other_participant = serializers.SerializerMethodField()
	last_message = serializers.SerializerMethodField()
	unread_count = serializers.SerializerMethodField()

	class Meta:
		model = Conversation
		fields = ("id", "other_participant", "last_message", "unread_count", "created_at")
		read_only_fields = fields

	def get_other_participant(self, conversation):
		me = self.context["request"].user
		return PublicProfileSerializer(conversation.other_participant(me)).data

	def get_last_message(self, conversation):
		last = conversation.messages.order_by("-created_at").first()
		return ChatMessageSerializer(last).data if last else None

	def get_unread_count(self, conversation):
		me = self.context["request"].user
		read_state = conversation.read_states.filter(user=me).first()
		unread = conversation.messages.exclude(user=me)
		if read_state is not None:
			unread = unread.filter(created_at__gt=read_state.last_read_at)
		return unread.count()