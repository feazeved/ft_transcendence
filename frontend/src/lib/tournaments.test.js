import { describe, expect, it, vi } from "vitest"
import {
	createTournament,
	finalStandings,
	formatDate,
	getTournament,
	isEntered,
	joinTournament,
	leaveTournament,
	listTournaments,
	liveMatchId,
	startTournament,
	STATUS_ACCENTS,
	STATUS_COLORS,
	STATUS_LABELS,
} from "./tournaments.js"
import { api } from "./api.js"

// The in-memory store this file used to exercise is gone: §5 landed, and the six
// functions below are real calls now. What is left to test here is what is still
// ours to get wrong — the pure helpers the screens share, and the addresses the
// six calls go to.

vi.mock("./api.js", () => ({
	api: { get: vi.fn(() => Promise.resolve({})), post: vi.fn(() => Promise.resolve({})) },
}))

describe("formatDate", () => {
	// Midday UTC, so the date is the same in whatever timezone this runs in.
	it("shows a two-digit day, short month and year", () => {
		expect(formatDate("2026-03-03T12:00:00Z")).toBe("03 Mar 2026")
	})
})

describe("STATUS_COLORS", () => {
	it("has a colour for exactly the statuses that have a label", () => {
		expect(Object.keys(STATUS_COLORS).sort()).toEqual(Object.keys(STATUS_LABELS).sort())
	})
})

describe("finalStandings", () => {
	// Pure: the podium is derived from `final_position`, the field the backend
	// already has for it, rather than a separate list of names that could
	// disagree with the roster drawn beside it.
	const entry = (username, final_position) => ({ user: { username }, final_position })

	it("puts the three places in order", () => {
		const tournament = { participants: [entry("ana", 1), entry("pedro", 2), entry("lucas", 3)] }
		expect(finalStandings(tournament).map((e) => e.user.username)).toEqual(["ana", "pedro", "lucas"])
	})

	it("reads the order from final_position, not from the roster order", () => {
		const tournament = { participants: [entry("lucas", 3), entry("ana", 1), entry("pedro", 2)] }
		expect(finalStandings(tournament).map((e) => e.final_position)).toEqual([1, 2, 3])
	})

	it("is empty while nobody has finished", () => {
		const tournament = { participants: [entry("ana", null), entry("pedro", null)] }
		expect(finalStandings(tournament)).toEqual([])
	})

	it("survives a tournament with no participants at all", () => {
		expect(finalStandings({})).toEqual([])
		expect(finalStandings(null)).toEqual([])
	})

	it("never shows more than three", () => {
		const tournament = {
			participants: [1, 2, 3, 4, 5].map((n) => entry(`p${n}`, n)),
		}
		expect(finalStandings(tournament)).toHaveLength(3)
	})
})

describe("STATUS_ACCENTS", () => {
	it("has a card stripe for exactly the statuses that have a label", () => {
		expect(Object.keys(STATUS_ACCENTS).sort()).toEqual(Object.keys(STATUS_LABELS).sort())
	})
})


describe("isEntered", () => {
	const tournament = { participants: [{ user: { username: "daniel" } }, { user: { username: "rita_c" } }] }

	it("finds somebody on the roster", () => {
		expect(isEntered(tournament, "rita_c")).toBe(true)
	})

	it("does not invent a place for somebody who is not", () => {
		expect(isEntered(tournament, "stranger")).toBe(false)
	})

	it("says no for a guest, who has no name to look for", () => {
		expect(isEntered(tournament, undefined)).toBe(false)
	})

	it("survives a tournament with no roster loaded yet", () => {
		expect(isEntered({}, "daniel")).toBe(false)
		expect(isEntered(null, "daniel")).toBe(false)
	})
})

describe("the API calls", () => {
	// A tournament is addressed by its short code, which is what the badge shows
	// and what /tournament/:id carries.
	it("reads the list and one tournament", () => {
		listTournaments()
		expect(api.get).toHaveBeenCalledWith("/tournaments/")

		getTournament("8K2P")
		expect(api.get).toHaveBeenCalledWith("/tournaments/8K2P/")
	})

	it("sends the config over unchanged, because its keys are the backend's", () => {
		const config = { name: "Friday", max_participants: 20, players_per_table: 5, jump_in: true }
		createTournament(config)
		expect(api.post).toHaveBeenCalledWith("/tournaments/", config)
	})

	it("joins, leaves and starts by code", () => {
		joinTournament("8K2P")
		expect(api.post).toHaveBeenCalledWith("/tournaments/8K2P/register/", {})

		leaveTournament("8K2P")
		expect(api.post).toHaveBeenCalledWith("/tournaments/8K2P/unregister/", {})

		startTournament("8K2P")
		expect(api.post).toHaveBeenCalledWith("/tournaments/8K2P/start/", {})
	})
})

describe("STATUS_LABELS", () => {
	it("speaks the backend's GameStatus, not a vocabulary of its own", () => {
		expect(Object.keys(STATUS_LABELS).sort()).toEqual(
			["cancelled", "finished", "in_progress", "pending"].sort(),
		)
	})
})

describe("liveMatchId", () => {
	const draw = (matches) => ({ rounds: [{ round: 1, matches }] })
	const table = (publicId, status, ...publicIds) => ({
		public_id: publicId,
		status,
		players: publicIds.map((id) => ({ id, user: { public_id: id } })),
	})

	it("finds the table I am waiting at", () => {
		expect(liveMatchId(draw([table("g1", "pending", "me", "ana")]), "me")).toBe("g1")
	})

	it("finds the table I am playing at", () => {
		expect(liveMatchId(draw([table("g1", "in_progress", "me", "ana")]), "me")).toBe("g1")
	})

	it("skips the tables I am not at", () => {
		const rounds = draw([table("g1", "pending", "ana", "pedro"), table("g2", "pending", "me", "lucas")])
		expect(liveMatchId(rounds, "me")).toBe("g2")
	})

	it("ignores a table that is over", () => {
		expect(liveMatchId(draw([table("g1", "finished", "me", "ana")]), "me")).toBeNull()
	})

	it("is null before there is a draw, and for a guest", () => {
		expect(liveMatchId({ rounds: [] }, "me")).toBeNull()
		expect(liveMatchId(draw([table("g1", "pending", "me")]), undefined)).toBeNull()
		expect(liveMatchId(null, "me")).toBeNull()
		expect(liveMatchId({}, "me")).toBeNull()
	})
})
