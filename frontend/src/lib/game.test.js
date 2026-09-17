import { describe, expect, it } from "vitest"
import {
	afterDraw,
	afterWild,
	jumpIn,
	livePayload,
	lost,
	myTurn,
	sevenSwap,
	spectating,
	tenPlayers,
	theirTurn,
	wildPending,
} from "./fakeGameState.js"
import { arcPositions, canPlay, nextPlayer, offersSwap, seatOrder } from "./game.js"

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
	it("puts a single seat in the middle, at the top", () => {
		expect(arcPositions(1)).toEqual([{ x: 50, y: 0 }])
	})

	it("curves the same way on both sides", () => {
		const spots = arcPositions(9)
		spots.forEach((spot, i) => {
			const mirror = spots[spots.length - 1 - i]
			expect(spot.x + mirror.x).toBeCloseTo(100)
			expect(spot.y).toBeCloseTo(mirror.y)
		})
	})

	// The square root goes NaN if a seat ever lands outside the ellipse.
	it("gives a real position for every table size", () => {
		for (let count = 1; count <= 10; count++) {
			for (const { x, y } of arcPositions(count)) {
				expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
			}
		}
	})

	// A spectator of a full game sees all 10 players on the arc, and GameTable
	// makes each seat 8% wide, so neighbours must be at least that far apart.
	it("leaves room for 10 seats of 8% each", () => {
		const xs = arcPositions(10).map((spot) => spot.x)
		xs.slice(1).forEach((x, i) => expect(x - xs[i]).toBeGreaterThanOrEqual(8))
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
