import json
import threading
import time

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction, connection

from game_engine import Color, GameOver, IllegalMove, card_from_dict, card_to_dict, draw_card, pass_turn, play_card, state_from_dict, state_to_dict

from . import presence, spectators
from .background import run_in_background
from .models import Game, GamePlayer, GameStatus, ChatMessage, ChatMessageType, Conversation, ConversationRead, Tournament, MODIFIER_FIELDS
from .serializers import ChatMessageSerializer

User = get_user_model()


def leave_pending_game(game, game_player):
	"""
	Remove a player from a still-pending game, handing the host off to the
	next seat (by seat order) or closing the room if that was the last player.

	Caller must hold `game` under select_for_update() inside a transaction —
	shared between the explicit "leave" action and the disconnect grace period
	below, so both paths make the same call.
	"""
	user_id = game_player.user_id
	game_player.delete()
	if game.host_id == user_id:
		next_up = GamePlayer.objects.filter(game=game).order_by("seat").first()
		if next_up is not None:
			game.host = next_up.user
		else:
			game.status = GameStatus.CANCELLED
		game.save(update_fields=["host", "status"])


def _expire_disconnected_player(game_id, game_player_id):
	time.sleep(settings.GAME_DISCONNECT_GRACE_SECONDS)

	with transaction.atomic():
		try:
			game_player = GamePlayer.objects.select_related("game").get(pk=game_player_id)
		except GamePlayer.DoesNotExist:
			return
		if game_player.is_connected:
			return  # reconnected (e.g. a page refresh) within the grace period

		game = Game.objects.select_for_update().get(pk=game_id)
		if game.status != GameStatus.PENDING:
			return
		leave_pending_game(game, game_player)

	broadcast_game_update(game)

class PresenceConsumer(WebsocketConsumer):
	def connect(self):
		user = self.scope["user"]

		if not user.is_authenticated:
			self.close()
			return

		self.user = user
		self.group_name = f"presence_{user.pk}"

		async_to_sync(self.channel_layer.group_add)(self.group_name, self.channel_name)
		get_user_model().objects.filter(pk=user.pk).update(last_seen_at=timezone.now())

		# Counted before the handshake is answered: otherwise the client is
		# connected and asking who is online before this says so.
		connection_count = presence.register_connection(user.pk)
		self.accept()

		if connection_count == 1:
			self._broadcast_to_friends("online")

	def disconnect(self, close_code):
		user = getattr(self, "user", None)

		if user is None:
			return

		async_to_sync(self.channel_layer.group_discard)(self.group_name, self.channel_name)
		get_user_model().objects.filter(pk=user.pk).update(last_seen_at=timezone.now())

		remaining_connections = presence.unregister_connection(user.pk)

		if remaining_connections == 0:
			self._broadcast_to_friends("offline")

	def receive(self, text_data=None, bytes_data=None):
		# The client's heartbeat, and nothing else: it renews this connection's key.
		user = getattr(self, "user", None)
		if user is not None:
			presence.touch(user.pk)

	def _broadcast_to_friends(self, status):
		# "online" here means "work out where they actually are" — they may have
		# opened the app straight into a room.
		broadcast_presence(self.user.pk, status=status if status == "offline" else None)

	def presence_update(self, event):
		self.send(text_data=json.dumps({
			"type": "presence_update",
			"public_id": event["public_id"],
			"username": event["username"],
			"status": event["status"],
			"room_code": event.get("room_code"),
		}))

	def friendship_update(self, event):
		self.send(text_data=json.dumps({"type": "friendship_update"}))

def broadcast_game_update(game):
	from channels.layers import get_channel_layer

	channel_layer = get_channel_layer()
	async_to_sync(channel_layer.group_send)(f"game_{game.pk}", {"type": "game.update"})

def log_event(game, body):
	"""A line from the game itself in the table chat. No author: nobody said it."""
	message = ChatMessage.objects.create(game=game, user=None, body=body, message_type=ChatMessageType.SYSTEM)
	data = ChatMessageSerializer(message).data
	transaction.on_commit(lambda: _broadcast_chat(game.pk, data))

def _display_name(game_player):
	if game_player is None:
		return "Player"
	return game_player.display_name or (game_player.user.username if game_player.user else "Player")

