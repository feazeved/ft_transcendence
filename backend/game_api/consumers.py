import json

from asgiref.sync import async_to_sync
from channels.generic.websocket import WebsocketConsumer
from django.contrib.auth import get_user_model
from django.utils import timezone

from . import presence

class PresenceConsumer(WebsocketConsumer):
	def connect(self):
		user = self.scope["user"]

		if not user.is_authenticated:
			self.close()
			return

		self.user = user
		self.group_name = f"presence_{user.pk}"

		async_to_sync(self.channel_layer.group_add)(self.group_name, self.channel_name)
		self.accept()
		get_user_model().objects.filter(pk=user.pk).update(last_seen_at=timezone.now())

		connection_count = presence.register_connection(user.pk)

		if connection_count == 1:
			self._broadcast_to_friends("online")

	def disconnect(self, close_code):
		user = getattr(self, "user", None)

		if user is None:
			return

		async_to_sync(self.channel_layer.group_discard)(self.group_name, self.channel_name)
		get_user_model().objects.filter(pk=user.pk).update(last_seen_at=timezone.now())

		remaining_connections = presence.unregister_connection(user.pk)

		if remaining_connections == 0:
			self._broadcast_to_friends("offline")

	def _broadcast_to_friends(self, status):
		for friend_id in self.user.accepted_friend_ids():
			async_to_sync(self.channel_layer.group_send)(
				f"presence_{friend_id}",
				{
					"type": "presence.update",
					"public_id": str(self.user.public_id),
					"username": self.user.username,
					"status": status,
				},
			)

	def presence_update(self, event):
		self.send(text_data=json.dumps({
			"type": "presence_update",
			"public_id": event["public_id"],
			"username": event["username"],
			"status": event["status"],
		}))