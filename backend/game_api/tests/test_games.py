from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from ..models import Game, GamePlayer, GameStatus

User = get_user_model()


class GameTestCase(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="x")
		self.carol = User.objects.create_user(username="carol", email="carol@example.com", password="x")

	def login(self, user):
		self.client.login(username=user.username, password="x")


class CreateGameTests(GameTestCase):
	def test_can_create_a_game(self):
		self.login(self.alice)
		response = self.client.post(reverse("game-list"), {"max_seats": 4, "starting_hand_size": 7})
		self.assertEqual(response.status_code, 201)
		game = Game.objects.get(public_id=response.data["public_id"])
		self.assertEqual(game.host, self.alice)
		self.assertEqual(game.status, GameStatus.PENDING)

	def test_creating_a_game_auto_seats_the_host(self):
		self.login(self.alice)
		response = self.client.post(reverse("game-list"), {"max_seats": 4, "starting_hand_size": 7})
		game = Game.objects.get(public_id=response.data["public_id"])
		players = list(GamePlayer.objects.filter(game=game))
		self.assertEqual(len(players), 1)
		self.assertEqual(players[0].user, self.alice)
		self.assertEqual(players[0].seat, 0)

	def test_defaults_apply_when_not_specified(self):
		self.login(self.alice)
		response = self.client.post(reverse("game-list"), {})
		self.assertEqual(response.status_code, 201)
		self.assertEqual(response.data["max_seats"], 4)
		self.assertEqual(response.data["starting_hand_size"], 7)

	def test_can_enable_modifiers_at_creation(self):
		self.login(self.alice)
		response = self.client.post(
			reverse("game-list"),
			{"max_seats": 4, "starting_hand_size": 7, "jump_in": True, "draw_stacking": True},
		)
		self.assertTrue(response.data["jump_in"])
		self.assertTrue(response.data["draw_stacking"])
		self.assertFalse(response.data["seven_swap"])


class ListGamesTests(GameTestCase):
	def test_lists_an_open_pending_game(self):
		game = Game.objects.create(host=self.alice, max_seats=4, starting_hand_size=7)
		GamePlayer.objects.create(game=game, user=self.alice, seat=0)

		self.login(self.bob)
		response = self.client.get(reverse("game-list"))
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]["public_id"], str(game.public_id))

	def test_does_not_list_a_full_game(self):
		game = Game.objects.create(host=self.alice, max_seats=1, starting_hand_size=7)
		GamePlayer.objects.create(game=game, user=self.alice, seat=0)

		self.login(self.bob)
		response = self.client.get(reverse("game-list"))
		self.assertEqual(len(response.data), 0)

	def test_does_not_list_an_in_progress_game(self):
		game = Game.objects.create(host=self.alice, max_seats=4, starting_hand_size=7, status=GameStatus.IN_PROGRESS)
		GamePlayer.objects.create(game=game, user=self.alice, seat=0)

		self.login(self.bob)
		response = self.client.get(reverse("game-list"))
		self.assertEqual(len(response.data), 0)


