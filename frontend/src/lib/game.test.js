import { describe, expect, it } from "vitest"
import {
	afterDraw,
	afterWild,
	jumpIn,
	livePayload,
	lost,
	myTurn,
	noTimer,
	sevenSwap,
	spectating,
	tenPlayers,
	theirTurn,
	wildPending,
} from "./fakeGameState.js"
import {
	arcPositions,
	canPlay,
	directionNotice,
	drewNotice,
	gameNotices,
	jumpInNotice,
	myHandCount,
	rotationNotice,
	swapNotice,
	nextPlayer,
	playerById,
	offersSwap,
	sameCard,
	seatOrder,
	secondsLeft,
} from "./game.js"

describe("seatOrder", () => {
	it("puts me first and keeps the table order", () => {
		expect(seatOrder(theirTurn).map((p) => p.name)).toEqual(["daniel", "bruno", "daninin"])
	})

	it("changes nothing when I'm already first", () => {
		expect(seatOrder(myTurn)).toEqual(myTurn.players)
	})

	it("wraps around when I sit in the middle of a full table", () => {
		expect(seatOrder(tenPlayers).map((p) => p.player_id)).toEqual(["12", "37", "38", "39", "31", "32", "33", "34", "35", "36"])
	})

	// A spectator isn't in `players`, so there's no "me" to start from.
	it("leaves a spectator's order alone", () => {
		expect(seatOrder(spectating)).toEqual(spectating.players)
	})
})

describe("playerById", () => {
	it("finds a player by their id", () => {
		expect(playerById(myTurn, "13").name).toBe("alice")
	})

	it("gives nothing for an id that isn't at the table", () => {
		expect(playerById(myTurn, "999")).toBe(undefined)
	})

	// A spectator's `your_player_id` is null, and looking that up must not throw.
	it("gives nothing for a null id", () => {
		expect(playerById(spectating, null)).toBe(undefined)
	})
})

describe("nextPlayer", () => {
	it("moves forward through the list when direction is 1", () => {
		expect(nextPlayer(tenPlayers).name).toBe("ines")
	})

	it("wraps from the last player back to the first", () => {
		expect(nextPlayer({ ...tenPlayers, current_player_id: "39" }).name).toBe("alice")
	})

	// theirTurn: direction -1 and daninin, first in the list, is up.
	it("moves backward after a reverse, wrapping from the first to the last", () => {
		expect(nextPlayer(theirTurn).name).toBe("bruno")
	})
})

