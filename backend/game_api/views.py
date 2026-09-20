import uuid
from io import BytesIO
from pathlib import Path
from django.conf import settings as django_settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.http import FileResponse, JsonResponse, Http404
from django.views.decorators.csrf import ensure_csrf_cookie
from django.db.models import Q, Count, Max, F, FloatField, Value
from django.db.models.functions import Cast, Coalesce, NullIf
from django.shortcuts import get_object_or_404
from django.db import connection, transaction
from django.utils import timezone
from rest_framework import generics, viewsets, status
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny

from game_engine import GameSettings
from game_engine import start_game as engine_start_game
from game_engine import state_to_dict

from . import spectators
from .models import Friendship, FriendshipStatus, StoredFile, User, Game, GamePlayer, GameSpectator, GameStatus, Conversation, Tournament, TournamentParticipant, MODIFIER_FIELDS, generate_code
from .serializers import (
	FriendshipSerializer, FriendshipTargetSerializer, PublicProfileSerializer, GameCreateSerializer, GameDetailSerializer, GameListSerializer,
	LeaderboardEntrySerializer, MatchHistoryEntrySerializer, UserStatsSerializer, ChatMessageSerializer, ConversationSerializer,
	TournamentCreateSerializer, TournamentDetailSerializer, TournamentListSerializer, LiveGameSerializer,
)
from .consumers import broadcast_game_update as _broadcast_game_update, broadcast_presence, leave_pending_game, log_event, notify_friendship_change, schedule_turn_expiry

@ensure_csrf_cookie
def csrf(request):
	return JsonResponse({'detail': 'CSRF cookie set'})


def healthz(request):
	try:
		with connection.cursor() as cursor:
			cursor.execute('SELECT 1')
	except Exception:
		return JsonResponse({'status': 'error'}, status=503)
	return JsonResponse({'status': 'ok'})


def media_file(request, path):
	"""An uploaded file, out of the database.

	What `django.views.static.serve` did for MEDIA_ROOT, for files that are no
	longer on a disk (game_api/storage.py).
	"""
	stored = get_object_or_404(StoredFile, name=path)
	response = FileResponse(
		# psycopg2 hands bytea back as a memoryview; sqlite hands back bytes.
		BytesIO(bytes(stored.content)),
		content_type=stored.content_type or 'application/octet-stream',
	)
	response['Content-Length'] = stored.size
	# A day, not a year: a name is only taken once while its row exists, so it
	# could in principle come back meaning something else, and a year-long cache
	# of the wrong face is not a thing anybody can clear.
	response['Cache-Control'] = 'public, max-age=86400'
	return response


def spa_index(request):
	"""The built index.html, for every client-side route.

	The app is one document and the router decides which screen it draws, so
	/friends, /profile/42 and a room code all get the same file back. Only
	reachable where the app is served from here (settings.FRONTEND_DIST) —
	core/urls.py leaves the route out otherwise.
	"""
	index = Path(django_settings.FRONTEND_DIST) / 'index.html'
	response = FileResponse(index.open('rb'), content_type='text/html; charset=utf-8')
	# The filenames this document points at carry a hash and are cached for ever,
	# so this is the one file a deploy has to be able to replace.
	response['Cache-Control'] = 'no-cache'
	return response

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
			# A declining used to leave its row behind, and every database still
			# holds the ones made before `decline` started deleting them. Clearing
			# it here means those two people are not stuck for ever waiting on a
			# migration that may never be run against their data.
			if existing.status == FriendshipStatus.DECLINED:
				existing.delete()
			else:
				raise ValidationError("A friendship or pending request already exists with this user.")

		friendship = Friendship.objects.create(requester=request.user, addressee=target)
		transaction.on_commit(lambda: notify_friendship_change(target.pk))

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
		transaction.on_commit(lambda: notify_friendship_change(friendship.requester_id))

		return Response(self.get_serializer(friendship).data)

	@action(detail=True, methods=["post"])
	def decline(self, request, pk=None):
		friendship = get_object_or_404(self.get_queryset(), pk=pk)

		if friendship.addressee_id != request.user.id:
			raise PermissionDenied("Only the addressee can decline a request.")
		if friendship.status != FriendshipStatus.PENDING:
			raise ValidationError("This request is no longer pending.")

		# The row goes, rather than being kept as DECLINED.
		#
		# A kept row was a dead end for both people, for good: `create` refuses
		# any new request while *any* row exists between two users, in either
		# direction, and the Friends page never lists declined rows — so neither
		# of them could see the thing that was in the way, let alone clear it.
		# Saying no once meant never again, which is not what saying no means.
		#
		# Serialized before the delete, because the answer still describes the
		# request that was declined and the instance loses its pk on the way out.
		data = self.get_serializer(friendship).data
		requester_id = friendship.requester_id
		friendship.delete()
		transaction.on_commit(lambda: notify_friendship_change(requester_id))

		return Response(data)

	def destroy(self, request, pk=None):
		friendship = get_object_or_404(self.get_queryset(), pk=pk)
		user_id = request.user.id

		if friendship.status == FriendshipStatus.PENDING and friendship.requester_id != user_id:
			raise PermissionDenied("Only the requester can cancel a pending request.")
		if friendship.status == FriendshipStatus.BLOCKED and friendship.requester_id != user_id:
			raise PermissionDenied("Only the person who blocked this user can undo it.")

		other_id = friendship.addressee_id if friendship.requester_id == user_id else friendship.requester_id
		friendship.delete()
		transaction.on_commit(lambda: notify_friendship_change(other_id))

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
		# The blocked person's own friends list just changed, so poke them too.
		# This does not leak the block: their list simply loses the person, which
		# is what an ordinary unfriend looks like as well, and is what they would
		# have seen on their next load anyway.
		transaction.on_commit(lambda: notify_friendship_change(target.pk))
		return Response(self.get_serializer(friendship).data)

