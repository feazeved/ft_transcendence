FROM python:3.13-slim

WORKDIR /app

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

# Local dev never uses this — docker-compose.yml bind-mounts ./backend over
# /app instead, so edits show up without a rebuild. This COPY only matters
# where nothing bind-mounts the source in (Render, or any plain `docker run`
# of this image) — without it the image has no manage.py at all.
COPY backend/ /app/

COPY docker/backend/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

EXPOSE 8000

CMD ["entrypoint.sh"]
