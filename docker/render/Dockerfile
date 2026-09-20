# The deployed image: one process, one origin — the page, /api, /media, /static
# and /ws all answered by the same Django/uvicorn container.
#
# It exists beside docker/backend/Dockerfile, which is almost the same file,
# because local development wants the opposite trade: compose bind-mounts
# ./backend over /app and hands the app to the Vite dev server, so building the
# frontend in would make every `make up` slower and buy nothing. Render has
# nothing else to serve the app with, so here it is baked in.
#
# Why one origin at all: docs/adr/0004-one-origin-in-production.md.

FROM node:22-bookworm AS frontend

WORKDIR /app

# Pinned, because --frozen-lockfile only means anything if the pnpm that reads
# frontend/pnpm-lock.yaml is the one that wrote it (lockfileVersion 9.0).
RUN corepack enable && corepack prepare pnpm@9.15.9 --activate

# The manifest alone first: a deploy that changed no dependency reuses this
# layer instead of installing everything again.
COPY frontend/package.json frontend/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY frontend/ ./
RUN pnpm build


FROM python:3.13-slim

WORKDIR /app

COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt

COPY backend/ /app/

# WhiteNoise serves this at the site root and core/urls.py hands index.html to
# every client-side route. It lives outside /app so that a stray bind mount over
# the source can never take the app away with it.
COPY --from=frontend /app/dist /srv/frontend
ENV DJANGO_FRONTEND_DIST=/srv/frontend

# Writes a .gz beside every file that gets smaller for it, which is what lets
# WhiteNoise answer with a compressed bundle instead of uvicorn reading a
# megabyte of JavaScript off disk per visitor. collectstatic already does this
# for /static/; nothing does it for a Vite build.
RUN python -m whitenoise.compress /srv/frontend

COPY docker/backend/entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# Render sets PORT and the entrypoint follows it; this is only the local default.
EXPOSE 8000

CMD ["entrypoint.sh"]
