import { api } from "./api.js"

// The tournament API, and the few pure helpers the tournament screens share.
//
// This file used to *be* the tournaments: an in-memory store that seeded itself
// and answered every call from module state, standing in while the backend had
// no table shape, no settings columns, no short code and nothing writing
// `final_position`. All of that landed with §5, so the store is gone and the six
// functions below are the one-line `api` calls it was always going to become.
//
// They stayed `async` throughout precisely so this swap would touch this file
// and nothing else — the pages were written against a server from the first day.

export const STATUS_LABELS = {
	pending: "Upcoming",
	in_progress: "In progress",
	finished: "Finished",
	cancelled: "Canceled",
}

// Text colours, as theme tokens rather than the design's raw hexes: the design's
// #6f6f6f/#ffffff80 for a finished tournament misses WCAG AA at this size, and
// `muted` (#808080) is the darkest gray that passes on a panel (spec.md).
export const STATUS_COLORS = {
	pending: "text-blue-soft",
	in_progress: "text-green-soft",
	finished: "text-muted",
	cancelled: "text-red-soft",
}

// The stripe along the top of a card. Full-strength colours, not the `-soft`
// ones: a border only has to reach 3:1.
export const STATUS_ACCENTS = {
	pending: "border-t-blue",
	in_progress: "border-t-green",
	finished: "border-t-line-strong",
	cancelled: "border-t-red",
}

export function formatDate(iso) {
	return new Date(iso).toLocaleDateString("en-GB", {
		day: "2-digit",
		month: "short",
		year: "numeric",
	})
}

// How many places the podium shows. The design's Final results panel has three.
const PODIUM_PLACES = 3

// 1st, 2nd and 3rd, worked out from `final_position` — the field
// `TournamentParticipant` already has for it, rather than a separate list of
// names that could disagree with the roster. Pure, so `FinalResults.jsx` only
// has to draw what comes back.
export function finalStandings(tournament) {
	return (tournament?.participants ?? [])
		.filter((entry) => Number.isFinite(entry.final_position))
		.sort((a, b) => a.final_position - b.final_position)
		.slice(0, PODIUM_PLACES)
}

// Whether this person is signed up. Pure, and read from the roster rather than
// kept as a flag, so it cannot disagree with the chips drawn beside it.
export function isEntered(tournament, username) {
	if (!username) return false
	return (tournament?.participants ?? []).some((entry) => entry.user.username === username)
}


// --- the API -----------------------------------------------------------------
//
// A tournament is addressed by its short code — `id` in every payload — because
// that is what the badge shows and what `/tournament/:id` carries. `public_id`
// is still accepted by the server for links made before the code existed.

export function listTournaments() {
	return api.get("/tournaments/")
}

export function getTournament(id) {
	return api.get(`/tournaments/${id}/`)
}

// The config's keys are already the backend's field names, so it goes over
// unchanged — the rule `rooms.js` follows too.
export function createTournament(config) {
	return api.post("/tournaments/", config)
}

// All three answer with the whole fresh tournament, so the detail page replaces
// what is on screen instead of patching a second copy of the roster into step.
export function joinTournament(id) {
	return api.post(`/tournaments/${id}/register/`, {})
}

export function leaveTournament(id) {
	return api.post(`/tournaments/${id}/unregister/`, {})
}

export function startTournament(id) {
	return api.post(`/tournaments/${id}/start/`, {})
}

export function liveMatchId(tournament, publicId) {
	if (!publicId) return null

	for (const round of tournament?.rounds ?? []) {
		for (const match of round.matches) {
			if (match.status !== "pending" && match.status !== "in_progress") continue
			if (match.players.some((player) => player.user?.public_id === publicId)) return match.public_id
		}
	}

	return null
}
