#This is where we implement the game modifiers, settings which can change the behavior of certain cards in the game

from .cards import Card, CardType
from .engine import (_advance_turn, _is_legal_play, _get_player, register_draw_hook, register_legality_hook, register_modifier, register_play_hook)
from .engine import IllegalMove
from .state import GameState

#This is just an example of a modifier, a rule which makes playing a seven card exchange hands with another player
@register_modifier("seven_swap")
def seven_swap(state: GameState, card: Card, player_id: str, target_id: str) -> None:
	if target_id is None or card.card_type != CardType.NUMBER and card.value != 7:
		return

	idx = next(i for i, p in enumerate(state.players) if p.player_id == player_id)
	target_idx = next(i for i, p in enumerate(state.players) if p.player_id == target_id)
	state.players[idx].hand, state.players[target_idx].hand = (state.players[target_idx].hand, state.players[idx].hand)

@register_modifier("zero")
def zero(state: GameState, card: Card, player_id: str, target_id: str) -> None:
	if card.card_type != CardType.NUMBER and card.value != 0:
		return
	next_hand = list[Card]

	idx = 0
	for _ in state.players:
		target_idx = (idx + 1) % len(state.players)
		next_hand = state.players[idx].hand
		state.players[target_idx].hand = next_hand
		idx = target_idx


@register_modifier("jump_in")
def jump_in(state: GameState, card: Card, player_id: str) -> None:
#	if state.top_card.card_type != card.card_type or state.top_card.color != card.color or state.top_card.value != card.value:
	return

#	state.current_player_index = next(i for i, p in enumerate(state.players) if p.player_id == player_id)

	# while state.current_player_index != idx:
	# 	_advance_turn(state)


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


@register_draw_hook("continuous_draw")
def continuous_draw(state: GameState, player_id: str) -> bool:
	if _active_stack(state) is not None:
		return False

	if state.has_drawn_this_turn:
	    raise IllegalMove("Ja comprou seu safado, joga ou passa")

    player = _get_player(state, player_id)
	for _ in range(100):
		draw = state.deck.draw(1);
		player.hand.extend(draw)
		if _is_legal_play(state, draw[0]):
		    break

    state.has_drawn_this_turn = True
	return True
