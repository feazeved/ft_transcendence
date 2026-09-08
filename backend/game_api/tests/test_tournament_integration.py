from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY, get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.test import TransactionTestCase, override_settings

from core.asgi import application
from ..models import Game, GamePlayer, GameStatus, Tournament, TournamentParticipant

User = get_user_model()

IN_MEMORY_LAYER = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


def _session_cookie_for(user):
	session = SessionStore()
	session[SESSION_KEY] = str(user.pk)
	session[BACKEND_SESSION_KEY] = "django.contrib.auth.backends.ModelBackend"
	session[HASH_SESSION_KEY] = user.get_session_auth_hash()
	session.save()
	return session.session_key


async def _connect_to_game(user, game):
	session_key = await sync_to_async(_session_cookie_for)(user)
	communicator = WebsocketCommunicator(
		application, f"/ws/games/{game.public_id}/",
		headers=[(b"cookie", f"sessionid={session_key}".encode())],
	)
	connected, _ = await communicator.connect()
	return communicator, connected


def _setup_two_player_tournament():
	import random

	from game_engine import GameSettings, start_game, state_to_dict

	alice = User.objects.create_user(username="alice", email="a@example.com", password="x")
	bob = User.objects.create_user(username="bob", email="b@example.com", password="x")
	tournament = Tournament.objects.create(name="Cup", created_by=alice, max_participants=2)
	TournamentParticipant.objects.create(tournament=tournament, user=alice)
	TournamentParticipant.objects.create(tournament=tournament, user=bob)
	tournament.start()

	match = Game.objects.get(tournament=tournament, tournament_round=1)
	alice_gp = GamePlayer.objects.get(game=match, user=alice)
	bob_gp = GamePlayer.objects.get(game=match, user=bob)

	state = start_game(
		[(str(alice_gp.pk), "Alice"), (str(bob_gp.pk), "Bob")],
		settings=GameSettings(), rng=random.Random(1),
	)
	match.state = state_to_dict(state)
	match.status = GameStatus.IN_PROGRESS
	match.save(update_fields=["state", "status"])
	return tournament, match, alice, bob, alice_gp


def _find_legal_card(hand, current_color):
	for card in hand:
		if card["color"] == current_color or card["card_type"] in ("wild", "wild_draw_four"):
			return card
	return None


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class TournamentMatchIntegrationTests(TransactionTestCase):
	async def test_a_real_finished_match_advances_the_tournament(self):
		tournament, match, alice, bob, alice_gp = await sync_to_async(_setup_two_player_tournament)()

		communicator, connected = await _connect_to_game(alice, match)
		self.assertTrue(connected)
		initial = await communicator.receive_json_from()

		def rig_hand():
			from game_engine import state_from_dict, state_to_dict
			from game_engine.cards import Card, CardType

			state = state_from_dict(match.state)
			winning_card = Card(color=state.top_card.color, card_type=CardType.NUMBER, value=9)
			for p in state.players:
				if p.player_id == str(alice_gp.pk):
					p.hand = [winning_card]
			match.state = state_to_dict(state)
			match.save(update_fields=["state"])
			return winning_card

		from game_engine import card_to_dict
		winning_card = await sync_to_async(rig_hand)()

		await communicator.send_json_to({
			"action": "play_card", "card": card_to_dict(winning_card), "chosen_color": "red",
		})
		response = await communicator.receive_json_from()
		self.assertEqual(response["winner_id"], str(alice_gp.pk))

		await sync_to_async(tournament.refresh_from_db)()
		self.assertEqual(tournament.status, GameStatus.FINISHED)
		self.assertEqual(tournament.winner_id, alice.pk)

		await communicator.disconnect()