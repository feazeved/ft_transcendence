import { useEffect, useRef, useState } from "react"
import ChatComposer from "@/components/chat/ChatComposer.jsx"
import Avatar from "@/components/ui/Avatar.jsx"
import { ErrorMessage } from "@/components/ui/Message.jsx"
import { messageTime } from "@/lib/chat.js"

// The room's own chat, at the bottom left of the game table.
//
// It looks like the dock and is a different thing entirely. **It rides the game
// socket**, the same connection the cards go over: send `{action: "chat"}` and
// the server answers the whole room with `{type: "chat_message"}`. The dock's
// `ws/chat/` connection knows nothing about it, and it knows nothing about the
// dock — two channels whose frames happen to share a name.
//
// Everyone at the table reads it and everyone can write in it, spectators
// included: the server only asks for a seat before a *game* action, never before
// a message.
function TableChat({ roomCode, messages, historyCount = 0, players = 0, myPublicId, onSend }) {
	const [open, setOpen] = useState(false)
	// How much of the chat had been seen when the panel was last shut. It is only
	// ever written by the toggle below, which is what keeps the badge out of an
	// effect: while the panel is open everything on screen counts as read, so the
	// number is derived during render rather than synchronised after it.
	const [seenCount, setSeenCount] = useState(0)
	const [sendError, setSendError] = useState("")
	const scrollRef = useRef(null)

	// The badge counts what people said, never the log: a move a second would
	// otherwise keep the panel permanently unread.
	const spoken = messages.filter((message) => message.message_type !== "system")

	// `historyCount` is how many of those came from the history fetch rather than
	// over the socket. They are the conversation as it already was when you
	// arrived, so they are not news: without this, refreshing mid-game badges the
	// panel with a whole page of messages you have already read.
	const unread = open ? 0 : Math.max(0, spoken.length - Math.max(seenCount, historyCount))

	const toggle = () => {
		if (open) setSeenCount(spoken.length)
		setOpen(!open)
	}

	// The chat keeps its own error line. Putting it in the room's `error` would
	// print "your message wasn't sent" in the middle of the table, where it reads
	// as though a *move* had failed.
	const send = (body) => {
		if (onSend(body) === false) {
			setSendError("Not connected — your message wasn't sent.")
			return false
		}
		setSendError("")
		return true
	}

	useEffect(() => {
		const box = scrollRef.current
		if (box) box.scrollTop = box.scrollHeight
	}, [messages.length, open])

	return (
		<section
			aria-label="Table chat"
			className="fixed bottom-[clamp(12px,2vh,20px)] left-[clamp(12px,3vw,20px)] z-50 flex max-h-[min(420px,70vh)] w-[min(440px,calc(100vw-210px))] flex-col justify-end overflow-hidden rounded-lg border border-white/10 border-t-4 border-t-yellow bg-panel/95"
		>
			<h2 className="sr-only">Table chat</h2>
			<button
				type="button"
				onClick={toggle}
				aria-expanded={open}
				className="flex flex-none cursor-pointer flex-wrap items-center gap-2.5 border-none bg-transparent px-[clamp(12px,3vw,16px)] py-2.5 text-left transition-colors hover:bg-white/5"
			>
				<span className="font-mono text-[11px] tracking-[0.16em] text-yellow">TABLE CHAT</span>
				<span className="font-mono text-[11px] tracking-[0.1em] text-muted">
					ROOM {roomCode} · {players} AT THE TABLE
				</span>
				{unread > 0 && (
					<span className="min-w-[18px] rounded-full bg-red px-1.5 py-px text-center font-mono text-[10px] font-bold leading-4 text-white">
						{unread}
						<span className="sr-only"> unread</span>
					</span>
				)}
				<span className="ml-auto font-logo text-[13px] font-semibold text-soft">
					{open ? "Hide" : "Show"}
				</span>
			</button>

			{open && (
				<div className="flex min-h-0 flex-col border-t border-white/10">
					<ul
						ref={scrollRef}
						role="log"
						aria-live="polite"
						aria-relevant="additions"
						className="flex max-h-[min(260px,46vh)] list-none flex-col gap-2 overflow-y-auto px-[clamp(14px,3vw,18px)] py-3.5"
					>
						{messages.length === 0 && (
							<li className="text-center font-mono text-xs leading-loose text-muted">
								No messages yet.
								<br />
								Talk to the table.
							</li>
						)}
						{messages.map((message) => {
							// No author, so no bubble and no side: a log down the middle.
							if (message.message_type === "system")
								return (
									<li
										key={message.id}
										className="self-center px-2 text-center font-mono text-[11px] leading-relaxed text-muted"
									>
										{message.body}
									</li>
								)

							const mine = message.user?.public_id === myPublicId
							const sender = message.user?.display_name || message.user?.username || "Someone"
							return (
								<li
									key={message.id}
									className={`flex max-w-[min(80%,520px)] flex-col gap-1.5 rounded-lg border px-3.5 py-2.5 ${
										mine
											? "self-end border-yellow bg-yellow/10"
											: "self-start border-white/10 bg-white/5"
									}`}
								>
									{!mine && (
										<span className="flex items-center gap-1.5">
											<Avatar src={message.user?.avatar_url} name={sender} size="xs" />
											<span className="font-mono text-[10px] tracking-[0.1em] text-dim">
												{sender}
											</span>
										</span>
									)}
									<span className="text-sm leading-relaxed text-pretty text-white">{message.body}</span>
									<span className="self-end font-mono text-[9px] tracking-[0.08em] text-white/60">
										{messageTime(message.created_at)}
									</span>
								</li>
							)
						})}
					</ul>

					{sendError && (
						<ErrorMessage className="px-[clamp(14px,3vw,20px)] pb-1 text-[11px]">
							{sendError}
						</ErrorMessage>
					)}

					<ChatComposer
						label="Message to the table"
						placeholder="Message the table"
						accent="yellow"
						onSend={send}
						className="px-[clamp(14px,3vw,20px)]"
					/>
				</div>
			)}
		</section>
	)
}

export default TableChat
