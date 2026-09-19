# The deployed site is one origin

On 2026-09-19 the deployed site could be browsed and could not be played. Chat
said "Not connected — your message wasn't sent.", the room lobby sat on
"Joining room…" for ever, and the console repeated
`NS_ERROR_WEBSOCKET_CONNECTION_REFUSED` for `/ws/chat/`, `/ws/presence/` and
`/ws/games/<id>/`, widening the gap between attempts as `openSocket` backed off.

The frontend was on Vercel and the backend on Render, with `vercel.json`
rewriting `/api`, `/ws` and `/media` across. Three handshakes said what was
happening. Straight at Render, `/ws/chat/` answered `403` — which is what uvicorn
returns when a consumer calls `close()` before `accept()`, so the socket had
reached `ChatConsumer`, which refused it for having no session — and `/healthz/`
answered `500`, Channels reporting no websocket route at that path. Two different
answers from two paths is the application answering. Through Vercel the same
handshake came back `404`, as a Django HTML page, carrying Render's own
`X-Render-Origin-Server: uvicorn` header: the request had been forwarded, but as
an ordinary GET. Vercel's rewrites are an HTTP proxy. They do not carry a
protocol upgrade, so `/ws/` could never have worked there, and no amount of
configuration was going to change that.

**So the deployed app is served from the same origin as its API and its sockets.**
`docker/render/Dockerfile` builds the frontend and copies `dist/` into the Django
image; WhiteNoise serves it at the root and `core/urls.py` hands `index.html` to
every client-side route. One host answers the page, `/api`, `/media`, `/static`
and `/ws`. Vercel is a redirect to it and nothing else.

The alternative was to keep the split and point the sockets straight at Render.
That is not one config line: the session cookie belongs to the frontend's domain
and is never sent to the backend's, so every consumer's `is_authenticated` check
would fail and the sockets would be refused all over again — correctly this time.
It needs a second authentication path (a short-lived ticket issued over the API
and handed to the socket in its URL), or a domain both hosts are subdomains of so
that one cookie can cover them. Either is a real design; neither is worth it to
keep a static host that was only ever serving five files.

What this costs is honest to state. The app is now static files served by
Python, which is slower than a CDN and which we pay for in exactly one place:
the first request's latency. Hashed filenames are cached for a year
(`WHITENOISE_IMMUTABLE_FILE_TEST`) and the image ships them pre-gzipped, so the
repeat cost is a 304. It also made where uploads live a question that had to be
answered rather than assumed, since this host has no disk that survives a
deploy — see
[ADR 0005](0005-uploaded-files-live-in-the-database.md).

The rule the next deployment decision starts from: **whatever serves the page
must be able to answer the sockets, or the sockets need their own reachable
origin and an authentication scheme that survives being cross-site.** A static
host in front of a WebSocket application is not a deployment detail to be sorted
out later — it decides whether half the product runs.
