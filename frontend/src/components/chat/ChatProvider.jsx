import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react"
import {
	awaitingFirstMessage,
	chatRows,
	emptyChat,
	getMessages,
	listConversations,
	loadTabs,
	markRead,
	openChatSocket,
	openPresenceSocket,
	openThread as clearUnread,
	receiveMessage,
	saveTabs,
	sortMessages,
	threadsFromConversations,
	totalUnread,
	withHistory,
	withNotice,
	withoutNotice,
	withoutTab,
	withTab,
} from "@/lib/chat.js"
import { groupFriendships, listFriendships } from "@/lib/friends.js"
import { useAuth } from "@/lib/auth.jsx"

const ChatContext = createContext(null)

// Nobody has stopped typing, as far as the server is concerned: `ChatConsumer`
// broadcasts that somebody started and never that they finished, so the dock
// forgets on its own after this long.
const TYPING_FOR_MS = 4000
// And it says so at most this often while a draft is being written, instead of
// once per keystroke.
const TYPING_EVERY_MS = 2000

// The chat's one connection and all of its state, opened high in the tree so it
// survives every page change.
//
// This is the opposite of `useGameSocket`, which is born and dies with the room:
// a game socket belongs to one room, and this one belongs to the session. If the
// dock opened its own connection per page, every navigation would drop and
// rebuild it — and a message that arrived in between would be lost.
export function ChatProvider({ children }) {
	const { user } = useAuth()
	const myPublicId = user?.public_id

	const [chat, setChat] = useState(emptyChat)
	const [friends, setFriends] = useState([])
	// Incoming friend requests I have not answered. The same fetch that feeds the
	// chat rows already groups them, so the header's badge costs no extra request.
	const [incomingCount, setIncomingCount] = useState(0)
	// Ticks on every friendship poke. The dock refetches its own rows below, but
	// the Friends page keeps its own list and used to load it once on mount — so
	// an arriving request lit the header badge while the page underneath still
	// said "No pending requests". Following this lets it catch up too.
	const [friendshipVersion, setFriendshipVersion] = useState(0)
	const [presence, setPresence] = useState({})
	const [typing, setTyping] = useState({})
	const [notices, setNotices] = useState([])
	const [error, setError] = useState("")

	const [openWith, setOpenWith] = useState(null)
	const [listOpen, setListOpen] = useState(false)
	const [tabs, setTabs] = useState(loadTabs)
	// Which room the dock may invite people to. The room page sets it while it is
	// on screen; everywhere else it is null, and the thread says so.
	const [room, setRoom] = useState(null)

	const socketRef = useRef(null)
	const lastTypingRef = useRef({})
	const typingTimers = useRef({})
	// A read receipt that could not be sent because the socket was down. It waits
	// here and goes out the moment one opens.
	const pendingReadRef = useRef(null)
	// The open thread has to be readable from inside the socket callback, which is
	// built once and would otherwise close over the first render's value forever.
	// Written in an effect and not during render: writing to a ref while rendering
	// is not allowed under StrictMode, same rule as lib/socket.js.
	const openWithRef = useRef(null)
	useEffect(() => {
		openWithRef.current = openWith
	}, [openWith])

	// The tabs are the only thing kept in the browser (see lib/chat.js).
	useEffect(() => {
		saveTabs(tabs)
	}, [tabs])

	// Everything the list needs, in two requests: who your friends are, and which
	// conversations already exist. Neither one alone is the list.
	//
	// It is a callback and not just an effect body because it has to be callable
	// again later: friendships change on the Friends page, and a dock holding the
	// list it fetched at sign-in would show a friend you just removed and — worse —
	// know nothing about one you just accepted, so their Chat button would open an
	// empty corner. `openThread` and opening the list both refresh it.
	const load = useCallback(async () => {
		if (!myPublicId) return
		try {
			const [friendships, conversations] = await Promise.all([listFriendships(), listConversations()])
			const grouped = groupFriendships(
				Array.isArray(friendships) ? friendships : (friendships?.results ?? []),
				myPublicId,
			)
			setFriends(grouped.friends.map((entry) => entry.person))
			setIncomingCount(grouped.incoming.length)
			// Seeded, not replaced: a message can land over the socket while these
			// two requests are in flight, and it must not be lost. The server's
			// numbers win where they disagree — `unread_count` is the authority, and
			// a tally the browser started while loading is not.
			setChat((current) => {
				const seeded = threadsFromConversations(conversations)
				for (const [username, local] of Object.entries(current.threads)) {
					const fromServer = seeded[username]
					if (!fromServer) {
						seeded[username] = local
						continue
					}
					const known = new Set(fromServer.messages.map((message) => message.id))
					seeded[username] = {
						...fromServer,
						messages: sortMessages([
							...fromServer.messages,
							...local.messages.filter((message) => !known.has(message.id)),
						]),
						loaded: local.loaded,
						// A receipt only arrives over the socket, so a refetch must not
						// take "read" back off a message that is read.
						readUpTo: local.readUpTo ?? fromServer.readUpTo,
						// The one number the server does not get the last word on: the
						// thread you are looking at was read, and `mark_read` has already
						// been sent. Taking the server's count back would put a badge on
						// an open conversation that nothing would ever clear again.
						unread: username === openWithRef.current ? 0 : fromServer.unread,
					}
				}
				return { ...current, threads: seeded }
			})
		} catch (err) {
			setError(err.message)
		}
	}, [myPublicId])

	// Wrapped in an async call so nothing sets state while the effect body is still
	// running — the same shape pages/Friends.jsx uses for its own load.
	useEffect(() => {
		void (async () => {
			await load()
		})()
	}, [load])

	// The connection itself. It is opened once per signed-in session and closed on
	// sign-out, which is why the dependency list is just the user.
	useEffect(() => {
		if (!myPublicId) return undefined

		const handle = openChatSocket({
			onMessage: (data) => {
				if (data.type === "chat_message") {
					setChat((current) =>
						receiveMessage(current, data.message, { myPublicId, openWith: openWithRef.current }),
					)
				} else if (data.type === "typing") {
					// There is no "stopped typing" frame — the consumer only ever says
					// somebody started — so the dock forgets on a timer of its own,
					// pushed back by every fresh frame.
					const who = data.username
					setTyping((current) => ({ ...current, [who]: true }))
					clearTimeout(typingTimers.current[who])
					typingTimers.current[who] = setTimeout(() => {
						setTyping((current) => {
							const next = { ...current }
							delete next[who]
							return next
						})
					}, TYPING_FOR_MS)
				} else if (data.type === "notice") {
					setNotices((current) => withNotice(current, data))
				} else if (data.type === "read_receipt") {
					setChat((current) => markRead(current, data.conversation_id))
				} else if (data.type === "error") {
					setError(data.message)
				}
			},
			// A receipt that failed while the socket was down is sent now. Without
			// this the badge clears in the browser, the server never hears, and the
			// unread count is back on the next reload.
			onOpen: () => {
				const pending = pendingReadRef.current
				if (pending === null) return
				if (socketRef.current?.send({ action: "mark_read", conversation_id: pending }) !== false) {
					pendingReadRef.current = null
				}
			},
		})
		socketRef.current = handle

		const timers = typingTimers.current

		return () => {
			handle.close()
			socketRef.current = null
			for (const timer of Object.values(timers)) clearTimeout(timer)
		}
	}, [myPublicId])

	// The presence connection. Being on it is what makes you online to your
	// friends, so it is opened for every signed-in page, dock on screen or not.
	useEffect(() => {
		if (!myPublicId) return undefined

		const handle = openPresenceSocket({
			onMessage: (data) => {
				if (data.type === "presence_update") {
					// The whole place, not just the status: "In a lobby" is only
					// half an answer without the code that follows it.
					setPresence((current) => ({
						...current,
						[data.username]: { status: data.status, room_code: data.room_code ?? null },
					}))
				}
				// The server pokes without saying what changed, so we refetch. The
				// REST list stays the one authority on what a friendship is, and a
				// poke we miss costs nothing: the next fetch catches up anyway.
				if (data.type === "friendship_update") {
					void load()
					setFriendshipVersion((v) => v + 1)
				}
			},
		})

		return () => handle.close()
	}, [myPublicId, load])

	const send = useCallback((payload) => socketRef.current?.send(payload) ?? false, [])

	const dismissNotice = useCallback((id) => setNotices((current) => withoutNotice(current, id)), [])

	const rows = useMemo(
		() => chatRows({ friends, threads: chat.threads, presence, myPublicId }),
		[friends, chat.threads, presence, myPublicId],
	)

	// Opening a thread does three things at once: it clears the badge, it tells the
	// server the thread was read, and it fetches the history the row's single
	// preview message is standing in for.
	const openThread = useCallback(
		(username) => {
			if (!username) return
			setOpenWith(username)
			// Somebody we have never heard of — a friend accepted since the dock
			// loaded. Without this the thread would render nothing at all, because
			// there is no row to draw it from.
			if (!rows.some((row) => row.username === username)) void load()
			setListOpen(false)
			setError("")
			setTabs((current) => withoutTab(current, username))
			setChat((current) => clearUnread(current, username))

			const conversationId = chat.threads[username]?.conversationId
			// No conversation yet means nothing to mark read and no history to ask
			// for: both only start existing with the first message. The read receipt
			// itself is sent by the effect below, which also covers what arrives
			// while you are looking at it.
			if (!conversationId || chat.threads[username]?.loaded) return

			void (async () => {
				try {
					const history = await getMessages(conversationId)
					setChat((current) => withHistory(current, username, history))
				} catch (err) {
					setError(err.message)
				}
			})()
		},
		[chat.threads, rows, load],
	)

	// The read receipt, for as long as a thread is open. Clearing the badge in the
	// browser is not enough: without telling the server, every message you read
	// with the thread in front of you comes back unread after a reload. It re-fires
	// on each arrival, which is exactly when it has something new to confirm.
	const openConversationId = openWith ? chat.threads[openWith]?.conversationId : null
	const lastMessageId = openWith ? chat.threads[openWith]?.messages?.at(-1)?.id : null
	// A receipt that cannot be sent is remembered rather than dropped: `send`
	// answers false while the socket is down, and the socket's own `onOpen` above
	// is what flushes it. Otherwise the badge would clear here and come back on the
	// next reload, because the server never heard.
	useEffect(() => {
		if (!openConversationId || !lastMessageId) return
		if (send({ action: "mark_read", conversation_id: openConversationId }) === false) {
			pendingReadRef.current = openConversationId
		} else {
			pendingReadRef.current = null
		}
	}, [openConversationId, lastMessageId, send])

	// Opening the list refreshes it: it is the one moment the whole list is about to
	// be read, so it is the cheapest place to catch up on friendships that changed
	// on another page.
	const toggleList = useCallback(
		(next) => {
			setListOpen(next)
			if (next) void load()
		},
		[load],
	)

	const closeThread = useCallback(() => setOpenWith(null), [])

	// `openWith` is read from the closure rather than from inside a setState
	// updater: an updater has to be pure, and StrictMode runs it twice.
	const minimizeThread = useCallback(() => {
		if (!openWith) return
		setTabs((current) => withTab(current, openWith))
		setOpenWith(null)
	}, [openWith])

	const sendMessage = useCallback(
		(username, body) => {
			const row = rows.find((candidate) => candidate.username === username)
			const text = body.trim()
			if (!text) return false
			// No public_id means we know the name but not the person — a row built
			// from a conversation whose participant never loaded. Silence here would
			// eat the message, so it says so and the draft survives.
			if (!row?.publicId) {
				setError("Couldn't work out who to send that to. Try reopening the chat.")
				return false
			}
			// Remembered before the send, because the answer comes back naming only
			// the sender: see receiveMessage.
			if (!chat.threads[username]?.conversationId) {
				setChat((current) => awaitingFirstMessage(current, username))
			}
			setError("")
			// `send` answers false when the socket is down. Saying nothing would look
			// exactly like a message that was delivered.
			if (send({ action: "send_message", recipient_id: row.publicId, body: text }) === false) {
				setError("Not connected — your message wasn't sent.")
				return false
			}
			return true
		},
		[rows, chat.threads, send],
	)

	const sendInvite = useCallback(
		(username) => {
			const row = rows.find((candidate) => candidate.username === username)
			if (!row?.publicId || !room?.gameId) {
				setError("Couldn't work out who to invite. Try reopening the chat.")
				return
			}
			if (!chat.threads[username]?.conversationId) {
				setChat((current) => awaitingFirstMessage(current, username))
			}
			setError("")
			// The game's public_id, never the room code: `send_game_invite` looks the
			// game up by `public_id`.
			if (send({ action: "send_game_invite", recipient_id: row.publicId, game_id: room.gameId }) === false) {
				setError("Not connected — the invite wasn't sent.")
			}
		},
		[rows, room, chat.threads, send],
	)

	const notifyTyping = useCallback(
		(username) => {
			const row = rows.find((candidate) => candidate.username === username)
			const now = Date.now()
			// Per person, not one clock for everybody: a single timestamp would eat
			// the first frame to B when you had just been typing to A.
			if (!row?.publicId || now - (lastTypingRef.current[username] ?? 0) < TYPING_EVERY_MS) return
			lastTypingRef.current[username] = now
			send({ action: "typing", recipient_id: row.publicId })
		},
		[rows, send],
	)

	const value = useMemo(
		() => ({
			rows,
			threads: chat.threads,
			unreadTotal: totalUnread(chat.threads),
			incomingCount,
			friendshipVersion,
			openWith,
			listOpen,
			tabs,
			room,
			error,
			typing,
			notices,
			dismissNotice,
			toggleList,
			openThread,
			closeThread,
			minimizeThread,
			sendMessage,
			sendInvite,
			notifyTyping,
			setRoom,
			dismissError: () => setError(""),
		}),
		[
			rows,
			chat.threads,
			incomingCount,
			friendshipVersion,
			openWith,
			listOpen,
			tabs,
			room,
			error,
			typing,
			notices,
			dismissNotice,
			toggleList,
			openThread,
			closeThread,
			minimizeThread,
			sendMessage,
			sendInvite,
			notifyTyping,
		],
	)

	return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>
}

