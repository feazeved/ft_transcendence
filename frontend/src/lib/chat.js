// Everything the chat dock knows, in one place: the shape of a thread, the pure
// rules that move messages around, and the handful of calls that talk to the
// server. A component never builds a URL and never reasons about the wire.

import api from "./api.js"
import { openSocket } from "./socket.js"

// The server refuses an empty body and anything past 500 characters
// (`ChatConsumer._handle_send_message`). Both composers stop at the same number,
// so neither rule is ever reached.
export const MAX_MESSAGE_LENGTH = 500

// A thread is keyed by the other person's **username**, not by conversation id.
// The reason is the backend: a Conversation row only exists once somebody has
// sent a message, so a friend you have never written to has no id at all. The
// username is the one name for a person that exists before, during and after a
// conversation, so it is what the dock indexes by.
//
//   thread = { conversationId: number | null, messages: [], unread: number, loaded: boolean }
//   state  = { threads: { [username]: thread }, awaiting: string | null }
//
// `awaiting` is the username whose very first message we just sent. See
// receiveMessage for why it has to exist.

export function emptyThread() {
	// `readUpTo`: the last message the other side has said they read. Null until
	// a receipt lands — "not read" is a claim we have no right to make.
	return { conversationId: null, messages: [], unread: 0, loaded: false, readUpTo: null }
}

export function emptyChat() {
	return { threads: {}, awaiting: null }
}

// Oldest first, which is the order the screen reads. The API answers newest
// first (`order_by("-created_at")`), so every list that comes off it turns round
// here rather than in four different components.
export function sortMessages(messages = []) {
	return [...messages].sort((a, b) => {
		const byTime = String(a.created_at ?? "").localeCompare(String(b.created_at ?? ""))
		return byTime !== 0 ? byTime : (a.id ?? 0) - (b.id ?? 0)
	})
}

// GET /api/conversations/ turned into threads. `unread_count` is worked out
// server-side from the read receipt, which is exactly why a badge is still there
// after a reload: the browser is not keeping the tally.
export function threadsFromConversations(conversations = []) {
	const threads = {}
	for (const conversation of conversations) {
		const username = conversation?.other_participant?.username
		if (!username) continue
		threads[username] = {
			// Kept so the list can draw a row for somebody who is not (or is no
			// longer) a friend: nothing else on the page knows their name or photo.
			person: conversation.other_participant,
			conversationId: conversation.id,
			// The list hands over the last message with each row, so a preview is
			// on screen before anybody opens anything.
			messages: conversation.last_message ? [conversation.last_message] : [],
			unread: conversation.unread_count ?? 0,
			loaded: false,
			// Receipts are live, so a reload starts again from "they have not said".
			readUpTo: null,
		}
	}
	return threads
}

export function totalUnread(threads = {}) {
	return Object.values(threads).reduce((sum, thread) => sum + (thread.unread ?? 0), 0)
}

// A fetched page of history, merged with whatever the socket already delivered.
// Merged and not replaced: a message can land while the request is in flight, and
// it would be lost by an assignment.
export function withHistory(state, username, messages = []) {
	const thread = state.threads[username] ?? emptyThread()
	const seen = new Set(messages.map((m) => m.id))
	const merged = sortMessages([...messages, ...thread.messages.filter((m) => !seen.has(m.id))])

	return {
		...state,
		threads: { ...state.threads, [username]: { ...thread, messages: merged, loaded: true } },
	}
}

// The other side has read this conversation. A receipt means "everything up to
// now", so what is recorded is the last message in the thread when it lands —
// the message, not the clock: ids only go up, browsers disagree on the time.
export function markRead(state, conversationId) {
	const username = Object.keys(state.threads).find(
		(name) => state.threads[name].conversationId === conversationId,
	)
	if (!username) return state

	const thread = state.threads[username]
	const last = thread.messages[thread.messages.length - 1]
	if (!last) return state

	return { ...state, threads: { ...state.threads, [username]: { ...thread, readUpTo: last.id } } }
}

// The id of my last line in this thread, or null. Only that one carries the
// receipt: "read" covers everything before it.
export function lastOwnMessageId(thread, myPublicId) {
	const messages = thread?.messages ?? []
	for (let i = messages.length - 1; i >= 0; i--) {
		if (messages[i]?.user?.public_id === myPublicId) return messages[i].id
	}
	return null
}

