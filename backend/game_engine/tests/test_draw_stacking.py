import random

import pytest

from game_engine.cards import Card, CardType, Color
from game_engine.engine import IllegalMove, draw_card, play_card, start_game
from game_engine.state import GameSettings

STACKING = GameSettings(enabled_modifiers=frozenset({"draw_stacking"}))


def make_players(n: int) -> list[tuple[str, str]]:
	return [(f"p{i}", f"Player {i}") for i in range(n)]


def _set_hand(state, index: int, hand: list[Card]) -> None:
	state.players[index].hand = hand
	state.current_player_index = index


def test_draw_stacking_disabled_leaves_normal_behavior_alone():
	state = start_game(make_players(3), rng=random.Random(1))
	d2 = Card(color=state.current_color, card_type=CardType.DRAW_TWO)
	filler = Card(color=Color.RED, card_type=CardType.NUMBER, value=1)
	_set_hand(state, 0, [d2, filler])
	before = len(state.players[1].hand)
	new_state = play_card(state, "p0", d2)
	assert len(new_state.players[1].hand) == before + 2
	assert new_state.current_player_index == 2
	assert new_state.modifier_state == {}


def test_single_draw_two_with_no_stacking_response_forces_full_draw():
	state = start_game(make_players(3), settings=STACKING, rng=random.Random(2))
	d2 = Card(color=state.current_color, card_type=CardType.DRAW_TWO)
	filler = Card(color=Color.RED, card_type=CardType.NUMBER, value=1)
	_set_hand(state, 0, [d2, filler])

	after_play = play_card(state, "p0", d2)
	assert after_play.current_player_index == 1
	assert after_play.modifier_state["draw_stack"] == {"type": "draw_two", "count": 2}

	p1_hand_before = len(after_play.players[1].hand)
	after_draw = draw_card(after_play, "p1")
	assert len(after_draw.players[1].hand) == p1_hand_before + 2
	assert after_draw.current_player_index == 2
	assert "draw_stack" not in after_draw.modifier_state


def test_matching_type_is_legal_during_a_stack():
	state = start_game(make_players(2), settings=STACKING, rng=random.Random(3))
	d2_a = Card(color=state.current_color, card_type=CardType.DRAW_TWO)
	d2_b = Card(color=Color.BLUE, card_type=CardType.DRAW_TWO)
	filler = Card(color=Color.RED, card_type=CardType.NUMBER, value=1)
	_set_hand(state, 0, [d2_a, filler])
	after_first = play_card(state, "p0", d2_a)

	state1 = after_first
	state1.players[1].hand = [d2_b, filler]
	after_second = play_card(state1, "p1", d2_b)
	assert after_second.modifier_state["draw_stack"] == {"type": "draw_two", "count": 4}


def test_color_matching_card_is_illegal_during_a_stack():
	state = start_game(make_players(2), settings=STACKING, rng=random.Random(4))
	d2 = Card(color=state.current_color, card_type=CardType.DRAW_TWO)
	off_type_same_color = Card(color=state.current_color, card_type=CardType.NUMBER, value=3)
	filler = Card(color=Color.RED, card_type=CardType.NUMBER, value=1)
	_set_hand(state, 0, [d2, filler])
	after_first = play_card(state, "p0", d2)

	after_first.players[1].hand = [off_type_same_color]
	with pytest.raises(IllegalMove):
		play_card(after_first, "p1", off_type_same_color)


def test_wild_draw_four_cannot_join_a_draw_two_stack():
	state = start_game(make_players(2), settings=STACKING, rng=random.Random(5))
	d2 = Card(color=state.current_color, card_type=CardType.DRAW_TWO)
	wd4 = Card(color=Color.WILD, card_type=CardType.WILD_DRAW_FOUR)
	filler = Card(color=Color.RED, card_type=CardType.NUMBER, value=1)
	_set_hand(state, 0, [d2, filler])
	after_first = play_card(state, "p0", d2)

	after_first.players[1].hand = [wd4]
	with pytest.raises(IllegalMove):
		play_card(after_first, "p1", wd4, chosen_color=Color.RED)


