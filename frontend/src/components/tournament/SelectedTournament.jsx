import { useId } from "react"
import ButtonLink from "@/components/ui/ButtonLink.jsx"
import { FORMATS } from "@/lib/tournamentStructure.js"

// The bar under the grid: what you have picked, and the one way in.
//
// Selecting a card and opening it are two separate steps in the design, and the
// split is worth keeping — a card carries seven pieces of information, so a
// single click that navigated away would make the list impossible to read
// through. OPEN TOURNAMENT is a `<Link>` and not a button, because it only
// navigates.
function SelectedTournament({ tournament }) {
	const nameId = useId()
	const format = FORMATS[tournament.format]?.label ?? "Tournament"
	const host = tournament.created_by?.username

	return (
		<section
			aria-labelledby={nameId}
			className="flex flex-wrap items-center justify-between gap-5 rounded-lg border-[3px] border-blue bg-page px-[26px] py-6 shadow-[0_0_34px_rgba(0,119,185,0.2)]"
		>
			<div className="flex min-w-0 flex-col gap-1.5">
				<p className="font-mono text-[11px] tracking-[0.16em] text-blue-soft">SELECTED</p>
				<p id={nameId} className="font-title text-2xl font-bold text-white">
					{tournament.name}
				</p>
				<p className="font-mono text-xs text-white/70">
					{format} · {tournament.participant_count}/{tournament.max_participants} players
					{host ? ` · hosted by ${host}` : ""}
				</p>
			</div>

			<ButtonLink
				to={`/tournament/${tournament.id}`}
				color="blue"
				className="font-mono text-sm font-bold tracking-[0.1em]"
			>
				OPEN TOURNAMENT →
			</ButtonLink>
		</section>
	)
}

export default SelectedTournament
