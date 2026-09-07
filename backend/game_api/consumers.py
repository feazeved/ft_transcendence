import json

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction

from game_engine import Color, GameOver, IllegalMove, card_from_dict, card_to_dict, draw_card, pass_turn, play_card, state_from_dict, state_to_dict

from . import presence, spectators
from .models import Game, GamePlayer, GameStatus, ChatMessage, ChatMessageType, Conversation, ConversationRead, Tournament
from .serializers import ChatMessageSerializer

User = get_user_model()

class PresenceConsumer(WebsocketConsumer):
	def connect(self):
		user = self.scope["user"]

		if not user.is_authenticated:
			self.close()
			return

		self.user = user
		self.group_name = f"presence_{user.pk}"

		async_to_sync(self.channel_layer.group_add)(self.group_name, self.channel_name)
		self.accept()
		get_user_model().objects.filter(pk=user.pk).update(last_seen_at=timezone.now())

		connection_count = presence.register_connection(user.pk)

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

	def _broadcast_to_friends(self, status):
		for friend_id in self.user.accepted_friend_ids():
			async_to_sync(self.channel_layer.group_send)(
				f"presence_{friend_id}",
				{
					"type": "presence.update",
					"public_id": str(self.user.public_id),
					"username": self.user.username,
					"status": status,
				},
			)

	def presence_update(self, event):
		self.send(text_data=json.dumps({
			"type": "presence_update",
			"public_id": event["public_id"],
			"username": event["username"],
			"status": event["status"],
		}))

def broadcast_game_update(game):
	from channels.layers import get_channel_layer

	channel_layer = get_channel_layer()
	async_to_sync(channel_layer.group_send)(f"game_{game.pk}", {"type": "game.update"})

