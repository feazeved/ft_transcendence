import { enabledRuleLabels } from "@/lib/rooms.js"

// One open room. The whole card isn't a link: JOIN is the action, and the code
// next to it is there to be read and shared.
function RoomCard({ room, onJoin }) {
	const houseRules = enabledRuleLabels(room)
	const rules =
		houseRules.length === 0
			? "CLASSIC RULES"
			: `${houseRules.length} HOUSE RULE${houseRules.length === 1 ? "" : "S"}`

	return (
		<li className="flex flex-col gap-4 rounded-lg border border-white/10 border-t-4 border-t-red bg-panel p-[22px]">
			<div className="flex items-start justify-between gap-3">
				<div className="flex min-w-0 flex-col gap-1.5">
					<h3 className="truncate font-title text-[22px] font-bold text-white">{room.name || "Room"}</h3>
					<p className="font-mono text-[11px] tracking-[0.12em] text-muted">
						{rules} · {room.max_seats} MAX
					</p>
				</div>
				<p className="flex-none rounded border border-[#1e4a33] px-2.5 py-1.5 font-mono text-[13px] text-green">
					{room.player_count}/{room.max_seats}
				</p>
			</div>

			<div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3.5">
				<p className="font-mono text-xs text-muted">CODE {room.join_code}</p>
				<button
					type="button"
					onClick={() => onJoin(room)}
					className="cursor-pointer rounded-md border-2 border-green px-[18px] py-2.5 font-mono text-xs font-bold tracking-[0.08em] text-green-soft transition-colors hover:bg-green hover:text-on-green"
				>
					JOIN
				</button>
			</div>
		</li>
	)
}

export default RoomCard
