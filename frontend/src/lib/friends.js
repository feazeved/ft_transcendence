import api from "./api.js"

// Every friendship call in one place: a page never knows a URL.
export function listFriendships() {
	return api.get("/friendships/")
}

export function sendRequest(username) {
	return api.post("/friendships/", { username })
}

export function acceptRequest(id) {
	return api.post(`/friendships/${id}/accept/`)
}

export function declineRequest(id) {
	return api.post(`/friendships/${id}/decline/`)
}

// Remove a friend, cancel a request you sent and unblock someone are all the
// same DELETE — the row goes away and the two of you are strangers again.
export function removeFriendship(id) {
	return api.delete(`/friendships/${id}/`)
}

export function blockUser(username) {
	return api.post("/friendships/block/", { username })
}

// Pure: rows in, four lists out. The rule for each row is "who is the other
// person, and which side of it am I on":
//
//   pending + I received it  → incoming     accepted            → friends
//   pending + I sent it      → sent         blocked + I blocked → blocked
//
// A row where someone blocked me, and a declined one, belong in no list: they
// are hidden from both sides.
export function groupFriendships(rows, myPublicId) {
	const incoming = []
	const friends = []
	const sent = []
	const blocked = []

	for (const row of rows ?? []) {
		const iAmRequester = row.requester?.public_id === myPublicId
		const person = iAmRequester ? row.addressee : row.requester
		if (!person) continue

		const entry = { id: row.id, person }
		if (row.status === "accepted") friends.push(entry)
		else if (row.status === "pending") (iAmRequester ? sent : incoming).push(entry)
		else if (row.status === "blocked" && iAmRequester) blocked.push(entry)
	}

	return { incoming, friends, sent, blocked }
}
