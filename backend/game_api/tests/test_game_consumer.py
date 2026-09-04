from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY, get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.test import TransactionTestCase, override_settings

from core.asgi import application
from ..models import Game, GamePlayer, GameStatus

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


def _make_started_game(alice, bob, rng_seed=1, **game_kwargs):
	import random

	from game_engine import GameSettings, start_game, state_to_dict

	game = Game.objects.create(host=alice, max_seats=4, starting_hand_size=7, status=GameStatus.PENDING, **game_kwargs)
	alice_gp = GamePlayer.objects.create(game=game, user=alice, seat=0)
	bob_gp = GamePlayer.objects.create(game=game, user=bob, seat=1)

	enabled = frozenset(name for name in ("draw_stacking", "jump_in", "draw_until_playable", "seven_swap", "zero_swap") if game_kwargs.get(name))
	state = start_game(
		[(str(alice_gp.pk), "Alice"), (str(bob_gp.pk), "Bob")],
		settings=GameSettings(enabled_modifiers=enabled),
		rng=random.Random(rng_seed),
	)
	game.state = state_to_dict(state)
	game.status = GameStatus.IN_PROGRESS
	game.save(update_fields=["state", "status"])
	return game, alice_gp, bob_gp


def _find_legal_card(hand, current_color):
	for card in hand:
		if card["color"] == current_color or card["card_type"] in ("wild", "wild_draw_four"):
			return card
	return None


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class ConnectionTests(TransactionTestCase):
	async def test_a_non_participant_cannot_connect(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		outsider = await sync_to_async(User.objects.create_user)(username="eve", email="e@example.com", password="x")
		game = await sync_to_async(Game.objects.create)(host=alice, max_seats=4, starting_hand_size=7)
		await sync_to_async(GamePlayer.objects.create)(game=game, user=alice, seat=0)

		communicator, connected = await _connect_to_game(outsider, game)
		self.assertFalse(connected)
		await communicator.disconnect()

	async def test_a_participant_can_connect_and_receives_initial_state(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, alice_gp, _ = await sync_to_async(_make_started_game)(alice, bob)

		communicator, connected = await _connect_to_game(alice, game)
		self.assertTrue(connected)

		message = await communicator.receive_json_from()
		self.assertEqual(message["type"], "game_state")
		self.assertEqual(message["your_player_id"], str(alice_gp.pk))

		await communicator.disconnect()

	async def test_connecting_marks_the_player_connected_in_the_database(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, alice_gp, _ = await sync_to_async(_make_started_game)(alice, bob)

		communicator, _ = await _connect_to_game(alice, game)
		await sync_to_async(alice_gp.refresh_from_db)()
		self.assertTrue(alice_gp.is_connected)

		await communicator.disconnect()

	async def test_disconnecting_marks_the_player_not_connected(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, alice_gp, _ = await sync_to_async(_make_started_game)(alice, bob)

		communicator, _ = await _connect_to_game(alice, game)
		await communicator.disconnect()

		await sync_to_async(alice_gp.refresh_from_db)()
		self.assertFalse(alice_gp.is_connected)


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class HandPrivacyTests(TransactionTestCase):
	async def test_own_hand_is_visible(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, alice_gp, _ = await sync_to_async(_make_started_game)(alice, bob)

		communicator, _ = await _connect_to_game(alice, game)
		message = await communicator.receive_json_from()

		me = next(p for p in message["players"] if p["player_id"] == str(alice_gp.pk))
		self.assertIn("hand", me)
		self.assertEqual(len(me["hand"]), me["hand_count"])
		self.assertEqual(me["hand_count"], 7)

		await communicator.disconnect()

	async def test_other_players_hand_is_hidden(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, _, bob_gp = await sync_to_async(_make_started_game)(alice, bob)

		communicator, _ = await _connect_to_game(alice, game)
		message = await communicator.receive_json_from()

		bobs_entry = next(p for p in message["players"] if p["player_id"] == str(bob_gp.pk))
		self.assertNotIn("hand", bobs_entry)
		self.assertEqual(bobs_entry["hand_count"], 7)

		await communicator.disconnect()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class GameplayTests(TransactionTestCase):
	async def test_playing_a_legal_card_broadcasts_the_update_to_both_players(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, alice_gp, bob_gp = await sync_to_async(_make_started_game)(alice, bob)

		alice_comm, _ = await _connect_to_game(alice, game)
		alice_initial = await alice_comm.receive_json_from()
		bob_comm, _ = await _connect_to_game(bob, game)
		await alice_comm.receive_json_from()
		await bob_comm.receive_json_from()

		self.assertEqual(alice_initial["current_player_id"], str(alice_gp.pk))
		my_entry = next(p for p in alice_initial["players"] if p["player_id"] == str(alice_gp.pk))
		card_to_play = _find_legal_card(my_entry["hand"], alice_initial["current_color"])
		self.assertIsNotNone(card_to_play, "fixed rng_seed=1 should always deal a legal opening play")

		await alice_comm.send_json_to({
			"action": "play_card",
			"card": card_to_play,
			"chosen_color": "red",
		})

		alice_update = await alice_comm.receive_json_from()
		bob_update = await bob_comm.receive_json_from()
		self.assertEqual(alice_update["type"], "game_state")
		self.assertEqual(bob_update["type"], "game_state")
		self.assertEqual(alice_update["top_card"], card_to_play)
		self.assertEqual(bob_update["top_card"], card_to_play)

		await alice_comm.disconnect()
		await bob_comm.disconnect()

	async def test_playing_out_of_turn_sends_an_error_only_to_the_requester(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, alice_gp, bob_gp = await sync_to_async(_make_started_game)(alice, bob)

		alice_comm, _ = await _connect_to_game(alice, game)
		alice_initial = await alice_comm.receive_json_from()
		bob_comm, _ = await _connect_to_game(bob, game)
		await alice_comm.receive_json_from()
		await bob_comm.receive_json_from()

		current_id = alice_initial["current_player_id"]
		not_current_comm = bob_comm if current_id == str(alice_gp.pk) else alice_comm

		await not_current_comm.send_json_to({"action": "draw_card"})

		response = await not_current_comm.receive_json_from()
		self.assertEqual(response["type"], "error")

		other_comm = alice_comm if not_current_comm is bob_comm else bob_comm
		self.assertTrue(await other_comm.receive_nothing(timeout=0.2))

		await alice_comm.disconnect()
		await bob_comm.disconnect()

	async def test_acting_before_the_game_has_started_is_rejected(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game = await sync_to_async(Game.objects.create)(host=alice, max_seats=4, starting_hand_size=7)
		await sync_to_async(GamePlayer.objects.create)(game=game, user=alice, seat=0)
		await sync_to_async(GamePlayer.objects.create)(game=game, user=bob, seat=1)

		alice_comm, connected = await _connect_to_game(alice, game)
		self.assertTrue(connected)
		await alice_comm.receive_json_from()

		await alice_comm.send_json_to({"action": "draw_card"})
		response = await alice_comm.receive_json_from()
		self.assertEqual(response["type"], "error")

		await alice_comm.disconnect()

	async def test_malformed_action_is_rejected_cleanly(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, _, _ = await sync_to_async(_make_started_game)(alice, bob)

		communicator, _ = await _connect_to_game(alice, game)
		await communicator.receive_json_from()

		await communicator.send_json_to({"action": "play_card"})
		response = await communicator.receive_json_from()
		self.assertEqual(response["type"], "error")

		await communicator.disconnect()