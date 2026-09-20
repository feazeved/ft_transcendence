import { URGENT_SECONDS } from "@/components/game/arena.js"

// The one line above the arena: what the table is waiting for, how long the turn
// still has, and which way play is going.
//
// It wraps rather than shrinks, so on a phone the three parts stack instead of
// being squeezed. The countdown is hidden altogether when there is nothing to
// count: a room with no turn timer, or a turn the server never stamped (§2.4).
function TableStatus({ status, myTurn = false, seconds = null, waitingFor = "", direction = 1 }) {
	const urgent = seconds !== null && seconds <= URGENT_SECONDS

	return (
		<div className="flex flex-none flex-wrap items-center gap-x-3.5 gap-y-2.5">
			<p className={`font-mono text-sm ${myTurn ? "font-bold text-yellow" : "text-white/70"}`}>{status}</p>

			{seconds !== null && (
				<span
					className={`flex items-center gap-2 rounded-full border-2 px-3.5 py-[7px] font-mono text-sm font-bold ${
						urgent ? "border-red-soft text-red-soft" : "border-dim text-dim"
					}`}
				>
					<i aria-hidden="true" className="h-2 w-2 rounded-full bg-current" />
					{seconds}S{!myTurn && waitingFor ? ` · ${waitingFor.toUpperCase()}` : ""}
				</span>
			)}

			<span className="flex items-center gap-2.5 rounded-full border border-white/15 bg-bar/80 px-3.5 py-2 font-mono text-[11px] tracking-[0.14em] text-dim">
				DIRECTION OF PLAY
				<i aria-hidden="true" className="font-logo text-base font-bold not-italic text-yellow">
					{direction === 1 ? "→" : "←"}
				</i>
				<span className="text-muted">{direction === 1 ? "CLOCKWISE" : "COUNTER-CLOCKWISE"}</span>
			</span>
		</div>
	)
}

export default TableStatus
