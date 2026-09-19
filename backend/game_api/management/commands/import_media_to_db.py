"""
Bring files uploaded before the move into the database.

Uploads are rows now (game_api/storage.py), so anything saved to MEDIA_ROOT by
an older build is still on disk and no longer reachable: the profile still
points at `avatars/<public_id>.jpg`, and nothing serves that name any more. This
walks MEDIA_ROOT once and copies what it finds.

Run it wherever those files still exist — a development machine, or a server
with a disk that outlived the change. On Render there is nothing to find, and it
says so and exits.
"""
from pathlib import Path

from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
	help = 'Copy files under MEDIA_ROOT into the database, for uploads made before uploads were rows.'

	def add_arguments(self, parser):
		parser.add_argument(
			'--dry-run',
			action='store_true',
			help='Name what would be copied and change nothing.',
		)

	def handle(self, *args, **options):
		root = Path(settings.MEDIA_ROOT)
		if not root.is_dir():
			self.stdout.write(f'Nothing to import: {root} does not exist.')
			return

		copied = 0
		already_there = 0

		for path in sorted(p for p in root.rglob('*') if p.is_file()):
			name = path.relative_to(root).as_posix()

			# The database wins: a file of the same name that is already a row
			# is the newer one, and re-saving would rename this one beside it.
			if default_storage.exists(name):
				already_there += 1
				continue

			if options['dry_run']:
				self.stdout.write(f'would import {name} ({path.stat().st_size} bytes)')
			else:
				default_storage.save(name, ContentFile(path.read_bytes()))
				self.stdout.write(f'imported {name}')
			copied += 1

		verb = 'would import' if options['dry_run'] else 'imported'
		self.stdout.write(self.style.SUCCESS(f'{verb} {copied}, already in the database: {already_there}'))

		if copied and not options['dry_run']:
			self.stdout.write('The files under MEDIA_ROOT are now copies and can be deleted.')
