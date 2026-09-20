import Seat from "@/components/game/Seat.jsx"
import { arenaSizes } from "@/components/game/arena.js"
import { arcPositions } from "@/lib/game.js"

// Everyone else, on an arc around the pile. My own hand owns the bottom of the
// screen, so the arc is only ever drawn for opponents.
//
// The geometry is `arcPositions` in lib/game.js, tested there. Here it becomes
// CSS: `x` is a percentage of the arena width, and `band` a fraction of the arena
// height *minus one seat*, which is what stops the top of the arc from sliding up
// under the header on a short window. In a really short one (`tight`) the pile has
// moved below the seats, so the seats give it the middle column back.
//
// A seat is only a <button> while a Seven swap is being aimed. The rest of the
// time there is nothing to click, and a row of disabled buttons would have a
// screen reader announcing "button, unavailable" once per opponent.
function OpponentArc({
	opponents,
	currentPlayerId,
	compact = false,
	tight = false,
	seconds = null,
	totalSeconds = null,
	targeting = false,
	onPick,
}) {
	const spots = arcPositions(opponents.length, { tight })
	const { reserve, seatWidth, avatar } = arenaSizes(compact)

	return (
		<ul className="absolute inset-0">
			{opponents.map((player, i) => {
				const isTurn = player.player_id === currentPlayerId
				const seat = (
					<Seat
						player={player}
						index={i}
						isTurn={isTurn}
						compact={compact}
						avatarSize={avatar}
						seconds={isTurn ? seconds : null}
						totalSeconds={totalSeconds}
					/>
				)

				return (
					<li
						key={player.player_id}
						className={`absolute -translate-x-1/2 ${player.is_connected ? "" : "opacity-50"}`}
						style={{
							left: `${spots[i].x}%`,
							top: `calc((100% - ${reserve}px) * ${spots[i].band})`,
							width: seatWidth,
						}}
					>
						{targeting ? (
							<button
								type="button"
								onClick={() => onPick?.(player)}
								aria-label={`Swap hands with ${player.name}, ${player.hand_count} cards`}
								className="flex w-full cursor-pointer flex-col items-center rounded-lg border-2 border-dashed border-yellow bg-yellow/5 px-1 py-[clamp(4px,0.7vh,7px)] transition-colors hover:border-white hover:bg-yellow/20"
							>
								{seat}
							</button>
						) : (
							<span className="flex w-full flex-col items-center rounded-lg border-2 border-transparent px-1 py-[clamp(4px,0.7vh,7px)]">
								{seat}
							</span>
						)}
					</li>
				)
			})}
		</ul>
	)
}

export default OpponentArc
