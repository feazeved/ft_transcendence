import random

from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.db import IntegrityError
from django.test import TestCase

from game_engine.cards import CardType, Color
from game_engine.deck import STANDARD_COLORS
from game_engine.engine import play_card, start_game
from game_engine.serialization import state_from_dict, state_to_dict

from ..models import Game, GamePlayer

User = get_user_model()


def _would_be_legal(state, card):
	if card.card_type in (CardType.WILD, CardType.WILD_DRAW_FOUR):
		return True
	if card.color == state.current_color:
		return True
	top = state.top_card
	if card.card_type == CardType.NUMBER and top.card_type == CardType.NUMBER:
		return card.value == top.value
	return card.card_type == top.card_type and card.card_type != CardType.NUMBER


class UserModelTests(TestCase):
	def test_create_user_hashes_the_password_properly(self):
		user = User.objects.create_user(username='alice', email='alice@example.com', password='s3cret!')
		self.assertNotEqual(user.password, 's3cret!')
		self.assertTrue(user.check_password('s3cret!'))

	def test_email_must_be_unique(self):
		User.objects.create_user(username='alice', email='dupe@example.com', password='x')
		with self.assertRaises(IntegrityError):
			User.objects.create_user(username='bob', email='dupe@example.com', password='x')

	def test_avatar_url_falls_back_to_default_when_unset(self):
		user = User.objects.create_user(username='alice', email='alice@example.com', password='x')
		self.assertFalse(user.avatar)
		self.assertEqual(user.avatar_url, User.DEFAULT_AVATAR_URL)


class GameModelTests(TestCase):
	def setUp(self):
		self.users = [
			User.objects.create_user(username=f'u{i}', email=f'u{i}@example.com', password='x')
			for i in range(10)
		]

	def test_create_pending_game_with_seated_players(self):
		game = Game.objects.create(max_seats=4, starting_hand_size=7)
		GamePlayer.objects.create(game=game, user=self.users[0], seat=0)
		GamePlayer.objects.create(game=game, user=self.users[1], seat=1)
		self.assertEqual(game.players.count(), 2)
		self.assertEqual(game.status, 'pending')
		self.assertIsNone(game.state)

	def test_duplicate_seat_is_rejected(self):
		game = Game.objects.create(max_seats=4, starting_hand_size=7)
		GamePlayer.objects.create(game=game, user=self.users[0], seat=0)
		with self.assertRaises(IntegrityError):
			GamePlayer.objects.create(game=game, user=self.users[1], seat=0)

	def test_max_seats_rejects_more_than_ten(self):
		game = Game(max_seats=11, starting_hand_size=7)
		with self.assertRaises(ValidationError):
			game.full_clean()

	def test_max_seats_accepts_ten(self):
		game = Game(max_seats=10, starting_hand_size=7)
		game.full_clean()

	def test_max_seats_rejects_fewer_than_two(self):
		game = Game(max_seats=1, starting_hand_size=7)
		with self.assertRaises(ValidationError):
			game.full_clean()


class GameStatePersistenceTests(TestCase):
	def setUp(self):
		self.users = [
			User.objects.create_user(username=f'u{i}', email=f'u{i}@example.com', password='x')
			for i in range(10)
		]

	def test_state_round_trips_through_postgres(self):
		engine_state = start_game(
			[(str(self.users[0].id), 'u0'), (str(self.users[1].id), 'u1')],
			rng=random.Random(11),
		)
		game = Game.objects.create(
			max_seats=2, starting_hand_size=7, status='in_progress', state=state_to_dict(engine_state)
		)
		GamePlayer.objects.create(game=game, user=self.users[0], seat=0)
		GamePlayer.objects.create(game=game, user=self.users[1], seat=1)

		reloaded = Game.objects.get(pk=game.pk)
		restored_state = state_from_dict(reloaded.state)

		self.assertEqual(
			[p.hand for p in restored_state.players],
			[p.hand for p in engine_state.players],
		)
		self.assertEqual(restored_state.top_card, engine_state.top_card)

	def test_a_move_can_be_applied_after_reload_from_postgres(self):
		engine_state = start_game(
			[(str(self.users[0].id), 'u0'), (str(self.users[1].id), 'u1')],
			rng=random.Random(6),
		)
		game = Game.objects.create(
			max_seats=2, starting_hand_size=7, status='in_progress', state=state_to_dict(engine_state)
		)

		reloaded = Game.objects.get(pk=game.pk)
		restored_state = state_from_dict(reloaded.state)

		current = restored_state.players[restored_state.current_player_index]
		legal = next((c for c in current.hand if _would_be_legal(restored_state, c)), None)
		if legal is None:
			self.skipTest('seeded hand had no legal card')
		color = STANDARD_COLORS[0] if legal.color == Color.WILD else None
		new_state = play_card(restored_state, current.player_id, legal, chosen_color=color)

		game.state = state_to_dict(new_state)
		game.save()

		reloaded_again = Game.objects.get(pk=game.pk)
		final_state = state_from_dict(reloaded_again.state)
		self.assertEqual(final_state.top_card, legal)

	def test_ten_player_game_persists_correctly(self):
		players = [(str(u.id), u.username) for u in self.users]
		engine_state = start_game(players, rng=random.Random(77))
		game = Game.objects.create(
			max_seats=10, starting_hand_size=7, status='in_progress', state=state_to_dict(engine_state)
		)
		for seat, user in enumerate(self.users):
			GamePlayer.objects.create(game=game, user=user, seat=seat)

		self.assertEqual(game.players.count(), 10)
		reloaded = Game.objects.get(pk=game.pk)
		restored_state = state_from_dict(reloaded.state)
		self.assertEqual(len(restored_state.players), 10)
		self.assertEqual(
			[p.hand for p in restored_state.players],
			[p.hand for p in engine_state.players],
		)