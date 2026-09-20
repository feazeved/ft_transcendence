import { enabledRuleLabels } from "@/lib/rooms.js"

// The house rules a room or a tournament has switched on, as chips — or the one
// line that says it has none.
//
// It takes a settings object and nothing else: no room, no tournament, just the
// five keys. That is why the tournament pages can reuse it (area 06). The names
// come from lib/rooms.js, which keeps them exactly as CONTEXT.md writes them, and
// "House rules" is the group's name everywhere — never "Optional rules", which is
// what the design's label says.
function HouseRuleChips({ settings }) {
	const rules = enabledRuleLabels(settings)

	if (rules.length === 0) {
		return <p className="font-mono text-xs text-muted">Classic rules only.</p>
	}

	return (
		<ul className="flex flex-wrap gap-2">
			{rules.map((label) => (
				<li key={label} className="rounded-[5px] bg-blue px-[11px] py-1.5 font-mono text-[11px] text-white">
					{label}
				</li>
			))}
		</ul>
	)
}

export default HouseRuleChips
