from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse

from ..models import Game, GamePlayer, GameSpectator, GameStatus

User = get_user_model()


class SeatTestCase(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="a@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="b@example.com", password="x")
		self.carol = User.objects.create_user(username="carol", email="c@example.com", password="x")
		self.game = Game.objects.create(
			host=self.alice, name="Sala", max_seats=4, starting_hand_size=7, status=GameStatus.PENDING,
		)
		GamePlayer.objects.create(game=self.game, user=self.alice, seat=0)

	def login(self, user):
		self.client.login(username=user.username, password="x")

	def seat(self, index):
		return self.client.post(reverse("game-seat", args=[self.game.public_id]), {"index": index})

	def spectate(self):
		return self.client.post(reverse("game-spectate", args=[self.game.public_id]))


class TakeASeatTests(SeatTestCase):
	"""§1.2 — until this endpoint existed, "Sit here" was a 404 and `join` handing
	out the lowest free seat was the only way anybody was ever seated."""

	def test_a_newcomer_can_choose_which_seat_to_take(self):
		self.login(self.bob)
		response = self.seat(2)
		self.assertEqual(response.status_code, 200)
		self.assertEqual(GamePlayer.objects.get(game=self.game, user=self.bob).seat, 2)

	def test_a_seated_player_can_move_to_a_free_seat(self):
		self.login(self.alice)
		self.assertEqual(self.seat(3).status_code, 200)
		self.assertEqual(GamePlayer.objects.get(game=self.game, user=self.alice).seat, 3)
		self.assertEqual(GamePlayer.objects.filter(game=self.game).count(), 1)

	def test_asking_for_the_seat_you_are_already_in_is_not_an_error(self):
		# Two people racing for the same free seat should leave the winner
		# seated, not holding an error.
		self.login(self.alice)
		self.assertEqual(self.seat(0).status_code, 200)
		self.assertEqual(GamePlayer.objects.get(game=self.game, user=self.alice).seat, 0)

	def test_a_spectator_taking_a_seat_stops_being_a_spectator(self):
		GameSpectator.objects.create(game=self.game, user=self.bob)
		self.login(self.bob)
		self.assertEqual(self.seat(1).status_code, 200)
		self.assertEqual(GamePlayer.objects.get(game=self.game, user=self.bob).seat, 1)
		self.assertFalse(GameSpectator.objects.filter(game=self.game, user=self.bob).exists())

	def test_a_taken_seat_is_refused(self):
		self.login(self.bob)
		response = self.seat(0)
		self.assertEqual(response.status_code, 400)
		self.assertFalse(GamePlayer.objects.filter(game=self.game, user=self.bob).exists())

	def test_a_seat_outside_the_room_is_refused(self):
		self.login(self.bob)
		self.assertEqual(self.seat(4).status_code, 400)
		self.assertEqual(self.seat(-1).status_code, 400)

	def test_a_seat_that_is_not_a_number_is_refused(self):
		self.login(self.bob)
		self.assertEqual(self.seat("chair").status_code, 400)
		# `int(True)` is 1, which would quietly seat somebody.
		self.assertEqual(self.seat(True).status_code, 400)

	def test_seats_cannot_be_taken_once_the_game_has_started(self):
		self.game.status = GameStatus.IN_PROGRESS
		self.game.save(update_fields=["status"])
		self.login(self.bob)
		self.assertEqual(self.seat(2).status_code, 400)


@override_settings(GAME_MAX_SPECTATORS=2)
class SpectateFromASeatTests(SeatTestCase):
	"""§1.3 and §1.4."""

	def test_a_seated_player_can_step_down_to_watch(self):
		GamePlayer.objects.create(game=self.game, user=self.bob, seat=1)
		self.login(self.bob)
		response = self.spectate()
		self.assertEqual(response.status_code, 200)
		self.assertFalse(GamePlayer.objects.filter(game=self.game, user=self.bob).exists())
		self.assertTrue(GameSpectator.objects.filter(game=self.game, user=self.bob).exists())

	def test_the_host_stepping_down_hands_the_room_to_the_next_seat(self):
		GamePlayer.objects.create(game=self.game, user=self.bob, seat=1)
		self.login(self.alice)
		self.assertEqual(self.spectate().status_code, 200)
		self.game.refresh_from_db()
		self.assertEqual(self.game.host, self.bob)
		self.assertTrue(GameSpectator.objects.filter(game=self.game, user=self.alice).exists())

	def test_the_only_player_cannot_step_down(self):
		# Leaving the last seat closes the room, and a closed room is not one you
		# can go on watching.
		self.login(self.alice)
		self.assertEqual(self.spectate().status_code, 400)
		self.game.refresh_from_db()
		self.assertEqual(self.game.status, GameStatus.PENDING)
		self.assertTrue(GamePlayer.objects.filter(game=self.game, user=self.alice).exists())

	def test_a_seat_cannot_be_given_up_once_the_game_has_started(self):
		GamePlayer.objects.create(game=self.game, user=self.bob, seat=1)
		self.game.status = GameStatus.IN_PROGRESS
		self.game.save(update_fields=["status"])
		self.login(self.bob)
		self.assertEqual(self.spectate().status_code, 400)

	def test_the_spectator_limit_is_enforced(self):
		for name in ("d1", "d2"):
			GameSpectator.objects.create(
				game=self.game,
				user=User.objects.create_user(username=name, email=f"{name}@e.com", password="x"),
			)
		self.login(self.bob)
		response = self.spectate()
		self.assertEqual(response.status_code, 400)
		self.assertIn("2 people watching", str(response.data))

	def test_a_room_that_does_not_allow_spectators_refuses_one(self):
		# The socket has always refused these; the endpoint used to let them in,
		# so the two disagreed about the same room.
		self.game.allow_spectators = False
		self.game.save(update_fields=["allow_spectators"])
		self.login(self.bob)
		self.assertEqual(self.spectate().status_code, 400)