describe("arcPositions", () => {
	// `x` is the seat's centre in % of the arena width; `band` is a 0–1 fraction
	// of the arena height minus one seat, which is what keeps the top of the arc
	// out from under the header.
	it("puts a single seat at the top, in the middle", () => {
		const [only] = arcPositions(1)
		expect(only.x).toBeCloseTo(50)
		expect(only.band).toBeCloseTo(0)
	})

	// Three seats open a half circle: one at each side, level with each other,
	// and one at the very top.
	it("opens a half circle at three seats", () => {
		const spots = arcPositions(3)
		expect(spots.map((s) => Math.round(s.x))).toEqual([92, 50, 8])
		expect(spots.map((s) => Number(s.band.toFixed(2)))).toEqual([0.5, 0, 0.5])
	})

	// From four on, the arc is 270° wide, which lands the seats one per corner.
	it("puts one seat in each corner at four seats", () => {
		const spots = arcPositions(4)
		expect(spots.map((s) => Math.round(s.x))).toEqual([80, 80, 20, 20])
		expect(spots.map((s) => Number(s.band.toFixed(2)))).toEqual([0.85, 0.15, 0.15, 0.85])
	})

	it("stops opening at 270° once there are five seats or more", () => {
		// The widest seats sit at the same place whether there are 5 or 9 of them.
		expect(arcPositions(5)[0]).toEqual(arcPositions(9)[0])
	})

	it("curves the same way on both sides", () => {
		const spots = arcPositions(9)
		spots.forEach((spot, i) => {
			const mirror = spots[spots.length - 1 - i]
			expect(spot.x + mirror.x).toBeCloseTo(100)
			expect(spot.band).toBeCloseTo(mirror.band)
		})
	})

	it("gives a real position for every table size", () => {
		for (let count = 1; count <= 10; count++) {
			for (const { x, band } of arcPositions(count)) {
				expect(Number.isFinite(x) && Number.isFinite(band)).toBe(true)
			}
		}
	})

	// A seat is up to 8% wide, so it must never hang off either edge, and the
	// arena reserves one seat's height, so `band` must stay inside 0–1.
	it("keeps every seat inside the arena", () => {
		for (let count = 1; count <= 10; count++) {
			for (const { x, band } of arcPositions(count)) {
				expect(x).toBeGreaterThanOrEqual(8)
				expect(x).toBeLessThanOrEqual(92)
				expect(band).toBeGreaterThanOrEqual(0)
				expect(band).toBeLessThanOrEqual(1)
			}
		}
	})

	// In an arena too short for a seat and the pile to share the middle, the pile
	// drops below the seats — so no seat may sit in the middle third any more.
	it("clears the middle column in a very short arena", () => {
		for (let count = 1; count <= 10; count++) {
			for (const { x } of arcPositions(count, { tight: true })) {
				expect(x <= 29.0001 || x >= 70.9999).toBe(true)
			}
		}
	})

	it("leaves the seats that are already out at the sides where they are", () => {
		const roomy = arcPositions(9)
		const tight = arcPositions(9, { tight: true })
		expect(tight[0].x).toBeCloseTo(roomy[0].x)
		expect(tight[8].x).toBeCloseTo(roomy[8].x)
		// …and the heights never change: only the sideways position moves.
		expect(tight.map((s) => s.band)).toEqual(roomy.map((s) => s.band))
	})

	// 9 opponents (a full table seen by a spectator is 10 seats) can't fit side by
	// side, so the ends come down the sides instead of queueing along the top.
	it("sends the end seats down the sides rather than along the top", () => {
		const spots = arcPositions(9)
		const top = spots.reduce((lowest, spot) => (spot.band < lowest.band ? spot : lowest))
		expect(top.band).toBeCloseTo(0)
		expect(spots[0].band).toBeGreaterThan(0.8)
		expect(spots[8].band).toBeGreaterThan(0.8)
	})
})

// "red 2", "blue skip", "wild wild_draw_four"… so the expectations read like the table.
const label = (card) => `${card.color} ${card.card_type === "number" ? card.value : card.card_type}`
const playable = (game) =>
	game.players.find((p) => p.player_id === game.your_player_id).hand.filter((card) => canPlay(card, game)).map(label)

describe("canPlay", () => {
	it("matches the top card's colour or number on my turn", () => {
		expect(playable(myTurn)).toEqual(["red 2", "blue 5", "red draw_two"])
	})

	it("always allows a wild", () => {
		expect(playable(wildPending)).toEqual(["wild wild", "wild wild_draw_four"])
	})

	// A black wild is on top, so only the colour chosen for it counts.
	it("follows the chosen colour after a wild, not the card", () => {
		expect(playable(afterWild)).toEqual(["red 2", "red draw_two"])
	})

	// This is what makes the table pass automatically after a draw.
	it("finds nothing when no card matches", () => {
		expect(playable(afterDraw)).toEqual([])
	})

	it("allows nothing when it isn't my turn", () => {
		expect(playable(theirTurn)).toEqual([])
	})

	it("allows only an identical card out of turn when jump-in is on", () => {
		expect(playable(jumpIn)).toEqual(["green 4"])
	})

	// lost: still "my turn" in the payload, but alice has already won.
	it("allows nothing once the game is over", () => {
		expect(playable(lost)).toEqual([])
	})
})

describe("offersSwap", () => {
	const seven = { color: "red", card_type: "number", value: 7 }

	it("offers a swap when seven swap is on and the card is a 7", () => {
		expect(offersSwap(seven, sevenSwap)).toBe(true)
	})

	it("doesn't when seven swap is off", () => {
		expect(offersSwap(seven, myTurn)).toBe(false)
	})

	// `dev` sends no `settings` at all until backend Task 8 lands.
	it("doesn't when the payload has no settings yet", () => {
		expect(offersSwap(seven, livePayload)).toBe(false)
	})

	it("only for a 7: not a 0, not a skip", () => {
		expect(offersSwap({ color: "red", card_type: "number", value: 0 }, sevenSwap)).toBe(false)
		expect(offersSwap({ color: "red", card_type: "skip", value: null }, sevenSwap)).toBe(false)
	})
})

