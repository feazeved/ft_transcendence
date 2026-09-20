import { useId } from "react"
import { finalStandings } from "@/lib/tournaments.js"

// The podium of a finished tournament: first, second and third.
//
// An `<ol>` and not a `<table>`: the spec sends ranked data to a table, and that
// is right for the Leaderboard, which has columns of numbers to compare. Three
// names with their place spelled out beside them are a list in rank order, which
// is exactly what an ordered list means.
//
// Who came where is worked out by `finalStandings()` from each participant's
// `final_position` — the field `TournamentParticipant` already has for it — so
// this file only draws.
const PLACES = [
	{ label: "1ST PLACE", color: "text-yellow", edge: "border-l-yellow" },
	{ label: "2ND PLACE", color: "text-blue-soft", edge: "border-l-blue" },
	{ label: "3RD PLACE", color: "text-green-soft", edge: "border-l-green" },
]

function FinalResults({ tournament }) {
	const headingId = useId()
	const standings = finalStandings(tournament)

	// A section with nothing to say draws nothing at all.
	if (standings.length === 0) return null

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3.5">
			<h2 id={headingId} className="font-logo text-[19px] font-bold text-white">
				Final results
			</h2>
			<ol className="flex flex-wrap gap-3">
				{standings.map((entry, index) => {
					const place = PLACES[index] ?? PLACES[PLACES.length - 1]
					return (
						<li
							key={entry.user.username}
							className={`flex items-center gap-3.5 rounded-md border border-white/10 border-l-4 bg-panel px-[22px] py-4 ${place.edge}`}
						>
							{/* The number repeats the place written next to it, so it is decorative. */}
							<span aria-hidden="true" className={`font-mono text-[22px] font-bold ${place.color}`}>
								{String(entry.final_position).padStart(2, "0")}
							</span>
							<span className="flex flex-col gap-0.5">
								<span className="font-mono text-[11px] tracking-[0.12em] text-muted">{place.label}</span>
								<span className="font-title text-xl font-bold text-white">{entry.user.username}</span>
							</span>
						</li>
					)
				})}
			</ol>
		</section>
	)
}

export default FinalResults
