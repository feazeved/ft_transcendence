import io

from django.contrib.auth import get_user_model
from django.test import TestCase
from django.test.client import BOUNDARY, MULTIPART_CONTENT, encode_multipart
from django.urls import reverse
from django.utils import timezone

User = get_user_model()


def _tiny_png():
	from PIL import Image

	buffer = io.BytesIO()
	Image.new("RGB", (1, 1), color="red").save(buffer, format="PNG")
	buffer.seek(0)
	buffer.name = "avatar.png"
	return buffer


class OwnProfileTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username="alice", email="alice@example.com", password="x", display_name="Alice A."
		)
		self.client.login(username="alice", password="x")

	def test_get_own_profile_includes_email_and_richer_fields(self):
		response = self.client.get(reverse("rest_user_details"))
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["username"], "alice")
		self.assertEqual(response.data["email"], "alice@example.com")
		self.assertEqual(response.data["display_name"], "Alice A.")
		self.assertIn("avatar_url", response.data)
		self.assertIn("is_online", response.data)

	def test_can_update_display_name(self):
		response = self.client.patch(
			reverse("rest_user_details"), {"display_name": "New Name"}, content_type="application/json"
		)
		self.assertEqual(response.status_code, 200)
		self.user.refresh_from_db()
		self.assertEqual(self.user.display_name, "New Name")

	def test_can_upload_an_avatar(self):
		response = self.client.patch(
			reverse("rest_user_details"),
			data=encode_multipart(BOUNDARY, {"avatar": _tiny_png()}),
			content_type=MULTIPART_CONTENT,
		)
		self.assertEqual(response.status_code, 200)
		self.user.refresh_from_db()
		self.assertTrue(bool(self.user.avatar))
		self.assertNotEqual(self.user.avatar_url, User.DEFAULT_AVATAR_URL)

	def test_public_id_and_last_seen_are_read_only(self):
		original_public_id = str(self.user.public_id)
		response = self.client.patch(
			reverse("rest_user_details"),
			{"public_id": "11111111-1111-1111-1111-111111111111", "last_seen_at": "2020-01-01T00:00:00Z"},
			content_type="application/json",
		)
		self.assertEqual(response.status_code, 200)
		self.user.refresh_from_db()
		self.assertEqual(str(self.user.public_id), original_public_id)


class PublicProfileTests(TestCase):
	def setUp(self):
		self.viewer = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.target = User.objects.create_user(
			username="bob", email="bob@example.com", password="x", display_name="Bobby"
		)
		self.client.login(username="alice", password="x")

	def test_can_view_another_users_public_profile(self):
		response = self.client.get(reverse("public-profile", args=[self.target.public_id]))
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["username"], "bob")
		self.assertEqual(response.data["display_name"], "Bobby")

	def test_another_users_email_is_not_exposed(self):
		response = self.client.get(reverse("public-profile", args=[self.target.public_id]))
		self.assertNotIn("email", response.data)

	def test_requires_authentication(self):
		self.client.logout()
		response = self.client.get(reverse("public-profile", args=[self.target.public_id]))
		self.assertEqual(response.status_code, 403)

	def test_unknown_public_id_is_a_404(self):
		response = self.client.get(reverse("public-profile", args=["11111111-1111-1111-1111-111111111111"]))
		self.assertEqual(response.status_code, 404)


class OnlineStatusTests(TestCase):
	def test_never_seen_is_not_online(self):
		user = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.assertFalse(user.is_online)

	def test_recently_seen_is_online(self):
		user = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		user.last_seen_at = timezone.now()
		self.assertTrue(user.is_online)

	def test_seen_long_ago_is_not_online(self):
		user = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		user.last_seen_at = timezone.now() - User.ONLINE_THRESHOLD * 2
		self.assertFalse(user.is_online)

	def test_an_authenticated_request_bumps_last_seen_at(self):
		user = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.assertIsNone(user.last_seen_at)
		self.client.login(username="alice", password="x")
		self.client.get(reverse("rest_user_details"))
		user.refresh_from_db()
		self.assertIsNotNone(user.last_seen_at)
		self.assertTrue(user.is_online)