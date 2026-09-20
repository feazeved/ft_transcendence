import { formatDate, STATUS_COLORS, STATUS_LABELS } from "@/lib/tournaments.js"
import { FORMATS } from "@/lib/tournamentStructure.js"

// The top of a tournament's page: which one this is, what it is, and when it was
// made.
//
// It writes its own header instead of using `ui/PageHeader`, the way
// `home/OpenRooms.jsx` does: the line under the title is not PageHeader's muted
// mono count but the format and the status, and the status carries a colour of
// its own. The mono "TOURNAMENT 8K2P" above the title is a label, not a heading —
// the page has exactly one h1, and it is the tournament's name.
function TournamentHeader({ tournament }) {
	const format = FORMATS[tournament.format]?.label ?? "Tournament"

	return (
		<header className="flex flex-wrap items-end justify-between gap-5 border-b border-line pb-4">
			<div className="flex min-w-0 flex-col gap-2">
				<p className="font-mono text-xs tracking-[0.18em] text-red-soft">TOURNAMENT {tournament.id}</p>
				<h1 className="font-title text-[clamp(28px,6vw,38px)] font-extrabold text-white">{tournament.name}</h1>
				<p className="text-[15px] text-white/70">
					{format} ·{" "}
					<span className={`font-logo font-semibold ${STATUS_COLORS[tournament.status] ?? "text-muted"}`}>
						{STATUS_LABELS[tournament.status] ?? tournament.status}
					</span>
				</p>
			</div>
			<p className="font-mono text-[13px] text-muted">{formatDate(tournament.created_at)}</p>
		</header>
	)
}

export default TournamentHeader
