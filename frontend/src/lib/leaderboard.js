import api from "./api.js"

// Home's Top 5 (area 02) calls this too, with pageSize: 5.
export function getLeaderboard({ page = 1, pageSize = 25, ordering = "wins" } = {}) {
	const query = new URLSearchParams({ page, page_size: pageSize, ordering })
	// `LeaderboardView` sorts over the whole table, not over the page.
	return api.get(`/leaderboard/?${query}`)
}

// Pure: which page buttons to draw. Always the first page, the last one, the
// current one and its neighbours; everything skipped becomes one "gap".
//
//   pageItems(6, 12) → [1, "gap", 5, 6, 7, "gap", 12]
export function pageItems(page, totalPages) {
	const items = []
	for (let i = 1; i <= totalPages; i++) {
		if (i === 1 || i === totalPages || Math.abs(i - page) <= 1) items.push(i)
		else if (items[items.length - 1] !== "gap") items.push("gap")
	}
	return items
}
