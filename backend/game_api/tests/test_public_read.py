"""
Browsing is public; acting is not.

Home draws its open rooms, the top five and the live-tournament banner for
anyone who opens the site, and only sends a visitor to Login when they act on
one of them (spec, "Sign-in and guests"). The whole API inherited
`IsAuthenticated` from `REST_FRAMEWORK`, so every one of those three requests
answered 403 to a signed-out visitor and the sections read "Couldn't load the
rooms." — with the server's own "Authentication credentials were not provided."
printed underneath. These pin the three reads open, and the writes shut.
"""
from django.contrib.auth import get_user_model
from django.test import TestCase

from ..models import Game, GamePlayer, GameStatus, Tournament

User = get_user_model()


class GuestCanBrowseTests(TestCase):
	def setUp(self):
		self.host = User.objects.create_user(username="host", email="host@example.com", password="x")
		self.game = Game.objects.create(
			host=self.host, name="Open Room", max_seats=4, starting_hand_size=7,
			status=GameStatus.PENDING,
		)
		GamePlayer.objects.create(game=self.game, user=self.host, seat=0)
		self.tournament = Tournament.objects.create(name="Open Cup", created_by=self.host, max_participants=8)

	def test_open_rooms_are_listed_to_a_signed_out_visitor(self):
		response = self.client.get("/api/games/")
		self.assertEqual(response.status_code, 200)
		self.assertIn("Open Room", [row["name"] for row in response.json()])

	def test_leaderboard_is_readable_signed_out(self):
		response = self.client.get("/api/leaderboard/")
		self.assertEqual(response.status_code, 200)

	def test_tournaments_are_listed_signed_out(self):
		response = self.client.get("/api/tournaments/")
		self.assertEqual(response.status_code, 200)
		self.assertIn("Open Cup", [row["name"] for row in response.json()])

	def test_a_tournament_link_opens_signed_out(self):
		response = self.client.get(f"/api/tournaments/{self.tournament.join_code}/")
		self.assertEqual(response.status_code, 200)

	def test_live_games_are_listed_signed_out(self):
		response = self.client.get("/api/games/live/")
		self.assertEqual(response.status_code, 200)


class GuestStillCannotActTests(TestCase):
	"""Opening the reads must not have opened anything else."""

	def setUp(self):
		self.host = User.objects.create_user(username="host2", email="host2@example.com", password="x")
		self.game = Game.objects.create(
			host=self.host, max_seats=4, starting_hand_size=7, status=GameStatus.PENDING,
		)
		self.tournament = Tournament.objects.create(name="Shut Cup", created_by=self.host, max_participants=8)

	def test_creating_a_room_still_needs_an_account(self):
		response = self.client.post("/api/games/", {"name": "Nope", "max_seats": 4, "starting_hand_size": 7})
		self.assertEqual(response.status_code, 403)

	def test_joining_a_room_still_needs_an_account(self):
		response = self.client.post(f"/api/games/{self.game.join_code}/join/")
		self.assertEqual(response.status_code, 403)

	def test_creating_a_tournament_still_needs_an_account(self):
		response = self.client.post("/api/tournaments/", {"name": "Nope", "max_participants": 8})
		self.assertEqual(response.status_code, 403)

	def test_registering_for_a_tournament_still_needs_an_account(self):
		response = self.client.post(f"/api/tournaments/{self.tournament.join_code}/register/")
		self.assertEqual(response.status_code, 403)

	def test_friendships_still_need_an_account(self):
		self.assertEqual(self.client.get("/api/friendships/").status_code, 403)
