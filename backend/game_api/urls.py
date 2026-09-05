from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import FriendshipViewSet, PublicProfileView, GameViewSet, LeaderboardView, MatchHistoryView, UserStatsView

router = DefaultRouter()

router.register("friendships", FriendshipViewSet, basename="friendship")
router.register("games", GameViewSet, basename="game")

urlpatterns = [
	path("users/<uuid:public_id>/", PublicProfileView.as_view(), name="public-profile"),
	path("users/<uuid:public_id>/matches/", MatchHistoryView.as_view(), name="match-history"),
	path("users/<uuid:public_id>/stats/", UserStatsView.as_view(), name="user-stats"),
	path("leaderboard/", LeaderboardView.as_view(), name="leaderboard"),
] + router.urls