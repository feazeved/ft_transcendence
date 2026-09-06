from django.urls import path

from .consumers import GameConsumer, PresenceConsumer, ChatConsumer

websocket_urlpatterns = [
	path("ws/presence/", PresenceConsumer.as_asgi()),
	path("ws/games/<uuid:public_id>/", GameConsumer.as_asgi()),
	path("ws/chat/", ChatConsumer.as_asgi()),
]