import { Link } from "react-router"
import { canJoinInvite, inviteRoomCode, inviteText, isInvite, messageTime } from "@/lib/chat.js"

const JOIN =
	"self-start cursor-pointer rounded-md border-2 border-green bg-transparent px-3.5 py-2 font-logo text-xs font-semibold text-green-soft transition-colors hover:bg-green hover:text-on-green"

// One bubble in the dock's thread: mine on the right, theirs on the left, and an
// invite in green with a way into the room.
//
// Join is a <Link> and not a button, because it only navigates — the room page
// does the joining. Its label carries the room code, so "Join room 9QTB" still
// says which room when it is read on its own out of a list of buttons.
function ChatMessage({ message, mine, otherName }) {
	const invite = isInvite(message)
	const code = inviteRoomCode(message)

	return (
		<li
			className={`flex max-w-[85%] flex-col gap-1.5 rounded-lg border px-3 py-2.5 ${
				mine ? "self-end" : "self-start"
			} ${invite ? "border-green bg-green/10" : mine ? "border-green bg-green/15" : "border-white/10 bg-white/5"}`}
		>
			{invite && (
				<span className="font-mono text-[10px] tracking-[0.12em] text-green-soft">
					INVITE · ROOM {code}
				</span>
			)}
			<span className="text-[13px] leading-relaxed text-pretty text-white">
				{invite ? inviteText(message, { mine, otherName }) : message.body}
			</span>
			{canJoinInvite(message, mine) && code && (
				<Link to={`/room/${code}`} className={JOIN}>
					Join room {code}
				</Link>
			)}
			<span className="self-end font-mono text-[9px] tracking-[0.08em] text-white/60">
				{messageTime(message.created_at)}
			</span>
		</li>
	)
}

export default ChatMessage
