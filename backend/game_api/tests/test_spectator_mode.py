from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY, get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.test import TransactionTestCase, override_settings

from core.asgi import application
from .. import spectators
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

	game = Game.objects.create(
		host=alice, max_seats=4, starting_hand_size=7, status=GameStatus.PENDING, **game_kwargs
	)
	alice_gp = GamePlayer.objects.create(game=game, user=alice, seat=0)
	bob_gp = GamePlayer.objects.create(game=game, user=bob, seat=1)

	state = start_game(
		[(str(alice_gp.pk), "Alice"), (str(bob_gp.pk), "Bob")],
		settings=GameSettings(), rng=random.Random(rng_seed),
	)
	game.state = state_to_dict(state)
	game.status = GameStatus.IN_PROGRESS
	game.save(update_fields=["state", "status"])
	return game, alice_gp, bob_gp


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class SpectatorConnectionTests(TransactionTestCase):
	def tearDown(self):
		for key in spectators._redis_client.keys("spectators:*"):
			spectators._redis_client.delete(key)

	async def test_a_spectator_can_connect_to_an_in_progress_game(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		eve = await sync_to_async(User.objects.create_user)(username="eve", email="e@example.com", password="x")
		game, _, _ = await sync_to_async(_make_started_game)(alice, bob)

		communicator, connected = await _connect_to_game(eve, game)
		self.assertTrue(connected)

		state = await communicator.receive_json_from()
		self.assertEqual(state["is_spectator"], True)
		self.assertIsNone(state["your_player_id"])

		await communicator.disconnect()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class SpectatorHandPrivacyTests(TransactionTestCase):
	def tearDown(self):
		for key in spectators._redis_client.keys("spectators:*"):
			spectators._redis_client.delete(key)

	async def test_spectator_sees_no_players_actual_hand(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		eve = await sync_to_async(User.objects.create_user)(username="eve", email="e@example.com", password="x")
		game, alice_gp, bob_gp = await sync_to_async(_make_started_game)(alice, bob)

		communicator, _ = await _connect_to_game(eve, game)
		state = await communicator.receive_json_from()

		for entry in state["players"]:
			self.assertNotIn("hand", entry)
			self.assertEqual(entry["hand_count"], 7)

		await communicator.disconnect()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class SpectatorRestrictionTests(TransactionTestCase):
	def tearDown(self):
		for key in spectators._redis_client.keys("spectators:*"):
			spectators._redis_client.delete(key)

	async def test_spectator_cannot_play_a_card(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		eve = await sync_to_async(User.objects.create_user)(username="eve", email="e@example.com", password="x")
		game, alice_gp, _ = await sync_to_async(_make_started_game)(alice, bob)

		communicator, _ = await _connect_to_game(eve, game)
		await communicator.receive_json_from()

		await communicator.send_json_to({"action": "play_card", "card": {"color": "red", "card_type": "number", "value": 1}})
		response = await communicator.receive_json_from()
		self.assertEqual(response["type"], "error")

		await communicator.disconnect()

	async def test_spectator_cannot_draw(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		eve = await sync_to_async(User.objects.create_user)(username="eve", email="e@example.com", password="x")
		game, _, _ = await sync_to_async(_make_started_game)(alice, bob)

		communicator, _ = await _connect_to_game(eve, game)
		await communicator.receive_json_from()

		await communicator.send_json_to({"action": "draw_card"})
		response = await communicator.receive_json_from()
		self.assertEqual(response["type"], "error")

		await communicator.disconnect()

	async def test_spectator_can_chat(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		eve = await sync_to_async(User.objects.create_user)(username="eve", email="e@example.com", password="x")
		game, _, _ = await sync_to_async(_make_started_game)(alice, bob)

		alice_comm, _ = await _connect_to_game(alice, game)
		await alice_comm.receive_json_from()
		eve_comm, _ = await _connect_to_game(eve, game)
		await alice_comm.receive_json_from()
		await eve_comm.receive_json_from()

		await eve_comm.send_json_to({"action": "chat", "body": "good game so far!"})

		eve_echo = await eve_comm.receive_json_from()
		alice_receipt = await alice_comm.receive_json_from()
		self.assertEqual(eve_echo["message"]["body"], "good game so far!")
		self.assertEqual(alice_receipt["message"]["body"], "good game so far!")

		await alice_comm.disconnect()
		await eve_comm.disconnect()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class SpectatorCountTests(TransactionTestCase):
	def tearDown(self):
		for key in spectators._redis_client.keys("spectators:*"):
			spectators._redis_client.delete(key)

	async def test_spectator_count_increases_and_decreases(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		eve = await sync_to_async(User.objects.create_user)(username="eve", email="e@example.com", password="x")
		game, _, _ = await sync_to_async(_make_started_game)(alice, bob)

		eve_comm, _ = await _connect_to_game(eve, game)
		state = await eve_comm.receive_json_from()
		self.assertEqual(state["spectator_count"], 1)

		await eve_comm.disconnect()
		count_after = await sync_to_async(spectators.spectator_count)(game.pk)
		self.assertEqual(count_after, 0)

	async def test_players_see_the_spectator_count_too(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		eve = await sync_to_async(User.objects.create_user)(username="eve", email="e@example.com", password="x")
		game, _, _ = await sync_to_async(_make_started_game)(alice, bob)

		alice_comm, _ = await _connect_to_game(alice, game)
		await alice_comm.receive_json_from()
		eve_comm, _ = await _connect_to_game(eve, game)

		alice_update = await alice_comm.receive_json_from()
		self.assertEqual(alice_update["spectator_count"], 1)

		await alice_comm.disconnect()
		await eve_comm.disconnect()


class LiveGamesDiscoveryTests(TransactionTestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="a@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="b@example.com", password="x")
		self.client.login(username="alice", password="x")

	def test_lists_an_in_progress_game(self):
		game, _, _ = _make_started_game(self.alice, self.bob)
		response = self.client.get("/api/games/live/")
		self.assertEqual(response.status_code, 200)
		public_ids = [g["public_id"] for g in response.data]
		self.assertIn(str(game.public_id), public_ids)

	def test_does_not_list_a_pending_game(self):
		Game.objects.create(host=self.alice, max_seats=4, starting_hand_size=7)
		response = self.client.get("/api/games/live/")
		public_ids = [g["public_id"] for g in response.data]
		self.assertEqual(public_ids, [])

	def test_does_not_list_a_finished_game(self):
		game, _, _ = _make_started_game(self.alice, self.bob)
		game.status = GameStatus.FINISHED
		game.save(update_fields=["status"])
		response = self.client.get("/api/games/live/")
		public_ids = [g["public_id"] for g in response.data]
		self.assertNotIn(str(game.public_id), public_ids)

	def test_includes_spectator_count(self):
		game, _, _ = _make_started_game(self.alice, self.bob)
		spectators.register_spectator(game.pk)
		try:
			response = self.client.get("/api/games/live/")
			entry = next(g for g in response.data if g["public_id"] == str(game.public_id))
			self.assertEqual(entry["spectator_count"], 1)
		finally:
			spectators.unregister_spectator(game.pk)