def _hand_size(state, player_id):
	for player in state.players:
		if player.player_id == player_id:
			return len(player.hand)
	return 0

def _broadcast_chat(game_pk, data):
	from channels.layers import get_channel_layer

	async_to_sync(get_channel_layer().group_send)(f"game_{game_pk}", {"type": "game.chat", "message": data})

def notify_user(user_id, notice):
	"""Put a notice in this person's chat dock. Live only, and carries its own text."""
	from channels.layers import get_channel_layer

	if user_id is None:
		return

	async_to_sync(get_channel_layer().group_send)(f"chat_{user_id}", {"type": "chat.notice", "notice": notice})

def notify_friendship_change(*user_ids):
	"""
	Poke each of these users' presence sockets so their client refetches its
	friendships: a new request, an accept, a decline, a cancel or a block.

	Carries no data on purpose, exactly like `broadcast_game_update` above. The
	REST list stays the single source of truth for what a friendship looks like,
	so a socket event can never drift from it, and a client that missed an event
	catches up on its next fetch anyway. Callers send it after commit, or the
	client could refetch and read a row that has not landed yet.
	"""
	from channels.layers import get_channel_layer

	channel_layer = get_channel_layer()
	for user_id in user_ids:
		if user_id is None:
			continue
		async_to_sync(channel_layer.group_send)(f"presence_{user_id}", {"type": "friendship.update"})

def expire_overdue_turn(game):
	"""
	Draw for whoever is sitting on an overdue turn and pass it on.

	Returns `(game, expired)`. Safe to call at any moment and from anywhere: a
	turn that still has time left is left alone, so two callers racing on the
	same turn cannot advance it twice — the first resets `turn_started_at` and
	the second finds it fresh.
	"""
	if game.turn_timer_seconds is None or game.state is None or game.status != GameStatus.IN_PROGRESS:
		return game, False
	if game.turn_started_at is None:
		return game, False

	elapsed = (timezone.now() - game.turn_started_at).total_seconds()
	if elapsed < game.turn_timer_seconds:
		return game, False

	state = state_from_dict(game.state)
	current_player_id = state.players[state.current_player_index].player_id

	try:
		if not state.has_drawn_this_turn:
			state = draw_card(state, current_player_id)
		state = pass_turn(state, current_player_id)
	except (IllegalMove, GameOver):
		return game, False

	game.state = state_to_dict(state)
	game.turn_started_at = timezone.now()
	game.save(update_fields=["state", "turn_started_at"])
	return game, True

# One watcher thread per game, so a turn runs out on its own.
#
# Until this existed, `expire_overdue_turn` was only ever reached from
# `connect()` and `receive()` — that is, when somebody *did* something. A player
# who walks away therefore stalled the table for as long as everyone else was
# polite enough to wait: the countdown on their screens reached zero and nothing
# happened, because the only thing that could move the turn on was an action
# from the very people who were waiting.
#
# A thread and a sleep, like `_expire_disconnected_player` above, because this
# project has no worker process. `_turn_watchers` keeps it to one per game; the
# set is per process, so several web workers would each keep their own, which is
# harmless: `expire_overdue_turn` no-ops on a turn that has already moved.
#
# Started from `GameViewSet.start` only, never from `connect()`, so that merely
# opening a socket cannot spawn one. A process restarting mid-game therefore
# loses the watcher, and that game falls back to expiring on the next action —
# which is exactly the old behaviour, so the worst case is no worse than before.
_turn_watchers = set()
_turn_watchers_lock = threading.Lock()

def schedule_turn_expiry(game_id):
	with _turn_watchers_lock:
		if game_id in _turn_watchers:
			return
		_turn_watchers.add(game_id)

	run_in_background(_watch_turns, game_id)

def _watch_turns(game_id):
	try:
		while True:
			game = Game.objects.filter(pk=game_id).first()
			# Gone, over, or never had a timer: there is nothing left to watch.
			if game is None or game.status != GameStatus.IN_PROGRESS:
				return
			if game.turn_timer_seconds is None or game.turn_started_at is None:
				return

			remaining = game.turn_timer_seconds - (timezone.now() - game.turn_started_at).total_seconds()
			if remaining > 0:
				# Sleep out the rest of *this* turn and look again. Someone acting
				# in the meantime just means a longer wait next time round.
				time.sleep(remaining)
				continue

			with transaction.atomic():
				locked = Game.objects.select_for_update().get(pk=game_id)
				locked, expired = expire_overdue_turn(locked)

			if expired:
				broadcast_game_update(locked)
	finally:
		with _turn_watchers_lock:
			_turn_watchers.discard(game_id)

