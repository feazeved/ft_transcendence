from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from ..models import ChatMessage, Conversation, ConversationRead, Game, GamePlayer

User = get_user_model()


class ConversationListTests(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="x")
		self.carol = User.objects.create_user(username="carol", email="carol@example.com", password="x")
		self.client.login(username="alice", password="x")

	def test_lists_my_conversations(self):
		conversation = Conversation.between(self.alice, self.bob)
		ChatMessage.objects.create(conversation=conversation, user=self.bob, body="hi")
		response = self.client.get(reverse("conversation-list"))
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["count"], 1)

	def test_does_not_list_a_conversation_i_am_not_part_of(self):
		conversation = Conversation.between(self.bob, self.carol)
		ChatMessage.objects.create(conversation=conversation, user=self.bob, body="hi")
		response = self.client.get(reverse("conversation-list"))
		self.assertEqual(response.data["count"], 0)

	def test_includes_the_other_participant_and_last_message(self):
		conversation = Conversation.between(self.alice, self.bob)
		ChatMessage.objects.create(conversation=conversation, user=self.bob, body="first")
		ChatMessage.objects.create(conversation=conversation, user=self.bob, body="most recent")

		response = self.client.get(reverse("conversation-list"))
		entry = response.data["results"][0]
		self.assertEqual(entry["other_participant"]["username"], "bob")
		self.assertEqual(entry["last_message"]["body"], "most recent")

	def test_unread_count_excludes_my_own_messages(self):
		conversation = Conversation.between(self.alice, self.bob)
		ChatMessage.objects.create(conversation=conversation, user=self.alice, body="from me")
		response = self.client.get(reverse("conversation-list"))
		self.assertEqual(response.data["results"][0]["unread_count"], 0)

	def test_unread_count_reflects_last_read_at(self):
		conversation = Conversation.between(self.alice, self.bob)
		ChatMessage.objects.create(conversation=conversation, user=self.bob, body="before read")
		ConversationRead.objects.create(conversation=conversation, user=self.alice)
		ChatMessage.objects.create(conversation=conversation, user=self.bob, body="after read")

		response = self.client.get(reverse("conversation-list"))
		self.assertEqual(response.data["results"][0]["unread_count"], 1)


class ConversationMessagesTests(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="x")
		self.carol = User.objects.create_user(username="carol", email="carol@example.com", password="x")
		self.conversation = Conversation.between(self.alice, self.bob)
		self.client.login(username="alice", password="x")

	def test_lists_messages_most_recent_first(self):
		ChatMessage.objects.create(conversation=self.conversation, user=self.alice, body="first")
		ChatMessage.objects.create(conversation=self.conversation, user=self.bob, body="second")
		response = self.client.get(reverse("conversation-messages", args=[self.conversation.pk]))
		self.assertEqual(response.data["results"][0]["body"], "second")

	def test_forbidden_for_a_non_participant(self):
		self.client.login(username="carol", password="x")
		response = self.client.get(reverse("conversation-messages", args=[self.conversation.pk]))
		self.assertEqual(response.status_code, 403)


class GameChatHistoryTests(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="x")
		self.game = Game.objects.create(host=self.alice, max_seats=4, starting_hand_size=7)
		GamePlayer.objects.create(game=self.game, user=self.alice, seat=0)
		self.client.login(username="alice", password="x")

	def test_lists_in_game_messages(self):
		ChatMessage.objects.create(game=self.game, user=self.alice, body="gg")
		response = self.client.get(reverse("game-chat-history", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 200)
		self.assertEqual(response.data["count"], 1)

	def test_forbidden_for_a_non_participant(self):
		self.client.login(username="bob", password="x")
		response = self.client.get(reverse("game-chat-history", args=[self.game.public_id]))
		self.assertEqual(response.status_code, 403)