// The turn started at 14:00:00 sharp in every fixture, and the timer is 60s.
const STARTED = new Date("2026-09-12T14:00:00.000000+00:00").getTime()

describe("secondsLeft", () => {
	it("gives the whole timer at the moment the turn starts", () => {
		expect(secondsLeft(myTurn, STARTED)).toBe(60)
	})

	it("counts down while the turn runs", () => {
		expect(secondsLeft(myTurn, STARTED + 18_000)).toBe(42)
	})

	// A turn that ran out reads 0, never a negative number.
	it("stops at zero once the turn is overdue", () => {
		expect(secondsLeft(myTurn, STARTED + 95_000)).toBe(0)
	})

	// noTimer keeps turn_started_at on purpose: a room without a turn timer has
	// no countdown at all, and the pill has to stay hidden.
	it("gives nothing when the room has no turn timer", () => {
		expect(secondsLeft(noTimer, STARTED)).toBe(null)
	})

	// livePayload is what the backend sends today: start never saves the time.
	it("gives nothing when the turn has no start time", () => {
		expect(secondsLeft(livePayload, STARTED)).toBe(null)
	})

	it("gives nothing for a start time it can't read", () => {
		expect(secondsLeft({ ...myTurn, turn_started_at: "not a date" }, STARTED)).toBe(null)
	})
})

// Every notice compares a "before" with an "after", so the tests build pairs out
// of myTurn by changing only the field the notice looks at.
const RED_5 = { color: "red", card_type: "number", value: 5 }
const RED_7 = { color: "red", card_type: "number", value: 7 }
const RED_0 = { color: "red", card_type: "number", value: 0 }
const GREEN_4 = { color: "green", card_type: "number", value: 4 }
const MY_CARDS = myTurn.players[0].hand

// Replaces my own hand, keeping hand_count in step the way the server does.
const withMyCards = (game, cards) => ({
	...game,
	players: game.players.map((p) =>
		p.player_id === game.your_player_id ? { ...p, hand: cards, hand_count: cards.length } : p,
	),
})

describe("sameCard", () => {
	it("is true for two cards with the same colour, type and value", () => {
		expect(sameCard(RED_5, { ...RED_5 })).toBe(true)
	})

	it("is false when the value differs", () => {
		expect(sameCard(RED_5, RED_7)).toBe(false)
	})

	it("is false when the colour differs", () => {
		expect(sameCard(RED_5, { ...RED_5, color: "blue" })).toBe(false)
	})

	// A number 0 and a skip both carry value 0/null, so the type has to count too.
	it("is false when the type differs", () => {
		expect(sameCard(RED_0, { color: "red", card_type: "skip", value: 0 })).toBe(false)
	})

	it("is true for two missing cards and false when only one is missing", () => {
		expect(sameCard(null, null)).toBe(true)
		expect(sameCard(RED_5, null)).toBe(false)
	})
})

describe("myHandCount", () => {
	it("counts the cards in my own hand", () => {
		expect(myHandCount(myTurn)).toBe(7)
	})

	// A spectator has no seat, so there is no hand of mine to count.
	it("gives null when I'm not at the table", () => {
		expect(myHandCount(spectating)).toBe(null)
	})
})

describe("directionNotice", () => {
	it("says nothing on the first state", () => {
		expect(directionNotice(null, myTurn)).toBe(null)
	})

	it("says nothing when the direction didn't change", () => {
		expect(directionNotice(myTurn, myTurn)).toBe(null)
	})

	it("points right when play turns clockwise", () => {
		expect(directionNotice({ ...myTurn, direction: -1 }, myTurn)).toBe("Direction reversed →")
	})

	it("points left when play turns counter-clockwise", () => {
		expect(directionNotice(myTurn, { ...myTurn, direction: -1 })).toBe("Direction reversed ←")
	})
})