class GameConsumer(WebsocketConsumer):
	def connect(self):
		user = self.scope["user"]
		if not user.is_authenticated:
			self.close()
			return

		public_id = self.scope["url_route"]["kwargs"]["public_id"]
		try:
			game = Game.objects.get(public_id=public_id)
		except Game.DoesNotExist:
			self.close()
			return

		self.user = user
		self.game = game
		self.group_name = f"game_{game.pk}"

		try:
			self.game_player = GamePlayer.objects.select_related("user").get(game=game, user=user)
			self.is_spectator = False
		except GamePlayer.DoesNotExist:
			self.game_player = None
			self.is_spectator = True

		async_to_sync(self.channel_layer.group_add)(self.group_name, self.channel_name)
		self.accept()

		if self.is_spectator:
			spectators.register_spectator(game.pk)
		else:
			GamePlayer.objects.filter(pk=self.game_player.pk).update(is_connected=True)

		with transaction.atomic():
			game = Game.objects.select_for_update().get(pk=self.game.pk)
			game, _ = self._expire_overdue_turn(game)
		self.game = game

		broadcast_game_update(self.game)

	def disconnect(self, close_code):
		is_spectator = getattr(self, "is_spectator", None)
		if is_spectator is None:
			return

		async_to_sync(self.channel_layer.group_discard)(self.group_name, self.channel_name)
		if is_spectator:
			spectators.unregister_spectator(self.game.pk)
		else:
			GamePlayer.objects.filter(pk=self.game_player.pk).update(is_connected=False)
		broadcast_game_update(self.game)

	def receive(self, text_data):
		is_spectator = getattr(self, "is_spectator", None)
		if is_spectator is None:
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

		if is_spectator:
			self._send_error("Spectators can't play.")
			return
		game_player = self.game_player

		with transaction.atomic():
			game = Game.objects.select_for_update().get(pk=self.game.pk)
			game, expired = self._expire_overdue_turn(game)
		if expired:
			self.game = game
			broadcast_game_update(game)

		try:
			with transaction.atomic():
				game = Game.objects.select_for_update().get(pk=self.game.pk)
				if game.state is None or game.status != GameStatus.IN_PROGRESS:
					self._send_error("This game hasn't started yet.")
					return

				state = state_from_dict(game.state)
				player_id = str(game_player.pk)

				if action == "play_card":
					card = card_from_dict(payload["card"])
					chosen_color_raw = payload.get("chosen_color")
					chosen_color = Color(chosen_color_raw) if chosen_color_raw else None
					new_state = play_card(state, player_id, card, chosen_color=chosen_color, target_id=payload.get("target_id"))
				elif action == "draw_card":
					new_state = draw_card(state, player_id)
				elif action == "pass_turn":
					new_state = pass_turn(state, player_id)
				else:
					self._send_error(f"Unknown action: {action!r}")
					return

				game.state = state_to_dict(new_state)
				if new_state.winner_id is not None:
					game.status = GameStatus.FINISHED
					game.finished_at = timezone.now()
					winner_gp = (GamePlayer.objects.filter(pk=int(new_state.winner_id)).select_related("user").first())
					if winner_gp is not None:
						game.winner = winner_gp.user
					ranked = sorted(new_state.players, key=lambda p: len(p.hand))
					for position, ranked_player in enumerate(ranked, start=1):
						GamePlayer.objects.filter(pk=int(ranked_player.player_id)).update(finish_position=position)
					game.save(update_fields=["state", "status", "finished_at", "winner"])
					if game.tournament_id is not None:
						tournament = Tournament.objects.select_for_update().get(pk=game.tournament_id)
						tournament.maybe_advance(game.tournament_round)
				else:
					game.save(update_fields=["state"])
		except (IllegalMove, GameOver) as exc:
			self._send_error(str(exc))
			return
		except (KeyError, ValueError, StopIteration):
			self._send_error("Malformed action.")
			return

		self.game = game
		broadcast_game_update(game)

	def game_update(self, event):
		self.game = Game.objects.select_related("host", "winner").get(pk=self.game.pk)
		self.send(text_data=json.dumps(self._personalized_state()))

	def _send_error(self, message):
		self.send(text_data=json.dumps({"type": "error", "message": message}))

	def _personalized_state(self):
		game = self.game
		if game.state is None:
			return {"type": "game_state", "status": game.status, "state": None}

		state = state_from_dict(game.state)
		my_player_id = str(self.game_player.pk) if self.game_player is not None else None
		connection_by_id = {
			str(pk): is_connected
			for pk, is_connected in GamePlayer.objects.filter(game=game).values_list("pk", "is_connected")
		}

		players = []
		for p in state.players:
			entry = {
				"player_id": p.player_id,
				"name": p.name,
				"hand_count": len(p.hand),
				"is_connected": connection_by_id.get(p.player_id, False),
			}
			if p.player_id == my_player_id:
				entry["hand"] = [card_to_dict(c) for c in p.hand]
			players.append(entry)

		return {
			"type": "game_state",
			"status": game.status,
			"your_player_id": my_player_id,
			"is_spectator": self.game_player is None,
			"spectator_count": spectators.spectator_count(game.pk),
			"top_card": card_to_dict(state.top_card),
			"current_color": state.current_color.value,
			"current_player_id": state.players[state.current_player_index].player_id,
			"direction": state.direction.value,
			"has_drawn_this_turn": state.has_drawn_this_turn,
			"draw_pile_count": len(state.deck.draw_pile),
			"winner_id": state.winner_id,
			"turn_timer_seconds": game.turn_timer_seconds,
			"turn_started_at": game.turn_started_at.isoformat() if game.turn_started_at else None,
			"players": players,
		}

	def _expire_overdue_turn(self, game):
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

	def _handle_chat(self, payload):
		body = (payload.get("body") or "").strip()
		if not body:
			self._send_error("Message body can't be empty.")
			return
		if len(body) > 500:
			self._send_error("Message is too long.")
			return

		message = ChatMessage.objects.create(game=self.game, user=self.user, body=body)
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
		if game.status != GameStatus.PENDING:
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

	def chat_read_receipt(self, event):
		self.send(text_data=json.dumps({"type": "read_receipt", "conversation_id": event["conversation_id"], "reader_id": event["reader_id"]}))

	def _send_error(self, message):
		self.send(text_data=json.dumps({"type": "error", "message": message}))