import { describe, expect, it } from "vitest"
import {
	computeStructure,
	FORMATS,
	LIMITS,
	makeDefaultConfig,
	MAX_RECOMMENDED_ROUNDS,
	validateConfig,
} from "./tournamentStructure.js"

const shape = (max_participants, players_per_table, advance_per_table) => ({
	max_participants,
	players_per_table,
	advance_per_table,
})

// Every table shape inside LIMITS, advancing fewer players than sit at a table —
// everything validateConfig lets through to its convergence check.
function everyShapeInLimits() {
	const shapes = []
	for (let p = LIMITS.max_participants.min; p <= LIMITS.max_participants.max; p++)
		for (let t = LIMITS.players_per_table.min; t <= LIMITS.players_per_table.max; t++)
			for (let a = LIMITS.advance_per_table.min; a <= LIMITS.advance_per_table.max && a < t; a++)
				shapes.push(shape(p, t, a))
	return shapes
}

const named = (overrides = {}) => ({ ...makeDefaultConfig(), name: "Friday Cup", ...overrides })

describe("makeDefaultConfig", () => {
	it("returns a fresh object on every call", () => {
		const first = makeDefaultConfig()
		first.max_participants = 99

		const second = makeDefaultConfig()
		expect(second).not.toBe(first)
		expect(second.max_participants).toBe(20)
	})

	it("is a knockout unless told otherwise", () => {
		expect(makeDefaultConfig().format).toBe("knockout")
		expect(makeDefaultConfig("bestof").format).toBe("bestof")
	})

	// If a LIMITS key drifts from its config key, validateConfig destructures
	// `undefined` and throws a TypeError instead of returning a message.
	it("has a field for every key in LIMITS", () => {
		const config = makeDefaultConfig()
		expect(Object.keys(LIMITS).filter((key) => !(key in config))).toEqual([])
	})
})

describe("FORMATS", () => {
	it("keys every format by its own id", () => {
		expect(Object.entries(FORMATS).filter(([key, format]) => format.id !== key)).toEqual([])
	})
})

describe("computeStructure", () => {
	it("sends players who fit one table straight to the final", () => {
		expect(computeStructure(shape(4, 4, 1))).toEqual({
			rounds: [{ round: 1, players: 4, tables: 1, advancing: 4, isFinal: true }],
			totalRounds: 1,
			converged: true,
			tooManyRounds: false,
		})
	})

	it("takes 20 players at tables of 5 through two rounds to a final of 4", () => {
		expect(computeStructure(shape(20, 5, 2))).toEqual({
			rounds: [
				{ round: 1, players: 20, tables: 4, advancing: 8, isFinal: false },
				{ round: 2, players: 8, tables: 2, advancing: 4, isFinal: false },
				{ round: 3, players: 4, tables: 1, advancing: 4, isFinal: true },
			],
			totalRounds: 3,
			converged: true,
			tooManyRounds: false,
		})
	})

	it("takes 8 players at tables of 4 through one round to a final of 4", () => {
		expect(computeStructure(shape(8, 4, 2)).rounds).toEqual([
			{ round: 1, players: 8, tables: 2, advancing: 4, isFinal: false },
			{ round: 2, players: 4, tables: 1, advancing: 4, isFinal: true },
		])
	})

	it("gets 100 players at tables of 7 to a final in five rounds", () => {
		const structure = computeStructure(shape(100, 7, 3))
		expect(structure.rounds.map((round) => round.players)).toEqual([100, 42, 18, 9, 3])
		expect(structure).toMatchObject({ totalRounds: 5, converged: true })
	})

	it("reads numbers typed into the form as strings", () => {
		expect(computeStructure({ max_participants: "8", players_per_table: "4", advance_per_table: "2" })).toEqual(
			computeStructure(shape(8, 4, 2)),
		)
	})

	// The preview recomputes on every keystroke, so a cleared field must not throw.
	it("survives blank fields", () => {
		expect(() => computeStructure(shape("", "", ""))).not.toThrow()
	})

	// 6 players at tables of 4 is 2 tables; 3 advance from each, which is 6 again.
	it("flags a config that never reduces as not converged", () => {
		expect(computeStructure(shape(6, 4, 3))).toMatchObject({ converged: false, tooManyRounds: false })
	})

	it("trips tooManyRounds above MAX_RECOMMENDED_ROUNDS, not at it", () => {
		expect(MAX_RECOMMENDED_ROUNDS).toBe(5)
		expect(computeStructure(shape(100, 7, 3))).toMatchObject({ totalRounds: 5, tooManyRounds: false })
		expect(computeStructure(shape(100, 4, 2))).toMatchObject({ totalRounds: 6, tooManyRounds: true })
	})

	// Nothing inside LIMITS gets near this; it's what a half-typed number can do.
	it("gives up after 64 rounds instead of churning through absurd input", () => {
		const structure = computeStructure(shape(1_000_000_000, 7, 6))
		expect(structure.rounds).toHaveLength(64)
		expect(structure.converged).toBe(false)
	})

	describe("for every table shape inside LIMITS", () => {
		const shapes = everyShapeInLimits()

		it("numbers rounds 1, 2, 3… and counts them in totalRounds", () => {
			const broken = shapes.filter((s) => {
				const { rounds, totalRounds } = computeStructure(s)
				return totalRounds !== rounds.length || rounds.some((round, i) => round.round !== i + 1)
			})
			expect(broken).toEqual([])
		})

		it("seats each round with exactly the players the round before advanced", () => {
			const broken = shapes.filter((s) => {
				const { rounds } = computeStructure(s)
				return rounds.some((round, i) => i > 0 && round.players !== rounds[i - 1].advancing)
			})
			expect(broken).toEqual([])
		})

		it("shrinks the field every round", () => {
			const broken = shapes.filter((s) => {
				const { rounds } = computeStructure(s)
				return rounds.some((round, i) => i > 0 && round.players >= rounds[i - 1].players)
			})
			expect(broken).toEqual([])
		})

		it("marks the last round as the final only when the structure converges", () => {
			const broken = shapes.filter((s) => {
				const { rounds, converged } = computeStructure(s)
				return rounds.some((round, i) => round.isFinal !== (converged && i === rounds.length - 1))
			})
			expect(broken).toEqual([])
		})
	})

	// KNOWN GAPS, failing on purpose. These are the two bracket decisions still
	// open with the backend, written as the behaviour we want. `it.fails` keeps
	// `npm test` green meanwhile. When the code changes to match, vitest reports
	// them as unexpectedly passing: change `it.fails` to `it`. If the decision
	// goes the other way, delete them.

	// Math.round puts 12 players at tables of 5 onto 2 tables — of 6.
	it.fails("never seats more players at a table than the host asked for", () => {
		const { rounds } = computeStructure(shape(12, 5, 2))
		for (const round of rounds) expect(Math.ceil(round.players / round.tables)).toBeLessThanOrEqual(5)
	})

	// 5 players, tables of 4, 1 advancing: the "final" is one person on their own.
	it.fails("never ends in a final with fewer than two players", () => {
		const { rounds } = computeStructure(shape(5, 4, 1))
		expect(rounds.at(-1).players).toBeGreaterThanOrEqual(2)
	})
})

