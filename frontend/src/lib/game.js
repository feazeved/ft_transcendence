export function seatOrder(game) {
	const players = game.players
	const meIdx = players.findIndex((p) => p.player_id === game.your_player_id)
	return meIdx < 0 ? players : [...players.slice(meIdx), ...players.slice(0, meIdx)]
}

// Whose turn comes after the current player's, following `direction` (1 or -1).
export function nextPlayer(game) {
	const n = game.players.length
	const idx = game.players.findIndex((p) => p.player_id === game.current_player_id)
	return game.players[(idx + game.direction + n) % n]
}

// Where each seat on the arc goes: x is the seat's centre and y its top edge,
// both in % of the table area. Seats are spread evenly from 8% to 92% of the
// width and drop lower towards both ends, following half an ellipse.
export function arcPositions(count) {
	return Array.from({ length: count }, (_, i) => {
		const x = 8 + (84 * (i + 0.5)) / count
		const t = (x - 50) / 42
		const y = 60 * (1 - Math.sqrt(1 - t * t))
		return { x, y }
	})
}

export function canPlay(card, game) {
	if (game.winner_id != null) return false
	const top = game.top_card
	if (game.current_player_id !== game.your_player_id) {
		const sameAsTop = card.color === top.color && card.card_type === top.card_type && card.value === top.value
		return Boolean(game.settings?.jump_in) && sameAsTop
	}
	if (card.card_type === "wild" || card.card_type === "wild_draw_four") return true
	if (card.color === game.current_color) return true
	if (card.card_type === "number" && top.card_type === "number") return card.value === top.value
	return card.card_type === top.card_type && card.card_type !== "number"
}

export function offersSwap(card, game) {
	return Boolean(game.settings?.seven_swap) && card.card_type === "number" && card.value === 7
}
