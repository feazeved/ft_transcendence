from allauth.account.utils import user_pk_to_url_str
from dj_rest_auth.registration.serializers import RegisterSerializer as BaseRegisterSerializer
from dj_rest_auth.serializers import PasswordResetSerializer as BasePasswordResetSerializer
from dj_rest_auth.serializers import UserDetailsSerializer as BaseUserDetailsSerializer
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework import serializers

from . import spectators
from .models import (
	Friendship, Game, GamePlayer, GameSpectator, GameStatus, ChatMessage, Conversation,
	ConversationRead, Tournament, TournamentParticipant, MODIFIER_FIELDS as _MODIFIER_FIELDS,
	tournament_converges
)

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
	# Where they are, not just whether they are here. The chat dock draws four
	# states and two of them need a room: "In a lobby · 9QTB", "In a game".
	# `is_online` stays for everything that only asks the yes/no question.
	presence = serializers.SerializerMethodField()

	class Meta:
		model = User
		fields = ("public_id", "username", "display_name", "avatar_url", "is_online", "presence", "date_joined")
		read_only_fields = fields

	def get_presence(self, user):
		from . import consumers

		# Offline first, then where. A seat row is written by the game socket and
		# can outlive its person; the presence key expires, so it is asked first.
		if not user.is_online:
			return {"status": "offline", "room_code": None}

		status, room_code = consumers.presence_state(user.pk)
		return {"status": status, "room_code": room_code}

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

class GameSpectatorSerializer(serializers.ModelSerializer):
	public_id = serializers.ReadOnlyField(source="user.public_id")
	username = serializers.ReadOnlyField(source="user.username")
	display_name = serializers.SerializerMethodField()

	class Meta:
		model = GameSpectator
		fields = ("public_id", "username", "display_name", "joined_at")
		read_only_fields = fields

	def get_display_name(self, obj):
	    return getattr(obj.user, "display_name", None) or obj.user.username

class GameListSerializer(serializers.ModelSerializer):
	host = PublicProfileSerializer(read_only=True)
	player_count = serializers.IntegerField(source='players.count', read_only=True)
	spectator_count = serializers.SerializerMethodField()

	class Meta:
		model = Game
		fields = ("public_id", "join_code", "name", "host", "status", "mode", "max_seats", "allow_spectators", "spectator_count", "player_count", *_MODIFIER_FIELDS, "created_at")
		read_only_fields = fields

	def get_spectator_count(self, game):
		# A list view reads every count in one `MGET` and puts the answers in the
		# context; one room on its own still asks directly. Without the batch a
		# page of rooms costs one Redis round trip each.
		counts = self.context.get("spectator_counts")
		if counts is not None:
			return counts.get(game.pk, 0)
		return spectators.spectator_count(game.pk)


class GameDetailSerializer(GameListSerializer):
	players = GamePlayerSerializer(many=True, read_only=True)
	spectators = GameSpectatorSerializer(many=True, read_only=True)
	winner = PublicProfileSerializer(read_only=True)

	class Meta(GameListSerializer.Meta):
		fields = GameListSerializer.Meta.fields + ("starting_hand_size", "turn_timer_seconds", "players", "spectators", "winner", "finished_at")
		read_only_fields = fields

class GameCreateSerializer(serializers.ModelSerializer):
	class Meta:
		model = Game
		fields = ("name", "mode", "max_seats", "starting_hand_size", "turn_timer_seconds", "allow_spectators", *_MODIFIER_FIELDS)
		extra_kwargs = {
			"max_seats": {"default": 4},
			"starting_hand_size": {"default": 7},
			"turn_timer_seconds": {"min_value": 10, "max_value": 300},
		}

	def create(self, validated_data):
		user = self.context["request"].user
		return Game.objects.create(host=user, **validated_data)

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
	conversation_id = serializers.IntegerField(read_only=True)

	class Meta:
		model = ChatMessage
		fields = ("id", "conversation_id", "user", "message_type", "body", "invited_game", "created_at")
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

