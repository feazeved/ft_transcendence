"""
Uploaded files live in the database.

Every file this app accepts — the avatar someone picks, the picture that comes
back from Google or 42 — used to be written to the container's filesystem, which
is thrown away on every deploy and every restart. Nothing errored when that
happened; the images simply stopped existing and everyone fell back to the
default picture. The database is the only store here that survives a deploy, so
uploads go there. See docs/adr/0005-uploaded-files-live-in-the-database.md.

Django reaches this through STORAGES['default'], so `user.avatar.save(...)`,
`.url`, `.read()` and `.delete()` all keep working unchanged — only the shelf
underneath them moved.
"""
import mimetypes
from urllib.parse import urljoin

from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import Storage
from django.utils.encoding import filepath_to_uri


class DatabaseStorage(Storage):
	# Imported here rather than at module level: a storage can be built while
	# the app registry is still loading, and a model import then would raise.
	def _model(self):
		from .models import StoredFile

		return StoredFile

	def _row(self, name):
		row = self._model().objects.filter(name=name).first()
		if row is None:
			raise FileNotFoundError(name)
		return row

	def _open(self, name, mode='rb'):
		if 'w' in mode:
			raise ValueError('A stored file is written whole, not opened for writing.')
		row = self._row(name)
		# psycopg2 hands bytea back as a memoryview; sqlite hands back bytes.
		return ContentFile(bytes(row.content), name=name)

	def _save(self, name, content):
		content.open()
		try:
			data = content.read()
		finally:
			content.close()

		self._model().objects.update_or_create(
			name=name,
			defaults={
				'content': data,
				'content_type': mimetypes.guess_type(name)[0] or 'application/octet-stream',
				'size': len(data),
			},
		)
		return name

	def exists(self, name):
		return self._model().objects.filter(name=name).exists()

	def delete(self, name):
		self._model().objects.filter(name=name).delete()

	def size(self, name):
		return self._row(name).size

	def get_modified_time(self, name):
		return self._row(name).uploaded_at

	get_created_time = get_modified_time
	get_accessed_time = get_modified_time

	def url(self, name):
		# The same URL FileSystemStorage produced, so nothing downstream — the
		# serializers, the frontend, anybody's bookmark — has to know this moved.
		url = filepath_to_uri(name)
		if url is not None:
			url = url.lstrip('/')
		return urljoin(settings.MEDIA_URL, url)

	def listdir(self, path):
		prefix = path.rstrip('/') + '/' if path else ''
		names = self._model().objects.filter(name__startswith=prefix).values_list('name', flat=True)
		files = sorted({name[len(prefix):] for name in names if '/' not in name[len(prefix):]})
		directories = sorted({name[len(prefix):].split('/', 1)[0] for name in names if '/' in name[len(prefix):]})
		return directories, files
