from django.contrib.auth import get_user_model
from django.test import TestCase
from django.urls import reverse

from ..models import ChatMessage, ChatMessageType, Game, GamePlayer, GameStatus

User = get_user_model()


class GameLogTests(TestCase):
	"""The table's log: real ChatMessage rows with no author, so a refresh reads them back."""

	def test_starting_the_game_writes_an_authorless_line(self):
		ana = User.objects.create_user(username="ana", email="ana@example.com", password="x")
		bea = User.objects.create_user(username="bea", email="bea@example.com", password="x")
		game = Game.objects.create(host=ana, max_seats=2, starting_hand_size=5, status=GameStatus.PENDING)
		GamePlayer.objects.create(game=game, user=ana, seat=0)
		GamePlayer.objects.create(game=game, user=bea, seat=1)

		self.client.force_login(ana)
		self.assertEqual(self.client.post(reverse("game-start", args=[game.public_id])).status_code, 200)

		log = ChatMessage.objects.filter(game=game, message_type=ChatMessageType.SYSTEM)
		self.assertIn("The game has started.", log.values_list("body", flat=True))
		self.assertIsNone(log.first().user)
