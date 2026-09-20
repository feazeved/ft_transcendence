from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from ..models import Tournament

User = get_user_model()


class CreateWithSettingsTests(TestCase):
	"""
	The create dialog sends one flat config object whose keys are already the
	backend's field names, so it goes over unchanged. It used to accept only
	`name` and `max_participants`, so every other setting the host chose was
	silently dropped.
	"""

	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="a@example.com", password="x")
		self.client.login(username="alice", password="x")

	def _create(self, **overrides):
		body = {
			"name": "Friday Showdown", "format": "knockout", "max_participants": 20,
			"players_per_table": 5, "advance_per_table": 2, "starting_hand_size": 9,
			"turn_timer_seconds": 45, "final_best_of_3": True, "jump_in": True, "seven_swap": True,
		}
		body.update(overrides)
		return self.client.post(reverse("tournament-list"), body, content_type="application/json")

	def test_every_setting_is_kept(self):
		response = self._create()
		self.assertEqual(response.status_code, 201)
		tournament = Tournament.objects.get(name="Friday Showdown")
		self.assertEqual(tournament.format, "knockout")
		self.assertEqual(tournament.players_per_table, 5)
		self.assertEqual(tournament.advance_per_table, 2)
		self.assertEqual(tournament.starting_hand_size, 9)
		self.assertEqual(tournament.turn_timer_seconds, 45)
		self.assertTrue(tournament.jump_in)
		self.assertTrue(tournament.seven_swap)
		self.assertFalse(tournament.zero_swap)

	def test_the_answer_carries_the_settings_back(self):
		# The detail page draws the structure panel straight from these, so a
		# field accepted and not returned would leave it unable to draw what was
		# just asked for.
		response = self._create()
		for field in ("format", "players_per_table", "advance_per_table", "starting_hand_size",
		              "turn_timer_seconds", "final_best_of_3", "jump_in"):
			self.assertIn(field, response.data)

	def test_a_new_tournament_gets_a_readable_code(self):
		response = self._create()
		self.assertEqual(len(response.data["id"]), 4)
		self.assertNotIn("I", response.data["id"])
		self.assertNotIn("O", response.data["id"])
		self.assertNotIn("0", response.data["id"])
		self.assertNotIn("1", response.data["id"])

	def test_the_creator_is_signed_up(self):
		response = self._create()
		self.assertEqual(response.data["participant_count"], 1)

	def test_a_shape_that_never_reaches_a_final_table_is_refused(self):
		# 20 at tables of 4 with 3 advancing: 20 -> 15 -> 12 -> 9 -> 6, and six
		# people at two tables send six through again. It never comes down to one
		# table. The create dialog draws the same conclusion live and shows it as
		# a warning; the server has to mean it, for anything that is not the
		# dialog — and has to reach it the same way, or a host would be shown one
		# tournament and given another.
		response = self._create(max_participants=20, players_per_table=4, advance_per_table=3)
		self.assertEqual(response.status_code, 400)
		self.assertFalse(Tournament.objects.filter(name="Friday Showdown").exists())

	def test_a_shape_that_does_reach_a_final_table_is_allowed(self):
		# The near neighbour of the test above, so the check cannot pass by
		# refusing everything: 20 -> 12 -> 6 -> the final.
		response = self._create(max_participants=20, players_per_table=5, advance_per_table=3)
		self.assertEqual(response.status_code, 201)

	def test_settings_are_optional_and_fall_back_to_the_defaults(self):
		response = self.client.post(
			reverse("tournament-list"), {"name": "Bare", "max_participants": 8},
			content_type="application/json",
		)
		self.assertEqual(response.status_code, 201)
		tournament = Tournament.objects.get(name="Bare")
		self.assertEqual(tournament.format, "knockout")
		self.assertEqual(tournament.players_per_table, 5)


class LookupByCodeTests(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="a@example.com", password="x")
		self.client.login(username="alice", password="x")
		self.tournament = Tournament.objects.create(
			name="Cup", created_by=self.alice, max_participants=8,
		)

	def test_a_tournament_opens_by_its_short_code(self):
		response = self.client.get(reverse("tournament-detail", args=[self.tournament.join_code]))
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["id"], self.tournament.join_code)

	def test_the_code_is_not_case_sensitive(self):
		response = self.client.get(reverse("tournament-detail", args=[self.tournament.join_code.lower()]))
		self.assertEqual(response.status_code, 200)

	def test_the_uuid_still_opens_it_so_old_links_keep_working(self):
		response = self.client.get(reverse("tournament-detail", args=[self.tournament.public_id]))
		self.assertEqual(response.status_code, 200)

	def test_an_unknown_code_is_a_404(self):
		response = self.client.get(reverse("tournament-detail", args=["ZZZZ"]))
		self.assertEqual(response.status_code, 404)
