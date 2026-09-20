from django.urls import re_path

from .consumers import GameConsumer, PresenceConsumer, ChatConsumer

websocket_urlpatterns = [
	re_path("ws/presence/$", PresenceConsumer.as_asgi()),
	re_path("ws/games/(?P<code_or_id>[a-zA-Z0-9-]+)/$", GameConsumer.as_asgi()),
	re_path("ws/chat/$", ChatConsumer.as_asgi()),
]
