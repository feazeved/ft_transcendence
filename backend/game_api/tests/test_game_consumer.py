from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY, get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.test import TransactionTestCase, override_settings
from django.db import connection

from core.asgi import application
from ..models import Game, GamePlayer, GameStatus

User = get_user_model()

IN_MEMORY_LAYER = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}

async def drain_on_commit():
	def _drain():
		while connection.run_on_commit:
			callbacks = connection.run_on_commit
			connection.run_on_commit = []
			for _, callback in callbacks:
				callback()

	await sync_to_async(_drain)()

# The table log rides this same socket now, so a test waiting for the state has
# to step over the line that narrates it.
async def _next_state(communicator):
	while True:
		frame = await communicator.receive_json_from()
		if frame["type"] != "chat_message":
			return frame

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
	await drain_on_commit()
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
	async def test_a_non_participant_connects_as_a_spectator_not_rejected(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		outsider = await sync_to_async(User.objects.create_user)(username="eve", email="e@example.com", password="x")
		game = await sync_to_async(Game.objects.create)(host=alice, max_seats=4, starting_hand_size=7)
		await sync_to_async(GamePlayer.objects.create)(game=game, user=alice, seat=0)

		communicator, connected = await _connect_to_game(outsider, game)
		self.assertTrue(connected)
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

	async def test_game_state_carries_every_house_rule_even_when_all_are_off(self):
		# All five keys, always. The client treats a missing key and False the
		# same way, so an incomplete object would be a silent lie rather than an
		# error, and the table would just never offer the rule.
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, _, _ = await sync_to_async(_make_started_game)(alice, bob)

		communicator, _ = await _connect_to_game(alice, game)
		message = await communicator.receive_json_from()

		self.assertEqual(
			message["settings"],
			{
				"draw_stacking": False,
				"jump_in": False,
				"draw_until_playable": False,
				"seven_swap": False,
				"zero_swap": False,
			},
		)

		await communicator.disconnect()

	async def test_game_state_reports_the_house_rules_the_room_was_created_with(self):
		# The engine is already given these at start; this is the client being
		# told, which is what decides whether the hand is playable out of turn
		# and whether the swap prompt can open at all.
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, _, _ = await sync_to_async(_make_started_game)(alice, bob, jump_in=True, seven_swap=True)

		communicator, _ = await _connect_to_game(alice, game)
		message = await communicator.receive_json_from()

		self.assertTrue(message["settings"]["jump_in"])
		self.assertTrue(message["settings"]["seven_swap"])
		self.assertFalse(message["settings"]["zero_swap"])
		self.assertFalse(message["settings"]["draw_stacking"])
		self.assertFalse(message["settings"]["draw_until_playable"])

		await communicator.disconnect()

	async def test_a_spectator_leaving_is_taken_off_the_count(self):
		# Nothing covered this before, which is how a merge could drop the
		# `unregister_spectator` call and leave the watching count climbing for
		# ever with nobody noticing. `connect()` counts a spectator in; the point
		# here is that `disconnect()` counts them back out.
		from .. import spectators

		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		outsider = await sync_to_async(User.objects.create_user)(username="eve", email="e@example.com", password="x")
		game = await sync_to_async(Game.objects.create)(host=alice, max_seats=4, starting_hand_size=7)
		await sync_to_async(GamePlayer.objects.create)(game=game, user=alice, seat=0)

		before = await sync_to_async(spectators.spectator_count)(game.pk)

		communicator, connected = await _connect_to_game(outsider, game)
		self.assertTrue(connected)
		self.assertEqual(await sync_to_async(spectators.spectator_count)(game.pk), before + 1)

		await communicator.disconnect()
		self.assertEqual(await sync_to_async(spectators.spectator_count)(game.pk), before)

	async def test_a_seated_player_leaving_does_not_touch_the_spectator_count(self):
		from .. import spectators

		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, _, _ = await sync_to_async(_make_started_game)(alice, bob)

		before = await sync_to_async(spectators.spectator_count)(game.pk)
		communicator, _ = await _connect_to_game(alice, game)
		await communicator.disconnect()

		self.assertEqual(await sync_to_async(spectators.spectator_count)(game.pk), before)

	async def test_every_player_at_the_table_carries_a_face(self):
		# The table draws a photo per seat; without this the whole ring of
		# players was faceless.
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, _, _ = await sync_to_async(_make_started_game)(alice, bob)

		communicator, _ = await _connect_to_game(alice, game)
		message = await communicator.receive_json_from()

		self.assertEqual(len(message["players"]), 2)
		for player in message["players"]:
			# User.avatar_url falls back to the site default, so this is never
			# empty and never a broken image.
			self.assertTrue(player["avatar_url"])

		await communicator.disconnect()

	async def test_a_quiet_table_reports_no_draw_stack(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, _, _ = await sync_to_async(_make_started_game)(alice, bob)

		communicator, _ = await _connect_to_game(alice, game)
		message = await communicator.receive_json_from()

		self.assertIsNone(message["draw_stack"])

		await communicator.disconnect()

	async def test_a_running_draw_stack_is_reported_with_the_card_that_answers_it(self):
		# The engine calls the card `type` in its own modifier_state; the table
		# reads `card_type`, like every other card in the payload.
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game, _, _ = await sync_to_async(_make_started_game)(alice, bob, draw_stacking=True)

		def _stack_six():
			game.state["modifier_state"]["draw_stack"] = {"type": "draw_two", "count": 6}
			game.save(update_fields=["state"])

		await sync_to_async(_stack_six)()

		communicator, _ = await _connect_to_game(alice, game)
		message = await communicator.receive_json_from()

		self.assertEqual(message["draw_stack"], {"card_type": "draw_two", "count": 6})

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
		await drain_on_commit()

		alice_update = await _next_state(alice_comm)
		bob_update = await _next_state(bob_comm)
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
		await drain_on_commit()

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
		await drain_on_commit()

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
		await drain_on_commit()

		response = await communicator.receive_json_from()
		self.assertEqual(response["type"], "error")

		await communicator.disconnect()