import { useEffect, useState } from "react"
import { Link } from "react-router"
import { FORMATS } from "@/lib/tournamentStructure.js"
// Real data since §5 landed; it comes through
// the same `listTournaments()` the tournament pages use (area 06), so there is
// one list and one shape. It is async because the real endpoint will be.
import { listTournaments } from "@/lib/tournaments.js"

// The design's "NEXT MATCH" countdown is left out: nothing tells us when the
// next match starts.
function TournamentBanner() {
	const [live, setLive] = useState(null)

	useEffect(() => {
		let ignore = false

		listTournaments()
			.then((tournaments) => {
				if (!ignore) setLive(tournaments.find((tournament) => tournament.status === "in_progress") ?? null)
			})
			// A banner is a bonus, not part of the page: if the list can't be had,
			// it stays away rather than pushing an error onto Home.
			.catch(() => {})

		return () => {
			ignore = true
		}
	}, [])

	// A section with nothing to say draws nothing at all.
	if (!live) return null

	const format = FORMATS[live.format]?.label ?? "Tournament"
	const players = live.participant_count ?? 0

	return (
		<section className="mx-auto w-full max-w-[1240px] px-[clamp(16px,4vw,24px)] pb-[88px]">
			<div className="flex flex-wrap items-center justify-between gap-7 rounded-lg border-[3px] border-blue bg-page p-[clamp(20px,4vw,34px)]">
				<div className="flex min-w-[260px] flex-col gap-3">
					<p className="font-mono text-xs tracking-[0.18em] text-blue-soft">LIVE TOURNAMENT</p>
					<h2 className="font-title text-[clamp(25px,5vw,32px)] font-extrabold text-white">{live.name}</h2>
					<p className="text-[15px] text-white/70">
						{format}, {players} {players === 1 ? "player" : "players"}.
					</p>
				</div>

				<dl className="flex flex-wrap gap-7 font-mono">
					<div className="flex flex-col gap-1.5">
						<dt className="text-[11px] tracking-[0.14em] text-muted">FORMAT</dt>
						<dd className="text-[26px] font-bold text-white">{format}</dd>
					</div>
					<div className="flex flex-col gap-1.5">
						<dt className="text-[11px] tracking-[0.14em] text-muted">PLAYERS</dt>
						<dd className="text-[26px] font-bold text-white">{players}</dd>
					</div>
				</dl>

				<Link
					to={`/tournament/${live.id}`}
					className="rounded-md bg-blue px-[30px] py-[18px] font-mono text-[15px] font-bold tracking-[0.06em] text-white transition-colors hover:bg-blue-hover"
				>
					OPEN TOURNAMENT →
				</Link>
			</div>
		</section>
	)
}

export default TournamentBanner
