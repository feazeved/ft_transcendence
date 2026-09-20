import { describe, expect, it } from "vitest"
import {
	alreadyInvited,
	awaitingFirstMessage,
	canJoinInvite,
	chatRows,
	emptyChat,
	inviteAction,
	inviteRoomCode,
	inviteText,
	isInvite,
	isLastMessageRead,
	lastOwnMessageId,
	markRead,
	openThread,
	receiveMessage,
	showsChatDock,
	threadsFromConversations,
	totalUnread,
	withHistory,
	withNotice,
	withoutNotice,
	withoutTab,
	withTab,
} from "./chat.js"

const ME = "me-uuid"

const person = (username, overrides = {}) => ({
	public_id: `${username}-uuid`,
	username,
	display_name: "",
	avatar_url: `/profile/${username}.jpg`,
	is_online: false,
	...overrides,
})

const message = (overrides = {}) => ({
	id: 1,
	conversation_id: 7,
	user: person("ines"),
	message_type: "text",
	body: "table is open, come sit",
	invited_game: null,
	created_at: "2026-09-18T20:51:00Z",
	...overrides,
})

describe("receiveMessage", () => {
	// The first message of a conversation arrives with a conversation_id nobody
	// has seen before: the sender is who it belongs to.
	it("files an incoming message under the person who sent it", () => {
		const state = receiveMessage(emptyChat(), message(), { myPublicId: ME, openWith: null })

		expect(state.threads.ines.conversationId).toBe(7)
		expect(state.threads.ines.messages.map((m) => m.body)).toEqual(["table is open, come sit"])
	})

	// The wire names the sender and never the recipient, so my own first message
	// to somebody can only be placed by remembering who I sent it to.
	it("files my own first message under the person I sent it to", () => {
		const waiting = awaitingFirstMessage(emptyChat(), "ines")
		const state = receiveMessage(waiting, message({ user: person("me") }), {
			myPublicId: "me-uuid",
			openWith: "ines",
		})

		expect(state.threads.ines.conversationId).toBe(7)
		expect(state.threads.ines.messages).toHaveLength(1)
		expect(state.awaiting).toBeNull()
	})

	it("drops a message it cannot place", () => {
		const state = receiveMessage(emptyChat(), message({ user: person("me") }), { myPublicId: "me-uuid" })

		expect(state.threads).toEqual({})
	})

	it("counts an unread only for the other person's messages, and not in the open thread", () => {
		let state = receiveMessage(emptyChat(), message({ id: 1 }), { myPublicId: ME, openWith: null })
		state = receiveMessage(state, message({ id: 2 }), { myPublicId: ME, openWith: "ines" })
		state = receiveMessage(state, message({ id: 3, user: person("me") }), { myPublicId: "me-uuid" })

		expect(state.threads.ines.unread).toBe(1)
		expect(state.threads.ines.messages).toHaveLength(3)
	})

	// A reconnect replays; the server also echoes my own send back to me. Neither
	// may show the same line twice.
	it("ignores a message it already has", () => {
		const once = receiveMessage(emptyChat(), message({ id: 5 }), { myPublicId: ME })
		const twice = receiveMessage(once, message({ id: 5 }), { myPublicId: ME })

		expect(twice.threads.ines.messages).toHaveLength(1)
		expect(twice.threads.ines.unread).toBe(1)
	})
})

const conversation = (overrides = {}) => ({
	id: 7,
	other_participant: person("ines"),
	last_message: message(),
	unread_count: 2,
	created_at: "2026-09-18T20:00:00Z",
	...overrides,
})

describe("threadsFromConversations", () => {
	// The unread count is the server's answer, not a tally the browser keeps: it
	// is what makes a badge survive a reload.
	it("keys the server's conversations by the other person, with their unread count", () => {
		const threads = threadsFromConversations([conversation()])

		expect(threads.ines.conversationId).toBe(7)
		expect(threads.ines.unread).toBe(2)
		expect(threads.ines.messages.map((m) => m.id)).toEqual([1])
		expect(threads.ines.loaded).toBe(false)
	})

	it("keeps a conversation that has no message yet", () => {
		const threads = threadsFromConversations([conversation({ last_message: null, unread_count: 0 })])

		expect(threads.ines.messages).toEqual([])
	})
})

describe("totalUnread", () => {
	it("adds up every thread", () => {
		const threads = threadsFromConversations([
			conversation(),
			conversation({ id: 8, other_participant: person("daniel"), unread_count: 3 }),
		])

		expect(totalUnread(threads)).toBe(5)
	})

	it("is zero with nothing waiting", () => {
		expect(totalUnread({})).toBe(0)
	})
})

