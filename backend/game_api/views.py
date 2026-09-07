from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.db.models import Q, Count, Max
from django.shortcuts import get_object_or_404
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django.db import transaction

from game_engine import GameSettings
from game_engine import start_game as engine_start_game
from game_engine import state_to_dict

from .models import Friendship, FriendshipStatus, User, Game, GamePlayer, GameStatus, Conversation, Tournament, TournamentParticipant, MODIFIER_FIELDS
from .serializers import (
	FriendshipSerializer, FriendshipTargetSerializer, PublicProfileSerializer, GameCreateSerializer, GameDetailSerializer, GameListSerializer,
	LeaderboardEntrySerializer, MatchHistoryEntrySerializer, UserStatsSerializer, ChatMessageSerializer, ConversationSerializer,
	TournamentCreateSerializer, TournamentDetailSerializer, TournamentListSerializer,
)
from .consumers import broadcast_game_update as _broadcast_game_update

@ensure_csrf_cookie
def csrf(request):
	return JsonResponse({'detail': 'CSRF cookie set'})

class PublicProfileView(generics.RetrieveAPIView):
	queryset = User.objects.all()
	serializer_class = PublicProfileSerializer
	lookup_field = "public_id"


def _existing_relationship(user, target):
	return Friendship.objects.filter(
		Q(requester=user, addressee=target) | Q(requester=target, addressee=user)
	).first()


class FriendshipViewSet(viewsets.GenericViewSet):
	serializer_class = FriendshipSerializer

	def get_queryset(self):
		user = self.request.user
		return Friendship.objects.filter(Q(requester=user) | Q(addressee=user)).select_related("requester", "addressee")

	def list(self, request):
		return Response(self.get_serializer(self.get_queryset(), many=True).data)

	@action(detail=False, methods=["get"])
	def friends(self, request):
		qs = self.get_queryset().filter(status=FriendshipStatus.ACCEPTED)
		return Response(self.get_serializer(qs, many=True).data)

	@action(detail=False, methods=["get"])
	def incoming(self, request):
		qs = self.get_queryset().filter(addressee=request.user, status=FriendshipStatus.PENDING)
		return Response(self.get_serializer(qs, many=True).data)

	@action(detail=False, methods=["get"])
	def outgoing(self, request):
		qs = self.get_queryset().filter(requester=request.user, status=FriendshipStatus.PENDING)
		return Response(self.get_serializer(qs, many=True).data)

	def create(self, request):
		target_serializer = FriendshipTargetSerializer(data=request.data, context={"request": request})
		target_serializer.is_valid(raise_exception=True)
		target = target_serializer.target
		existing = _existing_relationship(request.user, target)

		if existing is not None:
			if existing.status == FriendshipStatus.BLOCKED:
				raise PermissionDenied("Can't send a friend request to this user.")
			raise ValidationError("A friendship or pending request already exists with this user.")

		friendship = Friendship.objects.create(requester=request.user, addressee=target)

		return Response(self.get_serializer(friendship).data, status=201)

	@action(detail=True, methods=["post"])
	def accept(self, request, pk=None):
		friendship = get_object_or_404(self.get_queryset(), pk=pk)

		if friendship.addressee_id != request.user.id:
			raise PermissionDenied("Only the addressee can accept a request.")
		if friendship.status != FriendshipStatus.PENDING:
			raise ValidationError("This request is no longer pending.")

		friendship.status = FriendshipStatus.ACCEPTED
		friendship.save(update_fields=["status"])

		return Response(self.get_serializer(friendship).data)

	@action(detail=True, methods=["post"])
	def decline(self, request, pk=None):
		friendship = get_object_or_404(self.get_queryset(), pk=pk)

		if friendship.addressee_id != request.user.id:
			raise PermissionDenied("Only the addressee can decline a request.")
		if friendship.status != FriendshipStatus.PENDING:
			raise ValidationError("This request is no longer pending.")

		friendship.status = FriendshipStatus.DECLINED
		friendship.save(update_fields=["status"])

		return Response(self.get_serializer(friendship).data)

	def destroy(self, request, pk=None):
		friendship = get_object_or_404(self.get_queryset(), pk=pk)
		user_id = request.user.id

		if friendship.status == FriendshipStatus.PENDING and friendship.requester_id != user_id:
			raise PermissionDenied("Only the requester can cancel a pending request.")
		if friendship.status == FriendshipStatus.BLOCKED and friendship.requester_id != user_id:
			raise PermissionDenied("Only the person who blocked this user can undo it.")

		friendship.delete()

		return Response(status=204)

	@action(detail=False, methods=["post"])
	def block(self, request):
		target_serializer = FriendshipTargetSerializer(data=request.data, context={"request": request})
		target_serializer.is_valid(raise_exception=True)
		target = target_serializer.target
		existing = _existing_relationship(request.user, target)

		if existing is not None:
			existing.requester = request.user
			existing.addressee = target
			existing.status = FriendshipStatus.BLOCKED
			existing.save(update_fields=["requester", "addressee", "status"])
			friendship = existing
		else:
			friendship = Friendship.objects.create(
				requester=request.user, addressee=target, status=FriendshipStatus.BLOCKED
			)
		return Response(self.get_serializer(friendship).data)