// Provider and hooks belong together, same as lib/auth.jsx.
// oxlint-disable-next-line react/only-export-components
export function useChat() {
	const ctx = useContext(ChatContext)
	if (!ctx) throw new Error("useChat must be used within <ChatProvider>")
	return ctx
}

// What the room tells the dock so that "Invite to Play" has something to invite
// to. `joinable` is false only once the game is over, because the server only
// accepts an invite to a PENDING game.
//
// It is a hook and not a prop because the room page and the dock are not in the
// same part of the tree: the dock lives at the root, the room is a page.
// oxlint-disable-next-line react/only-export-components
export function useChatRoom({ gameId, roomCode, joinable }) {
	const { setRoom } = useChat()

	useEffect(() => {
		if (!gameId || !roomCode) return undefined
		setRoom({ gameId, roomCode, joinable })
		// Cleared on the way out, so a thread opened on Home never offers an invite
		// to a room nobody is in any more.
		return () => setRoom(null)
	}, [gameId, roomCode, joinable, setRoom])
}

// The `one:chat-open` event: anything on any page can open a chat with somebody
// by name, without importing the dock or knowing it exists. The Friends page's
// Chat button is the one sender today.
// oxlint-disable-next-line react/only-export-components
export function openChatWith(username) {
	window.dispatchEvent(new CustomEvent("one:chat-open", { detail: { username } }))
}

export default ChatProvider
