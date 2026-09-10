from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from ..models import Friendship, FriendshipStatus

User = get_user_model()


class FriendshipTestCase(TestCase):
	def setUp(self):
		self.alice = User.objects.create_user(username="alice", email="alice@example.com", password="x")
		self.bob = User.objects.create_user(username="bob", email="bob@example.com", password="x")
		self.carol = User.objects.create_user(username="carol", email="carol@example.com", password="x")

	def login(self, user):
		self.client.login(username=user.username, password="x")


class SendingRequestsTests(FriendshipTestCase):
	def test_can_send_a_friend_request(self):
		self.login(self.alice)
		response = self.client.post(reverse("friendship-list"), {"username": "bob"})
		self.assertEqual(response.status_code, 201)
		friendship = Friendship.objects.get()
		self.assertEqual(friendship.requester, self.alice)
		self.assertEqual(friendship.addressee, self.bob)
		self.assertEqual(friendship.status, FriendshipStatus.PENDING)

	def test_cannot_send_a_request_to_yourself(self):
		self.login(self.alice)
		response = self.client.post(reverse("friendship-list"), {"username": "alice"})
		self.assertEqual(response.status_code, 400)
		self.assertEqual(Friendship.objects.count(), 0)

	def test_cannot_send_a_request_to_a_nonexistent_user(self):
		self.login(self.alice)
		response = self.client.post(reverse("friendship-list"), {"username": "nobody"})
		self.assertEqual(response.status_code, 400)

	def test_cannot_send_a_duplicate_request(self):
		self.login(self.alice)
		self.client.post(reverse("friendship-list"), {"username": "bob"})
		response = self.client.post(reverse("friendship-list"), {"username": "bob"})
		self.assertEqual(response.status_code, 400)
		self.assertEqual(Friendship.objects.count(), 1)

	def test_cannot_send_a_request_to_someone_who_already_sent_one(self):
		Friendship.objects.create(requester=self.bob, addressee=self.alice)
		self.login(self.alice)
		response = self.client.post(reverse("friendship-list"), {"username": "bob"})
		self.assertEqual(response.status_code, 400)
		self.assertEqual(Friendship.objects.count(), 1)

	def test_cannot_send_a_request_to_someone_who_blocked_you(self):
		Friendship.objects.create(requester=self.bob, addressee=self.alice, status=FriendshipStatus.BLOCKED)
		self.login(self.alice)
		response = self.client.post(reverse("friendship-list"), {"username": "bob"})
		self.assertEqual(response.status_code, 403)


class AcceptDeclineTests(FriendshipTestCase):
	def setUp(self):
		super().setUp()
		self.friendship = Friendship.objects.create(requester=self.alice, addressee=self.bob)

	def test_addressee_can_accept(self):
		self.login(self.bob)
		response = self.client.post(reverse("friendship-accept", args=[self.friendship.pk]))
		self.assertEqual(response.status_code, 200)
		self.friendship.refresh_from_db()
		self.assertEqual(self.friendship.status, FriendshipStatus.ACCEPTED)

	def test_requester_cannot_accept_their_own_request(self):
		self.login(self.alice)
		response = self.client.post(reverse("friendship-accept", args=[self.friendship.pk]))
		self.assertEqual(response.status_code, 403)
		self.friendship.refresh_from_db()
		self.assertEqual(self.friendship.status, FriendshipStatus.PENDING)

	def test_an_uninvolved_user_cannot_accept(self):
		self.login(self.carol)
		response = self.client.post(reverse("friendship-accept", args=[self.friendship.pk]))
		self.assertEqual(response.status_code, 404)

	def test_addressee_can_decline(self):
		self.login(self.bob)
		response = self.client.post(reverse("friendship-decline", args=[self.friendship.pk]))
		self.assertEqual(response.status_code, 200)
		self.friendship.refresh_from_db()
		self.assertEqual(self.friendship.status, FriendshipStatus.DECLINED)

	def test_cannot_accept_an_already_accepted_request(self):
		self.friendship.status = FriendshipStatus.ACCEPTED
		self.friendship.save()
		self.login(self.bob)
		response = self.client.post(reverse("friendship-accept", args=[self.friendship.pk]))
		self.assertEqual(response.status_code, 400)


