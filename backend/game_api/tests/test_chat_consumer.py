from asgiref.sync import sync_to_async
from channels.testing import WebsocketCommunicator
from django.contrib.auth import BACKEND_SESSION_KEY, HASH_SESSION_KEY, SESSION_KEY, get_user_model
from django.contrib.sessions.backends.db import SessionStore
from django.test import TransactionTestCase, override_settings

from core.asgi import application
from ..models import ChatMessage, Conversation, ConversationRead, Friendship, FriendshipStatus, Game, GameStatus

User = get_user_model()

IN_MEMORY_LAYER = {"default": {"BACKEND": "channels.layers.InMemoryChannelLayer"}}


def _session_cookie_for(user):
	session = SessionStore()
	session[SESSION_KEY] = str(user.pk)
	session[BACKEND_SESSION_KEY] = "django.contrib.auth.backends.ModelBackend"
	session[HASH_SESSION_KEY] = user.get_session_auth_hash()
	session.save()
	return session.session_key


async def _connect_chat_as(user):
	session_key = await sync_to_async(_session_cookie_for)(user)
	communicator = WebsocketCommunicator(
		application, "/ws/chat/",
		headers=[(b"cookie", f"sessionid={session_key}".encode())],
	)
	connected, _ = await communicator.connect()
	return communicator, connected


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class ChatConnectionTests(TransactionTestCase):
	async def test_unauthenticated_connection_is_rejected(self):
		communicator = WebsocketCommunicator(application, "/ws/chat/")
		connected, _ = await communicator.connect()
		self.assertFalse(connected)
		await communicator.disconnect()

	async def test_authenticated_connection_is_accepted(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		communicator, connected = await _connect_chat_as(alice)
		self.assertTrue(connected)
		await communicator.disconnect()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class SendMessageTests(TransactionTestCase):
	async def test_sending_creates_a_message_and_broadcasts_to_both_participants(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")

		alice_comm, _ = await _connect_chat_as(alice)
		bob_comm, _ = await _connect_chat_as(bob)

		await alice_comm.send_json_to({
			"action": "send_message", "recipient_id": str(bob.public_id), "body": "hello bob",
		})

		alice_echo = await alice_comm.receive_json_from()
		bob_receipt = await bob_comm.receive_json_from()
		self.assertEqual(alice_echo["type"], "chat_message")
		self.assertEqual(alice_echo["message"]["body"], "hello bob")
		self.assertEqual(bob_receipt["message"]["body"], "hello bob")
		self.assertEqual(await sync_to_async(ChatMessage.objects.count)(), 1)

		await alice_comm.disconnect()
		await bob_comm.disconnect()

	async def test_sending_to_yourself_is_rejected(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		communicator, _ = await _connect_chat_as(alice)

		await communicator.send_json_to({
			"action": "send_message", "recipient_id": str(alice.public_id), "body": "hi me",
		})
		response = await communicator.receive_json_from()
		self.assertEqual(response["type"], "error")
		self.assertEqual(await sync_to_async(ChatMessage.objects.count)(), 0)

		await communicator.disconnect()

	async def test_sending_to_a_blocked_user_is_rejected(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		await sync_to_async(Friendship.objects.create)(
			requester=bob, addressee=alice, status=FriendshipStatus.BLOCKED
		)

		communicator, _ = await _connect_chat_as(alice)
		await communicator.send_json_to({
			"action": "send_message", "recipient_id": str(bob.public_id), "body": "hi",
		})
		response = await communicator.receive_json_from()
		self.assertEqual(response["type"], "error")
		self.assertEqual(await sync_to_async(ChatMessage.objects.count)(), 0)

		await communicator.disconnect()

	async def test_sending_an_empty_message_is_rejected(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		communicator, _ = await _connect_chat_as(alice)

		await communicator.send_json_to({
			"action": "send_message", "recipient_id": str(bob.public_id), "body": "   ",
		})
		response = await communicator.receive_json_from()
		self.assertEqual(response["type"], "error")

		await communicator.disconnect()

	async def test_sending_to_an_unknown_recipient_is_rejected(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		communicator, _ = await _connect_chat_as(alice)

		await communicator.send_json_to({
			"action": "send_message", "recipient_id": "11111111-1111-1111-1111-111111111111", "body": "hi",
		})
		response = await communicator.receive_json_from()
		self.assertEqual(response["type"], "error")

		await communicator.disconnect()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class TypingIndicatorTests(TransactionTestCase):
	async def test_typing_is_forwarded_to_the_recipient_only(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		carol = await sync_to_async(User.objects.create_user)(
			username="carol", email="c@example.com", password="x"
		)

		alice_comm, _ = await _connect_chat_as(alice)
		bob_comm, _ = await _connect_chat_as(bob)
		carol_comm, _ = await _connect_chat_as(carol)

		await alice_comm.send_json_to({"action": "typing", "recipient_id": str(bob.public_id)})

		event = await bob_comm.receive_json_from()
		self.assertEqual(event["type"], "typing")
		self.assertEqual(event["username"], "alice")
		self.assertTrue(await carol_comm.receive_nothing(timeout=0.2))
		self.assertTrue(await alice_comm.receive_nothing(timeout=0.2))

		await alice_comm.disconnect()
		await bob_comm.disconnect()
		await carol_comm.disconnect()

	async def test_typing_never_creates_a_database_row(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		alice_comm, _ = await _connect_chat_as(alice)
		bob_comm, _ = await _connect_chat_as(bob)

		await alice_comm.send_json_to({"action": "typing", "recipient_id": str(bob.public_id)})
		await bob_comm.receive_json_from()

		self.assertEqual(await sync_to_async(ChatMessage.objects.count)(), 0)
		self.assertEqual(await sync_to_async(Conversation.objects.count)(), 0)

		await alice_comm.disconnect()
		await bob_comm.disconnect()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class ReadReceiptTests(TransactionTestCase):
	async def test_mark_read_updates_state_and_notifies_the_other_participant(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		conversation = await sync_to_async(Conversation.between)(alice, bob)
		await sync_to_async(ChatMessage.objects.create)(conversation=conversation, user=bob, body="hey")

		alice_comm, _ = await _connect_chat_as(alice)
		bob_comm, _ = await _connect_chat_as(bob)

		await alice_comm.send_json_to({"action": "mark_read", "conversation_id": conversation.pk})

		event = await bob_comm.receive_json_from()
		self.assertEqual(event["type"], "read_receipt")
		self.assertEqual(event["reader_id"], str(alice.public_id))

		exists = await sync_to_async(
			ConversationRead.objects.filter(conversation=conversation, user=alice).exists
		)()
		self.assertTrue(exists)

		await alice_comm.disconnect()
		await bob_comm.disconnect()

	async def test_cannot_mark_read_a_conversation_you_are_not_part_of(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		carol = await sync_to_async(User.objects.create_user)(
			username="carol", email="c@example.com", password="x"
		)
		conversation = await sync_to_async(Conversation.between)(alice, bob)

		communicator, _ = await _connect_chat_as(carol)
		await communicator.send_json_to({"action": "mark_read", "conversation_id": conversation.pk})
		response = await communicator.receive_json_from()
		self.assertEqual(response["type"], "error")

		await communicator.disconnect()


@override_settings(CHANNEL_LAYERS=IN_MEMORY_LAYER)
class GameInviteTests(TransactionTestCase):
	async def test_sending_a_game_invite_creates_a_game_invite_message(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game = await sync_to_async(Game.objects.create)(host=alice, max_seats=4, starting_hand_size=7)

		alice_comm, _ = await _connect_chat_as(alice)
		bob_comm, _ = await _connect_chat_as(bob)

		await alice_comm.send_json_to({
			"action": "send_game_invite", "recipient_id": str(bob.public_id), "game_id": str(game.public_id),
		})

		await alice_comm.receive_json_from()
		event = await bob_comm.receive_json_from()
		self.assertEqual(event["message"]["message_type"], "game_invite")
		self.assertEqual(event["message"]["invited_game"]["public_id"], str(game.public_id))

		await alice_comm.disconnect()
		await bob_comm.disconnect()

	async def test_inviting_to_an_already_started_game_is_rejected(self):
		alice = await sync_to_async(User.objects.create_user)(username="alice", email="a@example.com", password="x")
		bob = await sync_to_async(User.objects.create_user)(username="bob", email="b@example.com", password="x")
		game = await sync_to_async(Game.objects.create)(
			host=alice, max_seats=4, starting_hand_size=7, status=GameStatus.IN_PROGRESS
		)

		communicator, _ = await _connect_chat_as(alice)
		await communicator.send_json_to({
			"action": "send_game_invite", "recipient_id": str(bob.public_id), "game_id": str(game.public_id),
		})
		response = await communicator.receive_json_from()
		self.assertEqual(response["type"], "error")

		await communicator.disconnect()