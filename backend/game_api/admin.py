from django.contrib import admin

from .models import ChatMessage, Friendship, Game, GamePlayer, Tournament, User

admin.site.register(User)
admin.site.register(Friendship)
admin.site.register(Tournament)
admin.site.register(Game)
admin.site.register(GamePlayer)
admin.site.register(ChatMessage)