def _draw_stack(state):
	"""
	`{"card_type": "draw_two", "count": 6}` while a stack is running, else None.

	Without it the pile could never read "Draw +6" and the "+6 incoming · ANSWER
	WITH +2 OR DRAW" badge could never appear — the stack was enforced perfectly
	and shown nowhere, so the one thing a player needed to know to answer it was
	the one thing the table could not say.
	"""
	stack = state.modifier_state.get("draw_stack")
	if not stack:
		return None
	return {"card_type": stack["type"], "count": stack["count"]}

# --- Presence with a place --------------------------------------------------
#
# The chat dock draws four states — Offline, Online, In a lobby and In a game —
# and the last two carry the room code, as in "In a lobby · 9QTB". Presence used
# to say only online or offline, so two of the four were unreachable: the client
# had nothing to build them from.
#
# The place is *derived*, never stored. A seat that is connected to a room is
# what being in a room means, and `GameConsumer` already keeps `is_connected`
# honest at both ends — so there is one truth, the same one the lobby draws, and
# no second copy in Redis to go stale when a process dies. Spectators are not
# counted: `GameSpectator` has no connected flag, so a row left behind by
# somebody who closed the tab would report them watching for ever, and a wrong
# place is worse than none.

def presence_state(user_id):
	"""`("online" | "lobby" | "game", room_code | None)` for a user who is online."""
	seat = (
		GamePlayer.objects
		.filter(
			user_id=user_id,
			is_connected=True,
			game__status__in=(GameStatus.PENDING, GameStatus.IN_PROGRESS),
		)
		.select_related("game")
		.first()
	)
	if seat is None:
		return "online", None
	place = "lobby" if seat.game.status == GameStatus.PENDING else "game"
	return place, seat.game.join_code

def broadcast_presence(user_id, status=None):
	"""
	Tell this person's friends where they are.

	`status` forces a value — "offline" on the way out, when the seat rows say
	nothing useful. Otherwise the place is worked out from the rooms they are
	sitting in.
	"""
	from channels.layers import get_channel_layer

	user = get_user_model().objects.filter(pk=user_id).first()
	if user is None:
		return

	if status == "offline":
		place, room_code = "offline", None
	else:
		place, room_code = presence_state(user_id)

	channel_layer = get_channel_layer()
	for friend_id in user.accepted_friend_ids():
		async_to_sync(channel_layer.group_send)(
			f"presence_{friend_id}",
			{
				"type": "presence.update",
				"public_id": str(user.public_id),
				"username": user.username,
				"status": place,
				"room_code": room_code,
			},
		)