describe("validateConfig", () => {
	it.each(Object.keys(FORMATS))("accepts the default %s config once it has a name", (format) => {
		expect(validateConfig({ ...makeDefaultConfig(format), name: "Friday Cup" })).toEqual({ ok: true, errors: [] })
	})

	it.each(["", "   "])("rejects the name %j", (name) => {
		expect(validateConfig(named({ name })).errors).toEqual(["Give the tournament a name."])
	})

	// Accepted at both ends of its range, rejected one step outside. This also
	// catches a LIMITS key drifting from the config: validateConfig would throw.
	describe.each(Object.entries(LIMITS))("%s", (field, { min, max }) => {
		it(`accepts ${min} and ${max}`, () => {
			expect(validateConfig(named({ [field]: min })).ok).toBe(true)
			expect(validateConfig(named({ [field]: max })).ok).toBe(true)
		})

		it(`rejects ${min - 1} and ${max + 1}`, () => {
			expect(validateConfig(named({ [field]: min - 1 })).errors).toHaveLength(1)
			expect(validateConfig(named({ [field]: max + 1 })).errors).toHaveLength(1)
		})
	})

	it("rejects advancing as many players as sit at the table", () => {
		expect(validateConfig(named({ players_per_table: 3, advance_per_table: 3 })).errors).toContain(
			"Can't advance more players than sit at the table.",
		)
	})

	it("rejects a structure that never reduces to one final table", () => {
		expect(validateConfig(named({ max_participants: 6, players_per_table: 4, advance_per_table: 3 })).errors).toEqual([
			expect.stringContaining("never reduces to a single final table"),
		])
	})

	describe("best of", () => {
		const bestOf = (overrides) => named({ format: "bestof", ...overrides })

		it.each([3, 5, 7])("accepts %i matches per round", (matches_per_round) => {
			expect(validateConfig(bestOf({ matches_per_round })).ok).toBe(true)
		})

		it.each([1, 2, 4, 9])("rejects %i matches per round", (matches_per_round) => {
			expect(validateConfig(bestOf({ matches_per_round })).errors).toEqual(["Matches per round must be 3, 5 or 7."])
		})

		it.each([1, 3, 7])("accepts %i matches in the final", (matches_in_final) => {
			expect(validateConfig(bestOf({ matches_in_final })).ok).toBe(true)
		})

		it.each([0, 2, 4])("rejects %i matches in the final", (matches_in_final) => {
			expect(validateConfig(bestOf({ matches_in_final })).errors).toEqual([
				"Matches in the final must be an odd number.",
			])
		})

		it("ignores the best-of fields for a knockout", () => {
			expect(validateConfig(named({ matches_per_round: 4, matches_in_final: 2 })).ok).toBe(true)
		})
	})

	// KNOWN GAP, failing on purpose — the one-player final from computeStructure
	// above, which validateConfig lets through today.
	it.fails("rejects a config whose final has one player", () => {
		expect(validateConfig(named({ max_participants: 5, players_per_table: 4, advance_per_table: 1 })).ok).toBe(false)
	})
})