class TournamentParticipantSerializer(serializers.ModelSerializer):
	user = PublicProfileSerializer(read_only=True)

	class Meta:
		model = TournamentParticipant
		fields = ("user", "seed", "final_position")
		read_only_fields = fields

class TournamentMatchSerializer(serializers.ModelSerializer):
	players = GamePlayerSerializer(many=True, read_only=True)
	winner = PublicProfileSerializer(read_only=True)

	class Meta:
		model = Game
		fields = ("public_id", "tournament_round", "status", "players", "winner", "finished_at")
		read_only_fields = fields

# Every setting a tournament was created with. Named once, used by all three
# serializers below, so a field cannot be accepted on create and then go missing
# from the answer — which is how the frontend would end up unable to draw the
# structure it had just asked for.
TOURNAMENT_CONFIG_FIELDS = (
	"format", "players_per_table", "advance_per_table", "starting_hand_size",
	"turn_timer_seconds", "final_best_of_3", "matches_per_round", "matches_in_final",
	*_MODIFIER_FIELDS,
)


class TournamentListSerializer(serializers.ModelSerializer):
	created_by = PublicProfileSerializer(read_only=True)
	participant_count = serializers.SerializerMethodField()
	# The short readable code, under the name the frontend reads it by. A UUID
	# cannot go in a badge or be said out loud, so `public_id` stays for links
	# that machines follow and this is the one people use.
	id = serializers.CharField(source="join_code", read_only=True)

	class Meta:
		model = Tournament
		fields = (
			"id", "public_id", "name", "created_by", "status",
			"max_participants", "participant_count", "created_at",
			*TOURNAMENT_CONFIG_FIELDS,
		)
		read_only_fields = fields

	def get_participant_count(self, tournament):
		return tournament.participants.count()

class TournamentDetailSerializer(TournamentListSerializer):
	participants = TournamentParticipantSerializer(many=True, read_only=True)
	winner = PublicProfileSerializer(read_only=True)
	rounds = serializers.SerializerMethodField()

	class Meta(TournamentListSerializer.Meta):
		fields = TournamentListSerializer.Meta.fields + ("participants", "winner", "finished_at", "rounds")
		read_only_fields = fields

	def get_rounds(self, tournament):
		matches = (tournament.games.select_related("winner").prefetch_related("players__user").order_by("tournament_round", "id"))
		grouped = {}
		for match in matches:
			grouped.setdefault(match.tournament_round, []).append(match)
		return [{"round": round_number, "matches": TournamentMatchSerializer(round_matches, many=True).data} for round_number, round_matches in sorted(grouped.items())]

class TournamentCreateSerializer(serializers.ModelSerializer):
	class Meta:
		model = Tournament
		fields = ("name", "max_participants", *TOURNAMENT_CONFIG_FIELDS)
		extra_kwargs = {field: {"required": False} for field in TOURNAMENT_CONFIG_FIELDS}

	def validate(self, attrs):
		"""
		Refuse a tournament that can never reach one final table.

		The create dialog draws this same conclusion live, from
		`computeStructure()`, and shows it as a warning instead of a preview. The
		check belongs here too: a host who ignores the warning, or anything that
		is not the dialog, would otherwise create a tournament that runs for ever.
		"""
		players = attrs.get("max_participants") or getattr(self.instance, "max_participants", 0)
		per_table = attrs.get("players_per_table", Tournament._meta.get_field("players_per_table").default)
		advance = attrs.get("advance_per_table", Tournament._meta.get_field("advance_per_table").default)

		if players and not tournament_converges(players, per_table, advance):
			raise serializers.ValidationError(
				"With this table size and this many players advancing, the tournament never "
				"reduces to a single final table."
			)
		return attrs

class LiveGameSerializer(GameListSerializer):
	pass