class JoinGameTests(GameTestCase):
	def setUp(self):
		super().setUp()
		self.game = Game.objects.create(host=self.alice, max_seats=2, starting_hand_size=7)
		GamePlayer.objects.create(game=self.game, user=self.alice, seat=0)

	def test_can_join_an_open_game(self):
		self.login(self.bob)
		response = self.client.post(reverse("game-join", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 200)
		self.assertTrue(GamePlayer.objects.filter(game=self.game, user=self.bob).exists())

	def test_joining_assigns_the_next_seat(self):
		self.login(self.bob)
		self.client.post(reverse("game-join", args=[self.game.public_id]))
		bob_seat = GamePlayer.objects.get(game=self.game, user=self.bob).seat
		self.assertEqual(bob_seat, 1)

	def test_cannot_join_twice(self):
		self.login(self.alice)
		response = self.client.post(reverse("game-join", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 400)

	def test_cannot_join_a_full_game(self):
		GamePlayer.objects.create(game=self.game, user=self.bob, seat=1)
		self.login(self.carol)
		response = self.client.post(reverse("game-join", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 400)

	def test_cannot_join_an_in_progress_game(self):
		self.game.status = GameStatus.IN_PROGRESS
		self.game.save()
		self.login(self.bob)
		response = self.client.post(reverse("game-join", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 400)


class LeaveGameTests(GameTestCase):
	def setUp(self):
		super().setUp()
		self.game = Game.objects.create(host=self.alice, max_seats=4, starting_hand_size=7)
		GamePlayer.objects.create(game=self.game, user=self.alice, seat=0)
		GamePlayer.objects.create(game=self.game, user=self.bob, seat=1)

	def test_can_leave_a_pending_game(self):
		self.login(self.bob)
		response = self.client.post(reverse("game-leave", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 204)
		self.assertFalse(GamePlayer.objects.filter(game=self.game, user=self.bob).exists())

	def test_host_leaving_hands_off_to_the_next_player(self):
		self.login(self.alice)
		self.client.post(reverse("game-leave", args=[self.game.public_id]))
		self.game.refresh_from_db()
		self.assertEqual(self.game.host, self.bob)
		self.assertEqual(self.game.status, GameStatus.PENDING)

	def test_last_player_leaving_cancels_the_game(self):
		self.login(self.bob)
		self.client.post(reverse("game-leave", args=[self.game.public_id]))
		self.login(self.alice)
		self.client.post(reverse("game-leave", args=[self.game.public_id]))
		self.game.refresh_from_db()
		self.assertEqual(self.game.status, GameStatus.CANCELLED)

	def test_cannot_leave_an_in_progress_game(self):
		self.game.status = GameStatus.IN_PROGRESS
		self.game.save()
		self.login(self.bob)
		response = self.client.post(reverse("game-leave", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 400)


class StartGameTests(GameTestCase):
	def setUp(self):
		super().setUp()
		self.game = Game.objects.create(host=self.alice, max_seats=4, starting_hand_size=7)
		GamePlayer.objects.create(game=self.game, user=self.alice, seat=0)

	def test_host_cannot_start_with_only_one_player(self):
		self.login(self.alice)
		response = self.client.post(reverse("game-start", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 400)

	def test_non_host_cannot_start(self):
		GamePlayer.objects.create(game=self.game, user=self.bob, seat=1)
		self.login(self.bob)
		response = self.client.post(reverse("game-start", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 403)

	def test_host_can_start_with_enough_players(self):
		GamePlayer.objects.create(game=self.game, user=self.bob, seat=1)
		self.login(self.alice)
		response = self.client.post(reverse("game-start", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 200)
		self.game.refresh_from_db()
		self.assertEqual(self.game.status, GameStatus.IN_PROGRESS)
		self.assertIsNotNone(self.game.state)

	def test_starting_deals_the_configured_hand_size(self):
		self.game.starting_hand_size = 5
		self.game.save()
		GamePlayer.objects.create(game=self.game, user=self.bob, seat=1)
		self.login(self.alice)
		self.client.post(reverse("game-start", args=[self.game.public_id]))
		self.game.refresh_from_db()
		for player in self.game.state["players"]:
			self.assertEqual(len(player["hand"]), 5)

	def test_starting_passes_enabled_modifiers_through(self):
		self.game.jump_in = True
		self.game.save()
		GamePlayer.objects.create(game=self.game, user=self.bob, seat=1)
		self.login(self.alice)
		self.client.post(reverse("game-start", args=[self.game.public_id]))
		self.game.refresh_from_db()
		self.assertEqual(self.game.state["settings"]["enabled_modifiers"], ["jump_in"])

	def test_cannot_start_an_already_started_game(self):
		GamePlayer.objects.create(game=self.game, user=self.bob, seat=1)
		self.login(self.alice)
		self.client.post(reverse("game-start", args=[self.game.public_id]))
		response = self.client.post(reverse("game-start", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 400)