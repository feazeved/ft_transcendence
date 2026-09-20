import api from "./api.js"

// Somebody else's profile: who they are, their record, and the games behind it.
// The three endpoints already existed; `MatchHistoryView` had no caller at all.

export function getPublicProfile(publicId) {
	return api.get(`/users/${publicId}/`)
}

export function getUserStats(publicId) {
	return api.get(`/users/${publicId}/stats/`)
}

// Paginated: the answer is `{ count, next, previous, results }`.
export function getMatchHistory(publicId, { page = 1, pageSize = 10 } = {}) {
	const query = new URLSearchParams({ page, page_size: pageSize })
	return api.get(`/users/${publicId}/matches/?${query}`)
}

// Everybody at that table except the person whose history this is.
export function opponentsOf(match, publicId) {
	return (match?.players ?? []).filter((player) => player.user?.public_id !== publicId)
}

// `won` comes from the server. A finished game can still have no winner at all
// — everybody left — and calling that a loss would be a lie.
export function matchOutcome(match) {
	if (!match?.winner) return { label: "No result", color: "text-muted" }
	return match.won ? { label: "Won", color: "text-green-soft" } : { label: "Lost", color: "text-red-soft" }
}

// "03 Mar 2026". Never throws on a date the server did not send.
export function formatDay(iso) {
	if (!iso) return ""
	const when = new Date(iso)
	if (Number.isNaN(when.getTime())) return ""
	return when.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
}

// The same, with the clock: two games on one evening have to be tellable apart.
export function formatPlayedAt(iso) {
	const day = formatDay(iso)
	if (!day) return ""
	const time = new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false })
	return `${day} · ${time}`
}
