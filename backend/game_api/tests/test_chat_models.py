from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction
from django.test import TestCase

from ..models import ChatMessage, Conversation, Friendship, FriendshipStatus

User = get_user_model()


class ConversationTests(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="x")

	def test_between_creates_a_conversation(self):
		conversation = Conversation.between(self.alice, self.bob)
		self.assertIsNotNone(conversation.pk)

	def test_between_is_idempotent_regardless_of_argument_order(self):
		first = Conversation.between(self.alice, self.bob)
		second = Conversation.between(self.bob, self.alice)
		self.assertEqual(first.pk, second.pk)
		self.assertEqual(Conversation.objects.count(), 1)

	def test_canonical_ordering_puts_the_lower_pk_first(self):
		conversation = Conversation.between(self.bob, self.alice)
		lower_pk_user = self.alice if self.alice.pk < self.bob.pk else self.bob
		self.assertEqual(conversation.user_a_id, lower_pk_user.pk)

	def test_other_participant_returns_the_correct_user(self):
		conversation = Conversation.between(self.alice, self.bob)
		self.assertEqual(conversation.other_participant(self.alice), self.bob)
		self.assertEqual(conversation.other_participant(self.bob), self.alice)

	def test_database_constraint_rejects_non_canonical_ordering(self):
		higher, lower = sorted([self.alice, self.bob], key=lambda u: -u.pk)
		with self.assertRaises(IntegrityError):
			with transaction.atomic():
				Conversation.objects.create(user_a=higher, user_b=lower)


class ChatMessageConstraintTests(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="x")

	def test_a_message_with_neither_game_nor_conversation_is_rejected(self):
		with self.assertRaises(IntegrityError):
			with transaction.atomic():
				ChatMessage.objects.create(user=self.alice, body="hello")

	def test_a_message_with_both_game_and_conversation_is_rejected(self):
		from ..models import Game

		game = Game.objects.create(host=self.alice, max_seats=4, starting_hand_size=7)
		conversation = Conversation.between(self.alice, self.bob)
		with self.assertRaises(IntegrityError):
			with transaction.atomic():
				ChatMessage.objects.create(user=self.alice, game=game, conversation=conversation, body="hello")

	def test_a_dm_message_alone_is_accepted(self):
		conversation = Conversation.between(self.alice, self.bob)
		message = ChatMessage.objects.create(user=self.alice, conversation=conversation, body="hello")
		self.assertIsNotNone(message.pk)


class BlockingReuseTests(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="x")
		self.carol = User.objects.create_user(username="carol", email="carol@example.com", password="x")

	def test_not_blocked_by_default(self):
		self.assertFalse(self.alice.is_blocked_with(self.bob))

	def test_blocked_when_alice_blocked_bob(self):
		Friendship.objects.create(requester=self.alice, addressee=self.bob, status=FriendshipStatus.BLOCKED)
		self.assertTrue(self.alice.is_blocked_with(self.bob))
		self.assertTrue(self.bob.is_blocked_with(self.alice))

	def test_an_accepted_friendship_is_not_a_block(self):
		Friendship.objects.create(requester=self.alice, addressee=self.bob, status=FriendshipStatus.ACCEPTED)
		self.assertFalse(self.alice.is_blocked_with(self.bob))

	def test_unrelated_users_are_not_blocked(self):
		Friendship.objects.create(requester=self.alice, addressee=self.bob, status=FriendshipStatus.BLOCKED)
		self.assertFalse(self.alice.is_blocked_with(self.carol))