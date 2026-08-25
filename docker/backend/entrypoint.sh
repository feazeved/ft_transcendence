#!/bin/sh
set -e

echo "[entrypoint] Database migrations"
python manage.py migrate

echo "[entrypoint] Collect static"
python manage.py collectstatic --noinput
echo "[entrypoint] Starting Uvicorn"
exec uvicorn core.asgi:application \
    --host 0.0.0.0 \
    --port 8000 \
    --reload
