from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from ..models import Game, GamePlayer, GameStatus, Tournament, TournamentParticipant

User = get_user_model()


def _make_tournament(n_participants, **config):
	creator = User.objects.create_user(username="creator", email="creator@example.com", password="x")
	users = [creator] + [
		User.objects.create_user(username=f"p{i}", email=f"p{i}@example.com", password="x")
		for i in range(n_participants - 1)
	]
	config.setdefault("max_participants", n_participants)
	tournament = Tournament.objects.create(name="Test Cup", created_by=creator, **config)
	for user in users:
		TournamentParticipant.objects.create(tournament=tournament, user=user)
	return tournament, users


def _finish(game, order=None):
	"""
	Finish a table, placing its players. `order` is the users in finishing order;
	by default they finish in seat order.
	"""
	seats = list(game.players.select_related("user").order_by("seat"))
	if order is None:
		order = [seat.user for seat in seats]
	by_user = {seat.user_id: seat for seat in seats}
	for position, user in enumerate(order, start=1):
		seat = by_user.get(user.pk)
		if seat is not None:
			GamePlayer.objects.filter(pk=seat.pk).update(finish_position=position)

	game.status = GameStatus.FINISHED
	game.winner = order[0]
	game.finished_at = timezone.now()
	game.save(update_fields=["status", "winner", "finished_at"])


class TableCountTests(TestCase):
	"""
	The backend has to seat exactly the shape the create dialog previewed with
	`computeStructure()`. A tournament that ran differently from the picture its
	host was shown would be invisible until somebody counted.
	"""

	def test_everybody_fits_at_one_table(self):
		tournament, _ = _make_tournament(4, players_per_table=5)
		self.assertEqual(tournament.table_count(4), 1)

	def test_tables_are_rounded_the_way_javascript_rounds(self):
		# floor(x + 0.5), not Python's round(), which rounds a half to even:
		# round(2.5) is 2 in Python and 3 in JavaScript.
		tournament, _ = _make_tournament(2, players_per_table=2)
		self.assertEqual(tournament.table_count(5), 3)

	def test_twenty_at_five_a_table(self):
		tournament, _ = _make_tournament(2, players_per_table=5)
		self.assertEqual(tournament.table_count(20), 4)
		self.assertEqual(tournament.table_count(8), 2)


class StartTests(TestCase):
	def test_start_moves_status_to_in_progress(self):
		tournament, _ = _make_tournament(4)
		tournament.start()
		self.assertEqual(tournament.status, GameStatus.IN_PROGRESS)

	def test_start_assigns_a_unique_seed_to_every_participant(self):
		tournament, _ = _make_tournament(6)
		tournament.start()
		seeds = list(tournament.participants.values_list("seed", flat=True))
		self.assertEqual(sorted(seeds), [1, 2, 3, 4, 5, 6])

	def test_a_small_tournament_is_one_table_and_that_table_is_the_final(self):
		# It used to pair people two at a time whatever the settings said.
		tournament, _ = _make_tournament(4, players_per_table=5)
		tournament.start()
		round1 = list(Game.objects.filter(tournament=tournament, tournament_round=1))
		self.assertEqual(len(round1), 1)
		self.assertEqual(round1[0].players.count(), 4)

	def test_a_big_tournament_is_split_into_tables(self):
		tournament, _ = _make_tournament(20, players_per_table=5, advance_per_table=2)
		tournament.start()
		round1 = list(Game.objects.filter(tournament=tournament, tournament_round=1))
		self.assertEqual(len(round1), 4)
		self.assertEqual(sorted(g.players.count() for g in round1), [5, 5, 5, 5])

	def test_tables_come_out_even_when_the_split_is_untidy(self):
		tournament, _ = _make_tournament(11, players_per_table=5, advance_per_table=2)
		tournament.start()
		sizes = sorted(g.players.count() for g in Game.objects.filter(tournament=tournament, tournament_round=1))
		self.assertEqual(sum(sizes), 11)
		self.assertLessEqual(max(sizes) - min(sizes), 1)

	def test_every_table_is_played_the_way_the_tournament_says(self):
		# The old bracket hardcoded max_seats=2 and a hand of seven, so none of
		# the host's settings ever reached the games.
		tournament, _ = _make_tournament(
			20, players_per_table=5, starting_hand_size=9, turn_timer_seconds=45, jump_in=True, seven_swap=True,
		)
		tournament.start()
		for game in Game.objects.filter(tournament=tournament, tournament_round=1):
			self.assertEqual(game.starting_hand_size, 9)
			self.assertEqual(game.turn_timer_seconds, 45)
			self.assertEqual(game.max_seats, 5)
			self.assertTrue(game.jump_in)
			self.assertTrue(game.seven_swap)
			self.assertFalse(game.zero_swap)

	def test_every_participant_appears_in_exactly_one_round_1_game(self):
		tournament, users = _make_tournament(11, players_per_table=5)
		tournament.start()
		seated = [
			gp.user_id
			for game in Game.objects.filter(tournament=tournament, tournament_round=1)
			for gp in game.players.all()
		]
		self.assertEqual(sorted(seated), sorted(u.pk for u in users))


