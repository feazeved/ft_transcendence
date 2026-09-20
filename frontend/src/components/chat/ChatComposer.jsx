import { useId, useState } from "react"
import { MAX_MESSAGE_LENGTH } from "@/lib/chat.js"

// The two chats write in the same box: the dock's thread and the table's panel.
// They differ only in their words and their colour, so both arrive as props
// rather than as a second copy of this file.
const TONES = {
	green: {
		field: "focus:border-green",
		send: "border-green text-green-soft hover:bg-green hover:text-on-green",
	},
	yellow: {
		field: "focus:border-yellow",
		send: "border-yellow text-yellow hover:bg-yellow hover:text-on-yellow",
	},
}

// `maxLength` is not decoration: the server rejects anything past 500 characters
// and an empty body, and Send stays disabled until there is something to send —
// so neither rule can be reached from here.
function ChatComposer({ label, placeholder, accent = "green", inputRef, onSend, onType, className = "" }) {
	const [draft, setDraft] = useState("")
	const id = useId()
	const tone = TONES[accent] ?? TONES.green
	const ready = draft.trim().length > 0

	// The draft is only thrown away once the message has actually gone. Clearing it
	// first looks identical to a delivered message and leaves nothing to retry
	// with, which is exactly the wrong behaviour when the socket is down.
	// `onSend` answering false means "not sent"; undefined means "sent".
	const submit = (event) => {
		event.preventDefault()
		if (!ready) return
		if (onSend(draft.trim()) === false) return
		setDraft("")
	}

	return (
		<form onSubmit={submit} className={`flex flex-none gap-2 border-t border-white/10 p-3.5 ${className}`}>
			<label htmlFor={id} className="sr-only">
				{label}
			</label>
			<input
				id={id}
				ref={inputRef}
				type="text"
				value={draft}
				maxLength={MAX_MESSAGE_LENGTH}
				autoComplete="off"
				placeholder={placeholder}
				onChange={(event) => {
					setDraft(event.target.value)
					onType?.()
				}}
				className={`min-w-0 flex-1 rounded-md border-2 border-line-strong bg-page px-3 py-2.5 text-sm text-white outline-none ${tone.field}`}
			/>
			<button
				type="submit"
				disabled={!ready}
				className={`flex-none cursor-pointer rounded-md border-2 bg-transparent px-4 py-2.5 font-logo text-[13px] font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${tone.send}`}
			>
				Send
			</button>
		</form>
	)
}

export default ChatComposer
