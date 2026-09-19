# Uploaded files live in the database

On 2026-09-19 an avatar 404ed on the deployed site. The row was right, the URL
was right, and the file was not there: `MEDIA_ROOT` is a directory inside the
container, and Render replaces that container on every deploy and every restart.
Nothing failed when the picture went — no error, no log line, no broken save.
The page simply drew the default avatar, which is exactly what it draws for
somebody who never uploaded one.

The obvious fix is a mounted disk, and it is the right one on a host that offers
disks. Render does not offer them on the free instance type, which is the one
this project runs on, so the choice was between paying for the deployment,
signing up for object storage, or using the store we already have that survives
a deploy. **Uploads go in the database**: `game_api.storage.DatabaseStorage`
becomes `STORAGES['default']`, a `StoredFile` row holds the bytes, and
`/media/<name>` is a view that reads one.

Everything above the storage is untouched. `user.avatar.save(...)`,
`.url`, `.read()` and `.delete()` all behave as they did, `avatar_url` still
returns `media/avatars/<public_id>.jpg`, and no serializer, template or frontend
line changed. That is the whole reason to do it at the storage layer rather than
by hand: Django already has a seam here, and the seam is the file.

**What it costs.** Images now travel through Postgres and through Python on the
way out, where a disk would have been the kernel's job — call it a millisecond on
a file this size, and it is cached for a day at the browser. Uploads count
against the database's storage rather than a disk's: an avatar is tens of
kilobytes, a few hundred accounts is a few tens of megabytes, and the free tier
holds a gigabyte. Nothing here should be read as permission to put a video in a
`BinaryField`. If this project ever accepts a bigger kind of upload, that is the
moment for object storage, not a bigger row.

**What it is not.** It is not a cache, and it is not a CDN. It is one small
table of small files, read far more often than written, in a project where the
alternative was paying rent for a disk to hold four avatars.

Files saved before the move are still on whatever disk held them, and nothing
serves them any more — `manage.py import_media_to_db` copies them across, once,
wherever they still exist. On Render there was nothing left to copy, which was
the point.
