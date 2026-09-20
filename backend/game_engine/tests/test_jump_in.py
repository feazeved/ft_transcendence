import pytest

from game_engine.cards import Card, CardType, Color
from game_engine.deck import Deck
from game_engine.engine import IllegalMove, draw_card, play_card
from game_engine.state import Direction, GameSettings, GameState, Player

JUMP_IN = GameSettings(enabled_modifiers=frozenset({"jump_in"}))
JUMP_IN_AND_STACKING = GameSettings(enabled_modifiers=frozenset({"jump_in", "draw_stacking"}))
FILLER = Card(Color.BLUE, CardType.NUMBER, 9)


def _state(hands, top, settings=JUMP_IN, current_idx=0):
	players = [Player(player_id=f"p{i}", name=f"P{i}", hand=h) for i, h in enumerate(hands)]
	return GameState(
		players=players, deck=Deck(), top_card=top, current_color=top.color,
		current_player_index=current_idx, direction=Direction.CLOCKWISE, settings=settings,
	)


def test_identical_card_can_be_played_out_of_turn_and_steals_the_turn():
	top = Card(Color.RED, CardType.NUMBER, 7)
	identical = Card(Color.RED, CardType.NUMBER, 7)
	state = _state([[], [identical, FILLER], []], top)

	new_state = play_card(state, "p1", identical)
	assert new_state.top_card == identical
	assert new_state.current_player_index == 2


def test_jumping_in_with_an_action_card_applies_its_effect_from_the_new_position():
	top = Card(Color.RED, CardType.SKIP)
	identical_skip = Card(Color.RED, CardType.SKIP)
	state = _state([[], [identical_skip, FILLER], [], []], top)

	new_state = play_card(state, "p1", identical_skip)
	assert new_state.current_player_index == 3


def test_non_matching_card_is_still_rejected_out_of_turn_even_with_jump_in_enabled():
	top = Card(Color.RED, CardType.NUMBER, 7)
	off_card = Card(Color.BLUE, CardType.NUMBER, 3)
	state = _state([[], [off_card], []], top)

	with pytest.raises(IllegalMove):
		play_card(state, "p1", off_card)


def test_same_color_different_number_does_not_qualify_as_identical():
	top = Card(Color.RED, CardType.NUMBER, 7)
	same_color_diff_number = Card(Color.RED, CardType.NUMBER, 3)
	state = _state([[], [same_color_diff_number], []], top)

	with pytest.raises(IllegalMove):
		play_card(state, "p1", same_color_diff_number)


def test_matching_card_is_rejected_out_of_turn_when_jump_in_is_not_enabled():
	top = Card(Color.RED, CardType.NUMBER, 7)
	identical = Card(Color.RED, CardType.NUMBER, 7)
	state = _state([[], [identical], []], top, settings=GameSettings())

	with pytest.raises(IllegalMove):
		play_card(state, "p1", identical)


def test_hand_membership_is_still_enforced_during_a_jump():
	top = Card(Color.RED, CardType.NUMBER, 7)
	identical = Card(Color.RED, CardType.NUMBER, 7)
	state = _state([[], [], []], top)

	with pytest.raises(IllegalMove):
		play_card(state, "p1", identical)


def test_the_real_current_players_own_play_is_unaffected():
	top = Card(Color.RED, CardType.NUMBER, 7)
	normal = Card(Color.RED, CardType.NUMBER, 2)
	state = _state([[normal, FILLER], [], []], top)

	new_state = play_card(state, "p0", normal)
	assert new_state.current_player_index == 1


def test_jump_in_needs_nothing_from_draw_stacking_to_work():
	top = Card(Color.RED, CardType.NUMBER, 7)
	identical = Card(Color.RED, CardType.NUMBER, 7)
	state = _state([[], [identical, FILLER], []], top, settings=JUMP_IN)

	new_state = play_card(state, "p1", identical)
	assert new_state.current_player_index == 2
	assert new_state.modifier_state == {}


def test_same_type_different_color_cannot_jump_into_an_active_stack():
	top = Card(Color.RED, CardType.NUMBER, 5)
	d2_red = Card(Color.RED, CardType.DRAW_TWO)
	d2_blue = Card(Color.BLUE, CardType.DRAW_TWO)
	state = _state([[d2_red, FILLER], [], [d2_blue, FILLER]], top, settings=JUMP_IN_AND_STACKING)

	after_p0 = play_card(state, "p0", d2_red)
	with pytest.raises(IllegalMove):
		play_card(after_p0, "p2", d2_blue)


def test_identical_card_can_jump_into_an_active_stack():
	top = Card(Color.RED, CardType.NUMBER, 5)
	d2_red_a = Card(Color.RED, CardType.DRAW_TWO)
	d2_red_b = Card(Color.RED, CardType.DRAW_TWO)
	state = _state(
		[[d2_red_a, FILLER], [], [d2_red_b, FILLER], []], top, settings=JUMP_IN_AND_STACKING
	)

	after_p0 = play_card(state, "p0", d2_red_a)
	after_jump = play_card(after_p0, "p2", d2_red_b)
	assert after_jump.modifier_state["draw_stack"] == {"type": "draw_two", "count": 4}
	assert after_jump.current_player_index == 3


def test_legitimate_in_turn_stacking_with_a_different_color_is_unaffected():
	top = Card(Color.RED, CardType.NUMBER, 5)
	d2_red = Card(Color.RED, CardType.DRAW_TWO)
	d2_green = Card(Color.GREEN, CardType.DRAW_TWO)
	state = _state([[d2_red, FILLER], [d2_green, FILLER], []], top, settings=JUMP_IN_AND_STACKING)

	after_p0 = play_card(state, "p0", d2_red)
	after_p1 = play_card(after_p0, "p1", d2_green)
	assert after_p1.modifier_state["draw_stack"] == {"type": "draw_two", "count": 4}


def test_stack_correctly_passes_on_and_can_keep_being_stacked_after_a_jump():
	top = Card(Color.RED, CardType.NUMBER, 5)
	d2_red = Card(Color.RED, CardType.DRAW_TWO)
	d2_red_2 = Card(Color.RED, CardType.DRAW_TWO)
	d2_green = Card(Color.GREEN, CardType.DRAW_TWO)
	state = _state(
		[[d2_red, FILLER], [], [d2_red_2, FILLER], [d2_green, FILLER]],
		top, settings=JUMP_IN_AND_STACKING,
	)

	after_p0 = play_card(state, "p0", d2_red)
	after_jump = play_card(after_p0, "p2", d2_red_2)
	after_p3 = play_card(after_jump, "p3", d2_green)
	assert after_p3.modifier_state["draw_stack"] == {"type": "draw_two", "count": 6}
	assert after_p3.current_player_index == 0

	p0_before = len(after_p3.players[0].hand)
	final = draw_card(after_p3, "p0")
	assert len(final.players[0].hand) == p0_before + 6
	assert "draw_stack" not in final.modifier_state