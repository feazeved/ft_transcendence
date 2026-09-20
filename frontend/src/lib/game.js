import { cardName } from "./cards.js"

export function seatOrder(game) {
	const players = game.players
	const meIdx = players.findIndex((p) => p.player_id === game.your_player_id)
	return meIdx < 0 ? players : [...players.slice(meIdx), ...players.slice(0, meIdx)]
}

// One player out of the payload, or undefined. Every screen asks this question —
// who am I, whose turn is it, who won — so it is asked in one place.
export function playerById(game, id) {
	return game?.players?.find((p) => p.player_id === id)
}

// Whose turn comes after the current player's, following `direction` (1 or -1).
export function nextPlayer(game) {
	const n = game.players.length
	const idx = game.players.findIndex((p) => p.player_id === game.current_player_id)
	return game.players[(idx + game.direction + n) % n]
}

// Where each seat on the arc goes, as the design draws it.
//
// The seats ring the pile and my hand owns the bottom, so the arc is centred on
// the top of the arena (90°) and opens `min(270, 90 * (count - 1))` degrees:
// a half circle at three seats, one seat per corner at four, and 270° from five
// up — it stops widening there so the top seat never climbs into the header.
//
// `x` is the seat's centre in % of the arena width, clamped so a seat can't hang
// off either edge. The vertical is deliberately NOT a percentage: `band` is a
// 0–1 fraction the table applies inside the arena height *minus one seat's
// height* (`calc((100% - 118px) * band)`). A percentage of the full height would
// push the top seat up under the header on a short window; a fraction of the
// space left over once a seat is accounted for cannot.
// `tight` is the last resort for an arena so short that the pile has had to move
// out from between the seats and sit below them (under 200px, see arena.js). The
// middle of the arena then belongs to the pile, so any seat whose angle would put
// it in the middle third is pushed out to the edge of that third — sideways only,
// never up or down.
export function arcPositions(count, { tight = false } = {}) {
	const span = Math.min(270, 90 * (count - 1))
	const step = count > 1 ? span / (count - 1) : 0

	return Array.from({ length: count }, (_, i) => {
		const radians = ((90 + span / 2 - step * i) * Math.PI) / 180
		let cos = Math.cos(radians)
		if (tight && Math.abs(cos) < 0.5) {
			// Dead centre has no side of its own to go to, so the seats in the first
			// half of the arc go right and the rest go left, keeping the order.
			const side = Math.abs(cos) > 1e-9 ? Math.sign(cos) : i < (count - 1) / 2 ? 1 : -1
			cos = 0.5 * side
		}
		const x = Math.min(92, Math.max(8, 50 - 42 * cos))
		const band = (1 - Math.sin(radians)) / 2
		return { x, band }
	})
}

export function canPlay(card, game) {
	if (game.winner_id != null) return false
	const top = game.top_card
	// Out of turn, only Jump in allows anything, and only a card identical to the
	// top one (CONTEXT.md: same colour and same number or symbol).
	if (game.current_player_id !== game.your_player_id) {
		return Boolean(game.settings?.jump_in) && sameCard(card, top)
	}
	if (card.card_type === "wild" || card.card_type === "wild_draw_four") return true
	if (card.color === game.current_color) return true
	if (card.card_type === "number" && top.card_type === "number") return card.value === top.value
	return card.card_type === top.card_type && card.card_type !== "number"
}

export function offersSwap(card, game) {
	return Boolean(game.settings?.seven_swap) && card.card_type === "number" && card.value === 7
}

// Seconds still to run on the current turn, or null when there is no countdown
// to show: a room with no turn timer, or (today's backend) a turn the server
// never stamped. Pure on purpose — `now` comes in from useNow, so the arithmetic
// can be tested without waiting for a clock.
export function secondsLeft(game, now) {
	if (!game?.turn_timer_seconds || !game.turn_started_at) return null
	const started = new Date(game.turn_started_at).getTime()
	if (Number.isNaN(started)) return null
	return Math.max(0, Math.floor(game.turn_timer_seconds - (now - started) / 1000))
}

/* ---------------------------------------------------------------------------
 * Notices
 *
 * The backend sends no events: it only ever sends the whole game state again.
 * So "the direction reversed" or "you drew 3 cards" has to be worked out by
 * comparing the state we had with the one that just arrived. Every notice is a
 * pure (prev, next) -> string | null function, which is why they can be tested
 * without a socket, a browser or a clock.
 * ------------------------------------------------------------------------- */

