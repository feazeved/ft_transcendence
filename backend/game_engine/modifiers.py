#This is where we implement the game modifiers, settings which can change the behavior of certain cards in the game

from .cards import Card, CardType
from .engine import register_modifier
from .state import GameState

#This is just an example of a modifier, a rule which makes playing a seven card exchange hands with another player
@register_modifier("seven_swap")
def seven_swap(state: GameState, card: Card, player_id: str) -> None:
	if card.card_type != CardType.NUMBER or card.value != 7
		return

	idx = next(i for i, p in enumerate(state.players) if p.player_id == player_id)
	target_idx = (idx + 1) % len(state.players)
	state.players[idx].hand, state.players[target_idx].hand = (state.players[target_idx].hand, state.players[idx].hand)