class GameConsumer(WebsocketConsumer):
	def connect(self):
		user = self.scope["user"]
		if not user.is_authenticated:
			self.close()
			return

		self.is_done = False
		code_or_id = self.scope["url_route"]["kwargs"]["code_or_id"]
		try:
			game = Game._resolve(code_or_id)
		except (Game.DoesNotExist, ValueError):
			self.close()
			return

		self.user = user
		self.game_id = game.pk
		self.group_name = f"game_{game.pk}"

		player = GamePlayer.objects.filter(game_id=self.game_id, user=user).first()
		if player is not None:
			GamePlayer.objects.filter(pk=player.pk).update(is_connected=True)
		else:
			if not game.allow_spectators:
				self.close()
				return
			spectators.register_spectator(self.game_id)

		async_to_sync(self.channel_layer.group_add)(self.group_name, self.channel_name)
		self.accept()

		# Their friends' docks now say "In a lobby · 9QTB" instead of "Online".
		broadcast_presence(self.user.pk)

		with transaction.atomic():
			game = Game.objects.select_for_update().get(pk=self.game_id)
			if game.status == GameStatus.IN_PROGRESS and game.state is not None:
				game, _ = self._expire_overdue_turn(game)
			transaction.on_commit(lambda: broadcast_game_update(game))

	def disconnect(self, close_code):
		if getattr(self, "is_done", True):
			return
		self.is_done = True

		async_to_sync(self.channel_layer.group_discard)(self.group_name, self.channel_name)

		# Everything here goes through `self.game_id` and `self.user`, the two
		# things `connect()` actually sets — the same way every other method in
		# this class reads the game.
		player = GamePlayer.objects.filter(game_id=self.game_id, user=self.user).first()
		if player is not None:
			GamePlayer.objects.filter(pk=player.pk).update(is_connected=False)
			# A player dropping out of a room that has not started yet gives up
			# the seat, after a grace period so a page refresh doesn't cost it.
			# `_expire_disconnected_player` re-checks PENDING under a lock; this
			# check only avoids starting a thread that would find nothing to do.
			if Game.objects.filter(pk=self.game_id, status=GameStatus.PENDING).exists():
				run_in_background(_expire_disconnected_player, self.game_id, player.pk)
		else:
			# No GamePlayer row means a spectator, and `connect()` registered one.
			spectators.unregister_spectator(self.game_id)

		# The room can be gone by now — the last player leaving a pending game
		# closes it — and a disconnect must not raise.
		try:
			game = Game.objects.get(pk=self.game_id)
			broadcast_game_update(game)
		except Game.DoesNotExist:
			pass

		# Back to plain "Online" — or to another room, if they have two tabs open.
		broadcast_presence(self.user.pk)

	def receive(self, text_data):
		if getattr(self, "is_done", False):
			return

		try:
			payload = json.loads(text_data)
			action = payload.get("action")
		except (json.JSONDecodeError, AttributeError):
			self._send_error("Malformed message.")
			return

		if action == "chat":
			self._handle_chat(payload)
			return

		player = GamePlayer.objects.filter(game_id=self.game_id, user=self.user).first()
		if player is None:
			self._send_error("You must take a seat to play.")
			return

		expired = False
		try:
			with transaction.atomic():
				game = Game.objects.select_for_update().get(pk=self.game_id)

				if game.status != GameStatus.IN_PROGRESS or game.state is None:
					self._send_error("This game hasn't started yet.")
					return

				game, expired = self._expire_overdue_turn(game)

				state = state_from_dict(game.state)
				player_id = str(player.pk)

				card = None
				chosen_color = None

				if action == "play_card":
					card = card_from_dict(payload["card"])
					chosen_color_raw = payload.get("chosen_color")
					if chosen_color_raw:
						chosen_color = Color(chosen_color_raw)
					new_state = play_card(state, player_id, card, chosen_color=chosen_color, target_id=payload.get("target_id"))
				elif action == "draw_card":
					new_state = draw_card(state, player_id)
				elif action == "pass_turn":
					new_state = pass_turn(state, player_id)
				else:
					self._send_error(f"Unknown action: {action!r}")
					return

				log_event(game, self._describe_move(player, action, state, new_state, card, chosen_color))
				if _hand_size(new_state, player_id) == 1 and _hand_size(state, player_id) != 1:
					log_event(game, f"{_display_name(player)} is on ONE!")

				game.state = state_to_dict(new_state)
				game.turn_started_at = timezone.now()
				if new_state.winner_id is not None:
					game.status = GameStatus.FINISHED
					game.finished_at = timezone.now()
					winner_gp = (GamePlayer.objects.filter(pk=int(new_state.winner_id)).select_related("user").first())
					if winner_gp is not None:
						game.winner = winner_gp.user
						log_event(game, f"{_display_name(winner_gp)} won the game.")
					ranked = sorted(new_state.players, key=lambda p: len(p.hand))
					for position, ranked_player in enumerate(ranked, start=1):
						GamePlayer.objects.filter(pk=int(ranked_player.player_id)).update(finish_position=position)
					game.save(update_fields=["state", "status", "turn_started_at", "finished_at", "winner"])
					if game.tournament_id is not None:
						tournament = Tournament.objects.select_for_update().get(pk=game.tournament_id)
						tournament.maybe_advance(game.tournament_round)
				else:
					game.save(update_fields=["state", "turn_started_at"])
				transaction.on_commit(lambda: broadcast_game_update(game))
		except (IllegalMove, GameOver) as exc:
			if expired:
				broadcast_game_update(game)
			self._send_error(str(exc))
			return
		except (KeyError, ValueError, StopIteration):
			if expired:
				broadcast_game_update(game)
			self._send_error("Malformed action.")
			return


	def game_update(self, event):
		if getattr(self, "is_done", False):
			return
		self.send(text_data=json.dumps(self._personalized_state()))

	def _send_error(self, message):
		self.send(text_data=json.dumps({"type": "error", "message": message}))

	def _personalized_state(self):
		game = Game.objects.select_related("host", "winner", "tournament").get(pk=self.game_id)
		player = GamePlayer.objects.filter(game=game, user=self.user).first()
		is_spectator = player is None

		if game.status == GameStatus.PENDING:
			# The shape here is the one `frontend/src/lib/fakeGameState.js` was
			# built against, and that file is the contract (ADR 0001). Three
			# things used to be wrong rather than merely missing, and each one
			# cost the Lobby a whole feature:
			#
			#  - a seat nested its person under `user`, so every name, photo and
			#    host tag on screen read `undefined`;
			#  - `spectators` was the Redis *count*, so the panel could say "2/6"
			#    but never who was watching;
			#  - `settings` carried three keys, so the room's hand size showed a
			#    dash and the house rules always read "Classic rules only", in a
			#    room that had three of them switched on.
			#
			# A seat is therefore flat, and the room says its own name and code —
			# without them the title was empty and the ROOM CODE button copied
			# nothing, which is how you tell somebody where to meet you.
			player_by_seat = {p.seat: p for p in game.players.select_related("user").all()}
			seats = []
			for i in range(game.max_seats):
				p = player_by_seat.get(i)
				if p is None:
					seats.append(None)
					continue
				# `GamePlayer.user` is nullable — SET_NULL when an account is
				# deleted, and an AI seat never had one — so nothing here may
				# reach through it without asking. Before this, a player deleting
				# their account while sitting in a room took the whole lobby down
				# with an AttributeError, for everybody in it.
				seats.append({
					"public_id": str(p.user.public_id) if p.user else None,
					"username": p.user.username if p.user else (p.display_name or "Player"),
					"avatar_url": p.user.avatar_url if p.user else get_user_model().DEFAULT_AVATAR_URL,
					# Derived from the room's host, not stored on the seat: one
					# place to look, so the two can never disagree.
					"is_host": p.user_id is not None and p.user_id == game.host_id,
					"is_connected": p.is_connected,
				})

			# Who is watching, by name. `GameSpectator` is the roster — the Redis
			# counter counts sockets, which is a different question and cannot
			# answer this one.
			watching = [
				{"username": s.user.username}
				for s in game.spectators.select_related("user").all()
			]

			return {
				"type": "lobby",
				"status": game.status,
				"name": game.name,
				"code": game.join_code,
				"host": game.host.username,
				"seats": seats,
				"settings": {
					"max_seats": game.max_seats,
					"starting_hand_size": game.starting_hand_size,
					"turn_timer_seconds": game.turn_timer_seconds,
					"allow_spectators": game.allow_spectators,
					**{name: getattr(game, name) for name in MODIFIER_FIELDS},
				},
				"spectators": watching,
				"max_spectators": settings.GAME_MAX_SPECTATORS,
				"your_seat": player.seat if player else None,
				"you_are_spectating": is_spectator,
				"is_spectator": is_spectator,
				"you_may_start": (
					player is not None
					if game.tournament_id is not None
					else game.host_id == self.user.pk
				),
				"tournament": game.tournament.join_code if game.tournament_id else None,
			}

		if game.state is None:
			return {"type": "game_state", "status": game.status, "state": None, "is_spectator": is_spectator}

		state = state_from_dict(game.state)
		my_player_id = str(player.pk) if player is not None else None
		# One query for both things a seat needs from the database: whether they
		# are still connected, and the face to draw. The engine's state knows
		# neither — it holds the game, not the people playing it.
		default_avatar = get_user_model().DEFAULT_AVATAR_URL
		seat_by_id = {
			str(gp.pk): gp
			for gp in GamePlayer.objects.filter(game=game).select_related("user")
		}

		players = []
		for p in state.players:
			gp = seat_by_id.get(p.player_id)
			entry = {
				"player_id": p.player_id,
				"name": p.name,
				"hand_count": len(p.hand),
				"is_connected": gp.is_connected if gp else False,
				# `User.avatar_url` already falls back to the site default, so an
				# account with no picture and a seat with no account both draw
				# the same face instead of a broken image.
				"avatar_url": gp.user.avatar_url if (gp and gp.user) else default_avatar,
			}
			if p.player_id == my_player_id:
				entry["hand"] = [card_to_dict(c) for c in p.hand]
			players.append(entry)

		return {
			"type": "game_state",
			"status": game.status,
			"your_player_id": my_player_id,
			"you_are_spectating": is_spectator,
			"is_spectator": is_spectator,
			"spectator_count": spectators.spectator_count(game.pk),
			"top_card": card_to_dict(state.top_card),
			"current_color": state.current_color.value,
			"current_player_id": state.players[state.current_player_index].player_id,
			"direction": state.direction.value,
			"has_drawn_this_turn": state.has_drawn_this_turn,
			"draw_pile_count": len(state.deck.draw_pile),
			# The running +2/+4 pile-up, or null when nothing is stacked. The
			# engine keeps it in `modifier_state` under its own key and calls the
			# card `type`; the table reads `card_type`, the name every other card
			# in the payload uses. Renamed here rather than in the engine, which
			# has its own tests and no business knowing what the client calls
			# things.
			"draw_stack": _draw_stack(state),
			"winner_id": state.winner_id,
			"turn_timer_seconds": game.turn_timer_seconds,
			"turn_started_at": game.turn_started_at.isoformat() if game.turn_started_at else None,
			# The house rules this room was created with. The engine already
			# enforces them — `GameViewSet.start` passes them as `GameSettings`
			# — but the table has to *offer* the two that need the player to act:
			# Jump in lets a card leave the hand out of turn, and Seven swap and
			# Zero rotate need a target picked. Without this the client cannot
			# know they are on, so it never opens either affordance and the rule
			# the host switched on is unreachable, however well the server
			# supports it.
			#
			# All five are sent, always, and never only the enabled ones: a rule
			# that is off is as much part of the answer as one that is on, and a
			# missing key and `false` have to mean the same thing to the client.
			"settings": {name: getattr(game, name) for name in MODIFIER_FIELDS},
			"players": players,
			# As in the lobby above: the way back to the round this table is part
			# of, or null for an ordinary room.
			"tournament": game.tournament.join_code if game.tournament_id else None,
		}

	def _describe_move(self, player, action, before, after, card, chosen_color):
		who = _display_name(player)

		if action == "play_card":
			line = f"{who} played {card}"
			return f"{line} and chose {chosen_color.value}" if chosen_color is not None else line

		if action == "draw_card":
			drawn = _hand_size(after, str(player.pk)) - _hand_size(before, str(player.pk))
			return f"{who} drew {drawn} cards" if drawn > 1 else f"{who} drew a card"

		return f"{who} passed"

	def _expire_overdue_turn(self, game):
		return expire_overdue_turn(game)

	def _handle_chat(self, payload):
		body = (payload.get("body") or "").strip()
		if not body:
			self._send_error("Message body can't be empty.")
			return
		if len(body) > 500:
			self._send_error("Message is too long.")
			return

		game = Game.objects.get(pk=self.game_id)
		message = ChatMessage.objects.create(game=game, user=self.user, body=body)
		async_to_sync(self.channel_layer.group_send)(self.group_name, {"type": "game.chat", "message": ChatMessageSerializer(message).data})

	def game_chat(self, event):
		self.send(text_data=json.dumps({"type": "chat_message", "message": event["message"]}, default=str))


