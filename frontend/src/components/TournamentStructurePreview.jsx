import { computeStructure, MAX_RECOMMENDED_ROUNDS } from "@/lib/tournamentStructure.js"

// Condensed "20 players → 4 tables → 8 players → 2 tables → final of 4 · 3
// rounds" line, live in CreateTournamentModal and static in TournamentDetail.
// Pure presentation over computeStructure() — no state of its own.
const TournamentStructurePreview = ({ config }) => {
	const structure = computeStructure(config)

	if (!structure.converged) {
		return (
			<p role="alert" className="text-sm text-red-400">
				With this table size and this many players advancing, the tournament never reduces to a single final table.
			</p>
		)
	}

	const chain = structure.rounds
		.map((r) => (r.isFinal ? `final of ${r.players}` : `${r.players} players → ${r.tables} tables`))
		.join(" → ")

	return (
		<div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm">
			<p className="text-white/90">
				{chain} <span className="text-white/50">· {structure.totalRounds} rounds</span>
			</p>
			{structure.tooManyRounds && (
				<p className="mt-1 text-amber-400">
					Heads up: {structure.totalRounds} rounds is more than recommended ({MAX_RECOMMENDED_ROUNDS}).
				</p>
			)}
		</div>
	)
}

export default TournamentStructurePreview
