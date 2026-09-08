import { MODIFIER_TOGGLES } from "./rooms.js"
import { makeDefaultConfig } from "./tournamentStructure.js"

export const HOUSE_RULE_TOGGLES = MODIFIER_TOGGLES

// These are the backend's GameStatus values, not names of our own — the whole
// API speaks this enum and a second vocabulary would only need translating.
export const STATUS_LABELS = {
	pending: "Upcoming",
	in_progress: "In progress",
	finished: "Finished",
}

export const STATUS_COLORS = {
	pending: "text-blue",
	in_progress: "text-green",
	finished: "text-white/50",
}

export function makeTournamentId(length = 4) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	let id = ""
	for (let i = 0; i < length; i++) {
		id += alphabet[Math.floor(Math.random() * alphabet.length)]
	}
	return id
}

export function formatDate(iso) {
	return new Date(iso).toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	})
}

// TODO backend: POST /tournaments/ with { name, ...config }, use the
// returned id instead of a client-generated one.
export function buildTournament({ name, host, avatar, config }) {
	return {
		id: makeTournamentId(),
		name,
		host,
		status: "pending",
		createdAt: new Date().toISOString(),
		participants: [{ name: host, avatar: avatar ?? "/profile/default.jpg", isHost: true }],
		config,
	}
}

function daysFromNow(days) {
	const d = new Date()
	d.setDate(d.getDate() + days)
	return d.toISOString()
}

function mockParticipants(count, host) {
	return Array.from({ length: count }, (_, i) => ({
		name: i === 0 ? host : `player_${i + 1}`,
		avatar: "/profile/default.jpg",
		isHost: i === 0,
	}))
}

// TODO backend: GET /tournaments/ — results will come from completed match
// data once round/match play exists, not a fixed list.
export function mockTournaments() {
	return [
		{
			id: "8K2P",
			name: "Friday Showdown",
			host: "daniel",
			status: "pending",
			createdAt: daysFromNow(3),
			participants: mockParticipants(14, "daniel"),
			config: { ...makeDefaultConfig("knockout"), players: 20 },
		},
		{
			id: "3FPQ",
			name: "Casual ONE League",
			host: "feazeved",
			status: "in_progress",
			createdAt: daysFromNow(-2),
			participants: mockParticipants(12, "feazeved"),
			config: {
				...makeDefaultConfig("bestof"),
				max_participants: 12,
				players_per_table: 4,
				advance_per_table: 1,
				matches_per_round: 5,
			},
		},
		{
			id: "WKWM",
			name: "Weekend Warmup",
			host: "guesttt",
			status: "in_progress",
			createdAt: daysFromNow(-1),
			participants: mockParticipants(10, "guesttt"),
			config: { ...makeDefaultConfig("knockout"), players: 10 },
		},
		{
			id: "9QXR",
			name: "Lightning Cup",
			host: "ana",
			status: "finished",
			createdAt: daysFromNow(-10),
			participants: mockParticipants(8, "ana"),
			results: ["ana", "player_5", "player_3"],
			config: {
				...makeDefaultConfig("knockout"),
				max_participants: 8,
				players_per_table: 4,
				advance_per_table: 2,
				final_best_of_3: false,
			},
		},
		{
			id: "CHMP",
			name: "Champions Cup",
			host: "pedro",
			status: "finished",
			createdAt: daysFromNow(-30),
			participants: mockParticipants(24, "pedro"),
			results: ["pedro", "player_11", "player_3"],
			config: {
				...makeDefaultConfig("bestof"),
				players: 24,
				matches_per_round: 3,
				matches_in_final: 7,
			},
		},
		{
			id: "L4TN",
			name: "Mega Tournament",
			host: "lucas",
			status: "pending",
			createdAt: daysFromNow(7),
			participants: mockParticipants(40, "lucas"),
			config: { ...makeDefaultConfig("knockout"), players: 64 },
		},
		{
			id: "RB7M",
			name: "Friends Cup",
			host: "guest_11",
			status: "pending",
			createdAt: daysFromNow(1),
			participants: mockParticipants(9, "guest_11"),
			config: { ...makeDefaultConfig("bestof"), players: 16 },
		},
		{
			id: "ZM1K",
			name: "One Card Masters",
			host: "daniel",
			status: "finished",
			createdAt: daysFromNow(-20),
			participants: mockParticipants(32, "daniel"),
			results: ["daniel", "player_19", "player_7"],
			config: { ...makeDefaultConfig("knockout"), players: 32 },
		},
	]
}

// TODO backend: replace with a real GET /tournaments/:id.
export function mockTournament(id) {
	return (
		mockTournaments().find((t) => t.id === id) ?? {
			id,
			name: `Tournament ${id}`,
			host: "daniel",
			status: "pending",
			createdAt: new Date().toISOString(),
			participants: mockParticipants(1, "daniel"),
			config: makeDefaultConfig("knockout"),
		}
	)
}

// Turns a config's house rules into "Stacking draw cards · Zero rotate" style
// chips. The flags sit flat on the config, so this takes the whole object —
// exactly like enabledRuleLabels() in lib/rooms.js.
export function enabledHouseRuleLabels(config = {}) {
	return HOUSE_RULE_TOGGLES.filter((r) => config[r.key]).map((r) => r.label)
}
