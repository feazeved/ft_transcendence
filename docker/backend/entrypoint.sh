#!/bin/sh
set -e

echo "[entrypoint] Waiting for Postgres"
python - <<'PY'
import os, sys, time, urllib.parse
import psycopg2

url = os.environ.get("DATABASE_URL")
if not url:
    sys.exit("[entrypoint] DATABASE_URL is not set. Is .env present and passed via env_file?")

u = urllib.parse.urlparse(url)
params = dict(
    dbname=(u.path or "").lstrip("/"),
    user=u.username,
    password=urllib.parse.unquote(u.password or ""),
    host=u.hostname,
    port=u.port or 5432,
)

DEADLINE = time.time() + 60
while True:
    try:
        psycopg2.connect(connect_timeout=3, **params).close()
        print("[entrypoint] Postgres is up")
        break
    except psycopg2.OperationalError as exc:
        text = str(exc)
        # Auth failures never resolve by waiting. Postgres reports a missing role
        # as "password authentication failed" too, so this covers both.
        if "authentication failed" in text or "does not exist" in text:
            sys.exit(
                "\n[entrypoint] Postgres rejected the credentials in DATABASE_URL:\n"
                f"    {text.strip()}\n\n"
                "  Two things cause this:\n"
                "  1. DATABASE_URL disagrees with POSTGRES_USER / POSTGRES_PASSWORD /\n"
                "     POSTGRES_DB in .env. Make them match.\n"
                "  2. The postgres volume was initialised before .env existed (or with\n"
                "     different credentials). Postgres only creates the role and database\n"
                "     on an empty data directory, so editing .env now changes nothing.\n"
                "     Wipe the volumes and start clean:  make reset-db\n"
            )
        if time.time() > DEADLINE:
            sys.exit(f"[entrypoint] Postgres did not become reachable in 60s: {text.strip()}")
        time.sleep(1)
PY

echo "[entrypoint] Database migrations"
python manage.py migrate

echo "[entrypoint] Collect static"
python manage.py collectstatic --noinput

echo "[entrypoint] Starting Uvicorn"
exec uvicorn core.asgi:application \
    --host 0.0.0.0 \
    --port 8000 \
    --reload
