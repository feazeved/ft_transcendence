from django.contrib.auth import get_user_model
from django.test import TestCase

from .. import consumers, presence
from ..models import Game, GamePlayer, GameStatus
from ..serializers import PublicProfileSerializer

User = get_user_model()


class PresencePlaceTests(TestCase):
	"""
	§7.1 — the chat dock's four states. Two of them were unreachable while
	presence only said online or offline: the client had nothing to build them
	from.
	"""

	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="a@example.com", password="x")

	def tearDown(self):
		for key in presence._redis_client.keys("presence:connections:*"):
			presence._redis_client.delete(key)

	def _room(self, status, connected=True):
		game = Game.objects.create(
			host=self.alice, max_seats=4, starting_hand_size=7, status=status,
		)
		GamePlayer.objects.create(game=game, user=self.alice, seat=0, is_connected=connected)
		return game

	def test_somebody_in_no_room_is_just_online(self):
		self.assertEqual(consumers.presence_state(self.alice.pk), ("online", None))

	def test_a_pending_room_reads_as_a_lobby_with_its_code(self):
		game = self._room(GameStatus.PENDING)
		self.assertEqual(consumers.presence_state(self.alice.pk), ("lobby", game.join_code))

	def test_a_running_game_reads_as_a_game_with_its_code(self):
		game = self._room(GameStatus.IN_PROGRESS)
		self.assertEqual(consumers.presence_state(self.alice.pk), ("game", game.join_code))

	def test_a_seat_that_is_not_connected_does_not_put_them_anywhere(self):
		# The seat outlives the socket — it is kept on purpose when somebody
		# leaves mid-game (§2.6) — so a seat alone must not claim they are there.
		self._room(GameStatus.IN_PROGRESS, connected=False)
		self.assertEqual(consumers.presence_state(self.alice.pk), ("online", None))

	def test_a_finished_game_does_not_put_them_anywhere(self):
		self._room(GameStatus.FINISHED)
		self.assertEqual(consumers.presence_state(self.alice.pk), ("online", None))

	def test_the_profile_carries_the_place_for_a_friends_list_that_just_loaded(self):
		# A page that has only just loaded has had no socket frame yet, so the
		# first answer has to come down with the friends list.
		game = self._room(GameStatus.PENDING)
		presence.register_connection(self.alice.pk)
		self.alice.refresh_from_db()

		data = PublicProfileSerializer(self.alice).data
		self.assertEqual(data["presence"], {"status": "lobby", "room_code": game.join_code})

	# Why offline is asked first: a seat can outlive its person — kill the backend
	# mid-game and every `is_connected` stays true — while a presence key expires.
	def test_a_seat_left_behind_by_somebody_who_is_gone_says_offline(self):
		self._room(GameStatus.PENDING)
		data = PublicProfileSerializer(self.alice).data
		self.assertEqual(data["presence"], {"status": "offline", "room_code": None})

	def test_an_offline_profile_says_offline_without_asking_where(self):
		stranger = User.objects.create_user(username="ghost", email="g@example.com", password="x")
		data = PublicProfileSerializer(stranger).data
		self.assertEqual(data["presence"], {"status": "offline", "room_code": None})
