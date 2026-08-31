#This is where in implement the engine of the game, where the plays actually happen (draw, play, win condition, etc)

import copy
import random
from typing import Callable

from .cards import Card, CardType, Color
from .deck import STANDARD_COLORS, Deck
from .state import Direction, GameSettings, GameState, Player

class IllegalMove(Exception):
	"""Raised when a requested move isn't legal given the current state."""

class GameOver(Exception):
	"""Raised when an action is attempted after the game has already been won."""

ModifierFn = Callable[[GameState, Card, str], None]
MODIFIER_REGISTRY: dict[str, ModifierFn] = {}

LegalityHookFn = Callable[[GameState, Card], "bool | None"]
LEGALITY_HOOKS: dict[str, LegalityHookFn] = {}

PlayHookFn = Callable[[GameState, Card, str], bool]
PLAY_HOOKS: dict[str, PlayHookFn] = {}

DrawHookFn = Callable[[GameState, str], bool]
DRAW_HOOKS: dict[str, DrawHookFn] = {}

def _run_modifiers(state: GameState, card: Card, player_id: str, target_id: str | None = None) -> None:
	for name in state.settings.enabled_modifiers:
		modifier = MODIFIER_REGISTRY.get(name)
		if modifier is not None and target_id is not None:
			modifier(state, card, player_id, target_id)
		elif modifier is not None:
			modifier(state, card, player_id)

def _is_legal_play(state: GameState, card: Card) -> bool:
	for name in state.settings.enabled_modifiers:
		hook = LEGALITY_HOOKS.get(name)
		if hook is not None:
			result = hook(state, card)
			if result is not None:
				return result

	if card.card_type in (CardType.WILD, CardType.WILD_DRAW_FOUR):
		return True
	if card.color == state.current_color:
		return True

	top = state.top_card

	if card.card_type == CardType.NUMBER and top.card_type == CardType.NUMBER:
		return card.value == top.value

	return card.card_type == top.card_type and card.card_type != CardType.NUMBER

def _advance_turn(state: GameState) -> None:
	n = len(state.players)

	state.current_player_index = (state.current_player_index + state.direction.value) % n
	state.has_drawn_this_turn = False

def _require_players_turn(state: GameState, player_id: str) -> None:
	current = state.players[state.current_player_index]

	if current.player_id != player_id:
		raise IllegalMove(f"It is not {player_id}'s turn (current: {current.player_id})")

def _require_game_not_over(state: GameState) -> None:
	if state.winner_id is not None:
		raise GameOver(f"Game already won by {state.winner_id}")

def _get_player(state: GameState, player_id: str) -> Player:
	for p in state.players:
		if p.player_id == player_id:
			return p
	raise ValueError(f"No such player: {player_id}")

def _apply_standard_effects(state: GameState, card: Card) -> None:
	n = len(state.players)

	if card.card_type == CardType.SKIP:
		_advance_turn(state)
		_advance_turn(state)
	elif card.card_type == CardType.REVERSE:
		if n == 2:
			_advance_turn(state)
			_advance_turn(state)
		else:
			state.direction = (Direction.COUNTER_CLOCKWISE if state.direction == Direction.CLOCKWISE else Direction.CLOCKWISE)
			_advance_turn(state)
	elif card.card_type == CardType.DRAW_TWO:
		_advance_turn(state)
		victim = state.players[state.current_player_index]
		victim.hand.extend(state.deck.draw(2))
		_advance_turn(state)
	elif card.card_type == CardType.WILD_DRAW_FOUR:
		_advance_turn(state)
		victim = state.players[state.current_player_index]
		victim.hand.extend(state.deck.draw(4))
		_advance_turn(state)
	else:
		_advance_turn(state)

def _resolve_opening_card(state: GameState) -> None:
	rejected: list[Card] = []

	while state.top_card.card_type != CardType.NUMBER:
		rejected.append(state.top_card)
		state.top_card = state.deck.draw(1)[0]
	if rejected:
		state.deck.return_and_reshuffle(rejected)

	state.current_color = state.top_card.color
	state.current_player_index = 0

