import { useEffect, useId, useRef } from "react"
import { Link } from "react-router"
import ChatComposer from "./ChatComposer.jsx"
import ChatMessage from "./ChatMessage.jsx"
import Avatar from "@/components/ui/Avatar.jsx"
import { ErrorMessage } from "@/components/ui/Message.jsx"
import { isLastMessageRead, presenceLabel } from "@/lib/chat.js"

const ICON =
	"h-8 w-8 flex-none cursor-pointer rounded-md border-2 border-line-strong bg-transparent font-mono text-sm leading-none text-soft transition-colors hover:border-white hover:text-white"

const INVITE =
	"cursor-pointer rounded-md border-2 border-green bg-transparent px-3 py-2 font-logo text-xs font-semibold text-green-soft transition-colors hover:bg-green hover:text-on-green disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-green-soft"

// One open conversation.
//
// It is a real <dialog>, but **not** a modal one: `open` instead of showModal().
// A modal dialog takes the whole page hostage — it traps focus and dims
// everything behind it — and this box sits on top of a live game that has to
// stay usable while you type. So it is a dialog for its semantics (a named box
// on top of the page, closed with Escape) without the behaviour that would be
// wrong here. The class list resets the browser's own dialog styling: `static`
// for its position, `m-0 p-0` for its margin and padding.
function ChatThread({ row, thread, myPublicId, invite, typing, error, onSend, onType, onInvite, onMinimize, onClose }) {
	const scrollRef = useRef(null)
	const inputRef = useRef(null)
	const titleId = useId()
	const messages = thread?.messages ?? []
	const count = messages.length
	// Drawn once, under the last thing I said.
	const read = isLastMessageRead(thread, myPublicId)

	// Opening a thread puts the cursor where you are about to write. The delay is
	// a frame, not a guess: the box has to exist before it can hold focus.
	useEffect(() => {
		const timer = setTimeout(() => inputRef.current?.focus(), 40)
		return () => clearTimeout(timer)
	}, [row.username])

	// Always land on the newest message, on open and on every arrival.
	useEffect(() => {
		const box = scrollRef.current
		if (box) box.scrollTop = box.scrollHeight
	}, [count, row.username])

	return (
		<dialog
			open
			aria-labelledby={titleId}
			className="static m-0 flex h-[min(460px,calc(100vh-120px))] w-[min(360px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg border border-white/10 border-t-4 border-t-green bg-panel p-0 text-white shadow-[0_22px_60px_rgba(0,0,0,.6)]"
		>
			<header className="flex flex-none items-center gap-2.5 border-b border-white/10 px-3.5 py-3">
				<Avatar src={row.avatarUrl} name={row.name} size="sm" ring={row.online ? "green" : undefined} />
				<span className="flex min-w-0 flex-1 flex-col gap-0.5">
					{/* A row the friends list has not caught up with has no public id
					    yet, so it stays plain text rather than a dead link. */}
					<h2 id={titleId} className="truncate font-title text-[17px] font-bold text-white">
						{row.publicId ? (
							<Link to={`/users/${row.publicId}`} className="underline-offset-4 hover:underline">
								{row.name}
							</Link>
						) : (
							row.name
						)}
					</h2>
					<span
						className={`flex items-center gap-1.5 font-mono text-[10px] tracking-[0.1em] ${
							row.online ? "text-green-soft" : "text-muted"
						}`}
					>
						<i
							aria-hidden="true"
							className={`h-[7px] w-[7px] flex-none rounded-full ${row.online ? "bg-green" : "bg-white/30"}`}
						/>
						{typing ? "Typing…" : presenceLabel(row.online)}
					</span>
				</span>
				<button type="button" onClick={onMinimize} aria-label={`Minimize chat with ${row.name}`} className={ICON}>
					&minus;
				</button>
				<button type="button" onClick={onClose} aria-label={`Close chat with ${row.name}`} className={ICON}>
					&times;
				</button>
			</header>

			{/* Either a button or a line saying why there isn't one, so the panel
			    always has the same height and the thread below never jumps. */}
			<div className="flex flex-none flex-wrap items-center gap-2 border-b border-white/10 px-3.5 py-2.5">
				{invite.show ? (
					<button type="button" onClick={onInvite} disabled={invite.disabled} className={INVITE}>
						{invite.label}
					</button>
				) : null}
				{invite.note && (
					<span className="font-mono text-[10px] tracking-[0.08em] text-muted">{invite.note}</span>
				)}
			</div>

			{/* role="log" + aria-live announces a message as it lands, which is the
			    only way a screen reader hears one arrive: nothing was clicked. */}
			<ul
				ref={scrollRef}
				role="log"
				aria-live="polite"
				aria-relevant="additions"
				className="flex min-h-0 flex-1 list-none flex-col gap-2 overflow-y-auto p-3.5"
			>
				{count === 0 && (
					<li className="m-auto text-center font-mono text-xs leading-loose text-muted">
						No messages yet.
						<br />
						Say hello.
					</li>
				)}
				{messages.map((message) => (
					<ChatMessage
						key={message.id}
						message={message}
						mine={message.user?.public_id === myPublicId}
						otherName={row.name}
					/>
				))}
				{read && (
					<li className="self-end pr-1 font-mono text-[10px] tracking-[0.1em] text-green-soft">
						READ
					</li>
				)}
			</ul>

			{error && <ErrorMessage className="flex-none px-3.5 pb-1 text-[11px]">{error}</ErrorMessage>}

			<ChatComposer
				label={`Message to ${row.name}`}
				placeholder="Write a message"
				accent="green"
				inputRef={inputRef}
				onSend={onSend}
				onType={onType}
			/>
		</dialog>
	)
}

export default ChatThread