class RemovingRelationshipsTests(FriendshipTestCase):
	def test_requester_can_cancel_their_own_pending_request(self):
		friendship = Friendship.objects.create(requester=self.alice, addressee=self.bob)
		self.login(self.alice)
		response = self.client.delete(reverse("friendship-detail", args=[friendship.pk]))
		self.assertEqual(response.status_code, 204)
		self.assertFalse(Friendship.objects.filter(pk=friendship.pk).exists())

	def test_addressee_cannot_cancel_a_pending_request_sent_to_them(self):
		friendship = Friendship.objects.create(requester=self.alice, addressee=self.bob)
		self.login(self.bob)
		response = self.client.delete(reverse("friendship-detail", args=[friendship.pk]))
		self.assertEqual(response.status_code, 403)
		self.assertTrue(Friendship.objects.filter(pk=friendship.pk).exists())

	def test_either_party_can_unfriend_an_accepted_friendship(self):
		friendship = Friendship.objects.create(
			requester=self.alice, addressee=self.bob, status=FriendshipStatus.ACCEPTED
		)
		self.login(self.bob)
		response = self.client.delete(reverse("friendship-detail", args=[friendship.pk]))
		self.assertEqual(response.status_code, 204)
		self.assertFalse(Friendship.objects.filter(pk=friendship.pk).exists())

	def test_only_the_blocker_can_undo_a_block(self):
		friendship = Friendship.objects.create(
			requester=self.alice, addressee=self.bob, status=FriendshipStatus.BLOCKED
		)
		self.login(self.bob)
		response = self.client.delete(reverse("friendship-detail", args=[friendship.pk]))
		self.assertEqual(response.status_code, 403)

		self.login(self.alice)
		response = self.client.delete(reverse("friendship-detail", args=[friendship.pk]))
		self.assertEqual(response.status_code, 204)


class BlockingTests(FriendshipTestCase):
	def test_can_block_a_user_with_no_prior_relationship(self):
		self.login(self.alice)
		response = self.client.post(reverse("friendship-block"), {"username": "bob"})
		self.assertEqual(response.status_code, 200)
		friendship = Friendship.objects.get()
		self.assertEqual(friendship.requester, self.alice)
		self.assertEqual(friendship.addressee, self.bob)
		self.assertEqual(friendship.status, FriendshipStatus.BLOCKED)

	def test_blocking_takes_over_an_existing_pending_request(self):
		Friendship.objects.create(requester=self.bob, addressee=self.alice)
		self.login(self.alice)
		response = self.client.post(reverse("friendship-block"), {"username": "bob"})
		self.assertEqual(response.status_code, 200)
		self.assertEqual(Friendship.objects.count(), 1)
		friendship = Friendship.objects.get()
		self.assertEqual(friendship.requester, self.alice)
		self.assertEqual(friendship.addressee, self.bob)
		self.assertEqual(friendship.status, FriendshipStatus.BLOCKED)

	def test_blocking_takes_over_an_existing_accepted_friendship(self):
		Friendship.objects.create(requester=self.alice, addressee=self.bob, status=FriendshipStatus.ACCEPTED)
		self.login(self.bob)
		response = self.client.post(reverse("friendship-block"), {"username": "alice"})
		self.assertEqual(response.status_code, 200)
		self.assertEqual(Friendship.objects.count(), 1)
		friendship = Friendship.objects.get()
		self.assertEqual(friendship.requester, self.bob)
		self.assertEqual(friendship.addressee, self.alice)
		self.assertEqual(friendship.status, FriendshipStatus.BLOCKED)


class ListingTests(FriendshipTestCase):
	def setUp(self):
		super().setUp()
		Friendship.objects.create(requester=self.alice, addressee=self.bob, status=FriendshipStatus.ACCEPTED)
		self.incoming_to_alice = Friendship.objects.create(requester=self.carol, addressee=self.alice)
		self.login(self.alice)

	def test_friends_lists_only_accepted(self):
		response = self.client.get(reverse("friendship-friends"))
		self.assertEqual(response.status_code, 200)
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]["status"], "accepted")

	def test_incoming_lists_pending_requests_addressed_to_me(self):
		response = self.client.get(reverse("friendship-incoming"))
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]["requester"]["username"], "carol")

	def test_outgoing_lists_pending_requests_i_sent(self):
		dave = User.objects.create_user(username="dave", email="dave@example.com", password="x")
		Friendship.objects.create(requester=self.alice, addressee=dave)
		response = self.client.get(reverse("friendship-outgoing"))
		self.assertEqual(len(response.data), 1)
		self.assertEqual(response.data[0]["addressee"]["username"], "dave")

	def test_list_includes_everything_regardless_of_status(self):
		response = self.client.get(reverse("friendship-list"))
		self.assertEqual(len(response.data), 2)