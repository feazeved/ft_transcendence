from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone

from ..models import Game, GamePlayer, GameStatus

User = get_user_model()


def _finished_game(winner, others, **game_kwargs):
	game = Game.objects.create(
		host=winner, max_seats=4, starting_hand_size=7, status=GameStatus.FINISHED,
		winner=winner, finished_at=timezone.now(), **game_kwargs,
	)
	GamePlayer.objects.create(game=game, user=winner, seat=0, finish_position=1)
	for i, user in enumerate(others, start=1):
		GamePlayer.objects.create(game=game, user=user, seat=i, finish_position=i + 1)
	return game


class MatchHistoryTests(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="x")
		self.client.login(username="alice", password="x")

	def test_lists_a_finished_game_the_user_played_in(self):
		_finished_game(winner=self.alice, others=[self.bob])
		response = self.client.get(reverse("match-history", args=[self.alice.public_id]))
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["count"], 1)

	def test_does_not_list_a_pending_game(self):
		game = Game.objects.create(host=self.alice, max_seats=4, starting_hand_size=7)
		GamePlayer.objects.create(game=game, user=self.alice, seat=0)
		response = self.client.get(reverse("match-history", args=[self.alice.public_id]))
		self.assertEqual(response.data["count"], 0)

	def test_does_not_list_an_in_progress_game(self):
		game = Game.objects.create(
			host=self.alice, max_seats=4, starting_hand_size=7, status=GameStatus.IN_PROGRESS
		)
		GamePlayer.objects.create(game=game, user=self.alice, seat=0)
		response = self.client.get(reverse("match-history", args=[self.alice.public_id]))
		self.assertEqual(response.data["count"], 0)

	def test_most_recent_game_first(self):
		older = _finished_game(winner=self.alice, others=[self.bob])
		older.finished_at = timezone.now() - timezone.timedelta(days=1)
		older.save(update_fields=["finished_at"])
		newer = _finished_game(winner=self.alice, others=[self.bob])

		response = self.client.get(reverse("match-history", args=[self.alice.public_id]))
		self.assertEqual(response.data["results"][0]["public_id"], str(newer.public_id))
		self.assertEqual(response.data["results"][1]["public_id"], str(older.public_id))

	def test_won_is_true_from_the_winners_perspective(self):
		_finished_game(winner=self.alice, others=[self.bob])
		response = self.client.get(reverse("match-history", args=[self.alice.public_id]))
		self.assertTrue(response.data["results"][0]["won"])

	def test_won_is_false_from_a_losers_perspective(self):
		_finished_game(winner=self.alice, others=[self.bob])
		response = self.client.get(reverse("match-history", args=[self.bob.public_id]))
		self.assertFalse(response.data["results"][0]["won"])

	def test_viewable_for_another_user_not_just_yourself(self):
		_finished_game(winner=self.bob, others=[self.alice])
		response = self.client.get(reverse("match-history", args=[self.bob.public_id]))
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["count"], 1)


class UserStatsTests(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="x")
		self.client.login(username="alice", password="x")

	def test_a_user_with_no_games_has_zeroed_stats(self):
		response = self.client.get(reverse("user-stats", args=[self.alice.public_id]))
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data, {"games_played": 0, "games_won": 0, "games_lost": 0, "win_rate": 0.0})

	def test_games_played_only_counts_finished_games(self):
		pending = Game.objects.create(host=self.alice, max_seats=4, starting_hand_size=7)
		GamePlayer.objects.create(game=pending, user=self.alice, seat=0)
		_finished_game(winner=self.alice, others=[self.bob])

		response = self.client.get(reverse("user-stats", args=[self.alice.public_id]))
		self.assertEqual(response.data["games_played"], 1)

	def test_wins_losses_and_win_rate(self):
		_finished_game(winner=self.alice, others=[self.bob])
		_finished_game(winner=self.alice, others=[self.bob])
		_finished_game(winner=self.bob, others=[self.alice])

		response = self.client.get(reverse("user-stats", args=[self.alice.public_id]))
		self.assertEqual(response.data["games_played"], 3)
		self.assertEqual(response.data["games_won"], 2)
		self.assertEqual(response.data["games_lost"], 1)
		self.assertAlmostEqual(response.data["win_rate"], 66.7, places=1)


class LeaderboardTests(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="x")
		self.carol = User.objects.create_user(username="carol", email="carol@example.com", password="x")
		self.client.login(username="alice", password="x")

	def test_orders_by_wins_descending(self):
		_finished_game(winner=self.bob, others=[self.alice, self.carol])
		_finished_game(winner=self.bob, others=[self.alice, self.carol])
		_finished_game(winner=self.alice, others=[self.bob, self.carol])

		response = self.client.get(reverse("leaderboard"))
		usernames = [entry["username"] for entry in response.data["results"]]
		self.assertEqual(usernames[0], "bob")
		self.assertEqual(usernames[1], "alice")

	def test_excludes_users_who_have_never_played(self):
		_finished_game(winner=self.alice, others=[self.bob])
		response = self.client.get(reverse("leaderboard"))
		usernames = [entry["username"] for entry in response.data["results"]]
		self.assertNotIn("carol", usernames)

	def test_includes_computed_win_rate(self):
		_finished_game(winner=self.alice, others=[self.bob])
		response = self.client.get(reverse("leaderboard"))
		alice_entry = next(e for e in response.data["results"] if e["username"] == "alice")
		self.assertEqual(alice_entry["games_played"], 1)
		self.assertEqual(alice_entry["games_won"], 1)
		self.assertEqual(alice_entry["win_rate"], 100.0)