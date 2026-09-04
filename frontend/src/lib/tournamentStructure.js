// Pure tournament logic. No React on purpose: the bracket maths is the one piece
// worth reusing later (real bracket generation, backend validation, previews).
// Everything here is a plain function that never throws.
import { defaultRoomSettings } from './rooms.js'

export const FORMATS = {
	knockout: {
		id: 'knockout',
		label: 'Knockout',
		description:
			'One match per round. Win and you advance, lose and you\'re out. Fast.',
	},
	bestof: {
		id: 'bestof',
		label: 'Best of 3',
		description:
			'Several matches per round at the same table. Ranked by average placement. Fairer, slower.',
	},
}

export const LIMITS = {
	players: { min: 4, max: 100 },
	playersPerTable: { min: 4, max: 7 },
	advancePerTable: { min: 1, max: 3 },
	startingCards: { min: 1, max: 20 },
	turnTimeSeconds: { min: 5, max: 300 },
}

// The soft ceiling for round count. Above this the preview shows a warning
// (it does not block creation).
export const MAX_RECOMMENDED_ROUNDS = 5

// Every tournament table runs on the same game engine as a room, so house
// rules reuse the exact settings (and defaults) from lib/rooms.js — see
// RULE_TOGGLES there for the toggle labels/hints.
export function makeDefaultConfig(format = 'knockout') {
	const { stacking_draw_two, jump_in, draw_until_playable, seven_swap, zero } = defaultRoomSettings()
	return {
		format,
		name: '',
		players: 20,
		playersPerTable: 5,
		advancePerTable: 2,
		startingCards: 7,
		turnTimeSeconds: 30,
		houseRules: {
			stacking_draw_two,
			jump_in,
			draw_until_playable,
			seven_swap,
			zero,
			// Unlike a standalone room, a tournament table can never be
			// spectated — fixed off, not a toggle.
			spectate: false,
		},
		// knockout only
		finalBestOf3: true,
		// bestof only
		matchesPerRound: 3, // 3 | 5 | 7
		matchesInFinal: 5,
	}
}

const HARD_ITERATION_CAP = 64

// Works out how many rounds the tournament has and how many players / tables
// each one holds. Returns:
//   {
//     rounds: [{ round, players, tables, advancing, isFinal }],
//     totalRounds,
//     converged,       // false when the bracket never shrinks to a single table
//     tooManyRounds,   // converged && totalRounds > MAX_RECOMMENDED_ROUNDS
//   }
export function computeStructure(config) {
	const perTable = Math.max(2, Math.floor(Number(config.playersPerTable)) || 0)
	const advance = Math.max(1, Math.floor(Number(config.advancePerTable)) || 0)
	let remaining = Math.max(0, Math.floor(Number(config.players)) || 0)

	const rounds = []
	let converged = false

	if (remaining <= perTable) {
		// Everyone already fits on one table — it is just a final.
		rounds.push({ round: 1, players: remaining, tables: 1, advancing: remaining, isFinal: true })
		converged = true
	} else {
		let guard = 0
		while (guard++ < HARD_ITERATION_CAP) {
			const tables = Math.max(1, Math.round(remaining / perTable))
			const advancing = tables * advance

			if (advancing >= remaining) {
				// Not shrinking: impossible bracket (e.g. 3 advance from tables of 4).
				rounds.push({ round: rounds.length + 1, players: remaining, tables, advancing, isFinal: false })
				converged = false
				break
			}

			rounds.push({ round: rounds.length + 1, players: remaining, tables, advancing, isFinal: false })

			if (advancing <= perTable) {
				rounds.push({ round: rounds.length + 1, players: advancing, tables: 1, advancing, isFinal: true })
				converged = true
				break
			}

			remaining = advancing
		}
	}

	const totalRounds = rounds.length
	return {
		rounds,
		totalRounds,
		converged,
		tooManyRounds: converged && totalRounds > MAX_RECOMMENDED_ROUNDS,
	}
}

const inRange = (value, { min, max }) => Number.isFinite(value) && value >= min && value <= max

// Simple validation to stop impossible combinations before creation.
// Returns { ok, errors: string[] } — errors are user-facing messages.
export function validateConfig(config) {
	const errors = []

	if (!String(config.name || '').trim()) errors.push('Give the tournament a name.')

	if (!inRange(config.players, LIMITS.players))
		errors.push(`Number of players must be between ${LIMITS.players.min} and ${LIMITS.players.max}.`)
	if (!inRange(config.playersPerTable, LIMITS.playersPerTable))
		errors.push(`Players per table must be between ${LIMITS.playersPerTable.min} and ${LIMITS.playersPerTable.max}.`)
	if (![1, 2, 3].includes(config.advancePerTable))
		errors.push('Only 1, 2 or 3 players can advance per table.')
	if (!inRange(config.startingCards, LIMITS.startingCards))
		errors.push(`Starting cards must be between ${LIMITS.startingCards.min} and ${LIMITS.startingCards.max}.`)
	if (!inRange(config.turnTimeSeconds, LIMITS.turnTimeSeconds))
		errors.push(`Turn timer must be between ${LIMITS.turnTimeSeconds.min} and ${LIMITS.turnTimeSeconds.max} seconds.`)

	if (
		Number.isFinite(config.advancePerTable) &&
		Number.isFinite(config.playersPerTable) &&
		config.advancePerTable >= config.playersPerTable
	)
		errors.push("Can't advance more players than sit at the table.")

	if (config.format === 'bestof') {
		if (![3, 5, 7].includes(config.matchesPerRound))
			errors.push('Matches per round must be 3, 5 or 7.')
		if (!Number.isFinite(config.matchesInFinal) || config.matchesInFinal < 1 || config.matchesInFinal % 2 === 0)
			errors.push('Matches in the final must be an odd number.')
	}

	// Only run the structural check once the raw numbers are sane.
	if (errors.length === 0 && !computeStructure(config).converged)
		errors.push('With this table size and this many players advancing, the tournament never reduces to a single final table.')

	return { ok: errors.length === 0, errors }
}
