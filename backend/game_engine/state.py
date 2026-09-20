from dataclasses import dataclass, field
from enum import IntEnum

from .cards import Card, Color
from .deck import Deck

class Direction(IntEnum):
	CLOCKWISE = 1
	COUNTER_CLOCKWISE = -1

@dataclass
class Player:
	player_id: str
	name: str
	hand: list[Card] = field(default_factory = list)

@dataclass
class GameSettings:
	enabled_modifiers: frozenset[str] = field(default_factory=frozenset)

	def is_enabled(self, name: str) -> bool:
		return name in self.enabled_modifiers

@dataclass
class GameState:
	players: list[Player]
	deck: Deck
	top_card: Card
	current_color: Color
	current_player_index: int
	direction: Direction
	settings: GameSettings
	has_drawn_this_turn: bool = False
	winner_id: str | None = None
	modifier_state: dict = field(default_factory=dict)