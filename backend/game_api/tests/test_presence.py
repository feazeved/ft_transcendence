from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY, get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.test import TransactionTestCase, override_settings

from core.asgi import application
from .. import presence
from ..models import Friendship

User = get_user_model()

IN_MEMORY_LAYER = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


def _session_cookie_for(user):
	session = SessionStore()
	session[SESSION_KEY] = str(user.pk)
	session[BACKEND_SESSION_KEY] = "django.contrib.auth.backends.ModelBackend"
	session[HASH_SESSION_KEY] = user.get_session_auth_hash()
	session.save()
	return session.session_key


async def _connect_as(user):
	session_key = await sync_to_async(_session_cookie_for)(user)
	communicator = WebsocketCommunicator(
		application, "/ws/presence/",
		headers=[(b"cookie", f"sessionid={session_key}".encode())],
	)
	connected, _ = await communicator.connect()
	return communicator, connected


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class PresenceConsumerTests(TransactionTestCase):
	def tearDown(self):
		for key in presence._redis_client.keys("presence:connections:*"):
			presence._redis_client.delete(key)

	async def test_unauthenticated_connection_is_rejected(self):
		communicator = WebsocketCommunicator(application, "/ws/presence/")
		connected, _ = await communicator.connect()
		self.assertFalse(connected)
		await communicator.disconnect()

	async def test_authenticated_connection_is_accepted(self):
		user = await sync_to_async(User.objects.create_user)(
			username="alice", email="alice@example.com", password="x"
		)
		communicator, connected = await _connect_as(user)
		self.assertTrue(connected)
		await communicator.disconnect()

	async def test_connecting_bumps_last_seen_at_immediately(self):
		user = await sync_to_async(User.objects.create_user)(
			username="alice", email="alice@example.com", password="x"
		)
		self.assertIsNone(user.last_seen_at)
		communicator, _ = await _connect_as(user)
		await sync_to_async(user.refresh_from_db)()
		self.assertIsNotNone(user.last_seen_at)
		await communicator.disconnect()

	async def test_connecting_notifies_an_accepted_friend(self):
		alice = await sync_to_async(User.objects.create_user)(
			username="alice", email="alice@example.com", password="x"
		)
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="bob@example.com", password="x")
		await sync_to_async(Friendship.objects.create)(requester=alice, addressee=bob, status="accepted")

		bob_comm, bob_connected = await _connect_as(bob)
		self.assertTrue(bob_connected)

		alice_comm, alice_connected = await _connect_as(alice)
		self.assertTrue(alice_connected)

		event = await bob_comm.receive_json_from()
		self.assertEqual(event["type"], "presence_update")
		self.assertEqual(event["username"], "alice")
		self.assertEqual(event["status"], "online")

		await alice_comm.disconnect()
		await bob_comm.disconnect()

	# The bug, end to end: being online has to end when the socket does.
	async def test_the_socket_is_what_makes_you_online(self):
		user = await sync_to_async(User.objects.create_user)(
			username="alice", email="alice@example.com", password="x"
		)
		self.assertFalse(user.is_online)

		communicator, _ = await _connect_as(user)
		self.assertTrue(user.is_online)

		await communicator.disconnect()
		self.assertFalse(user.is_online)

	async def test_a_non_friend_receives_nothing(self):
		alice = await sync_to_async(User.objects.create_user)(
			username="alice", email="alice@example.com", password="x"
		)
		carol = await sync_to_async(User.objects.create_user)(
			username="carol", email="carol@example.com", password="x"
		)

		carol_comm, _ = await _connect_as(carol)
		alice_comm, _ = await _connect_as(alice)

		self.assertTrue(await carol_comm.receive_nothing(timeout=0.2))

		await alice_comm.disconnect()
		await carol_comm.disconnect()

	async def test_disconnecting_notifies_an_accepted_friend(self):
		alice = await sync_to_async(User.objects.create_user)(
			username="alice", email="alice@example.com", password="x"
		)
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="bob@example.com", password="x")
		await sync_to_async(Friendship.objects.create)(requester=alice, addressee=bob, status="accepted")

		bob_comm, _ = await _connect_as(bob)
		alice_comm, _ = await _connect_as(alice)
		await bob_comm.receive_json_from()

		await alice_comm.disconnect()

		event = await bob_comm.receive_json_from()
		self.assertEqual(event["status"], "offline")
		self.assertEqual(event["username"], "alice")

		await bob_comm.disconnect()

	async def test_a_pending_not_yet_accepted_friend_receives_nothing(self):
		alice = await sync_to_async(User.objects.create_user)(
			username="alice", email="alice@example.com", password="x"
		)
		dave = await sync_to_async(User.objects.create_user)(username="dave", email="dave@example.com", password="x")
		await sync_to_async(Friendship.objects.create)(requester=alice, addressee=dave)

		dave_comm, _ = await _connect_as(dave)
		alice_comm, _ = await _connect_as(alice)

		self.assertTrue(await dave_comm.receive_nothing(timeout=0.2))

		await alice_comm.disconnect()
		await dave_comm.disconnect()

	async def test_a_second_connection_from_the_same_user_does_not_rebroadcast_online(self):
		alice = await sync_to_async(User.objects.create_user)(
			username="alice", email="alice@example.com", password="x"
		)
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="bob@example.com", password="x")
		await sync_to_async(Friendship.objects.create)(requester=alice, addressee=bob, status="accepted")

		bob_comm, _ = await _connect_as(bob)

		alice_tab1, _ = await _connect_as(alice)
		first_event = await bob_comm.receive_json_from()
		self.assertEqual(first_event["status"], "online")

		alice_tab2, _ = await _connect_as(alice)
		self.assertTrue(await bob_comm.receive_nothing(timeout=0.2))

		await alice_tab1.disconnect()
		await alice_tab2.disconnect()
		await bob_comm.disconnect()

	async def test_closing_one_of_two_connections_does_not_broadcast_offline(self):
		alice = await sync_to_async(User.objects.create_user)(
			username="alice", email="alice@example.com", password="x"
		)
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="bob@example.com", password="x")
		await sync_to_async(Friendship.objects.create)(requester=alice, addressee=bob, status="accepted")

		bob_comm, _ = await _connect_as(bob)
		alice_tab1, _ = await _connect_as(alice)
		await bob_comm.receive_json_from()
		alice_tab2, _ = await _connect_as(alice)

		await alice_tab1.disconnect()

		self.assertTrue(await bob_comm.receive_nothing(timeout=0.2))

		await alice_tab2.disconnect()
		await bob_comm.disconnect()

	async def test_closing_the_last_connection_broadcasts_offline(self):
		alice = await sync_to_async(User.objects.create_user)(
			username="alice", email="alice@example.com", password="x"
		)
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="bob@example.com", password="x")
		await sync_to_async(Friendship.objects.create)(requester=alice, addressee=bob, status="accepted")

		bob_comm, _ = await _connect_as(bob)
		alice_tab1, _ = await _connect_as(alice)
		await bob_comm.receive_json_from()
		alice_tab2, _ = await _connect_as(alice)

		await alice_tab1.disconnect()
		await alice_tab2.disconnect()

		event = await bob_comm.receive_json_from()
		self.assertEqual(event["status"], "offline")

		await bob_comm.disconnect()


