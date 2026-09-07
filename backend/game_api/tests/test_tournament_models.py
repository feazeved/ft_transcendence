from django.contrib.auth import get_user_model
from django.test import TestCase
from django.utils import timezone

from ..models import Game, GameStatus, Tournament, TournamentParticipant

User = get_user_model()


def _make_tournament(n_participants, max_participants=None):
	creator = User.objects.create_user(username="creator", email="creator@example.com", password="x")
	users = [creator] + [
		User.objects.create_user(username=f"p{i}", email=f"p{i}@example.com", password="x")
		for i in range(n_participants - 1)
	]
	tournament = Tournament.objects.create(
		name="Test Cup", created_by=creator, max_participants=max_participants or n_participants
	)
	for user in users:
		TournamentParticipant.objects.create(tournament=tournament, user=user)
	return tournament, users


def _finish(game, winner):
	game.status = GameStatus.FINISHED
	game.winner = winner
	game.finished_at = timezone.now()
	game.save(update_fields=["status", "winner", "finished_at"])


class StartTests(TestCase):
	def test_start_moves_status_to_in_progress(self):
		tournament, _ = _make_tournament(4)
		tournament.start()
		self.assertEqual(tournament.status, GameStatus.IN_PROGRESS)

	def test_start_assigns_a_unique_seed_to_every_participant(self):
		tournament, users = _make_tournament(6)
		tournament.start()
		seeds = list(tournament.participants.values_list("seed", flat=True))
		self.assertEqual(sorted(seeds), [1, 2, 3, 4, 5, 6])

	def test_even_bracket_has_no_byes(self):
		tournament, _ = _make_tournament(4)
		tournament.start()
		round1 = Game.objects.filter(tournament=tournament, tournament_round=1)
		self.assertEqual(round1.count(), 2)
		self.assertTrue(all(g.status == GameStatus.PENDING for g in round1))

	def test_odd_bracket_creates_exactly_one_bye(self):
		tournament, _ = _make_tournament(5)
		tournament.start()
		round1 = list(Game.objects.filter(tournament=tournament, tournament_round=1))
		self.assertEqual(len(round1), 3)
		finished = [g for g in round1 if g.status == GameStatus.FINISHED]
		pending = [g for g in round1 if g.status == GameStatus.PENDING]
		self.assertEqual(len(finished), 1)
		self.assertEqual(len(pending), 2)

	def test_a_bye_game_has_exactly_one_player_and_a_winner_already_set(self):
		tournament, _ = _make_tournament(3)
		tournament.start()
		bye_game = Game.objects.get(tournament=tournament, tournament_round=1, status=GameStatus.FINISHED)
		self.assertEqual(bye_game.players.count(), 1)
		self.assertIsNotNone(bye_game.winner)
		self.assertEqual(bye_game.players.first().user, bye_game.winner)

	def test_every_participant_appears_in_exactly_one_round_1_game(self):
		tournament, users = _make_tournament(5)
		tournament.start()
		seated_user_ids = set()
		for game in Game.objects.filter(tournament=tournament, tournament_round=1):
			for gp in game.players.all():
				seated_user_ids.add(gp.user_id)
		self.assertEqual(seated_user_ids, {u.pk for u in users})


class ProgressionTests(TestCase):
	def test_round_does_not_advance_until_every_match_finishes(self):
		tournament, _ = _make_tournament(4)
		tournament.start()
		round1 = list(Game.objects.filter(tournament=tournament, tournament_round=1))
		_finish(round1[0], round1[0].players.first().user)
		tournament.maybe_advance(1)
		self.assertFalse(Game.objects.filter(tournament=tournament, tournament_round=2).exists())

	def test_round_advances_once_every_match_finishes(self):
		tournament, _ = _make_tournament(4)
		tournament.start()
		for game in Game.objects.filter(tournament=tournament, tournament_round=1):
			_finish(game, game.players.first().user)
			tournament.maybe_advance(1)
		self.assertTrue(Game.objects.filter(tournament=tournament, tournament_round=2).exists())

	def test_a_bye_recipient_is_included_in_the_next_rounds_pool(self):
		tournament, _ = _make_tournament(5)
		tournament.start()
		bye_winner = Game.objects.get(
			tournament=tournament, tournament_round=1, status=GameStatus.FINISHED
		).winner

		for game in Game.objects.filter(tournament=tournament, tournament_round=1, status=GameStatus.PENDING):
			_finish(game, game.players.first().user)
			tournament.maybe_advance(1)

		round2_players = set()
		for game in Game.objects.filter(tournament=tournament, tournament_round=2):
			for gp in game.players.all():
				round2_players.add(gp.user_id)
		self.assertIn(bye_winner.pk, round2_players)
		self.assertEqual(len(round2_players), 3)

	def test_tournament_finishes_when_only_one_winner_remains(self):
		tournament, _ = _make_tournament(4)
		tournament.start()
		for game in Game.objects.filter(tournament=tournament, tournament_round=1):
			_finish(game, game.players.first().user)
			tournament.maybe_advance(1)

		final = Game.objects.get(tournament=tournament, tournament_round=2)
		final_winner = final.players.first().user
		_finish(final, final_winner)
		tournament.maybe_advance(2)

		tournament.refresh_from_db()
		self.assertEqual(tournament.status, GameStatus.FINISHED)
		self.assertEqual(tournament.winner, final_winner)
		self.assertIsNotNone(tournament.finished_at)

	def test_two_participant_tournament_finishes_after_one_match(self):
		tournament, _ = _make_tournament(2)
		tournament.start()
		game = Game.objects.get(tournament=tournament, tournament_round=1)
		winner = game.players.first().user
		_finish(game, winner)
		tournament.maybe_advance(1)

		tournament.refresh_from_db()
		self.assertEqual(tournament.status, GameStatus.FINISHED)
		self.assertEqual(tournament.winner, winner)