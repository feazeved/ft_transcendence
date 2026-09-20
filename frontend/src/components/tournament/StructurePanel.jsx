import { useId } from "react"
import { MAX_RECOMMENDED_ROUNDS } from "@/lib/tournamentStructure.js"

// The round-by-round shape of a tournament: how many players sit down, at how
// many tables, and how many walk out of each round.
//
// It draws and nothing else. Every number comes from `computeStructure()` in
// `lib/tournamentStructure.js`, which is a pure function with no React in it —
// the same split as the Game Table's derived notices. That is why the create
// dialog can show a live preview by handing it the half-typed form on every
// keystroke, and the detail page can show the same thing from a stored
// tournament: one function, one panel, two callers.
//
// `compact` is the create dialog's version: the same panel a size down, on the
// page background instead of a panel one, because in the dialog it sits *inside*
// a panel already.

// The design cycles four card colours down the rounds and paints the final
// yellow. `edge` is the stripe down the left of a round; `dot` outlines its
// tables.
const ROUND_ACCENTS = [
	{ edge: "border-l-red", dot: "border-red" },
	{ edge: "border-l-blue", dot: "border-blue" },
	{ edge: "border-l-green", dot: "border-green" },
	{ edge: "border-l-yellow", dot: "border-yellow" },
]

const FINAL_ACCENT = { edge: "border-l-yellow", dot: "border-yellow" }

// Eight is enough to read "lots of tables" at a glance; past that the dots stop
// being countable and the line of text beside them is the real answer anyway.
const MAX_DOTS = 8

function roundTitle(round) {
	return round.isFinal ? `Final — ${round.players} players` : `Round ${round.round}`
}

function roundDetail(round) {
	if (round.isFinal) return "One table, winner takes it"
	return `${round.players} players · ${round.tables} tables → ${round.advancing} advance`
}

function StructurePanel({ structure, label = "Structure", compact = false }) {
	const labelId = useId()

	return (
		<section aria-labelledby={labelId} className="flex min-w-0 flex-1 flex-col gap-3.5">
			{compact ? (
				<p id={labelId} className="font-mono text-[11px] tracking-[0.14em] text-muted">
					{label}
				</p>
			) : (
				<h2 id={labelId} className="font-logo text-[19px] font-bold text-white">
					{label}
				</h2>
			)}

			{structure.converged ? (
				<>
					<ol className="flex flex-col gap-2.5">
						{structure.rounds.map((round, index) => {
							const accent = round.isFinal ? FINAL_ACCENT : ROUND_ACCENTS[index % ROUND_ACCENTS.length]
							return (
								<li
									key={round.round}
									className={`flex flex-wrap items-center justify-between gap-3 rounded-md border border-white/10 border-l-4 ${
										accent.edge
									} ${compact ? "bg-page px-[18px] py-4" : "bg-panel px-[22px] py-[18px]"}`}
								>
									<span className="flex min-w-0 flex-col gap-1">
										<span className={`font-logo font-bold text-white ${compact ? "text-base" : "text-[17px]"}`}>
											{roundTitle(round)}
										</span>
										<span className="font-mono text-xs text-white/70">{roundDetail(round)}</span>
									</span>
									{/* The dots are a picture of the line above them, which already says
									    how many tables there are — so they are decorative. */}
									<span aria-hidden="true" className="flex flex-wrap justify-end gap-[5px]">
										{Array.from({ length: Math.min(round.tables, MAX_DOTS) }, (_, table) => (
											<i
												key={table}
												className={`block rounded-[3px] border ${accent.dot} ${
													round.isFinal ? "bg-yellow/10" : "bg-white/5"
												} ${compact ? "h-[30px] w-[22px]" : "h-[34px] w-[26px]"}`}
											/>
										))}
									</span>
								</li>
							)
						})}
					</ol>

					{structure.tooManyRounds && (
						<p className="text-sm text-yellow">
							Heads up: {structure.totalRounds} rounds is more than recommended ({MAX_RECOMMENDED_ROUNDS}).
						</p>
					)}
				</>
			) : (
				<p role="alert" className="rounded-md border border-red bg-red/10 p-[18px] text-[15px] text-red-soft">
					With this table size and this many players advancing, the tournament never reduces to a single final
					table.
				</p>
			)}
		</section>
	)
}

export default StructurePanel