// Two cards are the same card when colour, type and value all match. Used to ask
// "did the top of the pile change?" — the question behind most of the notices.
export function sameCard(a, b) {
	if (!a || !b) return !a && !b
	return a.color === b.color && a.card_type === b.card_type && a.value === b.value
}

// How many cards I hold, or null when I'm not at the table (a spectator).
export function myHandCount(game) {
	const me = playerById(game, game?.your_player_id)
	if (!me) return null
	return me.hand ? me.hand.length : me.hand_count ?? null
}

// "Direction reversed →": somebody played a reverse. The arrow points the way
// play goes now, not the way it went.
export function directionNotice(prev, next) {
	if (!prev || prev.direction === next.direction) return null
	return `Direction reversed ${next.direction === 1 ? "→" : "←"}`
}

// "Hands rotated →": a 0 landed on the pile in a room with Zero rotate on, so
// every hand passed to the next player. Three things have to hold — the rule is
// on, the pile actually changed, and the new top is a 0 — because a 0 that was
// already sitting there means nobody played anything.
export function rotationNotice(prev, next) {
	if (!prev || !next.settings?.zero_swap) return null
	if (sameCard(prev.top_card, next.top_card)) return null
	const top = next.top_card
	if (top?.card_type !== "number" || top.value !== 0) return null
	return `Hands rotated ${next.direction === 1 ? "→" : "←"}`
}

// "You swapped hands with alice": I played a 7 and chose somebody, in a room with
// Seven swap on.
//
// `targetId` is the `target_id` I put in my own play_card message, kept by
// GameTable until the answering state arrives. Hand counts alone can't tell a
// swap from no swap — two players holding five cards each swap into five cards
// each — so without the id there is nothing to go on.
export function swapNotice(prev, next, targetId) {
	if (!prev || !targetId) return null
	if (sameCard(prev.top_card, next.top_card)) return null
	const top = next.top_card
	if (top?.card_type !== "number" || top.value !== 7) return null
	const target = playerById(next, targetId)
	if (!target) return null
	return `You swapped hands with ${target.name}`
}

// "Jumped in with Green 4": the Jump in rule let me play out of turn.
//
// The condition that looks wrong is the right one: the top card must be the SAME
// card. Jump in only allows a card identical to the top one — the engine rejects
// anything else (`card != state.top_card` in game_engine/modifiers.py:32) — and it
// then lays that identical card on the pile, so the pile reads exactly as before.
// What gives the move away is that it wasn't my turn and my hand is one card
// lighter. Requiring the pile to hold still is also what keeps the two rules that
// hand me a different number of cards out of this notice: a rotation puts a 0 on
// top and a swap puts a 7 there, so both change the pile.
export function jumpInNotice(prev, next) {
	if (!prev || !next.settings?.jump_in) return null
	if (prev.current_player_id === prev.your_player_id) return null
	if (!sameCard(prev.top_card, next.top_card)) return null
	const before = myHandCount(prev)
	const after = myHandCount(next)
	if (before == null || after == null || before - after !== 1) return null
	return `Jumped in with ${cardName(next.top_card)}`
}

// "You drew 3 cards": my hand grew and the pile stayed put. The second half
// matters — a Zero rotate also changes how many cards I hold, but it puts a 0 on
// the pile, so requiring the same top card keeps a rotation from being announced
// as a draw.
export function drewNotice(prev, next) {
	if (!prev) return null
	if (!sameCard(prev.top_card, next.top_card)) return null
	const before = myHandCount(prev)
	const after = myHandCount(next)
	if (before == null || after == null || after <= before) return null
	const drawn = after - before
	return `You drew ${drawn} card${drawn === 1 ? "" : "s"}`
}

// Everything worth announcing about one new state, in reading order. GameTable
// calls this once per arriving payload and shows what comes back; an empty list
// means the state changed in no way the player needs told about.
export function gameNotices(prev, next, targetId) {
	return [
		directionNotice(prev, next),
		rotationNotice(prev, next),
		swapNotice(prev, next, targetId),
		jumpInNotice(prev, next),
		drewNotice(prev, next),
	].filter(Boolean)
}
