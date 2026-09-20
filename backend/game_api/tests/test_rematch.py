from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from ..models import Game, GamePlayer, GameSpectator, GameStatus

User = get_user_model()


class RematchTests(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="a@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="b@example.com", password="x")
		self.carol = User.objects.create_user(username="carol", email="c@example.com", password="x")
		self.game = Game.objects.create(
			host=self.alice, name="Sala", max_seats=4, starting_hand_size=5,
			turn_timer_seconds=30, jump_in=True, status=GameStatus.FINISHED, winner=self.alice,
		)
		GamePlayer.objects.create(game=self.game, user=self.alice, seat=0, finish_position=1)
		GamePlayer.objects.create(game=self.game, user=self.bob, seat=2, finish_position=2)
		self.code = self.game.join_code

	def login(self, user):
		self.client.login(username=user.username, password="x")

	def rematch(self, code=None):
		return self.client.post(reverse("game-rematch", args=[code or self.code]))

	def test_the_code_now_opens_a_fresh_pending_room(self):
		self.login(self.alice)
		response = self.rematch()
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["join_code"], self.code)
		self.assertEqual(response.data["status"], GameStatus.PENDING)
		self.assertNotEqual(response.data["public_id"], str(self.game.public_id))

	def test_the_finished_game_keeps_its_result(self):
		# The leaderboard and the match history both count finished games, so
		# reusing the row would erase what was just played for.
		self.login(self.alice)
		self.rematch()
		self.game.refresh_from_db()
		self.assertEqual(self.game.status, GameStatus.FINISHED)
		self.assertEqual(self.game.winner, self.alice)
		self.assertEqual(GamePlayer.objects.filter(game=self.game).count(), 2)
		self.assertNotEqual(self.game.join_code, self.code)

	def test_everyone_keeps_the_seat_they_had(self):
		self.login(self.alice)
		response = self.rematch()
		new_game = Game.objects.get(public_id=response.data["public_id"])
		seats = dict(GamePlayer.objects.filter(game=new_game).values_list("user__username", "seat"))
		self.assertEqual(seats, {"alice": 0, "bob": 2})

	def test_the_settings_come_across(self):
		self.login(self.alice)
		response = self.rematch()
		new_game = Game.objects.get(public_id=response.data["public_id"])
		self.assertEqual(new_game.name, "Sala")
		self.assertEqual(new_game.max_seats, 4)
		self.assertEqual(new_game.starting_hand_size, 5)
		self.assertEqual(new_game.turn_timer_seconds, 30)
		self.assertTrue(new_game.jump_in)
		self.assertEqual(new_game.host, self.alice)

	def test_spectators_come_across_too(self):
		GameSpectator.objects.create(game=self.game, user=self.carol)
		self.login(self.alice)
		response = self.rematch()
		new_game = Game.objects.get(public_id=response.data["public_id"])
		self.assertTrue(GameSpectator.objects.filter(game=new_game, user=self.carol).exists())

	def test_pressing_it_twice_lands_in_the_same_room(self):
		# Four people pressing "Back to room" at once must not make four rooms.
		self.login(self.alice)
		first = self.rematch()
		self.client.logout()
		self.login(self.bob)
		second = self.rematch()
		self.assertEqual(second.status_code, 200)
		self.assertEqual(first.data["public_id"], second.data["public_id"])
		self.assertEqual(Game.objects.filter(status=GameStatus.PENDING).count(), 1)

	def test_somebody_who_was_not_there_cannot_reopen_it(self):
		self.login(self.carol)
		self.assertEqual(self.rematch().status_code, 403)

	def test_a_game_still_being_played_cannot_be_reopened(self):
		self.game.status = GameStatus.IN_PROGRESS
		self.game.save(update_fields=["status"])
		self.login(self.alice)
		self.assertEqual(self.rematch().status_code, 400)

	def test_a_seat_whose_account_was_deleted_is_not_carried_over(self):
		User.objects.filter(pk=self.bob.pk).delete()
		self.login(self.alice)
		response = self.rematch()
		new_game = Game.objects.get(public_id=response.data["public_id"])
		self.assertEqual(GamePlayer.objects.filter(game=new_game).count(), 1)


class LeaveInProgressTests(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="a@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="b@example.com", password="x")
		self.game = Game.objects.create(
			host=self.alice, max_seats=4, starting_hand_size=7,
			turn_timer_seconds=30, status=GameStatus.IN_PROGRESS,
		)
		self.alice_gp = GamePlayer.objects.create(game=self.game, user=self.alice, seat=0, is_connected=True)
		self.bob_gp = GamePlayer.objects.create(game=self.game, user=self.bob, seat=1, is_connected=True)

	def login(self, user):
		self.client.login(username=user.username, password="x")

	def test_a_player_can_leave_a_game_in_progress(self):
		self.login(self.bob)
		response = self.client.post(reverse("game-leave", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 204)

	def test_the_seat_stays_but_goes_quiet(self):
		# The hand has been dealt and the history reads these rows, so the seat
		# is not deleted — the turn timer carries the game past them instead.
		self.login(self.bob)
		self.client.post(reverse("game-leave", args=[self.game.public_id]))
		self.bob_gp.refresh_from_db()
		self.assertFalse(self.bob_gp.is_connected)
		self.assertTrue(GamePlayer.objects.filter(pk=self.bob_gp.pk).exists())

	def test_a_finished_game_cannot_be_left(self):
		self.game.status = GameStatus.FINISHED
		self.game.save(update_fields=["status"])
		self.login(self.bob)
		response = self.client.post(reverse("game-leave", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 400)

	def test_somebody_who_is_not_playing_cannot_leave(self):
		carol = User.objects.create_user(username="carol", email="c@example.com", password="x")
		self.client.login(username=carol.username, password="x")
		response = self.client.post(reverse("game-leave", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 400)
