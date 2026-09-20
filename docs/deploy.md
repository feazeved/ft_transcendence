# Deploying

One Render web service serves everything: the page, `/api`, `/media`, `/static`
and `/ws`. That is not a preference — a static host in front of Django cannot
proxy a WebSocket upgrade, so a split deployment has no working chat, lobby or
game table. The reasoning is in
[ADR 0004](adr/0004-one-origin-in-production.md).

It needs two things beside the service itself: a Postgres database and a Redis
for the channel layer. No disk — uploaded files are rows.

## The service

| Render setting | Value |
| --- | --- |
| Language / runtime | Docker |
| Dockerfile path | `./docker/render/Dockerfile` |
| Docker build context | `.` |
| Health check path | `/healthz/` |
| Instance type | free works; paid is what stops it sleeping |

`docker/render/Dockerfile` builds the frontend with pnpm and copies `dist/` into
the Django image, where `DJANGO_FRONTEND_DIST=/srv/frontend` is already set. The
container listens on Render's `PORT`, runs migrations and `collectstatic` at
boot, and starts uvicorn — `docker/backend/entrypoint.sh`, the same one compose
uses.

`render.yaml` describes all of this as a blueprint, if you would rather adopt it
than keep the dashboard as the source of truth.

## Environment

Set in the dashboard, under the service's Environment:

| Variable | Value | Why |
| --- | --- | --- |
| `DJANGO_SECRET_KEY` | a long random string | Changing it signs everyone out. |
| `DJANGO_DEBUG` | `False` | |
| `DJANGO_ALLOWED_HOSTS` | `ft-transcendence-zn3z.onrender.com` | The public host, comma-separated if there is more than one. |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | `https://ft-transcendence-zn3z.onrender.com` | With the scheme. |
| `FRONTEND_URL` | `https://ft-transcendence-zn3z.onrender.com` | Password-reset and confirmation links, and where OAuth returns the browser. Same origin as the rest now. |
| `DATABASE_URL` | from the Postgres instance | Render fills this in for you if you attach its own database. |
| `REDIS_URL` | the managed Redis URL | `rediss://` (TLS) is fine as-is. |
| `UVICORN_WORKERS` | `2` | Each worker is another Redis connection and another BRPOP loop. |
| `GOOGLE_OAUTH_CLIENT_ID` / `_SECRET` | from Google Cloud | |
| `FORTYTWO_OAUTH_CLIENT_ID` / `_SECRET` | from the 42 intranet | |

## Uploaded files

There is nothing to configure: avatars and the pictures fetched from Google and
42 are rows in the database, not files on a disk
([ADR 0005](adr/0005-uploaded-files-live-in-the-database.md)). Render throws the
container's filesystem away on every deploy, so a disk was the only alternative
and disks are not offered on the free instance type.

This means the database is where uploads count against storage. An avatar is
tens of kilobytes; a few hundred accounts is a few tens of megabytes. Worth a
look if the site ever grows a bigger kind of upload.

If a machine still has files from before the move — a development box, or a
server with a disk that outlived it — bring them across once:

```sh
make backend-shell
python manage.py import_media_to_db --dry-run   # names what it would copy
python manage.py import_media_to_db
```

On Render there is nothing to find and it says so.

## OAuth redirect URIs

Both providers send the browser back to a URL that has to be registered with
them, and that URL is now the Render host. In the Google Cloud console and on the
42 intranet, the authorised redirect URIs are:

```
https://ft-transcendence-zn3z.onrender.com/accounts/google/login/callback/
https://ft-transcendence-zn3z.onrender.com/accounts/fortytwo/login/callback/
```

An old frontend-host entry there will fail with a redirect-URI mismatch, which
the provider reports and the app cannot.

## Vercel

`frontend/vercel.json` is now a redirect to the Render host, so old links still
land somewhere that works. The project can be deleted outright instead; nothing
depends on it.

## Checking a deploy

```sh
# The app answers, and the database behind it does too.
curl -sS https://ft-transcendence-zn3z.onrender.com/healthz/

# The WebSocket really is a WebSocket. HTTP/1.1 matters: HTTP/2 has no Upgrade.
curl -sSi --http1.1 -m 10 \
	-H 'Connection: Upgrade' -H 'Upgrade: websocket' \
	-H 'Sec-WebSocket-Version: 13' -H 'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==' \
	https://ft-transcendence-zn3z.onrender.com/ws/chat/ | head -1
```

`403 Forbidden` is the pass: that is Django refusing a socket with no session,
which it can only do after the upgrade reached it. `404` means the request
arrived as plain HTTP and never became a WebSocket — something in front of the
app is not passing the upgrade through, and chat, presence and the game table
are all dead behind it. `500` means the upgrade arrived at a path Channels has
no route for.

Then open the site, sign in, and watch the console: no `/ws/` errors, the friend
list showing presence, and a room reaching the table rather than "Joining room…".

## The Redis bill is not idle

The channel layer is `channels_redis.core.RedisChannelLayer`, which listens with
`BRPOP` on a five-second timeout. That is roughly twelve commands a minute per
worker and per connected socket, whether or not anybody is playing. On a managed
Redis with a monthly command quota, a service left running will spend it with
nobody on the site — worth watching for the first month, and the reason
`UVICORN_WORKERS` is 2 rather than the entrypoint's default of 4.