class GameViewSet(viewsets.GenericViewSet):
	queryset = Game.objects.all()
	lookup_field = "code"

	# Browsing is public; everything else needs an account. Home shows its open
	# rooms to a visitor and only sends them to Login when they act on one
	# (spec "Sign-in and guests"), so a blanket IsAuthenticated answered 403 to
	# the one request the page is built around and the section read
	# "Couldn't load the rooms."
	PUBLIC_ACTIONS = ("list", "live")

	def get_permissions(self):
		if self.action in self.PUBLIC_ACTIONS:
			return [AllowAny()]
		return super().get_permissions()

	def get_serializer_class(self):
		if self.action == "create":
			return GameCreateSerializer
		if self.action == "list":
			return GameListSerializer
		return GameDetailSerializer

	def get_queryset(self):
		return Game.objects.all()

	def _resolve(self, code, select_for_update=False):
		qs = self.get_queryset()
		if select_for_update:
			qs = qs.select_for_update()

		try:
			return Game._resolve(code, queryset=qs)
		except Game.DoesNotExist:
			raise Http404


	def list(self, request):
		games = [g for g in self.get_queryset().filter(status=GameStatus.PENDING) if g.players.count() < g.max_seats]
		context = {"spectator_counts": spectators.spectator_counts([g.pk for g in games])}
		return Response(GameListSerializer(games, many=True, context=context).data)

	def retrieve(self, request, code=None):
		game = self._resolve(code)
		return Response(GameDetailSerializer(game, context={'request': request}).data)

	def create(self, request, *args, **kwargs):
		serializer = GameCreateSerializer(data=request.data, context={'request': request})
		serializer.is_valid(raise_exception=True)
		game = serializer.save()

		GamePlayer.objects.create(game=game, user=request.user, seat=0, display_name=getattr(request.user, 'display_name', None) or request.user.username)
		return Response(GameDetailSerializer(game, context={'request': request}).data, status=201)

	@action(detail=True, methods=["post"])
	def join(self, request, code=None):
		with transaction.atomic():
			game = self._resolve(code, select_for_update=True)

			if game.status != GameStatus.PENDING:
				raise ValidationError("This game has already started or finished.")
			if GamePlayer.objects.filter(game=game, user=request.user).exists():
				raise ValidationError("You're already in this game as a player.")
			taken = set(game.players.values_list("seat", flat=True))
			seat = next((i for i in range(game.max_seats) if i not in taken), None)
			if seat is None:
				raise ValidationError("This game is full")

			GamePlayer.objects.create(game=game, user=request.user, seat=seat, display_name=getattr(request.user, 'display_name', None) or request.user.username)
		_broadcast_game_update(game)
		fresh_game = self.get_queryset().get(pk=game.pk)
		return Response(GameDetailSerializer(fresh_game, context={'request': request}).data)

	@action(detail=True, methods=["post"])
	def seat(self, request, code=None):
		"""
		Take free seat `index`: `POST /games/<code>/seat/` with `{"index": 2}`.

		Until this existed the Lobby's "Sit here" was a 404, and `join` handing
		out the lowest free seat was the only way anybody was ever seated — so
		nobody could choose where to sit, move once seated, or come down from
		the spectators into a seat that had opened up.

		One endpoint covers all three, because from the room's point of view they
		are the same move: whoever you are, you end up in seat `index`, and
		whatever you were before is undone.
		"""
		index = request.data.get("index")
		# A bool is an int in Python, and `int(True)` is 1 — which would quietly
		# seat somebody rather than telling them the request was wrong.
		if isinstance(index, bool):
			raise ValidationError("Seat index must be a number.")
		try:
			index = int(index)
		except (TypeError, ValueError):
			raise ValidationError("Seat index must be a number.")

		with transaction.atomic():
			game = self._resolve(code, select_for_update=True)

			if game.status != GameStatus.PENDING:
				raise ValidationError("This game has already started or finished.")
			if not 0 <= index < game.max_seats:
				raise ValidationError(f"This room has seats 0 to {game.max_seats - 1}.")

			occupant = GamePlayer.objects.filter(game=game, seat=index).first()
			if occupant is not None and occupant.user_id != request.user.id:
				raise ValidationError("Somebody is already sitting there.")

			mine = GamePlayer.objects.filter(game=game, user=request.user).first()
			if mine is not None:
				# Already seated: move across. Asking for the seat you are in is
				# not an error, it is a no-op — two people racing for the same
				# free seat should leave the winner seated, not holding an error.
				if mine.seat != index:
					mine.seat = index
					mine.save(update_fields=["seat"])
			else:
				GamePlayer.objects.create(
					game=game, user=request.user, seat=index,
					display_name=getattr(request.user, "display_name", None) or request.user.username,
				)
				# Coming down from the stands: stop being a spectator, or the
				# room would count the same person twice.
				GameSpectator.objects.filter(game=game, user=request.user).delete()

		_broadcast_game_update(game)
		fresh_game = self.get_queryset().get(pk=game.pk)
		return Response(GameDetailSerializer(fresh_game, context={'request': request}).data)

	@action(detail=True, methods=["post"])
	def spectate(self, request, code=None):
		with transaction.atomic():
			game = self._resolve(code, select_for_update=True)

			if game.status in (GameStatus.CANCELLED, GameStatus.FINISHED):
				raise ValidationError("Cannot spectate a cancelled or finished game.")
			if GameSpectator.objects.filter(game=game, user=request.user).exists():
				raise ValidationError("You're already spectating in this game.")
			# The socket has always refused a spectator on a room that does not
			# allow them (`GameConsumer.connect`); this endpoint did not, so the
			# two disagreed about the same room.
			if not game.allow_spectators:
				raise ValidationError("This room doesn't allow spectators.")
			# §1.4. Counted on the `GameSpectator` roster, which is also what the
			# lobby message lists, so the limit and the names on screen are the
			# same set — the Redis counter counts sockets and is a different
			# question.
			if GameSpectator.objects.filter(game=game).count() >= django_settings.GAME_MAX_SPECTATORS:
				raise ValidationError(f"This room already has {django_settings.GAME_MAX_SPECTATORS} people watching.")

			# §1.3: a seated player giving up their seat to watch instead. It used
			# to be refused outright with "You're already playing in this game."
			mine = GamePlayer.objects.filter(game=game, user=request.user).first()
			if mine is not None:
				if game.status != GameStatus.PENDING:
					raise ValidationError("Can't leave your seat once the game has started.")
				# `leave_pending_game` hands the host on to the next seat, so the
				# host may watch too — but it also closes a room with nobody left
				# in it, and a room that closed is not one you can go on watching.
				if GamePlayer.objects.filter(game=game).count() == 1:
					raise ValidationError("You're the only player — there would be no room left to watch.")
				leave_pending_game(game, mine)

			GameSpectator.objects.create(game=game, user=request.user)

		_broadcast_game_update(game)
		fresh_game = self.get_queryset().get(pk=game.pk)
		return Response(GameDetailSerializer(fresh_game, context={'request': request}).data)

	@action(detail=True, methods=["post"])
	def leave(self, request, code=None):
		with transaction.atomic():
			game = self._resolve(code, select_for_update=True)

			if game.status not in (GameStatus.PENDING, GameStatus.IN_PROGRESS):
				raise ValidationError("This game is already over.")

			try:
				game_player = GamePlayer.objects.get(game=game, user=request.user)
			except GamePlayer.DoesNotExist:
				raise ValidationError("You're not in this game.")

			if game.status == GameStatus.PENDING:
				# Nothing has been dealt, so the seat simply goes.
				leave_pending_game(game, game_player)
			else:
				# §2.6. Mid-game the seat *stays*: the hand has been dealt, the
				# match history and the leaderboard both read these rows, and the
				# engine has no way to take a player out of the turn order without
				# invalidating `current_player_index` and losing their cards.
				#
				# So leaving means going quiet, and the turn timer carries the
				# game past them — which only became true with §2.4. Before that
				# an absent player stalled the table for everyone, which is why
				# this used to be refused outright.
				GamePlayer.objects.filter(pk=game_player.pk).update(is_connected=False)

		_broadcast_game_update(game)
		return Response(status=status.HTTP_204_NO_CONTENT)

	@action(detail=True, methods=["post"])
	def leave_spectate(self, request, code=None):
		with transaction.atomic():
			game = self._resolve(code, select_for_update=True)
			deleted, _ = GameSpectator.objects.filter(game=game, user=request.user).delete()
			if deleted == 0:
				raise ValidationError("You are not spectating this game.")
		_broadcast_game_update(game)
		return Response(status=status.HTTP_204_NO_CONTENT)

	@action(detail=True, methods=["post"])
	def rematch(self, request, code=None):
		"""
		Reopen a finished room: `POST /games/<code>/rematch/`.

		The same people, the same settings and the same code, in a fresh pending
		lobby the host can start again.

		**A new row, never the finished one reset.** The leaderboard and the match
		history both count `game_seats__game__status=FINISHED`, so reusing the row
		would quietly erase the result that was just played for. The players and
		spectators are therefore *copied* across, not moved — the finished game
		keeps its own rows and stays in everybody's history.

		**Asked for, not automatic.** Reopening every room the moment its game
		ended would leave a pending room behind for every game ever finished,
		listed on Home, with players in it who are not there — and nothing to
		clean them up, because the grace period only fires for a socket that
		disconnects from *that* room, and nobody ever connected to it. So the
		room is built the first time somebody asks for one.
		"""
		with transaction.atomic():
			game = self._resolve(code, select_for_update=True)

			# Somebody got here first: the code already points at the new lobby,
			# so this is the answer rather than an error. That makes the button
			# safe to press by four people at once.
			if game.status == GameStatus.PENDING:
				return Response(GameDetailSerializer(game, context={'request': request}).data)
			if game.status != GameStatus.FINISHED:
				raise ValidationError("This game is still being played.")

			was_here = (
				GamePlayer.objects.filter(game=game, user=request.user).exists()
				or GameSpectator.objects.filter(game=game, user=request.user).exists()
			)
			if not was_here:
				raise PermissionDenied("You weren't in this game.")

			old_code = game.join_code
			# `join_code` is unique, so the finished game has to let go of it
			# first. It stays reachable by `public_id`, which is what history
			# links use.
			game.join_code = generate_code()
			game.save(update_fields=["join_code"])

			rematch = Game.objects.create(
				host=game.host, name=game.name, join_code=old_code, mode=game.mode,
				max_seats=game.max_seats, starting_hand_size=game.starting_hand_size,
				turn_timer_seconds=game.turn_timer_seconds, allow_spectators=game.allow_spectators,
				status=GameStatus.PENDING,
				**{field: getattr(game, field) for field in MODIFIER_FIELDS},
			)

			# Seats keep their numbers, so the table looks the way it did. A seat
			# whose account has since been deleted is not carried over — there is
			# nobody to carry.
			GamePlayer.objects.bulk_create([
				GamePlayer(
					game=rematch, user=player.user, seat=player.seat,
					kind=player.kind, ai_level=player.ai_level,
					display_name=player.display_name, is_connected=False,
				)
				for player in GamePlayer.objects.filter(game=game).select_related("user")
				if player.user_id is not None
			])
			GameSpectator.objects.bulk_create([
				GameSpectator(game=rematch, user=watcher.user)
				for watcher in GameSpectator.objects.filter(game=game).select_related("user")
			])

		_broadcast_game_update(game)
		fresh = self.get_queryset().get(pk=rematch.pk)
		return Response(GameDetailSerializer(fresh, context={'request': request}).data)

	@action(detail=True, methods=["post"])
	def start(self, request, code=None):
		game = self._resolve(code)

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
		game.turn_started_at = timezone.now()
		# `turn_started_at` belongs in this list. Leaving it out assigned the
		# field and then quietly declined to write it, so the first turn of every
		# game had no start time: the countdown never appeared, and the turn
		# could not expire either, because the expiry gives up on a null.
		game.save(update_fields=["state", "status", "turn_started_at"])

		if game.tournament_id is not None:
			log_event(game, f"Round {game.tournament_round} of {game.tournament.name}.")
		log_event(game, "The game has started.")

		# Hand the game to a watcher so a turn runs out even while everybody is
		# waiting politely for the player who walked away.
		schedule_turn_expiry(game.pk)

		# Everyone at this table just moved from "In a lobby" to "In a game".
		for user_id in GamePlayer.objects.filter(game=game).values_list("user_id", flat=True):
			if user_id is not None:
				broadcast_presence(user_id)

		_broadcast_game_update(game)
		fresh_game = self.get_queryset().get(pk=game.pk)
		return Response(GameDetailSerializer(fresh_game, context={'request': request}).data)

	@action(detail=False, methods=["get"])
	def live(self, request):
		games = list(self.get_queryset().filter(status=GameStatus.IN_PROGRESS))
		context = {"spectator_counts": spectators.spectator_counts([g.pk for g in games])}
		return Response(LiveGameSerializer(games, many=True, context=context).data)

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
	# Public: Home draws the top five for everyone, signed in or not.
	permission_classes = [AllowAny]
	serializer_class = LeaderboardEntrySerializer
	pagination_class = StatsPagination

	# `?ordering=` — the three the design's sort buttons offer, always highest
	# first. Sorting has to happen here, over the whole table, because the page
	# only ever holds 25 rows: sorting those would put the right 25 people in a
	# different order and call it a ranking. The buttons have been sending this
	# parameter since the redesign; until now the server ignored it, so the
	# ranking quietly disagreed with the button that was lit.
	#
	# Ties break by wins and then username, so the order is total — without a
	# last unique key, two players with equal stats can swap places between
	# pages and appear twice or not at all.
	ORDERINGS = {
		"wins": ("-games_won_count", "-games_played_count", "username"),
		"win_rate": ("-win_rate_value", "-games_won_count", "username"),
		"games": ("-games_played_count", "-games_won_count", "username"),
	}
	DEFAULT_ORDERING = "wins"

	def get_queryset(self):
		ordering = self.request.query_params.get("ordering", self.DEFAULT_ORDERING)
		# An unknown value falls back rather than failing: a cached client can be
		# a version behind, and a leaderboard in the default order beats an error
		# page. The three the buttons send are all honoured, which is the point.
		fields = self.ORDERINGS.get(ordering, self.ORDERINGS[self.DEFAULT_ORDERING])

		return (
			User.objects.filter(is_active=True, deleted_at__isnull=True)
			.annotate(
				games_played_count=Count(
					"game_seats", filter=Q(game_seats__game__status=GameStatus.FINISHED), distinct=True
				),
				games_won_count=Count("games_won", distinct=True),
			)
			.annotate(
				# The same number the serializer shows, computed in the database
				# so it can be sorted on. NullIf turns nought games played into
				# NULL, the division into NULL, and Coalesce into 0.0 — which is
				# how someone who has never played sorts last instead of crashing
				# the query.
				win_rate_value=Coalesce(
					Cast(F("games_won_count"), FloatField()) / Cast(NullIf(F("games_played_count"), 0), FloatField()),
					Value(0.0),
					output_field=FloatField(),
				),
			)
			.order_by(*fields)
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
		is_player = GamePlayer.objects.filter(game=game, user=self.request.user).exists()
		is_spectator = GameSpectator.objects.filter(game=game, user=self.request.user).exists()
		if not (is_player or is_spectator):
			raise PermissionDenied("Not a participant or spectator in this game.")
		return game.chat_messages.select_related("user").order_by("-created_at")

class TournamentViewSet(viewsets.GenericViewSet):
	# Same rule as the rooms: looking is public, joining and creating are not.
	# A tournament link is meant to be pasted to people, so `retrieve` is open
	# too — the Join button is what asks a guest to sign in.
	PUBLIC_ACTIONS = ("list", "retrieve")

	def get_permissions(self):
		if self.action in self.PUBLIC_ACTIONS:
			return [AllowAny()]
		return super().get_permissions()

	queryset = Tournament.objects.all()
	# Looked up by the short readable code, the same way a room is. `public_id`
	# still resolves, so links made before the code existed keep working.
	lookup_field = "code"

	def get_serializer_class(self):
		if self.action == "create":
			return TournamentCreateSerializer
		if self.action == "list":
			return TournamentListSerializer
		return TournamentDetailSerializer

	def get_queryset(self):
		return Tournament.objects.select_related("created_by", "winner").prefetch_related("participants__user", "games__players__user", "games__winner")

	def _resolve(self, code, select_for_update=False):
		qs = Tournament.objects.select_for_update() if select_for_update else self.get_queryset()
		try:
			return qs.get(join_code__iexact=code)
		except Tournament.DoesNotExist:
			pass
		try:
			return qs.get(public_id=code)
		except (Tournament.DoesNotExist, ValueError, DjangoValidationError):
			raise Http404

	def _detail(self, tournament):
		return Response(TournamentDetailSerializer(self.get_queryset().get(pk=tournament.pk)).data)

	def list(self, request):
		# Every tournament, whatever its status.
		#
		# This used to answer only PENDING ones, which quietly emptied two
		# screens: the list draws all four statuses each in its own colour, a
		# finished tournament is the only place the podium can be reached from,
		# and `home/TournamentBanner.jsx` looks for one that is `in_progress` —
		# so the LIVE TOURNAMENT banner could never appear again, with nothing
		# anywhere to say why. A caller wanting a narrower list should ask for
		# it, rather than be handed one it cannot see.
		tournaments = self.get_queryset().order_by("-created_at")
		return Response(TournamentListSerializer(tournaments, many=True).data)

	def retrieve(self, request, code=None):
		return Response(TournamentDetailSerializer(self._resolve(code), context={'request': request}).data)

	def create(self, request):
		create_serializer = TournamentCreateSerializer(data=request.data)
		create_serializer.is_valid(raise_exception=True)
		tournament = create_serializer.save(created_by=request.user)
		TournamentParticipant.objects.create(tournament=tournament, user=request.user)
		return Response(TournamentDetailSerializer(self.get_queryset().get(pk=tournament.pk)).data, status=201)

	@action(detail=True, methods=["post"])
	def register(self, request, code=None):
		with transaction.atomic():
			tournament = self._resolve(code, select_for_update=True)
			if tournament.status != GameStatus.PENDING:
				raise ValidationError("Registration is closed.")
			if TournamentParticipant.objects.filter(tournament=tournament, user=request.user).exists():
				raise ValidationError("Already registered.")
			if tournament.participants.count() >= tournament.max_participants:
				raise ValidationError("Tournament is full.")
			TournamentParticipant.objects.create(tournament=tournament, user=request.user)
		return self._detail(tournament)

	@action(detail=True, methods=["post"])
	def unregister(self, request, code=None):
		tournament = self._resolve(code)
		if tournament.status != GameStatus.PENDING:
			raise ValidationError("Can't leave a tournament that has already started.")
		deleted, _ = TournamentParticipant.objects.filter(tournament=tournament, user=request.user).delete()
		if deleted == 0:
			raise ValidationError("You're not registered for this tournament.")
		# Answers with the tournament, like its three siblings. A bare 204 forced
		# the page into a second request to learn what it had just done, and left
		# a window where the roster on screen was known to be wrong.
		return self._detail(tournament)

	@action(detail=True, methods=["post"])
	def start(self, request, code=None):
		tournament = self._resolve(code)
		if tournament.created_by_id != request.user.id:
			raise PermissionDenied("Only the creator can start the tournament.")
		if tournament.status != GameStatus.PENDING:
			raise ValidationError("This tournament has already started or finished.")
		if tournament.participants.count() < 2:
			raise ValidationError("Need at least 2 participants to start.")

		tournament.start()
		return self._detail(tournament)
