"""
Uploads survive a deploy, because they are rows.

The container's filesystem is thrown away every time the service restarts, and a
file written to it goes without an error — the page just draws the default
avatar, the same as for somebody who never uploaded one. So the bytes live in
the database now (docs/adr/0005-uploaded-files-live-in-the-database.md). These
pin the seam: what Django's file API asks of a storage, and the one URL that has
to keep answering with the same bytes it always did.
"""
import tempfile
from io import StringIO
from pathlib import Path

from django.contrib.auth import get_user_model
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management import call_command
from django.test import TestCase, override_settings

from ..models import StoredFile
from ..storage import DatabaseStorage

User = get_user_model()

PNG = (
	b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06"
	b"\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05"
	b"\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82"
)


class DatabaseStorageTests(TestCase):
	def test_the_configured_default_storage_is_the_database_one(self):
		# Everything else here would still pass against a filesystem storage.
		self.assertIsInstance(default_storage, DatabaseStorage)

	def test_a_saved_file_comes_back_byte_for_byte(self):
		name = default_storage.save("avatars/x.png", ContentFile(PNG))

		with default_storage.open(name) as stored:
			self.assertEqual(stored.read(), PNG)

	def test_a_saved_file_is_a_row_and_not_a_file(self):
		default_storage.save("avatars/row.png", ContentFile(PNG))

		row = StoredFile.objects.get(name="avatars/row.png")
		self.assertEqual(bytes(row.content), PNG)
		self.assertEqual(row.size, len(PNG))
		self.assertEqual(row.content_type, "image/png")

	def test_a_second_file_does_not_overwrite_the_first(self):
		first = default_storage.save("avatars/same.png", ContentFile(PNG))
		second = default_storage.save("avatars/same.png", ContentFile(b"different"))

		self.assertNotEqual(first, second)
		with default_storage.open(first) as stored:
			self.assertEqual(stored.read(), PNG)

	def test_the_url_is_the_one_it_always_was(self):
		# Django puts the script prefix on MEDIA_URL, so this is root-relative —
		# the same string FileSystemStorage returned before the move.
		self.assertEqual(default_storage.url("avatars/x.png"), "/media/avatars/x.png")

	def test_deleting_removes_the_row(self):
		default_storage.save("avatars/gone.png", ContentFile(PNG))
		default_storage.delete("avatars/gone.png")

		self.assertFalse(default_storage.exists("avatars/gone.png"))
		self.assertFalse(StoredFile.objects.filter(name="avatars/gone.png").exists())


class AvatarRoundTripTests(TestCase):
	def setUp(self):
		self.user = User.objects.create_user(
			username="mariane", email="mariane@example.com", password="x"
		)

	def test_an_uploaded_avatar_is_served_back_from_the_database(self):
		self.user.avatar.save("mariane.png", ContentFile(PNG))

		response = self.client.get(self.user.avatar_url)

		self.assertEqual(response.status_code, 200)
		self.assertEqual(b"".join(response.streaming_content), PNG)
		self.assertEqual(response["Content-Type"], "image/png")

	def test_the_avatar_url_still_names_the_public_id(self):
		self.user.avatar.save("mariane.png", ContentFile(PNG))

		self.assertEqual(self.user.avatar_url, f"/media/avatars/{self.user.public_id}.png")

	def test_a_file_that_was_never_uploaded_404s(self):
		response = self.client.get("/media/avatars/nobody.png")

		self.assertEqual(response.status_code, 404)

	def test_a_user_without_an_avatar_gets_the_static_default(self):
		self.assertEqual(self.user.avatar_url, User.DEFAULT_AVATAR_URL)


class ImportMediaToDbTests(TestCase):
	"""The one-time bring-across for files saved before uploads were rows."""

	def _run(self, root, *args):
		output = StringIO()
		with override_settings(MEDIA_ROOT=root):
			call_command("import_media_to_db", *args, stdout=output)
		return output.getvalue()

	def test_a_file_left_on_disk_becomes_a_row(self):
		with tempfile.TemporaryDirectory() as root:
			Path(root, "avatars").mkdir()
			Path(root, "avatars", "old.png").write_bytes(PNG)

			self._run(root)

		with default_storage.open("avatars/old.png") as stored:
			self.assertEqual(stored.read(), PNG)

	def test_a_dry_run_changes_nothing(self):
		with tempfile.TemporaryDirectory() as root:
			Path(root, "avatars").mkdir()
			Path(root, "avatars", "old.png").write_bytes(PNG)

			output = self._run(root, "--dry-run")

		self.assertIn("would import avatars/old.png", output)
		self.assertFalse(StoredFile.objects.exists())

	def test_a_name_already_in_the_database_is_left_alone(self):
		default_storage.save("avatars/old.png", ContentFile(b"the newer one"))

		with tempfile.TemporaryDirectory() as root:
			Path(root, "avatars").mkdir()
			Path(root, "avatars", "old.png").write_bytes(PNG)

			self._run(root)

		self.assertEqual(StoredFile.objects.count(), 1)
		with default_storage.open("avatars/old.png") as stored:
			self.assertEqual(stored.read(), b"the newer one")

	def test_nothing_to_import_is_not_an_error(self):
		output = self._run("/nonexistent-media-root")

		self.assertIn("Nothing to import", output)