describe("withHistory", () => {
	// The API hands back the newest first, one page at a time; the screen reads
	// oldest at the top.
	it("puts the fetched page in the order it is read, oldest first", () => {
		const state = withHistory(emptyChat(), "ines", [
			message({ id: 3, created_at: "2026-09-18T20:53:00Z" }),
			message({ id: 2, created_at: "2026-09-18T20:52:00Z" }),
		])

		expect(state.threads.ines.messages.map((m) => m.id)).toEqual([2, 3])
		expect(state.threads.ines.loaded).toBe(true)
	})

	// A message can land over the socket while the page is still in flight.
	it("keeps a message that arrived while the page was loading", () => {
		let state = receiveMessage(emptyChat(), message({ id: 9, created_at: "2026-09-18T21:00:00Z" }), {
			myPublicId: ME,
		})
		state = withHistory(state, "ines", [message({ id: 2, created_at: "2026-09-18T20:52:00Z" })])

		expect(state.threads.ines.messages.map((m) => m.id)).toEqual([2, 9])
	})
})

describe("openThread", () => {
	it("clears that person's unread and leaves the others alone", () => {
		const state = { threads: threadsFromConversations([
			conversation(),
			conversation({ id: 8, other_participant: person("daniel"), unread_count: 3 }),
		]), awaiting: null }

		const opened = openThread(state, "ines")

		expect(opened.threads.ines.unread).toBe(0)
		expect(opened.threads.daniel.unread).toBe(3)
	})

	it("opens a person with no conversation at all", () => {
		const opened = openThread(emptyChat(), "skipmaster")

		expect(opened.threads.skipmaster).toEqual({
			conversationId: null,
			messages: [],
			unread: 0,
			loaded: false,
			readUpTo: null,
		})
	})
})

describe("chatRows", () => {
	const friends = [person("daniel", { display_name: "Daniel F." }), person("skipmaster")]

	// GET /api/conversations/ only knows about people you have already written to,
	// but the design wants every friend in the list. The two have to be merged.
	it("gives a friend a row even with no conversation behind it", () => {
		const rows = chatRows({ friends, threads: {}, myPublicId: ME })

		expect(rows.map((r) => r.username)).toEqual(["daniel", "skipmaster"])
		expect(rows[0]).toMatchObject({ name: "Daniel F.", conversationId: null, unread: 0 })
	})

	// The other direction: somebody you talked to and then unfriended still has
	// their messages, and hiding the row would hide them for good.
	it("keeps a conversation with somebody who is not a friend", () => {
		const threads = threadsFromConversations([conversation()])
		const rows = chatRows({ friends, threads, myPublicId: ME })

		expect(rows.map((r) => r.username)).toContain("ines")
	})

	it("shows the last message as the preview, and marks my own", () => {
		const threads = threadsFromConversations([
			conversation(),
			conversation({
				id: 8,
				other_participant: person("daniel"),
				last_message: message({ id: 4, conversation_id: 8, user: person("me"), body: "give me five" }),
			}),
		])
		const rows = chatRows({ friends, threads, myPublicId: "me-uuid" })
		const by = Object.fromEntries(rows.map((r) => [r.username, r]))

		expect(by.ines.preview).toBe("table is open, come sit")
		expect(by.daniel.preview).toBe("You: give me five")
	})

	// With nothing said yet there is no preview to show, so the row falls back to
	// where the person is.
	it("falls back to the presence label when nothing has been said", () => {
		const presence = { daniel: { status: "online", room_code: null } }
		const rows = chatRows({ friends, threads: {}, presence, myPublicId: ME })
		const by = Object.fromEntries(rows.map((r) => [r.username, r]))

		expect(by.daniel).toMatchObject({ online: true, preview: "Online" })
		expect(by.skipmaster).toMatchObject({ online: false, preview: "Offline" })
	})

	it("says where someone is, with the room code", () => {
		const presence = { daniel: { status: "lobby", room_code: "9QTB" } }
		const rows = chatRows({ friends, threads: {}, presence, myPublicId: ME })

		expect(rows.find((r) => r.username === "daniel")).toMatchObject({
			online: true,
			preview: "In a lobby · 9QTB",
		})
	})

	it("counts being in a game as being online", () => {
		const presence = { daniel: { status: "game", room_code: "7F2K" } }
		const rows = chatRows({ friends, threads: {}, presence, myPublicId: ME })

		expect(rows.find((r) => r.username === "daniel")).toMatchObject({
			online: true,
			preview: "In a game · 7F2K",
		})
	})

	it("uses the presence that came down with the friends list when no frame has arrived", () => {
		const loaded = [person("daniel", { is_online: true, presence: { status: "game", room_code: "ABCD" } })]
		const rows = chatRows({ friends: loaded, threads: {}, myPublicId: ME })

		expect(rows[0].preview).toBe("In a game · ABCD")
	})

	// A presence frame is newer than the `is_online` the friends list was loaded with.
	it("lets a live presence frame beat the loaded is_online", () => {
		const loaded = [person("daniel", { is_online: true })]
		const presence = { daniel: { status: "offline", room_code: null } }
		const rows = chatRows({ friends: loaded, threads: {}, presence, myPublicId: ME })

		expect(rows[0].online).toBe(false)
	})

	it("puts the newest conversation first and the untouched friends after it", () => {
		const threads = threadsFromConversations([
			conversation({ id: 8, other_participant: person("daniel"), last_message: message({ id: 4, created_at: "2026-09-18T21:10:00Z" }) }),
			conversation(),
		])
		const rows = chatRows({ friends, threads, myPublicId: ME })

		expect(rows.map((r) => r.username)).toEqual(["daniel", "ines", "skipmaster"])
	})
})

