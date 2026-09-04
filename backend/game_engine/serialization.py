#Here we convert the GameState to and from JSON data

from copy import deepcopy

from .cards import Card, CardType, Color
from .deck import Deck
from .state import Direction, GameSettings, GameState, Player

def card_to_dict(card: Card) -> dict:
	return {"color": card.color.value, "card_type": card.card_type.value, "value": card.value}

def card_from_dict(data: dict) -> Card:
	return Card(color=Color(data["color"]), card_type=CardType(data["card_type"]), value=data.get("value"))

def state_to_dict(state: GameState) -> dict:
	return {
		"players": [{"player_id": p.player_id, "name": p.name, "hand": [card_to_dict(c) for c in p.hand]} for p in state.players],
		"draw_pile": [card_to_dict(c) for c in state.deck.draw_pile],
		"top_card": card_to_dict(state.top_card),
		"current_color": state.current_color.value,
		"current_player_index": state.current_player_index,
		"direction": state.direction.value,
		"settings": {"enabled_modifiers": sorted(state.settings.enabled_modifiers)},
		"has_drawn_this_turn": state.has_drawn_this_turn,
		"winner_id": state.winner_id,
		"modifier_state": deepcopy(state.modifier_state)
	}

def state_from_dict(data: dict) -> GameState:
	players = [Player(player_id=p["player_id"], name=p["name"], hand=[card_from_dict(c) for c in p["hand"]]) for p in data["players"]]
	deck = Deck(draw_pile=[card_from_dict(c) for c in data["draw_pile"]])

	return GameState(
		players=players,
		deck=deck,
		top_card=card_from_dict(data["top_card"]),
		current_color=Color(data["current_color"]),
		current_player_index=data["current_player_index"],
		direction=Direction(data["direction"]),
		settings=GameSettings(enabled_modifiers=frozenset(data["settings"]["enabled_modifiers"])),
		has_drawn_this_turn=data["has_drawn_this_turn"],
		winner_id=data["winner_id"],
		modifier_state=deepcopy(data.get("modifier_state", {}))
	)