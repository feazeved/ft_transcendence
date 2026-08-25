import random

from .cards import Card, CardType, Color

STANDARD_COLORS = (Color.RED, Color.YELLOW, Color.GREEN, Color.BLUE)

def build_standard_deck() -> list[Card]:
	cards: list[Card] = []

	for color in STANDARD_COLORS:
		cards.append(Card(color=color, card_type=CardType.NUMBER, value=0))
		for value in range(1, 10):
			cards.append(Card(color=color, card_type=CardType.NUMBER, value=value))
			cards.append(Card(color=color, card_type=CardType.NUMBER, value=value))
		for card_type in (CardType.SKIP, CardType.REVERSE, CardType.DRAW_TWO):
			cards.append(Card(Color=color, card_type=card_type))
			cards.append(Card(Color=color, card_type=card_type))
	for _ in range(4):
		cards.append(Card(color=Color.WILD, card_type=CardType.WILD))
		cards.append(Card(color=Color.WILD, card_type=CardType.WILD_DRAW_FOUR))

	return cards

class Deck:
	def __init__(self, rng: random.Random | None = None):
		self._rng = rng or random.Random()
		self.draw_pile: list[Card] = []
		self._refill()

	def _refill(self) -> None:
		new_cards = build_standard_deck()

		self._rng.shuffle(new_cards)
		self.draw_pile.extend(new_cards)

	def draw(self, count: int = 1) -> list[Card]:
		drawn = []

		for _ in range(count):
			if not self.draw_pile:
				self._refill()
			drawn.append(self.draw_pile.pop())

		return drawn

	def return_and_reshuffle(self, cards: list[Card]) -> None:
		self.draw_pile.extend(cards)
		self._rng.shuffle(self.draw_pile)

	def __len__(self) -> int:
		return len(self.draw_pile)