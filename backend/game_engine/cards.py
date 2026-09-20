from dataclasses import dataclass
from enum import Enum

class Color(Enum):
	RED = "red"
	YELLOW = "yellow"
	GREEN = "green"
	BLUE = "blue"
	WILD = "wild"

class CardType(Enum):
	NUMBER = "number"
	SKIP = "skip"
	REVERSE = "reverse"
	DRAW_TWO = "draw_two"
	WILD = "wild"
	WILD_DRAW_FOUR = "wild_draw_four"

@dataclass(frozen=True)
class Card:
	color: Color
	card_type: CardType
	value: int | None = None

	def __str__(self) -> str:
		if self.card_type == CardType.NUMBER:
			return f"{self.color.value} {self.value}"
		if self.color == Color.WILD:
			return self.card_type.value.replace("_", " ")

		return f"{self.color.value} {self.card_type.value.replace("_", " ")}"