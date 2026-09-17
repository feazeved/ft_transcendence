import { afterEach, describe, expect, it, vi } from "vitest"
import { MODIFIER_TOGGLES } from "./rooms.js"
import { makeDefaultConfig } from "./tournamentStructure.js"
import { enabledHouseRuleLabels, formatDate, makeTournamentId, STATUS_COLORS, STATUS_LABELS } from "./tournaments.js"

describe("makeTournamentId", () => {
	afterEach(() => {
		vi.restoreAllMocks()
	})

	it("is four characters by default", () => {
		expect(makeTournamentId()).toHaveLength(4)
	})

	it("has the requested length", () => {
		for (const length of [0, 1, 6, 12]) expect(makeTournamentId(length)).toHaveLength(length)
	})

	// People read these codes out loud and type them in. That's the whole reason
	// the alphabet leaves out I, O, 0 and 1.
	it("never uses I, O, 0 or 1", () => {
		const ids = Array.from({ length: 500 }, () => makeTournamentId(8)).join("")
		expect(ids).toMatch(/^[A-HJ-NP-Z2-9]+$/)
	})

	// Math.random lands anywhere in [0, 1). Pin both ends so an off-by-one can't
	// index past the alphabet and put "undefined" into a code.
	it("stays inside the alphabet at both ends of Math.random", () => {
		const random = vi.spyOn(Math, "random").mockReturnValue(0)
		expect(makeTournamentId(3)).toBe("AAA")

		random.mockReturnValue(0.999999)
		expect(makeTournamentId(3)).toBe("999")
	})
})

describe("formatDate", () => {
	// Midday UTC, so the date is the same in whatever timezone this runs in.
	it("shows a two-digit day, short month and year", () => {
		expect(formatDate("2026-03-03T12:00:00Z")).toBe("03 Mar 2026")
	})
})

describe("enabledHouseRuleLabels", () => {
	it("returns an empty list for a default tournament", () => {
		expect(enabledHouseRuleLabels(makeDefaultConfig())).toEqual([])
	})

	it("returns only the enabled labels, in toggle order", () => {
		const config = { ...makeDefaultConfig(), seven_swap: true, draw_stacking: true }
		expect(enabledHouseRuleLabels(config)).toEqual(["Stacking draw cards", "Seven swap"])
	})

	// A tournament config is full of truthy fields that aren't house rules.
	it("ignores keys that are not house rules", () => {
		expect(enabledHouseRuleLabels({ name: "Friday Cup", max_participants: 20, final_best_of_3: true })).toEqual([])
	})

	it("survives an undefined argument", () => {
		expect(enabledHouseRuleLabels()).toEqual([])
	})

	it("offers the same house rules as a room", () => {
		const everyRule = Object.fromEntries(MODIFIER_TOGGLES.map(({ key }) => [key, true]))
		expect(enabledHouseRuleLabels(everyRule)).toEqual(MODIFIER_TOGGLES.map(({ label }) => label))
	})
})

describe("STATUS_COLORS", () => {
	it("has a colour for exactly the statuses that have a label", () => {
		expect(Object.keys(STATUS_COLORS).sort()).toEqual(Object.keys(STATUS_LABELS).sort())
	})
})
