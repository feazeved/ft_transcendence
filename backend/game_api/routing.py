from django.urls import path

from .consumers import GameConsumer, PresenceConsumer

websocket_urlpatterns = [
	path("ws/presence/", PresenceConsumer.as_asgi()),
	path("ws/games/<uuid:public_id>/", GameConsumer.as_asgi()),
]