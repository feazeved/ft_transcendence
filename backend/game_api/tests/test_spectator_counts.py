from unittest.mock import patch

import redis
from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from .. import spectators
from ..models import Game, GameStatus

User = get_user_model()


class RedisIsDownTests(TestCase):
	"""
	The spectator count is a decoration; the room list is the only way into a
	game. One must never be able to take the other down.
	"""

	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="a@example.com", password="x")

	def test_the_room_list_still_answers_when_redis_is_unreachable(self):
		Game.objects.create(host=self.alice, max_seats=4, starting_hand_size=7, status=GameStatus.PENDING)
		self.client.login(username="alice", password="x")

		with patch.object(spectators._redis_client, "mget", side_effect=redis.ConnectionError("down")):
			response = self.client.get(reverse("game-list"))

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]["spectator_count"], 0)

	def test_a_single_count_reads_zero_when_redis_is_unreachable(self):
		with patch.object(spectators._redis_client, "get", side_effect=redis.ConnectionError("down")):
			self.assertEqual(spectators.spectator_count(1), 0)

	def test_registering_and_unregistering_survive_an_unreachable_redis(self):
		with patch.object(spectators._redis_client, "incr", side_effect=redis.ConnectionError("down")):
			self.assertEqual(spectators.register_spectator(1), 0)
		with patch.object(spectators._redis_client, "decr", side_effect=redis.ConnectionError("down")):
			self.assertEqual(spectators.unregister_spectator(1), 0)

	def test_a_batch_answers_zero_for_every_game_it_was_asked_about(self):
		with patch.object(spectators._redis_client, "mget", side_effect=redis.ConnectionError("down")):
			self.assertEqual(spectators.spectator_counts([7, 8, 9]), {7: 0, 8: 0, 9: 0})


class BatchCountTests(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="a@example.com", password="x")

	def test_counts_come_back_keyed_by_game_with_missing_rooms_reading_zero(self):
		self.assertEqual(spectators.spectator_counts([]), {})

		with patch.object(spectators._redis_client, "mget", return_value=["3", None]) as mget:
			self.assertEqual(spectators.spectator_counts([1, 2]), {1: 3, 2: 0})

		mget.assert_called_once_with(["spectators:1", "spectators:2"])

	def test_the_room_list_reads_every_count_in_one_round_trip(self):
		# The whole point of the batch: one Redis call for the page, not one per
		# room on the request Home cannot do without.
		for _ in range(3):
			Game.objects.create(host=self.alice, max_seats=4, starting_hand_size=7, status=GameStatus.PENDING)
		self.client.login(username="alice", password="x")

		with patch.object(spectators._redis_client, "mget", return_value=[None, None, None]) as mget:
			response = self.client.get(reverse("game-list"))

		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 3)
		self.assertEqual(mget.call_count, 1)
