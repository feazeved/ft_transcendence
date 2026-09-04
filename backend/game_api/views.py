from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from django.db import transaction

from game_engine import GameSettings
from game_engine import start_game as engine_start_game
from game_engine import state_to_dict

from .models import Friendship, FriendshipStatus, User, Game, GamePlayer, GameStatus, MODIFIER_FIELDS
from .serializers import FriendshipSerializer, FriendshipTargetSerializer, PublicProfileSerializer, GameCreateSerializer, GameDetailSerializer, GameListSerializer
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

		if game.host_id != request.user.id:
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