// A 0 on top with Zero rotate on means every hand moved one seat along. The
// setting key is the backend's `zero_swap`; the rule's name is Zero rotate.
describe("rotationNotice", () => {
	const rotating = { ...myTurn, settings: { ...myTurn.settings, zero_swap: true } }
	const onZero = { ...rotating, top_card: RED_0, current_color: "red" }

	it("follows the direction of play to the right", () => {
		expect(rotationNotice(rotating, onZero)).toBe("Hands rotated →")
	})

	it("follows the direction of play to the left", () => {
		expect(rotationNotice(rotating, { ...onZero, direction: -1 })).toBe("Hands rotated ←")
	})

	it("says nothing on the first state", () => {
		expect(rotationNotice(null, onZero)).toBe(null)
	})

	// Same 0 still on top: nothing was played, so nothing rotated.
	it("says nothing when the top card didn't change", () => {
		expect(rotationNotice(onZero, onZero)).toBe(null)
	})

	it("says nothing for a card that isn't a 0", () => {
		expect(rotationNotice(rotating, { ...rotating, top_card: RED_7, current_color: "red" })).toBe(null)
	})

	it("says nothing when Zero rotate is off", () => {
		expect(rotationNotice(myTurn, { ...myTurn, top_card: RED_0, current_color: "red" })).toBe(null)
	})

	// livePayload carries no `settings` at all yet.
	it("says nothing when the payload has no settings", () => {
		expect(rotationNotice(livePayload, { ...livePayload, top_card: RED_0 })).toBe(null)
	})
})

// Why the target id: after a swap my hand count and theirs trade places, and
// when the two hands were the same size the state looks identical to no swap at
// all. The id is the one *I* sent with the card, so it settles it.
describe("swapNotice", () => {
	const onSeven = { ...myTurn, top_card: RED_7, current_color: "red" }

	it("names the player I swapped with", () => {
		expect(swapNotice(myTurn, onSeven, "13")).toBe("You swapped hands with alice")
	})

	it("says nothing when I sent no target, even on a 7", () => {
		expect(swapNotice(myTurn, onSeven, null)).toBe(null)
	})

	it("says nothing on the first state", () => {
		expect(swapNotice(null, onSeven, "13")).toBe(null)
	})

	it("says nothing when the top card didn't change", () => {
		expect(swapNotice(onSeven, onSeven, "13")).toBe(null)
	})

	// A target I sent with something that isn't a 7 can't have been a swap.
	it("says nothing when the new top card isn't a 7", () => {
		expect(swapNotice(myTurn, { ...myTurn, top_card: GREEN_4, current_color: "green" }, "13")).toBe(null)
	})

	it("says nothing when the target isn't at the table any more", () => {
		expect(swapNotice(myTurn, onSeven, "999")).toBe(null)
	})
})

// A jump in is a card I played out of turn, and the rule only allows a card
// *identical* to the top one (game_engine/modifiers.py:32 rejects anything else),
// so the pile looks untouched afterwards. That is the giveaway: it wasn't my turn,
// the top card is the same card, and I hold exactly one card less.
describe("jumpInNotice", () => {
	// jumpIn: alice is up, a green 4 is on top and I hold the identical green 4.
	const waiting = jumpIn
	const jumped = withMyCards(jumpIn, MY_CARDS)

	it("names the card I jumped in with", () => {
		expect(jumpInNotice(waiting, jumped)).toBe("Jumped in with Green 4")
	})

	it("says nothing on the first state", () => {
		expect(jumpInNotice(null, jumped)).toBe(null)
	})

	// On my own turn, one card less is just an ordinary play.
	it("says nothing when it was already my turn", () => {
		const mine = { ...waiting, current_player_id: waiting.your_player_id }
		expect(jumpInNotice(mine, { ...jumped, current_player_id: jumped.your_player_id })).toBe(null)
	})

	it("says nothing when my hand didn't get smaller", () => {
		expect(jumpInNotice(waiting, waiting)).toBe(null)
	})

	// Two cards fewer is a swap or a rotation, not a jump in.
	it("says nothing when I lost more than one card", () => {
		expect(jumpInNotice(waiting, withMyCards(waiting, MY_CARDS.slice(0, 5)))).toBe(null)
	})

	// A rotation hands me somebody else's hand and puts a 0 on the pile; a swap
	// puts a 7 there. Either way the pile changed, so it wasn't a jump in.
	it("says nothing when the top card changed", () => {
		const rotated = withMyCards({ ...jumpIn, top_card: RED_0, current_color: "red" }, MY_CARDS)
		expect(jumpInNotice(waiting, rotated)).toBe(null)
	})

	it("says nothing in a room where Jump in is off", () => {
		const noRule = { ...jumpIn, settings: { ...jumpIn.settings, jump_in: false } }
		expect(jumpInNotice(noRule, withMyCards(noRule, MY_CARDS))).toBe(null)
	})

	// A spectator has no hand, so nothing of theirs can shrink.
	it("says nothing for a spectator", () => {
		const watching = { ...spectating, settings: { ...spectating.settings, jump_in: true } }
		expect(jumpInNotice(watching, watching)).toBe(null)
	})
})