const invite = (overrides = {}) =>
	message({
		id: 20,
		message_type: "game_invite",
		body: "",
		invited_game: { public_id: "game-uuid", join_code: "9QTB", status: "pending" },
		...overrides,
	})

describe("invites", () => {
	it("reads the room code off the invited game", () => {
		expect(isInvite(invite())).toBe(true)
		expect(isInvite(message())).toBe(false)
		expect(inviteRoomCode(invite())).toBe("9QTB")
	})

	// The room code is what a person types and shares; `public_id` is the UUID the
	// socket wants. A join link must never carry the UUID.
	it("has no code when the game is gone", () => {
		expect(inviteRoomCode(invite({ invited_game: null }))).toBe("")
	})

	// One message, two readings. The server stores no body for an invite, so the
	// line is written here — and it has to read correctly from both ends.
	it("writes the invite line for each side", () => {
		expect(inviteText(invite(), { mine: false, otherName: "Inês P." })).toBe("Inês P. invited you to play")
		expect(inviteText(invite(), { mine: true, otherName: "Inês P." })).toBe(
			"You invited Inês P. to room 9QTB",
		)
	})

	it("offers Join only to the person who was invited", () => {
		expect(canJoinInvite(invite(), false)).toBe(true)
		expect(canJoinInvite(invite(), true)).toBe(false)
		expect(canJoinInvite(message(), false)).toBe(false)
	})

	it("knows when I already invited this person to this room", () => {
		const sent = [invite({ user: person("me") })]

		expect(alreadyInvited(sent, { myPublicId: "me-uuid", roomCode: "9QTB" })).toBe(true)
		expect(alreadyInvited(sent, { myPublicId: "me-uuid", roomCode: "K3MP" })).toBe(false)
		expect(alreadyInvited([invite()], { myPublicId: "me-uuid", roomCode: "9QTB" })).toBe(false)
	})
})

describe("inviteAction", () => {
	it("explains itself instead of showing a button outside a room", () => {
		expect(inviteAction({ inRoom: false, online: true, joinable: true })).toEqual({
			show: false,
			disabled: false,
			label: "Invite to Play",
			note: "JOIN A ROOM TO INVITE FRIENDS",
		})
	})

	// `is_online` is 5 minutes since `last_seen_at`, and nothing writes that but a
	// presence connect or disconnect — so a friend with the app open all evening
	// reports offline. The server does not require the recipient to be online, so
	// the note is a warning, not a gate: blocking here would break the invite for
	// somebody who is sitting in a lobby right now.
	it("still offers the invite to a friend who looks offline, and says so", () => {
		expect(inviteAction({ inRoom: true, online: false, joinable: true })).toMatchObject({
			show: true,
			disabled: false,
			note: "THIS FRIEND IS OFFLINE",
		})
	})

	// The server refuses an invite to a game that is not PENDING, so the button is
	// never live to be pressed into that error.
	it("disables the button once the game is over", () => {
		// A game merely under way is still somewhere to invite people to: a room
		// outlives its game and the server takes the invite. Only a finished
		// room is nowhere worth being sent.
		expect(inviteAction({ inRoom: true, online: true, joinable: false })).toMatchObject({
			show: true,
			disabled: true,
			note: "THIS GAME IS OVER",
		})
	})

	it("still invites from a table with a game running", () => {
		expect(inviteAction({ inRoom: true, online: true, joinable: true })).toMatchObject({
			show: true,
			disabled: false,
			label: "Invite to Play",
		})
	})

	it("offers the invite, once", () => {
		expect(inviteAction({ inRoom: true, online: true, joinable: true })).toMatchObject({
			show: true,
			disabled: false,
			label: "Invite to Play",
			note: "",
		})
		expect(inviteAction({ inRoom: true, online: true, joinable: true, invited: true })).toMatchObject({
			show: true,
			disabled: true,
			label: "Invited",
		})
	})
})

