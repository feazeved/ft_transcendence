import { describe, expect, it, vi } from "vitest"
import {
	formatDay,
	formatPlayedAt,
	getMatchHistory,
	getPublicProfile,
	getUserStats,
	matchOutcome,
	opponentsOf,
} from "./profiles.js"
import api from "./api.js"

vi.mock("./api.js", () => ({
	default: { get: vi.fn(() => Promise.resolve({})), post: vi.fn(() => Promise.resolve({})) },
}))

const ME = "11111111-1111-1111-1111-111111111111"
const THEM = "22222222-2222-2222-2222-222222222222"

const seat = (publicId, name) => ({ id: publicId, display_name: name, user: { public_id: publicId } })

describe("the three addresses", () => {
	it("asks for the profile, the stats and the matches by public id", () => {
		getPublicProfile(ME)
		expect(api.get).toHaveBeenCalledWith(`/users/${ME}/`)

		getUserStats(ME)
		expect(api.get).toHaveBeenCalledWith(`/users/${ME}/stats/`)

		getMatchHistory(ME, { page: 2, pageSize: 5 })
		expect(api.get).toHaveBeenCalledWith(`/users/${ME}/matches/?page=2&page_size=5`)
	})
})

describe("opponentsOf", () => {
	it("leaves out the person whose history this is", () => {
		const match = { players: [seat(ME, "me"), seat(THEM, "ana")] }
		expect(opponentsOf(match, ME).map((p) => p.display_name)).toEqual(["ana"])
	})

	it("keeps the seating order of everybody else", () => {
		const match = { players: [seat("a", "ana"), seat(ME, "me"), seat("b", "bea")] }
		expect(opponentsOf(match, ME).map((p) => p.display_name)).toEqual(["ana", "bea"])
	})

	it("is empty rather than broken when there is nothing to read", () => {
		expect(opponentsOf(null, ME)).toEqual([])
		expect(opponentsOf({}, ME)).toEqual([])
	})
})

describe("matchOutcome", () => {
	it("reads the server's verdict", () => {
		expect(matchOutcome({ winner: { public_id: ME }, won: true }).label).toBe("Won")
		expect(matchOutcome({ winner: { public_id: THEM }, won: false }).label).toBe("Lost")
	})

	// A finished game can have no winner at all — everybody left — and calling
	// that a loss would be a lie about a game nobody lost.
	it("does not call a game with no winner a loss", () => {
		expect(matchOutcome({ winner: null, won: false }).label).toBe("No result")
		expect(matchOutcome({}).label).toBe("No result")
		expect(matchOutcome(null).label).toBe("No result")
	})
})

describe("formatDay", () => {
	it("writes the day before the month", () => {
		expect(formatDay("2026-03-03T12:00:00Z")).toBe("03 Mar 2026")
	})

	it("says nothing rather than throwing on a date the server did not send", () => {
		expect(formatDay(null)).toBe("")
		expect(formatDay("not a date")).toBe("")
	})
})

describe("formatPlayedAt", () => {
	it("puts the day first and the clock after it", () => {
		expect(formatPlayedAt("2026-03-03T14:22:00Z")).toMatch(/^03 Mar 2026 · \d{2}:\d{2}$/)
	})

	it("says nothing rather than throwing on a time the server did not send", () => {
		expect(formatPlayedAt(null)).toBe("")
		expect(formatPlayedAt("")).toBe("")
		expect(formatPlayedAt("not a date")).toBe("")
	})
})
