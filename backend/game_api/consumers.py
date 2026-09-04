import json

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.db import transaction

from game_engine import Color, GameOver, IllegalMove, card_from_dict, card_to_dict, draw_card, pass_turn, play_card, state_from_dict, state_to_dict

from . import presence
from .models import Game, GamePlayer, GameStatus

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

		try:
			game_player = GamePlayer.objects.select_related("user").get(game=game, user=user)
		except GamePlayer.DoesNotExist:
			self.close()
			return

		self.user = user
		self.game = game
		self.game_player = game_player
		self.group_name = f"game_{game.pk}"

		async_to_sync(self.channel_layer.group_add)(self.group_name, self.channel_name)
		self.accept()
		GamePlayer.objects.filter(pk=game_player.pk).update(is_connected=True)
		broadcast_game_update(self.game)

	def disconnect(self, close_code):
		game_player = getattr(self, "game_player", None)
		if game_player is None:
			return

		async_to_sync(self.channel_layer.group_discard)(self.group_name, self.channel_name)
		GamePlayer.objects.filter(pk=game_player.pk).update(is_connected=False)
		broadcast_game_update(self.game)

	def receive(self, text_data):
		game_player = getattr(self, "game_player", None)
		if game_player is None:
			return

		try:
			payload = json.loads(text_data)
			action = payload.get("action")
		except (json.JSONDecodeError, AttributeError):
			self._send_error("Malformed message.")
			return

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
					winner_gp = (
						GamePlayer.objects.filter(pk=int(new_state.winner_id)).select_related("user").first())
					if winner_gp is not None:
						game.winner = winner_gp.user
						GamePlayer.objects.filter(pk=winner_gp.pk).update(finish_position=1)
					game.save(update_fields=["state", "status", "finished_at", "winner"])
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
		my_player_id = str(self.game_player.pk)
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
			"top_card": card_to_dict(state.top_card),
			"current_color": state.current_color.value,
			"current_player_id": state.players[state.current_player_index].player_id,
			"direction": state.direction.value,
			"has_drawn_this_turn": state.has_drawn_this_turn,
			"draw_pile_count": len(state.deck.draw_pile),
			"winner_id": state.winner_id,
			"players": players,
		}