describe("showsChatDock", () => {
	// The dock belongs to the signed-in game: the pages you can read while signed
	// out have no business carrying it.
	it("is on the eight pages that have it", () => {
		for (const path of ["/", "/friends", "/leaderboard", "/profile", "/tournament", "/tournament/abc"]) {
			expect(showsChatDock(path)).toBe(true)
		}
	})

	it("is not on login, register, the legal pages or a wrong URL", () => {
		for (const path of ["/login", "/register", "/privacy-policy", "/terms-of-service", "/nope", "/tournament/abc/extra"]) {
			expect(showsChatDock(path)).toBe(false)
		}
	})

	// The room draws its own frame outside Layout, so it hangs the dock itself.
	it("leaves the room to hang its own", () => {
		expect(showsChatDock("/room/7F2K")).toBe(false)
	})
})

describe("tabs", () => {
	it("adds a minimised person once, keeping the order they were minimised in", () => {
		expect(withTab(["daniel"], "ines")).toEqual(["daniel", "ines"])
		expect(withTab(["daniel", "ines"], "daniel")).toEqual(["daniel", "ines"])
	})

	it("takes a person back out when their thread opens or closes", () => {
		expect(withoutTab(["daniel", "ines"], "daniel")).toEqual(["ines"])
		expect(withoutTab([], "daniel")).toEqual([])
	})
})

describe("read receipts", () => {
	// One of theirs, then one of mine: the shape a receipt is about.
	const conversation = () => {
		let state = receiveMessage(emptyChat(), message({ id: 1 }), { myPublicId: ME, openWith: "ines" })
		return receiveMessage(state, message({ id: 2, user: person("me", { public_id: ME }) }), {
			myPublicId: ME,
			openWith: "ines",
		})
	}

	it("says nothing until a receipt arrives", () => {
		expect(isLastMessageRead(conversation().threads.ines, ME)).toBe(false)
	})

	it("marks my last line read when they open the thread", () => {
		const state = markRead(conversation(), 7)
		expect(state.threads.ines.readUpTo).toBe(2)
		expect(isLastMessageRead(state.threads.ines, ME)).toBe(true)
	})

	// The receipt covered what was there when it landed, and nothing after it.
	it("does not cover a message sent after the receipt", () => {
		let state = markRead(conversation(), 7)
		state = receiveMessage(state, message({ id: 3, user: person("me", { public_id: ME }) }), {
			myPublicId: ME,
			openWith: "ines",
		})
		expect(isLastMessageRead(state.threads.ines, ME)).toBe(false)
	})

	it("is about my last line, not theirs", () => {
		const state = markRead(conversation(), 7)
		expect(lastOwnMessageId(state.threads.ines, ME)).toBe(2)
		expect(lastOwnMessageId(state.threads.ines, "nobody")).toBeNull()
	})

	it("leaves a conversation it cannot find alone", () => {
		const state = conversation()
		expect(markRead(state, 999)).toBe(state)
	})

	it("has nothing to mark in an empty thread", () => {
		const empty = { ...emptyChat(), threads: { ines: { conversationId: 7, messages: [], readUpTo: null } } }
		expect(markRead(empty, 7)).toBe(empty)
		expect(isLastMessageRead(empty.threads.ines, ME)).toBe(false)
	})
})

describe("dock notices", () => {
	const match = (round = 1) => ({
		kind: "tournament_match",
		tournament: "8K2P",
		tournament_name: "Friday Cup",
		round,
		room_code: "9QTB",
		game_id: "uuid-1",
	})

	// The dedupe is the one that matters: two frames for one table would stack
	// two identical cards over the launcher.
	it("keeps a notice once, and a later round apart from it", () => {
		const once = withNotice([], match())
		expect(once).toHaveLength(1)
		expect(withNotice(once, match())).toBe(once)
		expect(withNotice(once, match(2))).toHaveLength(2)
	})

	it("holds three at most, and drops the one dismissed", () => {
		let notices = []
		for (const round of [1, 2, 3, 4]) notices = withNotice(notices, match(round))
		expect(notices.map((notice) => notice.round)).toEqual([2, 3, 4])
		expect(withoutNotice(notices, notices[0].id)).toHaveLength(2)
	})
})