def test_draw_two_cannot_join_a_wild_draw_four_stack():
	state = start_game(make_players(2), settings=STACKING, rng=random.Random(6))
	wd4 = Card(color=Color.WILD, card_type=CardType.WILD_DRAW_FOUR)
	d2 = Card(color=Color.RED, card_type=CardType.DRAW_TWO)
	filler = Card(color=Color.RED, card_type=CardType.NUMBER, value=1)
	_set_hand(state, 0, [wd4, filler])
	after_first = play_card(state, "p0", wd4, chosen_color=Color.RED)

	after_first.players[1].hand = [d2]
	with pytest.raises(IllegalMove):
		play_card(after_first, "p1", d2)


def test_three_way_draw_two_chain_sums_correctly():
	state = start_game(make_players(3), settings=STACKING, rng=random.Random(7))
	d2_a = Card(color=state.current_color, card_type=CardType.DRAW_TWO)
	d2_b = Card(color=Color.BLUE, card_type=CardType.DRAW_TWO)
	filler = Card(color=Color.RED, card_type=CardType.NUMBER, value=1)

	_set_hand(state, 0, [d2_a, filler])
	state = play_card(state, "p0", d2_a)
	assert state.current_player_index == 1

	state.players[1].hand = [d2_b, filler]
	state = play_card(state, "p1", d2_b)
	assert state.current_player_index == 2
	assert state.modifier_state["draw_stack"]["count"] == 4

	p2_hand_before = len(state.players[2].hand)
	state = draw_card(state, "p2")
	assert len(state.players[2].hand) == p2_hand_before + 4
	assert state.current_player_index == 0
	assert "draw_stack" not in state.modifier_state


def test_wild_draw_four_chain_sums_correctly():
	state = start_game(make_players(2), settings=STACKING, rng=random.Random(8))
	wd4_a = Card(color=Color.WILD, card_type=CardType.WILD_DRAW_FOUR)
	wd4_b = Card(color=Color.WILD, card_type=CardType.WILD_DRAW_FOUR)
	filler = Card(color=Color.RED, card_type=CardType.NUMBER, value=1)

	_set_hand(state, 0, [wd4_a, filler])
	state = play_card(state, "p0", wd4_a, chosen_color=Color.GREEN)
	assert state.modifier_state["draw_stack"] == {"type": "wild_draw_four", "count": 4}

	state.players[1].hand = [wd4_b, filler]
	state = play_card(state, "p1", wd4_b, chosen_color=Color.YELLOW)
	assert state.modifier_state["draw_stack"] == {"type": "wild_draw_four", "count": 8}

	p0_hand_before = len(state.players[0].hand)
	state = draw_card(state, "p0")
	assert len(state.players[0].hand) == p0_hand_before + 8
	assert "draw_stack" not in state.modifier_state


def test_winning_with_a_stacking_card_ends_the_round_without_triggering_the_stack():
	state = start_game(make_players(2), settings=STACKING, rng=random.Random(9))
	d2 = Card(color=state.current_color, card_type=CardType.DRAW_TWO)
	_set_hand(state, 0, [d2])
	new_state = play_card(state, "p0", d2)
	assert new_state.winner_id == "p0"
	assert new_state.modifier_state == {}


def test_pending_stack_survives_a_serialization_round_trip():
	from game_engine.serialization import state_from_dict, state_to_dict

	state = start_game(make_players(2), settings=STACKING, rng=random.Random(10))
	d2 = Card(color=state.current_color, card_type=CardType.DRAW_TWO)
	filler = Card(color=Color.RED, card_type=CardType.NUMBER, value=1)
	_set_hand(state, 0, [d2, filler])
	state = play_card(state, "p0", d2)

	restored = state_from_dict(state_to_dict(state))
	assert restored.modifier_state == state.modifier_state
	with pytest.raises(IllegalMove):
		off_type = Card(color=restored.current_color, card_type=CardType.NUMBER, value=2)
		restored.players[1].hand.append(off_type)
		play_card(restored, "p1", off_type)
