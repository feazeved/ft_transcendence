#This is where we implement the game modifiers, settings which can change the behavior of certain cards in the game

from .cards import Card, CardType
from .engine import (_advance_turn, _is_legal_play, _get_player, register_draw_hook, register_legality_hook, register_modifier, register_play_hook)
from .engine import IllegalMove
from .state import GameState

@register_modifier("seven_swap")
def seven_swap(state: GameState, card: Card, player_id: str, target_id: str) -> None:
	if target_id is None or card.card_type != CardType.NUMBER or card.value != 7:
		return

	idx = next(i for i, p in enumerate(state.players) if p.player_id == player_id)
	target_idx = next(i for i, p in enumerate(state.players) if p.player_id == target_id)
	state.players[idx].hand, state.players[target_idx].hand = (state.players[target_idx].hand, state.players[idx].hand)

@register_modifier("zero_swap")
def zero_swap(state: GameState, card: Card, player_id: str) -> None:
	if card.card_type != CardType.NUMBER or card.value != 0:
		return

	n = len(state.players)
	original_hands = [p.hand for p in state.players]
	for idx in range(n):
		target_idx = (idx + state.direction.value) % n
		state.players[target_idx].hand = original_hands[idx]

@register_modifier("jump_in")
def jump_in() -> None:
	return

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

@register_draw_hook("draw_until_playable")
def draw_until_playable(state: GameState, player_id: str) -> bool:
	if _active_stack(state) is not None:
		return False

	if state.has_drawn_this_turn:
		raise IllegalMove("Already drew this turn, play a card or pass")

	player = _get_player(state, player_id)
	for _ in range(100):
		drawn = state.deck.draw(1)
		player.hand.extend(drawn)
		if _is_legal_play(state, drawn[0]):
			break

	state.has_drawn_this_turn = True
	return True
