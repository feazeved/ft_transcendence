#This is where we implement the game modifiers, settings which can change the behavior of certain cards in the game

from .cards import Card, CardType
from .engine import (_advance_turn, register_draw_hook, register_legality_hook, register_modifier, register_play_hook)
from .state import GameState

#This is just an example of a modifier, a rule which makes playing a seven card exchange hands with another player
@register_modifier("seven_swap")
def seven_swap(state: GameState, card: Card, player_id: str) -> None:
	if card.card_type != CardType.NUMBER or card.value != 7:
		return

	idx = next(i for i, p in enumerate(state.players) if p.player_id == player_id)
	target_idx = (idx + 1) % len(state.players)
	state.players[idx].hand, state.players[target_idx].hand = (state.players[target_idx].hand, state.players[idx].hand)

_STACK_KEY = "draw_stack"
_STACKABLE_COUNTS = {CardType.DRAW_TWO: 2, CardType.WILD_DRAW_FOUR: 4}

def _active_stack(state: GameState) -> dict | None:
	return state.modifier_state.get(_STACK_KEY)

@register_legality_hook("draw_stacking")
def _draw_stacking_legality(state: GameState, card: Card) -> bool | None:
	stack = _active_stack(state)
	if stack is None:
		return None

	return card.card_type.value == stack["type"]

@register_play_hook("draw_stacking")
def _draw_stacking_play(state: GameState, card: Card, player_id: str) -> bool:
	if card.card_type not in _STACKABLE_COUNTS:
		return False

	added = _STACKABLE_COUNTS[card.card_type]
	stack = _active_stack(state)

	if stack is not None and stack["type"] == card.card_type.value:
		stack["count"] += added
	else:
		stack = {"type": card.card_type.value, "count": added}

	state.modifier_state[_STACK_KEY] = stack
	_advance_turn(state)
	return True

@register_draw_hook("draw_stacking")
def _draw_stacking_draw(state: GameState, player_id: str) -> bool:
	stack = _active_stack(state)

	if stack is None:
		return False

	player = next(p for p in state.players if p.player_id == player_id)
	player.hand.extend(state.deck.draw(stack["count"]))

	del state.modifier_state[_STACK_KEY]
	_advance_turn(state)

	return True