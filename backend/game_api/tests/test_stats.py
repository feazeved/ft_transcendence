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

	def test_sorting_by_win_rate_beats_sorting_by_wins(self):
		# The whole point of sorting on the server. bob wins the most but also
		# loses one, so 2/3; carol wins her only game, so 1/1. The two orders
		# must genuinely differ, or the test would pass with the parameter
		# ignored — which is exactly the bug this fixes.
		_finished_game(winner=self.bob, others=[self.alice])
		_finished_game(winner=self.bob, others=[self.alice])
		_finished_game(winner=self.carol, others=[self.alice, self.bob])

		by_wins = self.client.get(reverse("leaderboard"), {"ordering": "wins"})
		self.assertEqual(by_wins.data["results"][0]["username"], "bob")

		by_rate = self.client.get(reverse("leaderboard"), {"ordering": "win_rate"})
		self.assertEqual(by_rate.data["results"][0]["username"], "carol")
		self.assertEqual(by_rate.data["results"][0]["win_rate"], 100.0)

	def test_sorting_by_games_counts_games_not_wins(self):
		# alice loses everything and has played the most; she comes first here
		# and last by wins.
		_finished_game(winner=self.bob, others=[self.alice])
		_finished_game(winner=self.bob, others=[self.alice])
		_finished_game(winner=self.carol, others=[self.alice])

		response = self.client.get(reverse("leaderboard"), {"ordering": "games"})
		self.assertEqual(response.data["results"][0]["username"], "alice")
		self.assertEqual(response.data["results"][0]["games_played"], 3)

	def test_someone_who_never_played_sorts_last_by_win_rate(self):
		# A rate of 0/0 must be 0.0 and not blow up the query.
		_finished_game(winner=self.alice, others=[self.bob])

		response = self.client.get(reverse("leaderboard"), {"ordering": "win_rate"})
		usernames = [e["username"] for e in response.data["results"]]
		self.assertEqual(usernames[0], "alice")
		self.assertEqual(usernames[-1], "carol")

	def test_an_unknown_ordering_falls_back_instead_of_failing(self):
		# A cached client can be a version behind, and a leaderboard in the
		# default order beats an error page.
		_finished_game(winner=self.bob, others=[self.alice])

		response = self.client.get(reverse("leaderboard"), {"ordering": "height"})
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["results"][0]["username"], "bob")

	def test_the_order_is_total_so_a_tie_cannot_shuffle_between_pages(self):
		# Three players, no games, everything equal — without a last unique key
		# the database may return them in any order, and someone paging through
		# would see a player twice or not at all.
		first = [e["username"] for e in self.client.get(reverse("leaderboard")).data["results"]]
		second = [e["username"] for e in self.client.get(reverse("leaderboard")).data["results"]]
		self.assertEqual(first, second)
		self.assertEqual(first, sorted(first))

	def test_includes_users_who_have_never_played(self):
		response = self.client.get(reverse("leaderboard"))
		entries = {e["username"]: e for e in response.data["results"]}
		self.assertIn("carol", entries)
		self.assertEqual(entries["carol"]["games_played"], 0)
		self.assertEqual(entries["carol"]["win_rate"], 0.0)

	def test_includes_computed_win_rate(self):
		_finished_game(winner=self.alice, others=[self.bob])
		response = self.client.get(reverse("leaderboard"))
		alice_entry = next(e for e in response.data["results"] if e["username"] == "alice")
		self.assertEqual(alice_entry["games_played"], 1)
		self.assertEqual(alice_entry["games_won"], 1)
		self.assertEqual(alice_entry["win_rate"], 100.0)
