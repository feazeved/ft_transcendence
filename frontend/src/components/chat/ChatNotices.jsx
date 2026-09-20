import { Link } from "react-router"

const DISMISS =
	"h-6 w-6 flex-none cursor-pointer rounded-md border border-line-strong bg-transparent font-mono text-xs leading-none text-soft transition-colors hover:border-white hover:text-white"

// What the tournament has to say, stacked above the chat launcher. Live only.
function noticeText(notice) {
	if (notice.kind === "tournament_over") {
		return {
			accent: "border-t-yellow",
			eyebrow: "TOURNAMENT OVER",
			eyebrowColor: "text-yellow",
			title: notice.tournament_name,
			line: notice.winner ? `${notice.winner} won it.` : "It ended with no winner.",
			to: `/tournament/${notice.tournament}`,
			action: "SEE THE PODIUM",
		}
	}

	return {
		accent: "border-t-green",
		eyebrow: `ROUND ${notice.round}`,
		eyebrowColor: "text-green-soft",
		title: "Your match is ready",
		line: `${notice.tournament_name} · table ${notice.room_code}`,
		to: `/room/${notice.game_id}`,
		action: "GO TO YOUR TABLE",
	}
}

function ChatNotices({ notices = [], onDismiss }) {
	if (notices.length === 0) return null

	return (
		<ul className="flex w-[min(360px,calc(100vw-24px))] list-none flex-col gap-2">
			{notices.map((notice) => {
				const text = noticeText(notice)
				return (
					<li
						key={notice.id}
						className={`flex items-start gap-3 rounded-lg border border-white/10 border-t-4 bg-panel px-3.5 py-3 shadow-[0_14px_34px_rgba(0,0,0,.5)] ${text.accent}`}
					>
						<span className="flex min-w-0 flex-1 flex-col gap-1">
							<span className={`font-mono text-[10px] tracking-[0.14em] ${text.eyebrowColor}`}>
								{text.eyebrow}
							</span>
							<span className="truncate font-title text-[15px] font-bold text-white">{text.title}</span>
							<span className="truncate font-mono text-[11px] text-white/70">{text.line}</span>
							<Link
								to={text.to}
								onClick={() => onDismiss(notice.id)}
								className="mt-1 font-mono text-[11px] tracking-[0.12em] text-yellow underline underline-offset-4"
							>
								{text.action}
							</Link>
						</span>
						<button type="button" onClick={() => onDismiss(notice.id)} aria-label="Dismiss" className={DISMISS}>
							&times;
						</button>
					</li>
				)
			})}
		</ul>
	)
}

export default ChatNotices
