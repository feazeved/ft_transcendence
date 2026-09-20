import { describe, expect, it } from "vitest"
import { cardName, CARD_BACK, cardSrc } from "./cards.js"

describe("cardSrc", () => {
	it("returns the card back when given no card", () => {
		expect(cardSrc(null)).toBe(CARD_BACK)
		expect(cardSrc(undefined)).toBe(CARD_BACK)
	})

	it("maps a number card to its value inside its colour folder", () => {
		expect(cardSrc({ color: "red", card_type: "number", value: 5 })).toBe("/cards/red/5.png")
	})

	// `String(card.value)` is right. Tidying it into `card.value || ...` would
	// break every zero in the deck — and zero_swap is one of our house rules.
	it("does not treat a zero as missing", () => {
		expect(cardSrc({ color: "yellow", card_type: "number", value: 0 })).toBe("/cards/yellow/0.png")
	})

	it("maps skip to block, the name it has on disk", () => {
		expect(cardSrc({ color: "green", card_type: "skip", value: null })).toBe("/cards/green/block.png")
	})

	it("maps draw_two to +2", () => {
		expect(cardSrc({ color: "blue", card_type: "draw_two", value: null })).toBe("/cards/blue/+2.png")
	})

	it("keeps reverse as reverse", () => {
		expect(cardSrc({ color: "red", card_type: "reverse", value: null })).toBe("/cards/red/reverse.png")
	})

	it("puts a wild at the root, with no colour folder", () => {
		expect(cardSrc({ color: "wild", card_type: "wild", value: null })).toBe("/cards/wild.png")
	})

	it("puts a wild draw four at the root, as +4", () => {
		expect(cardSrc({ color: "wild", card_type: "wild_draw_four", value: null })).toBe("/cards/+4.png")
	})

	// KNOWN GAP, failing on purpose. An unknown card_type builds
	// "/cards/red/undefined.png" today: a broken image and no error. Nobody has
	// decided what it should show instead. When it's fixed, vitest reports this
	// as unexpectedly passing — change `it.fails` to `it`.
	it.fails("never builds a path containing 'undefined' for an unknown card_type", () => {
		expect(cardSrc({ color: "red", card_type: "mystery", value: null })).not.toContain("undefined")
	})
})

// The card in words. It reads out the `alt` of the top card, names every button
// in my hand, and goes into the notices ("Jumped in with Green 4").
describe("cardName", () => {
	it("names a number card by colour and value", () => {
		expect(cardName({ color: "blue", card_type: "number", value: 7 })).toBe("Blue 7")
	})

	it("names a zero, rather than dropping it", () => {
		expect(cardName({ color: "yellow", card_type: "number", value: 0 })).toBe("Yellow 0")
	})

	it("names an action card by its rule name, not its filename", () => {
		expect(cardName({ color: "red", card_type: "skip", value: null })).toBe("Red Skip")
		expect(cardName({ color: "green", card_type: "reverse", value: null })).toBe("Green Reverse")
		expect(cardName({ color: "blue", card_type: "draw_two", value: null })).toBe("Blue Draw Two")
	})

	// A wild has no colour of its own, so "Wild Wild" would be silly.
	it("names the two wilds without repeating their colour", () => {
		expect(cardName({ color: "wild", card_type: "wild", value: null })).toBe("Wild")
		expect(cardName({ color: "wild", card_type: "wild_draw_four", value: null })).toBe("Wild Draw Four")
	})

	it("says 'card' when there is no card to name", () => {
		expect(cardName(null)).toBe("card")
	})
})
