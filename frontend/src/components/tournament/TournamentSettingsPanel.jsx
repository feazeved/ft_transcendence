import HouseRuleChips from "@/components/room/HouseRuleChips.jsx"

// How the host set the tournament up.
//
// A `<dl>` in an `<aside>`: label/value pairs are a description list, which is
// what the HTML is for — the same shape as `room/RoomSettingsPanel.jsx`.
//
// The house rules are drawn by **`room/HouseRuleChips.jsx`, reused from area 03**
// rather than copied. That component takes a settings object and nothing else —
// no room, no tournament, just the five keys — and because a tournament keeps its
// settings flat, the tournament object *is* that object. The names come from
// `lib/rooms.js`, which spells them exactly as CONTEXT.md does, and the group is
// called "House rules" everywhere, never the design's "OPTIONAL RULES".
//
// The last rows depend on the format, because the two formats are set up
// differently: a knockout has one match per round and an optional best-of-3
// final, a best-of has several matches every round.
function TournamentSettingsPanel({ tournament }) {
	const rows = [
		["Players", tournament.max_participants],
		["Players per table", tournament.players_per_table],
		["Advance per table", tournament.advance_per_table],
		["Starting cards", tournament.starting_hand_size],
		["Turn timer", `${tournament.turn_timer_seconds}s`],
		...(tournament.format === "knockout"
			? [["Final", tournament.final_best_of_3 ? "Best of 3" : "1 match"]]
			: [
					["Matches per round", tournament.matches_per_round],
					["Matches in the final", tournament.matches_in_final],
				]),
	]

	return (
		<aside className="flex flex-[0_1_300px] flex-col gap-5 rounded-lg border border-white/10 border-t-4 border-t-blue bg-panel p-6">
			<h2 className="font-logo text-[19px] font-bold text-white">Settings</h2>

			<dl className="flex flex-col gap-[11px] text-sm">
				{rows.map(([label, value]) => (
					<div key={label} className="flex items-baseline justify-between gap-3">
						<dt className="text-white/70">{label}</dt>
						<dd className="font-mono text-white">{value ?? "—"}</dd>
					</div>
				))}
			</dl>

			<div className="flex flex-col gap-2.5 border-t border-white/10 pt-4">
				<h3 className="text-sm text-white/70">House rules</h3>
				<HouseRuleChips settings={tournament} />
			</div>
		</aside>
	)
}

export default TournamentSettingsPanel
