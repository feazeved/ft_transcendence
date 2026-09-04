import { RULE_TOGGLES } from "./rooms.js"
import { makeDefaultConfig } from "./tournamentStructure.js"

export const HOUSE_RULE_TOGGLES = RULE_TOGGLES.filter((r) => r.key !== "spectate")

export const STATUS_LABELS = {
	scheduled: "Upcoming",
	ongoing: "In progress",
	finished: "Finished",
}

export const STATUS_COLORS = {
	scheduled: "text-blue",
	ongoing: "text-green",
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
		status: "scheduled",
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
			status: "scheduled",
			createdAt: daysFromNow(3),
			participants: mockParticipants(14, "daniel"),
			config: { ...makeDefaultConfig("knockout"), players: 20 },
		},
		{
			id: "3FPQ",
			name: "Casual ONE League",
			host: "feazeved",
			status: "ongoing",
			createdAt: daysFromNow(-2),
			participants: mockParticipants(12, "feazeved"),
			config: {
				...makeDefaultConfig("bestof"),
				players: 12,
				playersPerTable: 4,
				advancePerTable: 1,
				matchesPerRound: 5,
			},
		},
		{
			id: "WKWM",
			name: "Weekend Warmup",
			host: "guesttt",
			status: "ongoing",
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
				players: 8,
				playersPerTable: 4,
				advancePerTable: 2,
				finalBestOf3: false,
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
				matchesPerRound: 3,
				matchesInFinal: 7,
			},
		},
		{
			id: "L4TN",
			name: "Mega Tournament",
			host: "lucas",
			status: "scheduled",
			createdAt: daysFromNow(7),
			participants: mockParticipants(40, "lucas"),
			config: { ...makeDefaultConfig("knockout"), players: 64 },
		},
		{
			id: "RB7M",
			name: "Friends Cup",
			host: "guest_11",
			status: "scheduled",
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
			status: "scheduled",
			createdAt: new Date().toISOString(),
			participants: mockParticipants(1, "daniel"),
			config: makeDefaultConfig("knockout"),
		}
	)
}

// Turns a tournament's houseRules into "Stacking draw cards · Zero rotate"
// style chips, mirroring enabledRuleLabels in lib/rooms.js.
export function enabledHouseRuleLabels(houseRules = {}) {
	return HOUSE_RULE_TOGGLES.filter((r) => houseRules[r.key]).map((r) => r.label)
}
