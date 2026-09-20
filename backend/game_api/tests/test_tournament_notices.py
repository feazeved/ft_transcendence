from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY, get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.test import TransactionTestCase, override_settings

from core.asgi import application
from ..models import Game, Tournament, TournamentParticipant

User = get_user_model()

IN_MEMORY_LAYER = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


async def _chat_socket_for(user):
	def cookie():
		session = SessionStore()
		session[SESSION_KEY] = str(user.pk)
		session[BACKEND_SESSION_KEY] = "django.contrib.auth.backends.ModelBackend"
		session[HASH_SESSION_KEY] = user.get_session_auth_hash()
		session.save()
		return session.session_key

	session_key = await sync_to_async(cookie)()
	communicator = WebsocketCommunicator(
		application, "/ws/chat/", headers=[(b"cookie", f"sessionid={session_key}".encode())]
	)
	connected, _ = await communicator.connect()
	assert connected
	return communicator


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class TournamentNoticeTests(TransactionTestCase):
	""""The tournament system should notify users about the next game." The dock is where that lands."""

	def _tournament(self):
		ana = User.objects.create_user(username="ana", email="ana@example.com", password="x")
		bea = User.objects.create_user(username="bea", email="bea@example.com", password="x")
		tournament = Tournament.objects.create(name="Friday Cup", created_by=ana, max_participants=2)
		TournamentParticipant.objects.create(tournament=tournament, user=ana)
		TournamentParticipant.objects.create(tournament=tournament, user=bea)
		return tournament, ana, bea

	async def test_starting_a_round_tells_both_players_where_to_sit(self):
		tournament, ana, bea = await sync_to_async(self._tournament)()
		sockets = [await _chat_socket_for(ana), await _chat_socket_for(bea)]

		await sync_to_async(tournament.start)()
		match = await sync_to_async(Game.objects.get)(tournament=tournament, tournament_round=1)

		for socket in sockets:
			notice = await socket.receive_json_from()
			self.assertEqual(notice["kind"], "tournament_match")
			self.assertEqual(notice["room_code"], match.join_code)
			self.assertEqual(notice["game_id"], str(match.public_id))
			await socket.disconnect()

	async def test_somebody_who_is_not_in_it_hears_nothing(self):
		tournament, _, _ = await sync_to_async(self._tournament)()
		stranger = await sync_to_async(User.objects.create_user)(
			username="carol", email="carol@example.com", password="x"
		)
		socket = await _chat_socket_for(stranger)

		await sync_to_async(tournament.start)()

		self.assertTrue(await socket.receive_nothing(timeout=0.2))
		await socket.disconnect()
