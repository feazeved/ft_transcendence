import random

import pytest

from game_engine.cards import Card, CardType, Color
from game_engine.deck import Deck
from game_engine.engine import IllegalMove, draw_card, play_card, start_game
from game_engine.state import Direction, GameSettings, GameState, Player

DRAW_UNTIL_PLAYABLE = GameSettings(enabled_modifiers=frozenset({"draw_until_playable"}))


def test_stops_at_the_first_playable_card_and_keeps_everything_drawn():
	top = Card(Color.RED, CardType.NUMBER, 5)
	playable = Card(Color.RED, CardType.NUMBER, 9)
	unplayable_a = Card(Color.BLUE, CardType.NUMBER, 1)
	unplayable_b = Card(Color.GREEN, CardType.NUMBER, 2)
	unplayable_c = Card(Color.YELLOW, CardType.NUMBER, 3)

	deck = Deck(draw_pile=[playable, unplayable_c, unplayable_b, unplayable_a])
	state = GameState(
		players=[Player(player_id="p0", name="P0", hand=[]), Player(player_id="p1", name="P1", hand=[])],
		deck=deck, top_card=top, current_color=Color.RED, current_player_index=0,
		direction=Direction.CLOCKWISE, settings=DRAW_UNTIL_PLAYABLE,
	)

	new_state = draw_card(state, "p0")
	hand = new_state.players[0].hand
	assert [str(c) for c in hand] == ["blue 1", "green 2", "yellow 3", "red 9"]
	assert hand[-1] == playable


def test_a_wild_card_always_stops_the_search():
	top = Card(Color.RED, CardType.NUMBER, 5)
	wild = Card(Color.WILD, CardType.WILD)
	off_color = Card(Color.BLUE, CardType.NUMBER, 1)

	deck = Deck(draw_pile=[wild, off_color, off_color])
	state = GameState(
		players=[Player(player_id="p0", name="P0", hand=[]), Player(player_id="p1", name="P1", hand=[])],
		deck=deck, top_card=top, current_color=Color.RED, current_player_index=0,
		direction=Direction.CLOCKWISE, settings=DRAW_UNTIL_PLAYABLE,
	)

	new_state = draw_card(state, "p0")
	assert new_state.players[0].hand[-1] == wild
	assert len(new_state.players[0].hand) == 3


def test_does_not_end_the_turn():
	state = start_game([("p0", "P0"), ("p1", "P1")], settings=DRAW_UNTIL_PLAYABLE, rng=random.Random(1))
	current_id = state.players[state.current_player_index].player_id
	starting_index = state.current_player_index

	new_state = draw_card(state, current_id)
	assert new_state.current_player_index == starting_index
	assert new_state.has_drawn_this_turn is True


def test_cannot_draw_twice_in_one_turn():
	state = start_game([("p0", "P0"), ("p1", "P1")], settings=DRAW_UNTIL_PLAYABLE, rng=random.Random(1))
	current_id = state.players[state.current_player_index].player_id
	state = draw_card(state, current_id)
	with pytest.raises(IllegalMove):
		draw_card(state, current_id)


def test_defers_to_an_active_draw_stacking_penalty():
	both = GameSettings(enabled_modifiers=frozenset({"draw_until_playable", "draw_stacking"}))
	state = start_game([("p0", "P0"), ("p1", "P1")], settings=both, rng=random.Random(3))

	d2 = Card(color=state.current_color, card_type=CardType.DRAW_TWO)
	filler = Card(color=Color.RED, card_type=CardType.NUMBER, value=1)
	state.players[0].hand = [d2, filler]
	state.current_player_index = 0

	after_stack = play_card(state, "p0", d2)
	p1_hand_before = len(after_stack.players[1].hand)

	after_draw = draw_card(after_stack, "p1")
	assert len(after_draw.players[1].hand) == p1_hand_before + 2
	assert "draw_stack" not in after_draw.modifier_state
	assert after_draw.current_player_index == 0