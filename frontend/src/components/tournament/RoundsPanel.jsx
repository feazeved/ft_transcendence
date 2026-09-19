import { useId } from "react"
import { Link } from "react-router"
import Avatar from "@/components/ui/Avatar.jsx"
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/tournaments.js"

// The tables of each round, and who is sitting at them.
//
// `StructurePanel` beside this one says how many tables there *will* be, worked
// out from the settings. This says who is actually at them, from `rounds` on the
// tournament itself — so once a round starts there is a draw on screen instead
// of a page that looks exactly as it did before the host pressed the button.
//
// A table you are sitting at is a link, because that is where you are expected;
// everybody else's is text. Nothing is stored here: "is this mine" is derived
// from the players on every render, so it cannot drift from the roster above.
function RoundsPanel({ rounds = [], myPublicId }) {
	const headingId = useId()

	// Before the first round there is nothing to draw, and an empty heading is
	// worse than no heading.
	if (rounds.length === 0) return null

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3.5">
			<h2 id={headingId} className="font-logo text-[19px] font-bold text-white">
				Tables
			</h2>

			<ol className="flex flex-col gap-4">
				{rounds.map((round) => (
					<li key={round.round} className="flex flex-col gap-2.5">
						<p className="font-mono text-[11px] tracking-[0.14em] text-muted">ROUND {round.round}</p>

						<ul className="grid gap-2.5 sm:grid-cols-2">
							{round.matches.map((match) => {
								const mine = match.players.some((player) => player.user?.public_id === myPublicId)
								return (
									<li
										key={match.public_id}
										className={`flex flex-col gap-2.5 rounded-md border bg-panel px-[18px] py-4 ${
											mine ? "border-blue" : "border-white/10"
										}`}
									>
										<span className="flex items-center justify-between gap-3">
											<span
												className={`font-mono text-[11px] tracking-[0.14em] ${
													STATUS_COLORS[match.status] ?? "text-muted"
												}`}
											>
												{(STATUS_LABELS[match.status] ?? match.status).toUpperCase()}
											</span>
											{mine && match.status !== "finished" && (
												<Link
													to={`/room/${match.public_id}`}
													className="font-mono text-[11px] tracking-[0.14em] text-yellow underline underline-offset-4"
												>
													YOUR TABLE
												</Link>
											)}
										</span>

										<ul className="flex flex-wrap gap-2">
											{match.players.map((player) => {
												const won = Boolean(match.winner) && player.user?.public_id === match.winner.public_id
												return (
													<li
														key={player.id}
														className={`flex items-center gap-2 rounded-[5px] py-1.5 pl-1.5 pr-3 font-mono text-xs ${
															won ? "bg-yellow/15 text-yellow" : "bg-white/8 text-white/80"
														}`}
													>
														<Avatar src={player.user?.avatar_url} name={player.display_name} size="chip" />
														{player.display_name}
														{won && " · won"}
													</li>
												)
											})}
										</ul>
									</li>
								)
							})}
						</ul>
					</li>
				))}
			</ol>
		</section>
	)
}

export default RoundsPanel