def register_modifier(name: str):
	def decorator(fn: ModifierFn) -> ModifierFn:
		MODIFIER_REGISTRY[name] = fn
		return fn

	return decorator

def register_legality_hook(name: str):
	def decorator(fn: LegalityHookFn) -> LegalityHookFn:
		LEGALITY_HOOKS[name] = fn
		return fn

	return decorator

def register_play_hook(name: str):
	def decorator(fn: PlayHookFn) -> PlayHookFn:
		PLAY_HOOKS[name] = fn
		return fn

	return decorator

def register_draw_hook(name: str):
	def decorator(fn: DrawHookFn) -> DrawHookFn:
		DRAW_HOOKS[name] = fn
		return fn

	return decorator

def start_game(players: list[tuple[str, str]], *, settings: GameSettings | None = None, rng: random.Random | None = None, hand_size: int = 7) -> GameState:
	if not (2 <= len(players) <= 10):
		raise ValueError(f"Game needs 2-10 players, got {len(players)}")

	deck = Deck(rng=rng)
	dealt_players = [Player(player_id=pid, name=name, hand=deck.draw(hand_size)) for pid, name in players]
	state = GameState(players=dealt_players, deck=deck, top_card=deck.draw(1)[0], current_color=Color.RED, current_player_index=0, direction=Direction.CLOCKWISE, settings=settings or GameSettings())

	_resolve_opening_card(state)
	return state

def play_card(state: GameState, player_id: str, card: Card, *, chosen_color: Color | None = None, target_id: str | None = None) -> GameState:
	new_state = copy.deepcopy(state)
	_require_game_not_over(new_state)
	for name in new_state.settings.enabled_modifiers:
		if name == "jump in" and (new_state.top_card.card_type != card.card_type or new_state.top_card.color != card.color or new_state.top_card.value != card.value):
			_require_players_turn(new_state, player_id)
			break
		else:
			_require_players_turn(new_state, player_id)

	player = _get_player(new_state, player_id)

	if card not in player.hand:
		raise IllegalMove(f"{player.name} does not hold {card}")
	if not _is_legal_play(new_state, card):
		raise IllegalMove(f"{card} cannot be played on {new_state.top_card} " f"(active color: {new_state.current_color.value})")
	if card.card_type in (CardType.WILD, CardType.WILD_DRAW_FOUR):
		if chosen_color is None or chosen_color not in STANDARD_COLORS:
			raise IllegalMove("A standard color must be chosen when playing a Wild card")

	player.hand.remove(card)

	new_state.top_card = card
	new_state.current_color = chosen_color if card.color == Color.WILD else card.color
	new_state.has_drawn_this_turn = False

	if not player.hand:
		new_state.winner_id = player_id
		return new_state

	handled = False
	for name in new_state.settings.enabled_modifiers:
		hook = PLAY_HOOKS.get(name)
		if hook is not None and hook(new_state, card, player_id):
			handled = True
			break
	if not handled:
		_apply_standard_effects(new_state, card)

	_run_modifiers(new_state, card, player_id, target_id)
	return new_state

def draw_card(state: GameState, player_id: str) -> GameState:
	new_state = copy.deepcopy(state)

	_require_game_not_over(new_state)
	_require_players_turn(new_state, player_id)

	for name in new_state.settings.enabled_modifiers:
		hook = DRAW_HOOKS.get(name)
		if hook is not None and hook(new_state, player_id):
			return new_state

	if new_state.has_drawn_this_turn:
		raise IllegalMove("Already drew this turn, play a card or pass")

	player = _get_player(new_state, player_id)
	player.hand.extend(new_state.deck.draw(1))

	new_state.has_drawn_this_turn = True

	return new_state

def pass_turn(state: GameState, player_id: str) -> GameState:
	new_state = copy.deepcopy(state)

	_require_game_not_over(new_state)
	_require_players_turn(new_state, player_id)

	if not new_state.has_drawn_this_turn:
		raise IllegalMove("Draw before passing, you may have a legal play")

	_advance_turn(new_state)
	return new_state
