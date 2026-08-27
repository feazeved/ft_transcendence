import random

import pytest

from game_engine.cards import Card, CardType, Color
from game_engine.engine import play_card, start_game
from game_engine.serialization import state_from_dict, state_to_dict
from game_engine.state import GameSettings


def make_players(n: int) -> list[tuple[str, str]]:
    return [(f"p{i}", f"Player {i}") for i in range(n)]


def _would_be_legal(state, card: Card) -> bool:
    if card.card_type in (CardType.WILD, CardType.WILD_DRAW_FOUR):
        return True
    if card.color == state.current_color:
        return True
    top = state.top_card
    if card.card_type == CardType.NUMBER and top.card_type == CardType.NUMBER:
        return card.value == top.value
    return card.card_type == top.card_type and card.card_type != CardType.NUMBER


def test_round_trip_preserves_full_state():
    state = start_game(make_players(4), rng=random.Random(2))
    restored = state_from_dict(state_to_dict(state))

    assert [p.hand for p in restored.players] == [p.hand for p in state.players]
    assert [p.player_id for p in restored.players] == [p.player_id for p in state.players]
    assert restored.top_card == state.top_card
    assert restored.current_color == state.current_color
    assert restored.current_player_index == state.current_player_index
    assert restored.direction == state.direction
    assert restored.has_drawn_this_turn == state.has_drawn_this_turn
    assert restored.winner_id == state.winner_id
    assert len(restored.deck) == len(state.deck)
    assert list(restored.deck.draw_pile) == list(state.deck.draw_pile)


def test_round_trip_preserves_settings():
    settings = GameSettings(enabled_modifiers=frozenset({"seven_swap"}))
    state = start_game(make_players(2), settings=settings, rng=random.Random(4))
    restored = state_from_dict(state_to_dict(state))
    assert restored.settings.enabled_modifiers == frozenset({"seven_swap"})


def test_round_trip_output_is_json_safe():
    import json

    state = start_game(make_players(3), rng=random.Random(8))
    encoded = json.dumps(state_to_dict(state))
    restored = state_from_dict(json.loads(encoded))
    assert restored.top_card == state.top_card
    assert [p.hand for p in restored.players] == [p.hand for p in state.players]


def test_restored_state_is_actually_usable_by_the_engine():
    state = start_game(make_players(2), rng=random.Random(6))
    restored = state_from_dict(state_to_dict(state))

    current = restored.players[restored.current_player_index]
    legal = next((c for c in current.hand if _would_be_legal(restored, c)), None)
    if legal is None:
        pytest.skip("seeded hand had no legal card")
    color = Color.RED if legal.color == Color.WILD else None
    new_state = play_card(restored, current.player_id, legal, chosen_color=color)
    assert new_state.top_card == legal