export function isLastMessageRead(thread, myPublicId) {
	const mine = lastOwnMessageId(thread, myPublicId)
	if (mine === null || thread?.readUpTo == null) return false
	return mine <= thread.readUpTo
}

// A dock notice: the tournament saying where to be next, or that it is over.
export const MAX_NOTICES = 3

// Built from the notice, so the same one twice is still one notice.
function noticeId(notice) {
	return [notice.kind, notice.tournament, notice.round ?? "", notice.room_code ?? ""].join(":")
}

export function withNotice(notices = [], notice) {
	const id = noticeId(notice)
	if (notices.some((shown) => shown.id === id)) return notices
	return [...notices, { ...notice, id }].slice(-MAX_NOTICES)
}

export function withoutNotice(notices = [], id) {
	return notices.filter((notice) => notice.id !== id)
}

// Opening a thread is what clears its badge. The provider sends `mark_read`
// alongside, so the server agrees and the badge stays cleared after a reload.
export function openThread(state, username) {
	const thread = state.threads[username] ?? emptyThread()
	return { ...state, threads: { ...state.threads, [username]: { ...thread, unread: 0 } } }
}

// Called just before sending the first message to somebody: it is the only note
// we will have of who that message was for when it comes back.
export function awaitingFirstMessage(state, username) {
	return { ...state, awaiting: username }
}

// Which thread does an arriving message belong to?
//
// Three ways to answer, in order:
//  1. its conversation_id is one we already know — easy;
//  2. somebody else sent it, so the sender IS the other person;
//  3. I sent it and the conversation is brand new, so the only thing that can
//     say who it was for is what we remembered when we sent it (`awaiting`).
//
// Case 3 is not a corner case: it happens on the first message to every friend,
// because the payload names the sender and never the recipient.
export function receiveMessage(state, message, { myPublicId, openWith } = {}) {
	const mine = message?.user?.public_id === myPublicId
	const known = Object.keys(state.threads).find(
		(username) => state.threads[username].conversationId === message?.conversation_id,
	)
	const username = known ?? (mine ? state.awaiting : message?.user?.username)
	if (!username) return state

	const thread = state.threads[username] ?? emptyThread()
	// The server echoes my own send back to me, and a reconnect replays what we
	// already have, so the id is the last word on whether this line is news.
	if (thread.messages.some((seen) => seen.id === message.id)) return state

	return {
		...state,
		awaiting: username === state.awaiting ? null : state.awaiting,
		threads: {
			...state.threads,
			[username]: {
				...thread,
				person: thread.person ?? (mine ? undefined : message.user),
				conversationId: message.conversation_id ?? thread.conversationId,
				messages: [...thread.messages, message],
				unread: thread.unread + (!mine && username !== openWith ? 1 : 0),
			},
		},
	}
}

// --- the CHATS list ------------------------------------------------------

// Presence has four states in the design — Offline, Online, In a lobby and In a
// game — and since §7.1 the server sends all four, with the room code on the two
// that have one: "In a lobby · 9QTB".
//
// Takes the whole presence object rather than a boolean, because the room code is
// half the answer. An unknown status reads as Online rather than as itself: a
// server that grew a fifth state should look ordinary here, not leak a raw enum
// into the interface.
const PRESENCE_LABELS = {
	offline: "Offline",
	online: "Online",
	lobby: "In a lobby",
	game: "In a game",
}

export function presenceLabel(presence) {
	// A bare boolean is still accepted: plenty of callers only know yes or no.
	if (typeof presence === "boolean") return presence ? "Online" : "Offline"

	const status = presence?.status ?? "offline"
	const label = PRESENCE_LABELS[status] ?? "Online"
	return presence?.room_code ? `${label} · ${presence.room_code}` : label
}

// The accent a row's status line is painted in. Being somewhere is worth more
// than being merely present, so a lobby and a game each get their own.
const PRESENCE_COLORS = {
	offline: "text-muted",
	online: "text-green-soft",
	lobby: "text-blue-soft",
	game: "text-yellow",
}

export function presenceColor(presence) {
	return PRESENCE_COLORS[presence?.status] ?? "text-muted"
}

// The one line under a name in the list. An invite carries no body of its own,
// so it is described rather than quoted.
export function messagePreview(message, mine) {
	const text = isInvite(message) ? `Invite · room ${inviteRoomCode(message) || "?"}` : message?.body || ""
	return mine ? `You: ${text}` : text
}