class PresenceConnectionCountingTests(TransactionTestCase):
	def tearDown(self):
		for key in presence._redis_client.keys("presence:connections:*"):
			presence._redis_client.delete(key)

	def test_first_registration_returns_one(self):
		self.assertEqual(presence.register_connection(12345), 1)

	def test_second_registration_returns_two(self):
		presence.register_connection(12345)
		self.assertEqual(presence.register_connection(12345), 2)

	def test_unregistering_the_only_connection_returns_zero(self):
		presence.register_connection(12345)
		self.assertEqual(presence.unregister_connection(12345), 0)

	def test_unregistering_one_of_two_returns_one(self):
		presence.register_connection(12345)
		presence.register_connection(12345)
		self.assertEqual(presence.unregister_connection(12345), 1)

	def test_unregistering_below_zero_clamps_at_zero(self):
		self.assertEqual(presence.unregister_connection(12345), 0)
		self.assertEqual(presence.unregister_connection(12345), 0)

	def test_different_users_are_counted_independently(self):
		presence.register_connection(111)
		presence.register_connection(222)
		presence.register_connection(222)
		self.assertEqual(presence.unregister_connection(111), 0)
		self.assertEqual(presence.unregister_connection(222), 1)

	# The expiry covers a backend that died; the heartbeat keeps an idle tab online.
	def test_a_registered_connection_is_given_a_time_to_live(self):
		presence.register_connection(12345)
		self.assertGreater(presence._redis_client.ttl(presence._key(12345)), 0)

	def test_a_beat_renews_a_live_connection(self):
		presence.register_connection(12345)
		presence._redis_client.expire(presence._key(12345), 5)
		presence.touch(12345)
		self.assertGreater(presence._redis_client.ttl(presence._key(12345)), 5)

	def test_a_beat_from_nobody_does_not_invent_a_connection(self):
		presence.touch(12345)
		self.assertFalse(presence.is_online(12345))

	def test_is_online_follows_the_count(self):
		self.assertFalse(presence.is_online(12345))
		presence.register_connection(12345)
		self.assertTrue(presence.is_online(12345))
		presence.unregister_connection(12345)
		self.assertFalse(presence.is_online(12345))
