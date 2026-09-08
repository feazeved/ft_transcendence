from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from ..models import GameStatus, Tournament, TournamentParticipant

User = get_user_model()


class TournamentTestCase(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="x")
		self.carol = User.objects.create_user(username="carol", email="carol@example.com", password="x")

	def login(self, user):
		self.client.login(username=user.username, password="x")


class CreateTournamentTests(TournamentTestCase):
	def test_can_create_a_tournament(self):
		self.login(self.alice)
		response = self.client.post(reverse("tournament-list"), {"name": "Cup", "max_participants": 8})
		self.assertEqual(response.status_code, 201)
		tournament = Tournament.objects.get(public_id=response.data["public_id"])
		self.assertEqual(tournament.created_by, self.alice)

	def test_creating_auto_registers_the_creator(self):
		self.login(self.alice)
		response = self.client.post(reverse("tournament-list"), {"name": "Cup", "max_participants": 8})
		tournament = Tournament.objects.get(public_id=response.data["public_id"])
		self.assertTrue(TournamentParticipant.objects.filter(tournament=tournament, user=self.alice).exists())


class ListTournamentTests(TournamentTestCase):
	def test_lists_a_pending_tournament(self):
		Tournament.objects.create(name="Cup", created_by=self.alice, max_participants=8)
		self.login(self.bob)
		response = self.client.get(reverse("tournament-list"))
		self.assertEqual(len(response.data), 1)

	def test_does_not_list_a_started_tournament(self):
		Tournament.objects.create(
			name="Cup", created_by=self.alice, max_participants=8, status=GameStatus.IN_PROGRESS
		)
		self.login(self.bob)
		response = self.client.get(reverse("tournament-list"))
		self.assertEqual(len(response.data), 0)


class RegisterTests(TournamentTestCase):
	def setUp(self):
		super().setUp()
		self.tournament = Tournament.objects.create(name="Cup", created_by=self.alice, max_participants=2)
		TournamentParticipant.objects.create(tournament=self.tournament, user=self.alice)

	def test_can_register(self):
		self.login(self.bob)
		response = self.client.post(reverse("tournament-register", args=[self.tournament.public_id]))
		self.assertEqual(response.status_code, 200)
		self.assertTrue(
			TournamentParticipant.objects.filter(tournament=self.tournament, user=self.bob).exists()
		)

	def test_cannot_register_twice(self):
		self.login(self.alice)
		response = self.client.post(reverse("tournament-register", args=[self.tournament.public_id]))
		self.assertEqual(response.status_code, 400)

	def test_cannot_register_once_full(self):
		TournamentParticipant.objects.create(tournament=self.tournament, user=self.bob)
		self.login(self.carol)
		response = self.client.post(reverse("tournament-register", args=[self.tournament.public_id]))
		self.assertEqual(response.status_code, 400)

	def test_cannot_register_once_started(self):
		self.tournament.status = GameStatus.IN_PROGRESS
		self.tournament.save()
		self.login(self.bob)
		response = self.client.post(reverse("tournament-register", args=[self.tournament.public_id]))
		self.assertEqual(response.status_code, 400)

	def test_can_unregister_before_starting(self):
		self.login(self.alice)
		response = self.client.post(reverse("tournament-unregister", args=[self.tournament.public_id]))
		self.assertEqual(response.status_code, 204)
		self.assertFalse(
			TournamentParticipant.objects.filter(tournament=self.tournament, user=self.alice).exists()
		)

	def test_cannot_unregister_once_started(self):
		self.tournament.status = GameStatus.IN_PROGRESS
		self.tournament.save()
		self.login(self.alice)
		response = self.client.post(reverse("tournament-unregister", args=[self.tournament.public_id]))
		self.assertEqual(response.status_code, 400)


class StartTournamentTests(TournamentTestCase):
	def setUp(self):
		super().setUp()
		self.tournament = Tournament.objects.create(name="Cup", created_by=self.alice, max_participants=4)
		TournamentParticipant.objects.create(tournament=self.tournament, user=self.alice)

	def test_creator_cannot_start_with_only_one_participant(self):
		self.login(self.alice)
		response = self.client.post(reverse("tournament-start", args=[self.tournament.public_id]))
		self.assertEqual(response.status_code, 400)

	def test_non_creator_cannot_start(self):
		TournamentParticipant.objects.create(tournament=self.tournament, user=self.bob)
		self.login(self.bob)
		response = self.client.post(reverse("tournament-start", args=[self.tournament.public_id]))
		self.assertEqual(response.status_code, 403)

	def test_creator_can_start_with_enough_participants(self):
		TournamentParticipant.objects.create(tournament=self.tournament, user=self.bob)
		self.login(self.alice)
		response = self.client.post(reverse("tournament-start", args=[self.tournament.public_id]))
		self.assertEqual(response.status_code, 200)
		self.tournament.refresh_from_db()
		self.assertEqual(self.tournament.status, GameStatus.IN_PROGRESS)

	def test_detail_view_shows_generated_rounds(self):
		TournamentParticipant.objects.create(tournament=self.tournament, user=self.bob)
		self.login(self.alice)
		self.client.post(reverse("tournament-start", args=[self.tournament.public_id]))

		response = self.client.get(reverse("tournament-detail", args=[self.tournament.public_id]))
		self.assertEqual(len(response.data["rounds"]), 1)
		self.assertEqual(response.data["rounds"][0]["round"], 1)
		self.assertEqual(len(response.data["rounds"][0]["matches"]), 1)


class TournamentMatchStartTests(TournamentTestCase):
	def setUp(self):
		super().setUp()
		self.tournament = Tournament.objects.create(name="Cup", created_by=self.alice, max_participants=2)
		TournamentParticipant.objects.create(tournament=self.tournament, user=self.alice)
		TournamentParticipant.objects.create(tournament=self.tournament, user=self.bob)
		self.tournament.start()
		from ..models import Game
		self.match = Game.objects.get(tournament=self.tournament, tournament_round=1)

	def test_the_non_host_participant_can_still_start_the_match(self):
		non_host = self.bob if self.match.host_id == self.alice.pk else self.alice
		self.login(non_host)
		response = self.client.post(reverse("game-start", args=[self.match.public_id]))
		self.assertEqual(response.status_code, 200)

	def test_a_non_participant_cannot_start_the_match(self):
		self.login(self.carol)
		response = self.client.post(reverse("game-start", args=[self.match.public_id]))
		self.assertEqual(response.status_code, 403)