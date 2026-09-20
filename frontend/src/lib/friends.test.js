import { describe, expect, it } from "vitest"
import { groupFriendships } from "./friends.js"

const ME = "me-id"
const me = { public_id: ME, username: "me" }
const other = (username) => ({ public_id: `${username}-id`, username })

const row = (id, status, requester, addressee) => ({ id, status, requester, addressee })

describe("groupFriendships", () => {
	it("sorts each row by its status and by which side I am on", () => {
		const rows = [
			row(1, "accepted", me, other("ana")),
			row(2, "accepted", other("bruno"), me),
			row(3, "pending", other("carla"), me),
			row(4, "pending", me, other("diogo")),
			row(5, "blocked", me, other("edu")),
		]

		const { incoming, friends, sent, blocked } = groupFriendships(rows, ME)

		expect(friends.map((f) => f.person.username)).toEqual(["ana", "bruno"])
		expect(incoming.map((f) => f.person.username)).toEqual(["carla"])
		expect(sent.map((f) => f.person.username)).toEqual(["diogo"])
		expect(blocked.map((f) => f.person.username)).toEqual(["edu"])
	})

	// Only the person who blocked can see it: the blocked side must not find out.
	it("hides a block someone else put on me", () => {
		const rows = [row(1, "blocked", other("fabio"), me)]
		const groups = groupFriendships(rows, ME)
		expect(groups).toEqual({ incoming: [], friends: [], sent: [], blocked: [] })
	})

	it("hides declined rows from both sides", () => {
		const rows = [row(1, "declined", me, other("gil")), row(2, "declined", other("hugo"), me)]
		const groups = groupFriendships(rows, ME)
		expect(groups).toEqual({ incoming: [], friends: [], sent: [], blocked: [] })
	})

	it("keeps the friendship id, which every action needs", () => {
		const [entry] = groupFriendships([row(42, "accepted", me, other("ana"))], ME).friends
		expect(entry.id).toBe(42)
		expect(entry.person.username).toBe("ana")
	})

	it("survives no rows at all", () => {
		expect(groupFriendships(undefined, ME)).toEqual({ incoming: [], friends: [], sent: [], blocked: [] })
		expect(groupFriendships([], ME)).toEqual({ incoming: [], friends: [], sent: [], blocked: [] })
	})
})