class GameViewSet(viewsets.GenericViewSet):
	queryset = Game.objects.all()
	lookup_field = "public_id"

	def get_serializer_class(self):
		if self.action == "create":
			return GameCreateSerializer
		if self.action == "list":
			return GameListSerializer
		return GameDetailSerializer

	def get_queryset(self):
		return Game.objects.select_related("host", "winner").prefetch_related("players__user")

	def list(self, request):
		games = [g for g in self.get_queryset().filter(status=GameStatus.PENDING) if g.players.count() < g.max_seats]
		return Response(GameListSerializer(games, many=True).data)

	def retrieve(self, request, public_id=None):
		game =get_object_or_404(self.get_queryset(), public_id=public_id)
		return Response(GameDetailSerializer(game).data)

	def create(self, request):
		create_serializer = GameCreateSerializer(data=request.data)
		create_serializer.is_valid(raise_exception=True)
		game = create_serializer.save(host=request.user)

		GamePlayer.objects.create(game=game, user=request.user, seat=0, display_name=request.user.display_name or request.user.username)
		return Response(GameDetailSerializer(game).data, status=201)

	@action(detail=True, methods=["post"])
	def join(self, request, public_id=None):
		with transaction.atomic():
			game = get_object_or_404(Game.objects.select_for_update(), public_id=public_id)

			if game.status != GameStatus.PENDING:
				raise ValidationError("This game has already started or finished.")
			if GamePlayer.objects.filter(game=game, user=request.user).exists():
				raise ValidationError("You're already in this game.")

			seat_count = game.players.count()
			if seat_count >= game.max_seats:
				raise ValidationError("This game is full")

			GamePlayer.objects.create(game=game, user=request.user, seat=seat_count, display_name=request.user.display_name or request.user.username)
		_broadcast_game_update(game)
		return Response(GameDetailSerializer(self.get_queryset().get(pk=game.pk)).data)

	@action(detail=True, methods=["post"])
	def leave(self, request, public_id=None):
		game = get_object_or_404(Game, public_id=public_id)

		if game.status != GameStatus.PENDING:
			raise ValidationError("Can't leave a game that has already started.")
		
		deleted, _ = GamePlayer.objects.filter(game=game, user=request.user).delete()
		if deleted == 0:
			raise ValidationError("You're not in this game.")

		if game.host_id == request.user.id:
			next_up = GamePlayer.objects.filter(game=game).order_by("seat").first()
			if next_up is not None:
				game.host = next_up.user
			else:
				game.status = GameStatus.CANCELLED
			game.save(update_fields=["host", "status"])

		_broadcast_game_update(game)
		return Response(status=204)

	@action(detail=True, methods=["post"])
	def start(self, request, public_id=None):
		game = get_object_or_404(Game, public_id=public_id)

		if game.tournament_id is not None:
			if not GamePlayer.objects.filter(game=game, user=request.user).exists():
				raise PermissionDenied("Only participants in this match can start it.")
		elif game.host_id != request.user.id:
			raise PermissionDenied("Only the host can start the game.")
		if game.status != GameStatus.PENDING:
			raise ValidationError("This game has already started or finished.")

		players = list(GamePlayer.objects.filter(game=game).select_related("user").order_by("seat"))
		if len(players) < 2:
			raise ValidationError("Need at least 2 players to start.")

		enabled_modifiers = frozenset(name for name in MODIFIER_FIELDS if getattr(game, name))
		engine_players = [(str(gp.pk), gp.display_name or (gp.user.username if gp.user else "Player")) for gp in players]
		new_state = engine_start_game(engine_players, settings=GameSettings(enabled_modifiers=enabled_modifiers), hand_size=game.starting_hand_size)

		game.state = state_to_dict(new_state)
		game.status = GameStatus.IN_PROGRESS
		game.save(update_fields=["state", "status"])

		_broadcast_game_update(game)
		return Response(GameDetailSerializer(self.get_queryset().get(pk=game.pk)).data)

class StatsPagination(PageNumberPagination):
	page_size = 20
	max_page_size = 100
	page_size_query_param = "page_size"

class MatchHistoryView(generics.ListAPIView):
	serializer_class = MatchHistoryEntrySerializer
	pagination_class = StatsPagination

	def _viewed_user(self):
		if not hasattr(self, "_viewed_user_cache"):
			self._viewed_user_cache = get_object_or_404(User, public_id=self.kwargs["public_id"])
		return self._viewed_user_cache

	def get_queryset(self):
		user = self._viewed_user()
		return (Game.objects.filter(players__user=user, status=GameStatus.FINISHED).select_related("winner").prefetch_related("players__user").order_by("-finished_at").distinct())

	def get_serializer_context(self):
		context = super().get_serializer_context()
		context["viewed_user"] = self._viewed_user()
		return context

class UserStatsView(generics.RetrieveAPIView):
	queryset = User.objects.all()
	serializer_class = UserStatsSerializer
	lookup_field = "public_id"

