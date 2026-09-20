from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY, get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.test import TransactionTestCase, override_settings

from core.asgi import application
from ..models import Game, GamePlayer, GameSpectator, GameStatus, Tournament, TournamentParticipant

User = get_user_model()

IN_MEMORY_LAYER = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


def _session_cookie_for(user):
	session = SessionStore()
	session[SESSION_KEY] = str(user.pk)
	session[BACKEND_SESSION_KEY] = "django.contrib.auth.backends.ModelBackend"
	session[HASH_SESSION_KEY] = user.get_session_auth_hash()
	session.save()
	return session.session_key


async def _lobby_for(user, game):
	session_key = await sync_to_async(_session_cookie_for)(user)
	communicator = WebsocketCommunicator(
		application, f"/ws/games/{game.public_id}/",
		headers=[(b"cookie", f"sessionid={session_key}".encode())],
	)
	connected, _ = await communicator.connect()
	assert connected
	message = await communicator.receive_json_from()
	await communicator.disconnect()
	return message


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER, GAME_MAX_SPECTATORS=6)
class LobbyPayloadTests(TransactionTestCase):
	"""
	The lobby message against `frontend/src/lib/fakeGameState.js`, which is the
	contract (ADR 0001). Every assertion here stands for something the Lobby
	draws: a seat's name and face, the host tag, the room's title, the code you
	read out to someone, the house-rule chips and who is watching.
	"""

	def _room(self, **kwargs):
		alice = User.objects.create_user(username="alice", email="a@example.com", password="x")
		bob = User.objects.create_user(username="bob", email="b@example.com", password="x")
		game = Game.objects.create(
			host=alice, name="Sala do Diogo", max_seats=4, starting_hand_size=5,
			turn_timer_seconds=30, status=GameStatus.PENDING, **kwargs,
		)
		GamePlayer.objects.create(game=game, user=alice, seat=0)
		GamePlayer.objects.create(game=game, user=bob, seat=1)
		return game, alice, bob

	async def test_the_room_says_its_own_name_and_code(self):
		# Without these the title was empty and the ROOM CODE button copied
		# nothing — which is how you tell somebody where to meet you.
		game, alice, _ = await sync_to_async(self._room)()
		message = await _lobby_for(alice, game)

		self.assertEqual(message["type"], "lobby")
		self.assertEqual(message["name"], "Sala do Diogo")
		self.assertEqual(message["code"], game.join_code)

	async def test_a_seat_carries_its_person_flat_not_nested_under_user(self):
		# The nesting is what made every name, photo and host tag read undefined.
		game, alice, _ = await sync_to_async(self._room)()
		message = await _lobby_for(alice, game)

		seat = message["seats"][0]
		self.assertNotIn("user", seat)
		self.assertEqual(seat["username"], "alice")
		self.assertTrue(seat["avatar_url"])
		self.assertTrue(seat["is_connected"])

	async def test_only_the_host_seat_is_marked_as_host(self):
		game, alice, _ = await sync_to_async(self._room)()
		message = await _lobby_for(alice, game)

		self.assertTrue(message["seats"][0]["is_host"])
		self.assertFalse(message["seats"][1]["is_host"])

	async def test_free_seats_are_null_and_the_row_is_as_long_as_the_room(self):
		game, alice, _ = await sync_to_async(self._room)()
		message = await _lobby_for(alice, game)

		self.assertEqual(len(message["seats"]), 4)
		self.assertIsNone(message["seats"][2])
		self.assertIsNone(message["seats"][3])

	async def test_settings_carry_the_hand_size_and_every_house_rule(self):
		# Missing, these made the panel show a dash and the chips read
		# "Classic rules only" in a room that had two rules switched on.
		game, alice, _ = await sync_to_async(self._room)(jump_in=True, seven_swap=True)
		message = await _lobby_for(alice, game)

		self.assertEqual(message["settings"]["starting_hand_size"], 5)
		self.assertEqual(message["settings"]["max_seats"], 4)
		self.assertEqual(message["settings"]["turn_timer_seconds"], 30)
		self.assertTrue(message["settings"]["allow_spectators"])
		self.assertTrue(message["settings"]["jump_in"])
		self.assertTrue(message["settings"]["seven_swap"])
		self.assertFalse(message["settings"]["zero_swap"])
		self.assertFalse(message["settings"]["draw_stacking"])
		self.assertFalse(message["settings"]["draw_until_playable"])

	async def test_spectators_come_back_as_a_list_of_names(self):
		# A count could fill "2/6" but could never say who was there.
		game, alice, _ = await sync_to_async(self._room)()
		watcher = await sync_to_async(User.objects.create_user)(
			username="wildboy42", email="w@example.com", password="x"
		)
		await sync_to_async(GameSpectator.objects.create)(game=game, user=watcher)

		message = await _lobby_for(alice, game)

		self.assertEqual(message["spectators"], [{"username": "wildboy42"}])

	async def test_nobody_watching_is_an_empty_list_not_a_zero(self):
		game, alice, _ = await sync_to_async(self._room)()
		message = await _lobby_for(alice, game)

		self.assertEqual(message["spectators"], [])

	async def test_a_seat_whose_account_was_deleted_still_draws(self):
		# GamePlayer.user is SET_NULL, so deleting an account empties the seat's
		# user without removing the seat. Reaching through it took the entire
		# lobby down with an AttributeError — for everybody in the room, not just
		# the person who left.
		game, alice, bob = await sync_to_async(self._room)()
		await sync_to_async(User.objects.filter(pk=bob.pk).delete)()

		message = await _lobby_for(alice, game)

		orphan = message["seats"][1]
		self.assertIsNotNone(orphan)
		self.assertIsNone(orphan["public_id"])
		self.assertTrue(orphan["username"])
		self.assertTrue(orphan["avatar_url"])
		self.assertFalse(orphan["is_host"])

	async def test_the_room_reports_how_many_may_watch(self):
		game, alice, _ = await sync_to_async(self._room)()
		message = await _lobby_for(alice, game)

		self.assertEqual(message["max_spectators"], 6)

	async def test_the_host_of_an_ordinary_room_may_start_it(self):
		game, alice, _ = await sync_to_async(self._room)()
		lobby = await _lobby_for(alice, game)
		self.assertTrue(lobby["you_may_start"])

	async def test_a_guest_in_an_ordinary_room_may_not(self):
		game, _, bob = await sync_to_async(self._room)()
		lobby = await _lobby_for(bob, game)
		self.assertFalse(lobby["you_may_start"])

	async def test_every_participant_at_a_tournament_table_may_start_it(self):
		def build():
			alice = User.objects.create_user(username="ana", email="ana@example.com", password="x")
			bob = User.objects.create_user(username="bea", email="bea@example.com", password="x")
			tournament = Tournament.objects.create(name="Cup", created_by=alice, max_participants=2)
			TournamentParticipant.objects.create(tournament=tournament, user=alice)
			TournamentParticipant.objects.create(tournament=tournament, user=bob)
			tournament.start()
			match = Game.objects.get(tournament=tournament, tournament_round=1)
			non_host = bob if match.host_id == alice.pk else alice
			return match, non_host

		match, non_host = await sync_to_async(build)()
		lobby = await _lobby_for(non_host, match)
		self.assertTrue(lobby["you_may_start"])

	async def test_an_ordinary_room_belongs_to_no_tournament(self):
		game, alice, _ = await sync_to_async(self._room)()
		lobby = await _lobby_for(alice, game)
		self.assertIsNone(lobby["tournament"])

	async def test_a_tournament_table_carries_the_code_of_its_tournament(self):
		def build():
			ana = User.objects.create_user(username="ana", email="ana@example.com", password="x")
			bea = User.objects.create_user(username="bea", email="bea@example.com", password="x")
			tournament = Tournament.objects.create(name="Cup", created_by=ana, max_participants=2)
			TournamentParticipant.objects.create(tournament=tournament, user=ana)
			TournamentParticipant.objects.create(tournament=tournament, user=bea)
			tournament.start()
			return Game.objects.get(tournament=tournament, tournament_round=1), ana, tournament

		match, ana, tournament = await sync_to_async(build)()
		lobby = await _lobby_for(ana, match)
		self.assertEqual(lobby["tournament"], tournament.join_code)
