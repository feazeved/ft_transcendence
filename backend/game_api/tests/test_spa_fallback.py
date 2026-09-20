"""
Every client-side route is the same document.

Deployed, this process serves the built app as well as the API, because nothing
that could sit in front of it proxies a WebSocket upgrade (see
docs/adr/0004-one-origin-in-production.md). That makes Django responsible for
the thing a static host does for free: a reload on /friends, or a shared link to
/tournaments/7, has to come back as index.html and let the router read the URL —
while a mistyped API path still has to 404, or every caller sees a 200 page it
cannot parse instead of the error it was waiting for.
"""
import importlib
import tempfile
from pathlib import Path

from django.test import TestCase, override_settings
from django.urls import clear_url_caches

import core.urls


class SpaFallbackTests(TestCase):
	# The catch-all is only registered where FRONTEND_DIST is set, and that is
	# read when core.urls is imported — which is what keeps a local 404 showing
	# Django's list of tried patterns. So the URLconf is rebuilt here.
	@classmethod
	def setUpClass(cls):
		super().setUpClass()
		cls._dist = tempfile.TemporaryDirectory()
		Path(cls._dist.name, "index.html").write_text("<!doctype html><title>ft_transcendence</title>")
		cls._dist_override = override_settings(FRONTEND_DIST=cls._dist.name)
		cls._dist_override.enable()
		importlib.reload(core.urls)
		clear_url_caches()

	@classmethod
	def tearDownClass(cls):
		cls._dist_override.disable()
		importlib.reload(core.urls)
		clear_url_caches()
		cls._dist.cleanup()
		super().tearDownClass()

	def _body(self, response):
		return b"".join(response.streaming_content).decode()

	def test_a_client_side_route_gets_the_app(self):
		response = self.client.get("/friends")

		self.assertEqual(response.status_code, 200)
		self.assertIn("ft_transcendence", self._body(response))

	def test_a_deep_link_gets_the_app(self):
		response = self.client.get("/tournaments/7")

		self.assertEqual(response.status_code, 200)
		self.assertIn("ft_transcendence", self._body(response))

	def test_the_app_is_never_cached(self):
		# The filenames inside it carry a hash and are cached for a year, so a
		# cached index.html is a deploy nobody receives.
		response = self.client.get("/")

		self.assertEqual(response["Cache-Control"], "no-cache")

	def test_a_mistyped_api_path_still_404s(self):
		response = self.client.get("/api/no-such-endpoint/")

		self.assertEqual(response.status_code, 404)

	def test_the_health_check_is_not_swallowed(self):
		response = self.client.get("/healthz/")

		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.json()["status"], "ok")