class LeaderboardView(generics.ListAPIView):
	serializer_class = LeaderboardEntrySerializer
	pagination_class = StatsPagination

	def get_queryset(self):
		return (
			User.objects.annotate(
				games_played_count=Count(
					"game_seats", filter=Q(game_seats__game__status=GameStatus.FINISHED), distinct=True
				),
				games_won_count=Count("games_won", distinct=True),
			)
			.filter(games_played_count__gt=0)
			.order_by("-games_won_count", "-games_played_count", "username")
		)

class ConversationListView(generics.ListAPIView):
	serializer_class = ConversationSerializer
	pagination_class = StatsPagination

	def get_queryset(self):
		user = self.request.user
		return (
			Conversation.objects.filter(Q(user_a=user) | Q(user_b=user))
			.select_related("user_a", "user_b")
			.annotate(last_message_at=Max("messages__created_at"))
			.order_by("-last_message_at")
		)


class ConversationMessagesView(generics.ListAPIView):
	serializer_class = ChatMessageSerializer
	pagination_class = StatsPagination

	def get_conversation(self):
		if not hasattr(self, "_conversation_cache"):
			conversation = get_object_or_404(Conversation, pk=self.kwargs["conversation_id"])
			user = self.request.user
			if user.pk not in (conversation.user_a_id, conversation.user_b_id):
				raise PermissionDenied("Not your conversation.")
			self._conversation_cache = conversation
		return self._conversation_cache

	def get_queryset(self):
		return (
			self.get_conversation().messages
			.select_related("user", "invited_game", "invited_game__host")
			.order_by("-created_at")
		)


class GameChatHistoryView(generics.ListAPIView):
	serializer_class = ChatMessageSerializer
	pagination_class = StatsPagination

	def get_queryset(self):
		game = get_object_or_404(Game, public_id=self.kwargs["public_id"])
		if not GamePlayer.objects.filter(game=game, user=self.request.user).exists():
			raise PermissionDenied("Not a participant in this game.")
		return game.chat_messages.select_related("user").order_by("-created_at")

class TournamentViewSet(viewsets.GenericViewSet):
	queryset = Tournament.objects.all()
	lookup_field = "public_id"

	def get_serializer_class(self):
		if self.action == "create":
			return TournamentCreateSerializer
		if self.action == "list":
			return TournamentListSerializer
		return TournamentDetailSerializer

	def get_queryset(self):
		return Tournament.objects.select_related("created_by", "winner").prefetch_related("participants__user", "games__players__user", "games__winner")

	def list(self, request):
		tournaments = self.get_queryset().filter(status=GameStatus.PENDING)
		return Response(TournamentListSerializer(tournaments, many=True).data)

	def retrieve(self, request, public_id=None):
		tournament = get_object_or_404(self.get_queryset(), public_id=public_id)
		return Response(TournamentDetailSerializer(tournament).data)

	def create(self, request):
		create_serializer = TournamentCreateSerializer(data=request.data)
		create_serializer.is_valid(raise_exception=True)
		tournament = create_serializer.save(created_by=request.user)
		TournamentParticipant.objects.create(tournament=tournament, user=request.user)
		return Response(TournamentDetailSerializer(self.get_queryset().get(pk=tournament.pk)).data, status=201)

	@action(detail=True, methods=["post"])
	def register(self, request, public_id=None):
		with transaction.atomic():
			tournament = get_object_or_404(Tournament.objects.select_for_update(), public_id=public_id)
			if tournament.status != GameStatus.PENDING:
				raise ValidationError("Registration is closed.")
			if TournamentParticipant.objects.filter(tournament=tournament, user=request.user).exists():
				raise ValidationError("Already registered.")
			if tournament.participants.count() >= tournament.max_participants:
				raise ValidationError("Tournament is full.")
			TournamentParticipant.objects.create(tournament=tournament, user=request.user)
		return Response(TournamentDetailSerializer(self.get_queryset().get(pk=tournament.pk)).data)

	@action(detail=True, methods=["post"])
	def unregister(self, request, public_id=None):
		tournament = get_object_or_404(Tournament, public_id=public_id)
		if tournament.status != GameStatus.PENDING:
			raise ValidationError("Can't leave a tournament that has already started.")
		deleted, _ = TournamentParticipant.objects.filter(tournament=tournament, user=request.user).delete()
		if deleted == 0:
			raise ValidationError("You're not registered for this tournament.")
		return Response(status=204)

	@action(detail=True, methods=["post"])
	def start(self, request, public_id=None):
		tournament = get_object_or_404(Tournament, public_id=public_id)
		if tournament.created_by_id != request.user.id:
			raise PermissionDenied("Only the creator can start the tournament.")
		if tournament.status != GameStatus.PENDING:
			raise ValidationError("This tournament has already started or finished.")
		if tournament.participants.count() < 2:
			raise ValidationError("Need at least 2 participants to start.")

		tournament.start()
		return Response(TournamentDetailSerializer(self.get_queryset().get(pk=tournament.pk)).data)