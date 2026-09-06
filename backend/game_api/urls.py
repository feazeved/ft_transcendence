from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
	FriendshipViewSet, PublicProfileView, GameViewSet, LeaderboardView, MatchHistoryView,
	UserStatsView, ConversationListView, ConversationMessagesView, GameChatHistoryView,
)

router = DefaultRouter()

router.register("friendships", FriendshipViewSet, basename="friendship")
router.register("games", GameViewSet, basename="game")

urlpatterns = [
	path("users/<uuid:public_id>/", PublicProfileView.as_view(), name="public-profile"),
	path("users/<uuid:public_id>/matches/", MatchHistoryView.as_view(), name="match-history"),
	path("users/<uuid:public_id>/stats/", UserStatsView.as_view(), name="user-stats"),
	path("leaderboard/", LeaderboardView.as_view(), name="leaderboard"),
	path("conversations/", ConversationListView.as_view(), name="conversation-list"),
	path("conversations/<int:conversation_id>/messages/", ConversationMessagesView.as_view(), name="conversation-messages"),
	path("games/<uuid:public_id>/messages/", GameChatHistoryView.as_view(), name="game-chat-history"),
] + router.urls