// One row per person for the CHATS list, and the piece of this area worth
// understanding.
//
// The server's conversation list is not the list the design asks for. A
// Conversation row is only created by the first message (`Conversation.between`
// runs inside the consumer), so `GET /api/conversations/` cannot know about a
// friend you have never written to — and the design wants every friend in the
// list, ready to be written to. So the two lists are merged:
//
//   every friend                       → a row, with no conversation behind it
//   + everybody you have talked to     → a row, even if they are not a friend
//
// The second half is not symmetry for its own sake: dropping it would hide the
// messages of anyone you unfriended or were unfriended by.
export function chatRows({ friends = [], threads = {}, presence = {}, myPublicId } = {}) {
	const people = new Map()
	for (const person of friends) if (person?.username) people.set(person.username, person)
	for (const [username, thread] of Object.entries(threads)) {
		if (!people.has(username)) people.set(username, thread.person ?? { username })
	}

	const rows = [...people.entries()].map(([username, person]) => {
		const thread = threads[username]
		const last = thread?.messages?.[thread.messages.length - 1]
		// A live presence frame is always newer than the one that came down with
		// the friends list, so it wins when there is one. Both are the same shape
		// — `{ status, room_code }` — so neither side has to be special-cased.
		const where = presence[username] ?? person.presence ?? {
			status: person.is_online ? "online" : "offline",
			room_code: null,
		}
		const online = where.status !== "offline"

		return {
			username,
			publicId: person.public_id ?? null,
			name: person.display_name || username,
			avatarUrl: person.avatar_url ?? null,
			conversationId: thread?.conversationId ?? null,
			unread: thread?.unread ?? 0,
			online,
			presence: where,
			lastAt: last?.created_at ?? null,
			preview: last ? messagePreview(last, last.user?.public_id === myPublicId) : presenceLabel(where),
		}
	})

	// Whoever spoke last is at the top; friends with nothing said yet follow in
	// alphabetical order, so the list does not shuffle itself between reloads.
	return rows.sort((a, b) => {
		if (a.lastAt && b.lastAt) return b.lastAt.localeCompare(a.lastAt)
		if (a.lastAt) return -1
		if (b.lastAt) return 1
		return a.name.localeCompare(b.name)
	})
}

// --- invites -------------------------------------------------------------

// An invite is a ChatMessage with a type and a game attached instead of a body.
export function isInvite(message) {
	return message?.message_type === "game_invite"
}

// The **room code** — the four characters a person reads out — and never the
// game's `public_id`, which is what the socket wants when sending the invite.
// Two ids for one room, used in opposite directions; mixing them up is the
// easiest mistake to make in this area.
export function inviteRoomCode(message) {
	return message?.invited_game?.join_code ?? ""
}

// The server stores an invite with an empty body, so the sentence is written
// here — which means it can read correctly from both ends of the same message,
// instead of one side reading somebody else's words about themselves.
export function inviteText(message, { mine = false, otherName = "" } = {}) {
	const code = inviteRoomCode(message)
	if (mine) return `You invited ${otherName} to room ${code}`
	return `${otherName} invited you to play`
}

export function canJoinInvite(message, mine) {
	return isInvite(message) && !mine
}

// Whether I have already invited this person to this room, which turns the button
// into a disabled "Invited".
//
// It can only see the messages the thread is holding. Opening a thread fetches its
// history, and the invite button lives inside the thread, so in practice the
// history is there before the button can be pressed — but an invite older than the
// first page of 20 messages is invisible to this, and the button would offer a
// second invite to the same room. The server accepts it, so the cost is a
// duplicate bubble, not an error.
export function alreadyInvited(messages = [], { myPublicId, roomCode } = {}) {
	return messages.some(
		(message) =>
			isInvite(message) && message.user?.public_id === myPublicId && inviteRoomCode(message) === roomCode,
	)
}

