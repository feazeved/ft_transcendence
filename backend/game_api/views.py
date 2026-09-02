from django.http import JsonResponse
from django.views.decorators.csrf import ensure_csrf_cookie
from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework import generics, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .models import Friendship, FriendshipStatus, User
from .serializers import FriendshipSerializer, FriendshipTargetSerializer, PublicProfileSerializer

@ensure_csrf_cookie
def csrf(request):
	return JsonResponse({'detail': 'CSRF cookie set'})

class PublicProfileView(generics.RetrieveAPIView):
	queryset = User.objects.all()
	serializer_class = PublicProfileSerializer
	lookup_field = "public_id"


def _existing_relationship(user, target):
	return Friendship.objects.filter(
		Q(requester=user, addressee=target) | Q(requester=target, addressee=user)
	).first()


class FriendshipViewSet(viewsets.GenericViewSet):
	serializer_class = FriendshipSerializer

	def get_queryset(self):
		user = self.request.user
		return Friendship.objects.filter(Q(requester=user) | Q(addressee=user)).select_related("requester", "addressee")

	def list(self, request):
		return Response(self.get_serializer(self.get_queryset(), many=True).data)

	@action(detail=False, methods=["get"])
	def friends(self, request):
		qs = self.get_queryset().filter(status=FriendshipStatus.ACCEPTED)
		return Response(self.get_serializer(qs, many=True).data)

	@action(detail=False, methods=["get"])
	def incoming(self, request):
		qs = self.get_queryset().filter(addressee=request.user, status=FriendshipStatus.PENDING)
		return Response(self.get_serializer(qs, many=True).data)

	@action(detail=False, methods=["get"])
	def outgoing(self, request):
		qs = self.get_queryset().filter(requester=request.user, status=FriendshipStatus.PENDING)
		return Response(self.get_serializer(qs, many=True).data)

	def create(self, request):
		target_serializer = FriendshipTargetSerializer(data=request.data, context={"request": request})
		target_serializer.is_valid(raise_exception=True)
		target = target_serializer.target
		existing = _existing_relationship(request.user, target)

		if existing is not None:
			if existing.status == FriendshipStatus.BLOCKED:
				raise PermissionDenied("Can't send a friend request to this user.")
			raise ValidationError("A friendship or pending request already exists with this user.")

		friendship = Friendship.objects.create(requester=request.user, addressee=target)

		return Response(self.get_serializer(friendship).data, status=201)

	@action(detail=True, methods=["post"])
	def accept(self, request, pk=None):
		friendship = get_object_or_404(self.get_queryset(), pk=pk)

		if friendship.addressee_id != request.user.id:
			raise PermissionDenied("Only the addressee can accept a request.")
		if friendship.status != FriendshipStatus.PENDING:
			raise ValidationError("This request is no longer pending.")

		friendship.status = FriendshipStatus.ACCEPTED
		friendship.save(update_fields=["status"])

		return Response(self.get_serializer(friendship).data)

	@action(detail=True, methods=["post"])
	def decline(self, request, pk=None):
		friendship = get_object_or_404(self.get_queryset(), pk=pk)

		if friendship.addressee_id != request.user.id:
			raise PermissionDenied("Only the addressee can decline a request.")
		if friendship.status != FriendshipStatus.PENDING:
			raise ValidationError("This request is no longer pending.")

		friendship.status = FriendshipStatus.DECLINED
		friendship.save(update_fields=["status"])

		return Response(self.get_serializer(friendship).data)

	def destroy(self, request, pk=None):
		friendship = get_object_or_404(self.get_queryset(), pk=pk)
		user_id = request.user.id

		if friendship.status == FriendshipStatus.PENDING and friendship.requester_id != user_id:
			raise PermissionDenied("Only the requester can cancel a pending request.")
		if friendship.status == FriendshipStatus.BLOCKED and friendship.requester_id != user_id:
			raise PermissionDenied("Only the person who blocked this user can undo it.")

		friendship.delete()

		return Response(status=204)

	@action(detail=False, methods=["post"])
	def block(self, request):
		target_serializer = FriendshipTargetSerializer(data=request.data, context={"request": request})
		target_serializer.is_valid(raise_exception=True)
		target = target_serializer.target
		existing = _existing_relationship(request.user, target)

		if existing is not None:
			existing.requester = request.user
			existing.addressee = target
			existing.status = FriendshipStatus.BLOCKED
			existing.save(update_fields=["requester", "addressee", "status"])
			friendship = existing
		else:
			friendship = Friendship.objects.create(
				requester=request.user, addressee=target, status=FriendshipStatus.BLOCKED
			)
		return Response(self.get_serializer(friendship).data)