class ChatConsumer(WebsocketConsumer):
	def connect(self):
		user = self.scope["user"]

		if not user.is_authenticated:
			self.close()
			return

		self.user = user
		self.group_name = f"chat_{user.pk}"
		async_to_sync(self.channel_layer.group_add)(self.group_name, self.channel_name)
		self.accept()

	def disconnect(self, close_code):
		user = getattr(self, "user", None)
		if user is None:
			return
		async_to_sync(self.channel_layer.group_discard)(self.group_name, self.channel_name)

	def receive(self, text_data):
		if getattr(self, "user", None) is None:
			return

		try:
			payload = json.loads(text_data)
			action = payload.get("action")
		except (json.JSONDecodeError, AttributeError):
			self._send_error("Malformed message.")
			return

		if action == "send_message":
			self._handle_send_message(payload)
		elif action == "send_game_invite":
			self._handle_send_game_invite(payload)
		elif action == "typing":
			self._handle_typing(payload)
		elif action == "mark_read":
			self._handle_mark_read(payload)
		else:
			self._send_error(f"Unknown action: {action!r}")

	def _resolve_recipient(self, payload):
		try:
			recipient = User.objects.get(public_id=payload["recipient_id"])
		except (KeyError, User.DoesNotExist, ValueError):
			self._send_error("Unknown recipient.")
			return None
		if recipient.pk == self.user.pk:
			self._send_error("Can't message yourself.")
			return None
		if self.user.is_blocked_with(recipient):
			self._send_error("Can't message this user.")
			return None
		return recipient

	def _broadcast_message(self, message, participant_ids):
		payload_out = ChatMessageSerializer(message).data
		for participant_id in participant_ids:
			async_to_sync(self.channel_layer.group_send)(f"chat_{participant_id}", {"type": "chat.message", "message": payload_out})

	def _handle_send_message(self, payload):
		recipient = self._resolve_recipient(payload)
		if recipient is None:
			return

		body = (payload.get("body") or "").strip()
		if not body:
			self._send_error("Message body can't be empty.")
			return
		if len(body) > 500:
			self._send_error("Message is too long.")
			return

		conversation = Conversation.between(self.user, recipient)
		message = ChatMessage.objects.create(conversation=conversation, user=self.user, body=body)
		self._broadcast_message(message, (self.user.pk, recipient.pk))

	def _handle_send_game_invite(self, payload):
		recipient = self._resolve_recipient(payload)
		if recipient is None:
			return

		try:
			game = Game.objects.get(public_id=payload["game_id"])
		except (KeyError, Game.DoesNotExist, ValueError):
			self._send_error("Unknown game.")
			return
		# A room outlives its game (CONTEXT.md), so an invite points at somewhere
		# to go and not only at a game that has yet to start. "Come and play in my
		# room" is a reasonable thing to say from a table you are already at —
		# which is exactly where the design puts an invite button, and where it
		# could never be pressed while this required PENDING. A finished or
		# cancelled room is the only one there is no point being sent to.
		if game.status in (GameStatus.FINISHED, GameStatus.CANCELLED):
			self._send_error("That game can no longer be joined.")
			return

		conversation = Conversation.between(self.user, recipient)
		message = ChatMessage.objects.create(
			conversation=conversation, user=self.user,
			message_type=ChatMessageType.GAME_INVITE, invited_game=game,
			body=(payload.get("body") or "").strip()[:500],
		)
		self._broadcast_message(message, (self.user.pk, recipient.pk))

	def _handle_typing(self, payload):
		try:
			recipient = User.objects.get(public_id=payload["recipient_id"])
		except (KeyError, User.DoesNotExist, ValueError):
			return
		async_to_sync(self.channel_layer.group_send)(f"chat_{recipient.pk}", {"type": "chat.typing", "public_id": str(self.user.public_id), "username": self.user.username})

	def _handle_mark_read(self, payload):
		try:
			conversation = Conversation.objects.get(pk=payload["conversation_id"])
		except (KeyError, Conversation.DoesNotExist, ValueError):
			self._send_error("Unknown conversation.")
			return
		if self.user.pk not in (conversation.user_a_id, conversation.user_b_id):
			self._send_error("Not your conversation.")
			return

		ConversationRead.objects.update_or_create(conversation=conversation, user=self.user, defaults={"last_read_at": timezone.now()})
		other = conversation.other_participant(self.user)
		async_to_sync(self.channel_layer.group_send)(f"chat_{other.pk}", {"type": "chat.read_receipt", "conversation_id": conversation.pk, "reader_id": str(self.user.public_id)})

	def chat_message(self, event):
		self.send(text_data=json.dumps({"type": "chat_message", "message": event["message"]}, default=str))

	def chat_typing(self, event):
		self.send(text_data=json.dumps({"type": "typing", "public_id": event["public_id"], "username": event["username"]}))

	def chat_notice(self, event):
		self.send(text_data=json.dumps({"type": "notice", **event["notice"]}))

	def chat_read_receipt(self, event):
		self.send(text_data=json.dumps({"type": "read_receipt", "conversation_id": event["conversation_id"], "reader_id": event["reader_id"]}))

	def _send_error(self, message):
		self.send(text_data=json.dumps({"type": "error", "message": message}))