// What the thread offers at the top, and what it says when it offers nothing.
//
// Each "no" here mirrors a rule the server already enforces, so the button is
// never live to be pressed into an error: no invite outside a room, and none to a
// game that has left PENDING, because `send_game_invite` looks the game up and
// refuses anything else. A game already under way is no longer one of those
// noes: the server takes an invite to a running room too, so the button works
// from the Game Table — where the design always put it, and where it could never
// be pressed while an invite had to name a game that had not started.
//
// Being offline is deliberately NOT one of those noes. The server is happy to
// store an invite for somebody who is away — they read it when they come back —
// so a friend who is out gets one waiting for them rather than a button that
// will not press. It is a warning next to a live button, not a locked one.
//
// There is always either a button or a line of text, so the panel never collapses
// to nothing and the thread below it never jumps up the screen.
export function inviteAction({ inRoom = false, online = false, joinable = false, invited = false } = {}) {
	if (!inRoom) return { show: false, disabled: false, label: "Invite to Play", note: "JOIN A ROOM TO INVITE FRIENDS" }
	if (!joinable) return { show: true, disabled: true, label: "Invite to Play", note: "THIS GAME IS OVER" }
	if (invited) return { show: true, disabled: true, label: "Invited", note: "" }
	return { show: true, disabled: false, label: "Invite to Play", note: online ? "" : "THIS FRIEND IS OFFLINE" }
}

// --- where the dock hangs, and what it remembers --------------------------

// The eight signed-in pages the dock rides on. Login, Register, the legal pages
// and a wrong URL are left out on purpose — a signed-out reader has no chats.
//
// `/room/:code` is missing because it is the one route outside Layout: it draws
// its own frame, so it hangs its own dock.
const DOCK_PATHS = new Set(["/", "/friends", "/leaderboard", "/profile", "/tournament"])

export function showsChatDock(pathname = "") {
	const path = pathname.length > 1 ? pathname.replace(/\/$/, "") : pathname
	if (DOCK_PATHS.has(path)) return true
	// One tournament, one segment: /tournament/abc yes, /tournament/abc/extra no.
	return /^\/tournament\/[^/]+$/.test(path)
}

// The open tabs are the ONE thing the dock keeps in the browser. The design kept
// messages and unread counts there too, because it had no server; here both come
// from the backend, so the only thing worth remembering is which conversations
// you had parked when you last left.
export const TABS_KEY = "one.chat.tabs.v1"

export function withTab(tabs = [], username) {
	return tabs.includes(username) ? tabs : [...tabs, username]
}

export function withoutTab(tabs = [], username) {
	return tabs.filter((tab) => tab !== username)
}

export function loadTabs() {
	try {
		const raw = window.localStorage.getItem(TABS_KEY)
		const saved = raw ? JSON.parse(raw) : []
		return Array.isArray(saved) ? saved.filter((tab) => typeof tab === "string") : []
	} catch {
		return [] // storage blocked or holding nonsense: the dock still works
	}
}

export function saveTabs(tabs) {
	try {
		window.localStorage.setItem(TABS_KEY, JSON.stringify(tabs))
	} catch {
		/* ignore: remembering tabs is a convenience, not a feature */
	}
}

// --- talking to the server -----------------------------------------------

// Every chat list is paginated (`StatsPagination`), so the rows arrive wrapped.
function rows(data) {
	return Array.isArray(data) ? data : (data?.results ?? [])
}

export async function listConversations() {
	return rows(await api.get("/conversations/"))
}

export async function getMessages(conversationId) {
	return rows(await api.get(`/conversations/${conversationId}/messages/`))
}

// The game's own history, for the table chat. A different endpoint and a
// different socket from everything above — see TableChat.
export async function getGameMessages(publicId) {
	return rows(await api.get(`/games/${publicId}/messages/`))
}

// The dock's own connection, opened once high in the tree and kept for the whole
// session. `openSocket` is the same reconnecting client the room uses, so a
// dropped wifi heals here exactly as it does at the table.
export function openChatSocket(handlers) {
	return openSocket("/ws/chat/", handlers)
}

// The other half of the server's key expiry (TTL_SECONDS in presence.py): three
// beats inside its window, so an open connection is never taken for a dead one.
const HEARTBEAT_MS = 30000

// Presence is a second, separate connection: being connected to it is what makes
// you "online" to your friends (`PresenceConsumer` counts connections), and it is
// what pushes their status to you. Nothing else in the app opens it.
//
// The handle is wrapped so that closing the socket stops the beating with it.
export function openPresenceSocket(handlers) {
	const handle = openSocket("/ws/presence/", handlers)
	const beat = setInterval(() => handle.send({ action: "ping" }), HEARTBEAT_MS)

	return {
		...handle,
		close() {
			clearInterval(beat)
			handle.close()
		},
	}
}

// The clock on a bubble. 24-hour, as the design draws it, and it never throws on
// a malformed date — a missing time is worth less than a broken thread.
export function messageTime(iso) {
	const at = new Date(iso ?? "")
	if (Number.isNaN(at.getTime())) return ""
	return at.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })
}