describe("drewNotice", () => {
	const plusOne = withMyCards(myTurn, [...MY_CARDS, GREEN_4])
	const plusThree = withMyCards(myTurn, [...MY_CARDS, GREEN_4, RED_7, RED_0])

	it("counts one card in the singular", () => {
		expect(drewNotice(myTurn, plusOne)).toBe("You drew 1 card")
	})

	it("counts a stack in the plural", () => {
		expect(drewNotice(myTurn, plusThree)).toBe("You drew 3 cards")
	})

	it("says nothing on the first state", () => {
		expect(drewNotice(null, plusOne)).toBe(null)
	})

	it("says nothing when my hand stayed the same size", () => {
		expect(drewNotice(myTurn, myTurn)).toBe(null)
	})

	it("says nothing when my hand got smaller", () => {
		expect(drewNotice(myTurn, withMyCards(myTurn, MY_CARDS.slice(0, 6)))).toBe(null)
	})

	// A rotation also hands me a different number of cards, but it puts a 0 on the
	// pile. A draw never changes the top card, so that is what tells them apart.
	it("says nothing when the top card changed, so a rotation isn't read as a draw", () => {
		expect(drewNotice(myTurn, { ...plusThree, top_card: RED_0, current_color: "red" })).toBe(null)
	})

	it("says nothing for a spectator", () => {
		expect(drewNotice(spectating, spectating)).toBe(null)
	})
})

describe("gameNotices", () => {
	it("gives an empty list when nothing worth saying happened", () => {
		expect(gameNotices(myTurn, myTurn, null)).toEqual([])
	})

	it("gives an empty list on the very first state", () => {
		expect(gameNotices(null, myTurn, null)).toEqual([])
	})

	it("collects one notice", () => {
		expect(gameNotices(myTurn, { ...myTurn, direction: -1 }, null)).toEqual(["Direction reversed ←"])
	})

	// A 7 played on a rotating table: the swap I chose and nothing else, because a
	// 7 isn't a 0 and the direction held.
	it("keeps only the notices that apply", () => {
		const rotating = { ...myTurn, settings: { ...myTurn.settings, zero_swap: true } }
		const swapped = { ...rotating, top_card: RED_7, current_color: "red" }
		expect(gameNotices(rotating, swapped, "13")).toEqual(["You swapped hands with alice"])
	})

	// One state can carry two pieces of news: I jumped in with a reverse, which
	// also flipped the direction.
	const RED_REVERSE = { color: "red", card_type: "reverse", value: null }

	it("collects both when two things happened at once", () => {
		const alicesTurn = {
			...myTurn,
			settings: { ...myTurn.settings, jump_in: true },
			current_player_id: "13",
			top_card: RED_REVERSE,
			current_color: "red",
		}
		const jumpedIn = { ...withMyCards(alicesTurn, MY_CARDS.slice(0, 6)), direction: -1 }
		expect(gameNotices(alicesTurn, jumpedIn, null)).toEqual([
			"Direction reversed ←",
			"Jumped in with Red Reverse",
		])
	})
})
