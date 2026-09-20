import { formatDate, STATUS_ACCENTS, STATUS_COLORS, STATUS_LABELS } from "@/lib/tournaments.js"
import { FORMATS } from "@/lib/tournamentStructure.js"

// One tournament in the list. Clicking it selects it; the bar under the grid is
// what opens it.
//
// **The whole card is one `<button>`, and there is deliberately no `<dl>` and no
// heading inside it.** A `<button>` may only contain phrasing content, so a
// description list in there would be invalid HTML — and a selectable card is a
// control, so the control is the card. Selection is said out loud by
// `aria-pressed`, the same way the Leaderboard's sort buttons do it, and the
// button's name reads out everything on the card: who is hosting, how full it is
// and when it was made.
//
// `created_by` is nullable on the backend (`on_delete=SET_NULL`), so a
// tournament whose host has deleted their account still draws.
function TournamentCard({ tournament, selected, onSelect }) {
	const format = FORMATS[tournament.format]?.label ?? "Tournament"

	return (
		<li className="flex">
			<button
				type="button"
				aria-pressed={selected}
				onClick={() => onSelect(tournament.id)}
				className={`flex w-full cursor-pointer flex-col items-stretch gap-3.5 rounded-lg border border-t-4 bg-panel p-[22px] text-left transition-colors ${
					STATUS_ACCENTS[tournament.status] ?? "border-t-line-strong"
				} ${
					selected
						? "border-white shadow-[0_0_26px_rgba(255,255,255,0.12)]"
						: "border-white/10 hover:border-white/40"
				}`}
			>
				<span className="flex items-start justify-between gap-3">
					<span className="font-title text-[22px] font-bold leading-[1.15] text-white">{tournament.name}</span>
					<span className="flex-none rounded border border-line-strong px-[7px] py-1 font-mono text-[11px] tracking-[0.1em] text-muted">
						{tournament.id}
					</span>
				</span>

				<span className={`font-logo text-sm font-semibold ${STATUS_COLORS[tournament.status] ?? "text-muted"}`}>
					{STATUS_LABELS[tournament.status] ?? tournament.status}
				</span>

				<span className="flex flex-col gap-2 border-t border-white/10 pt-3.5 font-mono text-xs text-white/70">
					<span className="flex items-center justify-between gap-2.5">
						<span className="text-muted">FORMAT</span>
						<span>{format}</span>
					</span>
					<span className="flex items-center justify-between gap-2.5">
						<span className="text-muted">PLAYERS</span>
						<span className="font-bold text-white">
							{tournament.participant_count}/{tournament.max_participants}
						</span>
					</span>
					<span className="flex items-center justify-between gap-2.5">
						<span className="text-muted">HOST</span>
						<span className="truncate">{tournament.created_by?.username ?? "—"}</span>
					</span>
					<span className="flex items-center justify-between gap-2.5">
						<span className="text-muted">DATE</span>
						<span>{formatDate(tournament.created_at)}</span>
					</span>
				</span>
			</button>
		</li>
	)
}

export default TournamentCard
