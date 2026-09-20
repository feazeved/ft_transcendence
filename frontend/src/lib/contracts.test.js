import { existsSync } from "node:fs"
import { describe, expect, it } from "vitest"
import { CARD_BACK, cardSrc, COLOR_HEX } from "./cards.js"
import { MAX_PLAYERS, MIN_PLAYERS, MODIFIER_TOGGLES } from "./rooms.js"
import { STATUS_LABELS } from "./tournaments.js"

// Tripwires for what the frontend has to agree with but can't import: the
// backend's enums and limits, and the card images on disk.
//
// The backend values below are copied by hand on purpose. When one of these
// tests fails, someone changed one side of a contract without the other — that
// kind of bug errors nowhere, the UI just quietly shows nothing. Fix both sides,
// then update the copy here.

// backend/game_api/models.py — GameStatus, which Tournament.status uses too
const GAME_STATUSES = ["pending", "in_progress", "finished", "cancelled"]

// backend/game_api/models.py — MODIFIER_FIELDS
const MODIFIER_FIELDS = ["draw_stacking", "jump_in", "draw_until_playable", "seven_swap", "zero_swap"]

// backend/game_api/models.py — the validators on Game.max_seats
const MAX_SEATS = { min: 2, max: 10 }

// backend/game_engine/cards.py — Color, without WILD, which is never the colour in play
const PLAYABLE_COLORS = ["red", "yellow", "green", "blue"]

// backend/game_engine/deck.py — one of every distinct card build_standard_deck() makes
function everyDistinctCard() {
	const cards = []
	for (const color of PLAYABLE_COLORS) {
		for (let value = 0; value <= 9; value++) cards.push({ color, card_type: "number", value })
		for (const card_type of ["skip", "reverse", "draw_two"]) cards.push({ color, card_type, value: null })
	}
	cards.push({ color: "wild", card_type: "wild", value: null })
	cards.push({ color: "wild", card_type: "wild_draw_four", value: null })
	return cards
}

const onDisk = (src) => existsSync(new URL(`../../public${src}`, import.meta.url))

describe("card images", () => {
	it("has a picture on disk for every card in the deck", () => {
		expect(everyDistinctCard().map(cardSrc).filter((src) => !onDisk(src))).toEqual([])
	})

	it("has a picture on disk for the card back", () => {
		expect(onDisk(CARD_BACK)).toBe(true)
	})
})

describe("COLOR_HEX", () => {
	// After a wild, the glow is the only way to tell which colour is in play.
	it("covers exactly red, yellow, green and blue — never wild", () => {
		expect(Object.keys(COLOR_HEX).sort()).toEqual([...PLAYABLE_COLORS].sort())
	})

	// GameTable appends an alpha channel — `${glow}88` — which only works on #rrggbb.
	it("writes every colour as six-digit hex", () => {
		expect(Object.values(COLOR_HEX).filter((hex) => !/^#[0-9a-f]{6}$/i.test(hex))).toEqual([])
	})
})

describe("MODIFIER_TOGGLES", () => {
	// A modifier added to the backend but not here never shows up in the
	// create-room form. No error, no clue.
	it("matches the backend's MODIFIER_FIELDS", () => {
		expect(MODIFIER_TOGGLES.map((toggle) => toggle.key).sort()).toEqual([...MODIFIER_FIELDS].sort())
	})
})

describe("room size", () => {
	it("allows the same range of seats as Game.max_seats", () => {
		expect({ min: MIN_PLAYERS, max: MAX_PLAYERS }).toEqual(MAX_SEATS)
	})
})

describe("STATUS_LABELS", () => {
	it("labels pending, in_progress and finished", () => {
		expect(STATUS_LABELS).toMatchObject({
			pending: expect.any(String),
			in_progress: expect.any(String),
			finished: expect.any(String),
		})
	})

	// Tournament.status can hold any GameStatus value, cancelled included. A status
	// with no label renders as nothing, with no error to say so.
	it("labels every status the backend can send, including cancelled", () => {
		expect(Object.keys(STATUS_LABELS).sort()).toEqual([...GAME_STATUSES].sort())
	})
})
