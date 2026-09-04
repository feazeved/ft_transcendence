from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import FriendshipViewSet, PublicProfileView, GameViewSet

router = DefaultRouter()

router.register("friendships", FriendshipViewSet, basename="friendship")
router.register("games", GameViewSet, basename="game")

urlpatterns = [
	path("users/<uuid:public_id>/", PublicProfileView.as_view(), name="public-profile"),
] + router.urls