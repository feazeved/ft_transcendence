import { defaultRoomSettings } from './rooms.js'

// Every key in a tournament config is exactly the field name the backend
// expects on POST /api/tournaments/, so the object goes over unchanged with no
// mapping step — the same rule `rooms.js` follows for game rooms.
//
// `max_participants`, `starting_hand_size`, `turn_timer_seconds` and the five
// modifier flags already exist on the backend. The table-shape keys
// (`players_per_table`, `advance_per_table`, the best-of ones) are part 2 of
// TOURNAMENT_REQUEST.md and are not accepted yet.

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
	max_participants: { min: 4, max: 100 },
	players_per_table: { min: 4, max: 7 },
	advance_per_table: { min: 1, max: 3 },
	starting_hand_size: { min: 1, max: 20 },
	turn_timer_seconds: { min: 5, max: 300 },
}

export const MAX_RECOMMENDED_ROUNDS = 5

export function makeDefaultConfig(format = 'knockout') {
	const { draw_stacking, jump_in, draw_until_playable, seven_swap, zero_swap } = defaultRoomSettings()
	return {
		format,
		name: '',
		max_participants: 20,
		players_per_table: 5,
		advance_per_table: 2,
		starting_hand_size: 7,
		turn_timer_seconds: 30,
		// Flat, not nested: the backend takes these as top-level fields, and
		// enabledHouseRuleLabels() reads the config object directly.
		draw_stacking,
		jump_in,
		draw_until_playable,
		seven_swap,
		zero_swap,
		// knockout only
		final_best_of_3: true,
		// bestof only
		matches_per_round: 3, // 3 | 5 | 7
		matches_in_final: 5,
	}
}

const HARD_ITERATION_CAP = 64

export function computeStructure(config) {
	const perTable = Math.max(2, Math.floor(Number(config.players_per_table)) || 0)
	const advance = Math.max(1, Math.floor(Number(config.advance_per_table)) || 0)
	let remaining = Math.max(0, Math.floor(Number(config.max_participants)) || 0)

	const rounds = []
	let converged = false

	if (remaining <= perTable) {
		rounds.push({ round: 1, players: remaining, tables: 1, advancing: remaining, isFinal: true })
		converged = true
	} else {
		let guard = 0
		while (guard++ < HARD_ITERATION_CAP) {
			const tables = Math.max(1, Math.round(remaining / perTable))
			const advancing = tables * advance

			if (advancing >= remaining) {
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

export function validateConfig(config) {
	const errors = []

	if (!String(config.name || '').trim()) errors.push('Give the tournament a name.')

	if (!inRange(config.max_participants, LIMITS.max_participants))
		errors.push(`Number of players must be between ${LIMITS.max_participants.min} and ${LIMITS.max_participants.max}.`)
	if (!inRange(config.players_per_table, LIMITS.players_per_table))
		errors.push(`Players per table must be between ${LIMITS.players_per_table.min} and ${LIMITS.players_per_table.max}.`)
	if (![1, 2, 3].includes(config.advance_per_table))
		errors.push('Only 1, 2 or 3 players can advance per table.')
	if (!inRange(config.starting_hand_size, LIMITS.starting_hand_size))
		errors.push(`Starting cards must be between ${LIMITS.starting_hand_size.min} and ${LIMITS.starting_hand_size.max}.`)
	if (!inRange(config.turn_timer_seconds, LIMITS.turn_timer_seconds))
		errors.push(`Turn timer must be between ${LIMITS.turn_timer_seconds.min} and ${LIMITS.turn_timer_seconds.max} seconds.`)

	if (
		Number.isFinite(config.advance_per_table) &&
		Number.isFinite(config.players_per_table) &&
		config.advance_per_table >= config.players_per_table
	)
		errors.push("Can't advance more players than sit at the table.")

	if (config.format === 'bestof') {
		if (![3, 5, 7].includes(config.matches_per_round))
			errors.push('Matches per round must be 3, 5 or 7.')
		if (!Number.isFinite(config.matches_in_final) || config.matches_in_final < 1 || config.matches_in_final % 2 === 0)
			errors.push('Matches in the final must be an odd number.')
	}

	if (errors.length === 0 && !computeStructure(config).converged)
		errors.push('With this table size and this many players advancing, the tournament never reduces to a single final table.')

	return { ok: errors.length === 0, errors }
}
