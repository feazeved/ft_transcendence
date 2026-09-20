import { useEffect, useId, useRef } from "react"
import ChatList from "./ChatList.jsx"
import ChatNotices from "./ChatNotices.jsx"
import ChatThread from "./ChatThread.jsx"
import { useChat } from "./ChatProvider.jsx"
import Avatar from "@/components/ui/Avatar.jsx"
import { alreadyInvited, inviteAction } from "@/lib/chat.js"
import { useAuth } from "@/lib/auth.jsx"

const TAB =
	"flex cursor-pointer items-center gap-2.5 rounded-full border border-white/10 bg-panel py-2 pl-2 pr-3.5 transition-colors hover:border-green"

const BADGE =
	"min-w-[18px] rounded-full bg-red px-1.5 py-px text-center font-mono text-[10px] font-bold leading-4 text-white"

// The chat, bottom right of every signed-in page.
//
// It draws three things that are really one: the minimised tabs, the CHATS list
// and the open thread, all stacked above the launcher. The state behind them
// lives in ChatProvider, one level up, so none of it is lost when the page under
// the dock changes.
function ChatDock() {
	const { user } = useAuth()
	const {
		rows,
		threads,
		unreadTotal,
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
	} = useChat()

	const launcherRef = useRef(null)
	const listId = useId()

	// Kept in a ref so the listener below is attached once, instead of being torn
	// down and rebuilt every time a message changes `openThread`'s identity.
	const openRef = useRef(openThread)
	useEffect(() => {
		openRef.current = openThread
	}, [openThread])

	// "Open a chat with this person", from anywhere on the page, without the sender
	// importing the dock or knowing it exists. The Friends row's Chat button is the
	// one sender today.
	useEffect(() => {
		const onOpen = (event) => {
			const username = event?.detail?.username
			if (username) openRef.current(username)
		}
		window.addEventListener("one:chat-open", onOpen)
		return () => window.removeEventListener("one:chat-open", onOpen)
	}, [])

	// Escape closes the thread first and the list second, so one key walks back out
	// the same way you came in.
	//
	// The guard matters because this listener is on `document` and the dock is on
	// eight pages: with a modal open — Create room, Enter code, the tournament
	// dialog — one Escape would otherwise close the modal *and* the chat, and drag
	// focus to the chat launcher instead of back to whatever opened the modal. A
	// modal dialog owns Escape while it is up. `:modal` is what tells a real modal
	// apart from the thread below, which is a non-modal <dialog open>.
	useEffect(() => {
		const onKey = (event) => {
			if (event.key !== "Escape" || event.defaultPrevented) return
			try {
				if (document.querySelector("dialog[open]:modal")) return
			} catch {
				/* a browser without :modal support: fall through and handle it */
			}
			if (openWith) {
				closeThread()
				launcherRef.current?.focus()
			} else if (listOpen) {
				toggleList(false)
				launcherRef.current?.focus()
			}
		}
		document.addEventListener("keydown", onKey)
		return () => document.removeEventListener("keydown", onKey)
	}, [openWith, listOpen, closeThread, toggleList])

	if (!user) return null

	const openRow = rows.find((row) => row.username === openWith)
	const openThreadState = openWith ? threads[openWith] : null
	const tabRows = tabs.map((username) => rows.find((row) => row.username === username)).filter(Boolean)

	// Closing and minimising both put focus back on the launcher: the thing that
	// had focus is gone, and focus must never fall back to the top of the page.
	const leaveThread = (go) => {
		go()
		launcherRef.current?.focus()
	}

	const invite = openRow
		? inviteAction({
				inRoom: Boolean(room),
				online: openRow.online,
				joinable: Boolean(room?.joinable),
				invited: alreadyInvited(openThreadState?.messages ?? [], {
					myPublicId: user.public_id,
					roomCode: room?.roomCode,
				}),
			})
		: null

	return (
		<aside
			aria-label="Chat"
			className="fixed bottom-0 right-0 z-[60] flex items-end gap-2.5 pb-[clamp(12px,3vw,20px)] pr-[clamp(12px,3vw,20px)]"
		>
			{tabRows.length > 0 && (
				<ul className="flex list-none flex-col gap-2">
					{tabRows.map((row) => (
						<li key={row.username}>
							<button
								type="button"
								onClick={() => openThread(row.username)}
								aria-label={`Reopen chat with ${row.name}`}
								className={TAB}
							>
								<Avatar
									src={row.avatarUrl}
									name={row.name}
									size="xs"
									ring={row.online ? "green" : undefined}
								/>
								<span className="whitespace-nowrap font-title text-[15px] font-bold text-white">
									{row.name}
								</span>
								{row.unread > 0 && (
									<span className={BADGE}>
										{row.unread}
										<span className="sr-only"> unread</span>
									</span>
								)}
							</button>
						</li>
					))}
				</ul>
			)}

			<div className="flex flex-col items-end gap-2.5">
				<ChatNotices notices={notices} onDismiss={dismissNotice} />

				{openRow && (
					<ChatThread
						key={openRow.username}
						row={openRow}
						thread={openThreadState}
						myPublicId={user.public_id}
						invite={invite}
						typing={Boolean(typing[openRow.username])}
						error={error}
						onSend={(body) => sendMessage(openRow.username, body)}
						onType={() => notifyTyping(openRow.username)}
						onInvite={() => sendInvite(openRow.username)}
						onMinimize={() => leaveThread(minimizeThread)}
						onClose={() => leaveThread(closeThread)}
					/>
				)}

				{listOpen && (
					<div id={listId}>
						<ChatList rows={rows} onOpen={openThread} onClose={() => toggleList(false)} />
					</div>
				)}

				<button
					ref={launcherRef}
					type="button"
					onClick={() => toggleList(!listOpen)}
					aria-expanded={listOpen}
					aria-controls={listOpen ? listId : undefined}
					aria-label={listOpen ? "Close chats" : "Open chats"}
					className={`flex cursor-pointer items-center gap-2.5 rounded-full border-2 bg-bar px-5 py-3 font-logo text-sm font-bold shadow-[0_14px_34px_rgba(0,0,0,.5)] transition-colors hover:border-green hover:text-green-soft ${
						listOpen || openWith ? "border-green text-green-soft" : "border-line-strong text-soft"
					}`}
				>
					<svg
						aria-hidden="true"
						width="20"
						height="20"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="1.5"
						strokeLinecap="round"
						strokeLinejoin="round"
					>
						<path d="M20.4 12.2c0 4-3.8 7.2-8.4 7.2-1 0-2-.15-2.9-.43L4.2 20.6l1.3-3.5A6.9 6.9 0 0 1 3.6 12.2c0-4 3.8-7.2 8.4-7.2s8.4 3.2 8.4 7.2Z" />
					</svg>
					Chat
					{unreadTotal > 0 && (
						<span className="min-w-5 rounded-full bg-red px-1.5 py-0.5 text-center font-mono text-[11px] font-bold leading-4 text-white">
							{unreadTotal}
							<span className="sr-only"> unread messages</span>
						</span>
					)}
				</button>
			</div>
		</aside>
	)
}

export default ChatDock