class ProgressionTests(TestCase):
	def test_round_does_not_advance_until_every_table_finishes(self):
		tournament, _ = _make_tournament(20, players_per_table=5, advance_per_table=2)
		tournament.start()
		round1 = list(Game.objects.filter(tournament=tournament, tournament_round=1))
		_finish(round1[0])
		tournament.maybe_advance(1)
		self.assertFalse(Game.objects.filter(tournament=tournament, tournament_round=2).exists())

	def test_the_top_of_each_table_goes_through(self):
		tournament, _ = _make_tournament(20, players_per_table=5, advance_per_table=2)
		tournament.start()

		expected = set()
		for game in Game.objects.filter(tournament=tournament, tournament_round=1):
			order = [seat.user for seat in game.players.select_related("user").order_by("seat")]
			_finish(game, order)
			expected.update(u.pk for u in order[:2])
		tournament.maybe_advance(1)

		through = {
			gp.user_id
			for game in Game.objects.filter(tournament=tournament, tournament_round=2)
			for gp in game.players.all()
		}
		self.assertEqual(through, expected)
		self.assertEqual(len(through), 8)

	def test_a_tournament_runs_down_to_one_final_table(self):
		tournament, _ = _make_tournament(20, players_per_table=5, advance_per_table=2)
		tournament.start()

		round_number = 1
		while True:
			games = list(Game.objects.filter(tournament=tournament, tournament_round=round_number))
			if not games:
				break
			for game in games:
				if game.status != GameStatus.FINISHED:
					_finish(game)
			tournament.maybe_advance(round_number)
			tournament.refresh_from_db()
			if tournament.status == GameStatus.FINISHED:
				break
			round_number += 1

		self.assertEqual(tournament.status, GameStatus.FINISHED)
		self.assertIsNotNone(tournament.winner)
		self.assertIsNotNone(tournament.finished_at)
		# 20 -> 4 tables -> 8 -> 2 tables -> 4 -> the final.
		self.assertEqual(round_number, 3)

	def test_the_podium_is_written_from_the_final_table(self):
		# Nothing used to write final_position at all: the column existed, the
		# serializer sent it, and every value was null — so even a finished
		# tournament showed no podium.
		tournament, users = _make_tournament(4, players_per_table=5)
		tournament.start()
		final = Game.objects.get(tournament=tournament, tournament_round=1)
		order = [seat.user for seat in final.players.select_related("user").order_by("seat")]
		_finish(final, order)
		tournament.maybe_advance(1)

		tournament.refresh_from_db()
		self.assertEqual(tournament.status, GameStatus.FINISHED)
		self.assertEqual(tournament.winner, order[0])

		places = dict(tournament.participants.values_list("user_id", "final_position"))
		self.assertEqual(places[order[0].pk], 1)
		self.assertEqual(places[order[1].pk], 2)
		self.assertEqual(places[order[2].pk], 3)

	def test_two_participants_finish_after_one_table(self):
		tournament, _ = _make_tournament(2)
		tournament.start()
		game = Game.objects.get(tournament=tournament, tournament_round=1)
		order = [seat.user for seat in game.players.select_related("user").order_by("seat")]
		_finish(game, order)
		tournament.maybe_advance(1)

		tournament.refresh_from_db()
		self.assertEqual(tournament.status, GameStatus.FINISHED)
		self.assertEqual(tournament.winner, order[0])
