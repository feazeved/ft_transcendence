import Avatar from "@/components/ui/Avatar.jsx"
import { EmptyMessage } from "@/components/ui/Message.jsx"
import { presenceColor } from "@/lib/chat.js"

const ROW =
	"flex w-full cursor-pointer items-center gap-2.5 rounded-md border border-white/10 border-l-4 bg-page px-3 py-2.5 text-left transition-colors hover:border-white/30"

// The CHATS panel: one row per person, whoever spoke last at the top.
//
// Every row is one friend or one conversation — the merge that builds them is in
// lib/chat.js, and it is the reason a friend you have never written to is here
// at all.
function ChatList({ rows, onOpen, onClose }) {
	return (
		<section
			aria-label="Chats"
			className="flex max-h-[min(420px,calc(100vh-120px))] w-[min(340px,calc(100vw-24px))] flex-col overflow-hidden rounded-lg border border-white/10 border-t-4 border-t-green bg-panel shadow-[0_22px_60px_rgba(0,0,0,.6)]"
		>
			<div className="flex flex-none items-center justify-between gap-3 border-b border-white/10 px-3.5 py-3">
				<h2 className="font-mono text-[11px] tracking-[0.16em] text-green-soft">CHATS</h2>
				<button
					type="button"
					onClick={onClose}
					aria-label="Close chat list"
					className="h-[30px] w-[30px] flex-none cursor-pointer rounded-md border-2 border-line-strong bg-transparent font-mono text-sm leading-none text-soft transition-colors hover:border-white hover:text-white"
				>
					&times;
				</button>
			</div>

			<ul className="flex min-h-0 flex-1 list-none flex-col gap-1.5 overflow-y-auto p-3">
				{rows.length === 0 && (
					<li>
						<EmptyMessage>No friends yet — add someone on the Friends page.</EmptyMessage>
					</li>
				)}
				{rows.map((row) => (
					<li key={row.username} className={row.online ? "" : "opacity-60"}>
						<button
							type="button"
							onClick={() => onOpen(row.username)}
							className={`${ROW} ${row.online ? "border-l-green" : "border-l-white/10"}`}
						>
							<Avatar
								src={row.avatarUrl}
								name={row.name}
								size="sm"
								ring={row.online ? "green" : undefined}
							/>
							<span className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span className="truncate font-title text-base font-bold text-white">{row.name}</span>
								{/* An unread message outranks where they are; otherwise the
								    line takes the colour of the place — a lobby and a game
								    each get their own, so the four states read apart at a
								    glance and not only by their words. */}
								<span
									className={`truncate font-mono text-[10px] tracking-[0.08em] ${
										row.unread > 0 ? "text-white" : presenceColor(row.presence)
									}`}
								>
									{row.preview}
								</span>
							</span>
							{row.unread > 0 && (
								<span className="min-w-[18px] flex-none rounded-full bg-red px-1.5 py-px text-center font-mono text-[10px] font-bold leading-4 text-white">
									{row.unread}
									<span className="sr-only"> unread</span>
								</span>
							)}
						</button>
					</li>
				))}
			</ul>
		</section>
	)
}

export default ChatList
