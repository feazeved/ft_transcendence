import random

import pytest

from game_engine.cards import Card, CardType, Color
from game_engine.deck import Deck, build_standard_deck
from game_engine.engine import GameOver, IllegalMove, draw_card, pass_turn, play_card, start_game
from game_engine.state import Direction, GameSettings


def make_players(n: int) -> list[tuple[str, str]]:
	return [(f"p{i}", f"Player {i}") for i in range(n)]


def test_standard_deck_has_108_cards():
	assert len(build_standard_deck()) == 108


def test_standard_deck_composition():
	deck = build_standard_deck()
	numbers = [c for c in deck if c.card_type == CardType.NUMBER]
	wilds = [c for c in deck if c.card_type in (CardType.WILD, CardType.WILD_DRAW_FOUR)]
	actions = [c for c in deck if c.card_type in (CardType.SKIP, CardType.REVERSE, CardType.DRAW_TWO)]
	assert len(numbers) == 76
	assert len(actions) == 24
	assert len(wilds) == 8


def test_deck_refills_instead_of_recycling_discards():
	deck = Deck(rng=random.Random(1))
	deck.draw(108)
	assert len(deck) == 0
	more = deck.draw(5)
	assert len(more) == 5
	assert len(deck) == 108 - 5


def test_start_game_rejects_too_few_players():
	with pytest.raises(ValueError):
		start_game(make_players(1))


def test_start_game_rejects_too_many_players():
	with pytest.raises(ValueError):
		start_game(make_players(7))


def test_start_game_deals_seven_cards_each():
	state = start_game(make_players(4), rng=random.Random(42))
	assert all(len(p.hand) == 7 for p in state.players)


def test_start_game_is_deterministic_with_seeded_rng():
	a = start_game(make_players(3), rng=random.Random(7))
	b = start_game(make_players(3), rng=random.Random(7))
	assert [p.hand for p in a.players] == [p.hand for p in b.players]
	assert a.top_card == b.top_card


def test_start_game_never_leaves_wild_draw_four_as_top_card():
	for seed in range(50):
		state = start_game(make_players(3), rng=random.Random(seed))
		assert state.top_card.card_type != CardType.WILD_DRAW_FOUR


# ---- legal play ----

def test_wild_requires_chosen_color():
	state = start_game(make_players(2), rng=random.Random(3))
	current = state.players[state.current_player_index]
	wild = Card(color=Color.WILD, card_type=CardType.WILD)
	current.hand.append(wild)
	with pytest.raises(IllegalMove):
		play_card(state, current.player_id, wild)


def test_mismatched_card_is_illegal():
	state = start_game(make_players(2), rng=random.Random(3))
	current = state.players[state.current_player_index]
	illegal = _guaranteed_illegal_card(state)
	current.hand.append(illegal)
	with pytest.raises(IllegalMove):
		play_card(state, current.player_id, illegal)


def _guaranteed_illegal_card(state) -> Card:
	off_color = next(c for c in STANDARD_COLORS_TUPLE if c != state.current_color)
	off_type = next(
		t for t in (CardType.NUMBER, CardType.SKIP, CardType.REVERSE, CardType.DRAW_TWO)
		if t != state.top_card.card_type
	)
	value = 0 if off_type == CardType.NUMBER else None
	return Card(color=off_color, card_type=off_type, value=value)


from game_engine.deck import STANDARD_COLORS as STANDARD_COLORS_TUPLE

FILLER = Card(color=Color.RED, card_type=CardType.NUMBER, value=1)


def test_skip_skips_next_player():
	state = start_game(make_players(3), rng=random.Random(5))
	skip_card = Card(color=state.current_color, card_type=CardType.SKIP)
	state.players[0].hand = [skip_card, FILLER]
	state.current_player_index = 0
	new_state = play_card(state, "p0", skip_card)
	assert new_state.current_player_index == 2


def test_reverse_acts_as_skip_with_two_players():
	state = start_game(make_players(2), rng=random.Random(9))
	reverse_card = Card(color=state.current_color, card_type=CardType.REVERSE)
	state.players[0].hand = [reverse_card, FILLER]
	state.current_player_index = 0
	new_state = play_card(state, "p0", reverse_card)
	assert new_state.current_player_index == 0
	assert new_state.direction == state.direction


def test_reverse_flips_direction_with_three_players():
	state = start_game(make_players(3), rng=random.Random(11))
	reverse_card = Card(color=state.current_color, card_type=CardType.REVERSE)
	state.players[0].hand = [reverse_card, FILLER]
	state.current_player_index = 0
	new_state = play_card(state, "p0", reverse_card)
	assert new_state.direction == Direction.COUNTER_CLOCKWISE
	assert new_state.current_player_index == 2


