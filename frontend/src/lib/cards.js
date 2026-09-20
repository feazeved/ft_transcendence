// Maps a card from the game engine onto its picture in public/cards/.
//
// The engine sends {color, card_type, value}. Two names differ from the
// engine's card_type on disk: skip is "block", and the draw cards are
// "+2" / "+4". 

const FACE = {
	skip: "block",
	reverse: "reverse",
	draw_two: "+2",
	wild: "wild",
	wild_draw_four: "+4",
}

export const CARD_BACK = "/cards/back_card.png"

export function cardSrc(card) {
	if (!card) return CARD_BACK
	const face = card.card_type === "number" ? String(card.value) : FACE[card.card_type]
	return card.color === "wild" ? `/cards/${face}.png` : `/cards/${card.color}/${face}.png`
}

// The colour in play. Normally the top card's own colour, but after a wild it is
// whatever the player chose — which the black artwork cannot show on its own,
// so the table draws this as a glow instead.
export const COLOR_HEX = {
	red: "#e53935",
	yellow: "#fdd835",
	green: "#43a047",
	blue: "#1e88e5",
}

// The same card in words, for a screen reader and for the notices: "Blue 7",
// "Red Skip", "Wild Draw Four". Separate from FACE above, which names the file
// on disk ("+2", "block") — a filename is not something to read out loud.
const SPOKEN = {
	skip: "Skip",
	reverse: "Reverse",
	draw_two: "Draw Two",
	wild: "Wild",
	wild_draw_four: "Wild Draw Four",
}

export function cardName(card) {
	if (!card) return "card"
	if (card.color === "wild") return SPOKEN[card.card_type] ?? "Wild"
	const color = card.color.charAt(0).toUpperCase() + card.color.slice(1)
	return `${color} ${card.card_type === "number" ? card.value : SPOKEN[card.card_type] ?? card.card_type}`
}
