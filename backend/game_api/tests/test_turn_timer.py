from datetime import timedelta

from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY, get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.test import TransactionTestCase, override_settings
from django.utils import timezone

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


def _make_timed_game(alice, bob, turn_timer_seconds, turn_age_seconds, rng_seed=1):
	import random

	from game_engine import GameSettings, start_game, state_to_dict

	game = Game.objects.create(
		host=alice, max_seats=4, starting_hand_size=7, status=GameStatus.PENDING,
		turn_timer_seconds=turn_timer_seconds,
	)
	alice_gp = GamePlayer.objects.create(game=game, user=alice, seat=0)
	bob_gp = GamePlayer.objects.create(game=game, user=bob, seat=1)

	state = start_game(
		[(str(alice_gp.pk), "Alice"), (str(bob_gp.pk), "Bob")],
		settings=GameSettings(), rng=random.Random(rng_seed),
	)
	game.state = state_to_dict(state)
	game.status = GameStatus.IN_PROGRESS
	game.turn_started_at = timezone.now() - timedelta(seconds=turn_age_seconds)
	game.save(update_fields=["state", "status", "turn_started_at"])
	return game, alice_gp, bob_gp


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class NoTimerTests(TransactionTestCase):
	async def test_a_game_with_no_timer_never_expires_regardless_of_elapsed_time(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, alice_gp, _ = await sync_to_async(_make_timed_game)(alice, bob, None, 86400)

		communicator, _ = await _connect_to_game(alice, game)
		state = await communicator.receive_json_from()
		self.assertEqual(state["current_player_id"], str(alice_gp.pk))

		await communicator.disconnect()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class NotYetExpiredTests(TransactionTestCase):
	async def test_turn_does_not_expire_before_the_timer_elapses(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, alice_gp, _ = await sync_to_async(_make_timed_game)(alice, bob, 30, 5)

		communicator, _ = await _connect_to_game(alice, game)
		state = await communicator.receive_json_from()
		self.assertEqual(state["current_player_id"], str(alice_gp.pk))

		await communicator.disconnect()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class ExpiredTurnTests(TransactionTestCase):
	async def test_an_overdue_turn_auto_passes_to_the_next_player(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, alice_gp, bob_gp = await sync_to_async(_make_timed_game)(alice, bob, 10, 60)

		communicator, _ = await _connect_to_game(alice, game)
		state = await communicator.receive_json_from()
		self.assertEqual(state["current_player_id"], str(bob_gp.pk))

		await communicator.disconnect()

	async def test_expiry_is_checked_on_connect_not_only_on_incoming_messages(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, alice_gp, bob_gp = await sync_to_async(_make_timed_game)(alice, bob, 10, 60)

		communicator, _ = await _connect_to_game(bob, game)
		state = await communicator.receive_json_from()
		self.assertEqual(state["current_player_id"], str(bob_gp.pk))

		await communicator.disconnect()

	async def test_resets_turn_started_at_after_auto_passing(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, _, _ = await sync_to_async(_make_timed_game)(alice, bob, 10, 60)

		communicator, _ = await _connect_to_game(alice, game)
		await communicator.receive_json_from()
		await sync_to_async(game.refresh_from_db)()

		self.assertLess((timezone.now() - game.turn_started_at).total_seconds(), 5)

		await communicator.disconnect()

	async def test_broadcasts_the_expiry_even_if_a_late_action_afterward_is_rejected(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, alice_gp, bob_gp = await sync_to_async(_make_timed_game)(alice, bob, 10, 60)

		alice_comm, _ = await _connect_to_game(alice, game)
		alice_initial = await alice_comm.receive_json_from()
		self.assertEqual(alice_initial["current_player_id"], str(bob_gp.pk))
		self.assertFalse(alice_initial["has_drawn_this_turn"])

		await alice_comm.send_json_to({"action": "draw_card"})
		error = await alice_comm.receive_json_from()
		self.assertEqual(error["type"], "error")

		await alice_comm.disconnect()