def test_draw_two_forces_draw_and_skip():
	state = start_game(make_players(3), rng=random.Random(13))
	d2 = Card(color=state.current_color, card_type=CardType.DRAW_TWO)
	state.players[0].hand = [d2, FILLER]
	state.current_player_index = 0
	before = len(state.players[1].hand)
	new_state = play_card(state, "p0", d2)
	assert len(new_state.players[1].hand) == before + 2
	assert new_state.current_player_index == 2


def test_win_condition_ends_the_game():
	state = start_game(make_players(2), rng=random.Random(17))
	last_card = Card(color=state.current_color, card_type=CardType.NUMBER, value=1)
	state.players[0].hand = [last_card]
	state.current_player_index = 0
	new_state = play_card(state, "p0", last_card)
	assert new_state.winner_id == "p0"
	with pytest.raises(GameOver):
		play_card(new_state, "p1", new_state.players[1].hand[0])


def test_must_draw_before_passing():
	state = start_game(make_players(2), rng=random.Random(19))
	current_id = state.players[state.current_player_index].player_id
	with pytest.raises(IllegalMove):
		pass_turn(state, current_id)


def test_draw_then_pass_advances_turn():
	state = start_game(make_players(2), rng=random.Random(19))
	current_id = state.players[state.current_player_index].player_id
	state = draw_card(state, current_id)
	state = pass_turn(state, current_id)
	assert state.players[state.current_player_index].player_id != current_id


def test_cannot_draw_twice_in_one_turn():
	state = start_game(make_players(2), rng=random.Random(19))
	current_id = state.players[state.current_player_index].player_id
	state = draw_card(state, current_id)
	with pytest.raises(IllegalMove):
		draw_card(state, current_id)


def test_seven_swap_disabled_by_default():
	state = start_game(make_players(2), rng=random.Random(23))
	seven = Card(color=state.current_color, card_type=CardType.NUMBER, value=7)
	hand_before = list(state.players[1].hand)
	state.players[0].hand = [seven, FILLER]
	state.current_player_index = 0
	new_state = play_card(state, "p0", seven)
	assert new_state.players[1].hand == hand_before


def test_seven_swap_enabled_swaps_hands():
	settings = GameSettings(enabled_modifiers=frozenset({"seven_swap"}))
	state = start_game(make_players(2), settings=settings, rng=random.Random(23))
	p1_hand_before = list(state.players[1].hand)
	seven = Card(color=state.current_color, card_type=CardType.NUMBER, value=7)
	state.players[0].hand = [seven, FILLER]
	state.current_player_index = 0
	new_state = play_card(state, "p0", seven)
	assert new_state.players[0].hand == p1_hand_before


def test_state_is_never_mutated_in_place():
	state = start_game(make_players(2), rng=random.Random(29))
	original_hand = list(state.players[state.current_player_index].hand)
	current = state.players[state.current_player_index]
	legal = next((c for c in current.hand if _would_be_legal(state, c)), None)
	if legal is None:
		pytest.skip("seeded hand happened to have no legal card")
	play_card(state, current.player_id, legal, chosen_color=Color.RED)
	assert state.players[state.current_player_index].hand == original_hand


def _would_be_legal(state, card: Card) -> bool:
	if card.card_type in (CardType.WILD, CardType.WILD_DRAW_FOUR):
		return True
	if card.color == state.current_color:
		return True
	top = state.top_card
	if card.card_type == CardType.NUMBER and top.card_type == CardType.NUMBER:
		return card.value == top.value
	return card.card_type == top.card_type and card.card_type != CardType.NUMBER


def test_full_random_games_run_to_completion():
	for seed in range(20):
		rng = random.Random(seed)
		state = start_game(make_players(rng.randint(2, 6)), rng=random.Random(seed))
		for _ in range(2000):
			if state.winner_id is not None:
				break
			current = state.players[state.current_player_index]
			legal = [c for c in current.hand if _would_be_legal(state, c)]
			if not legal and not state.has_drawn_this_turn:
				state = draw_card(state, current.player_id)
				current = state.players[state.current_player_index]
				legal = [c for c in current.hand if _would_be_legal(state, c) and c == current.hand[-1]]
			if legal:
				card = rng.choice(legal)
				color = rng.choice(STANDARD_COLORS_TUPLE) if card.color == Color.WILD else None
				state = play_card(state, current.player_id, card, chosen_color=color)
			else:
				state = pass_turn(state, current.player_id)
		assert state.winner_id is not None, f"seed {seed}: game did not finish within 2000 actions"
