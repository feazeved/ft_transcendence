import Avatar from "@/components/ui/Avatar.jsx"
import table from "@/assets/table-2.png"

// One seat's circle. The lobby's seats size themselves, so Avatar fills the circle.
const SEAT_CIRCLE = "clamp(46px,13vw,74px)"

// The round table, with the seats set around it.
//
// How a seat gets into position: the <li> is stretched over the whole square and
// rotated around its centre, which swings the little box at its top edge round to
// the right place; the content is then rotated back by the same angle so the photo
// and the name stay upright. One rotation for the position, one to undo it.
//
// A seat is only a button when there is something to do with it. A taken seat has
// no action, so it is plain content — the old lobby made every seat a disabled
// button, which has a screen reader announcing "button, unavailable" all the way
// round the table. "Sit here" posts to `/games/<code>/seat/`, which has existed
// since 2026-09-18 (§1.2) — before that the click only ever came back a 404.
function LobbyTable({ seats, mySeat, onSeat }) {
	const count = seats.length || 1

	return (
		<div className="relative mx-auto aspect-square w-full max-w-[560px]">
			<img
				src={table}
				alt=""
				className="pointer-events-none absolute left-1/2 top-1/2 w-[62%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
			/>

			<ul className="absolute inset-0">
				{seats.map((player, i) => {
					const spin = (360 / count) * i
					const mine = mySeat === i
					const upright = { transform: `rotate(${-spin}deg)` }
					const circle = { width: SEAT_CIRCLE, height: SEAT_CIRCLE }

					const border = mine
						? "border-solid border-white"
						: player
							? player.is_connected
								? "border-solid border-white/20"
								: "border-solid border-white/10"
							: "border-dashed border-white/30 group-hover:border-white"

					const face = (
						<>
							<span
								className={`relative flex flex-none items-center justify-center rounded-full border-2 bg-white/5 ${border}`}
								style={mine ? { ...circle, boxShadow: "0 0 22px rgba(255,255,255,0.25)" } : circle}
							>
								{player ? (
									<Avatar src={player.avatar_url} name={player.username ?? ""} size="fill" />
								) : (
									<span aria-hidden="true" className="font-mono text-xl text-muted">
										+
									</span>
								)}
								{player?.is_host && (
									<span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue px-2 py-[3px] font-mono text-[10px] font-bold tracking-[0.1em] text-white">
										host
									</span>
								)}
							</span>
							<span
								className={`whitespace-nowrap font-title text-[clamp(12px,3vw,17px)] font-bold ${
									player ? "text-white" : "text-muted"
								}`}
							>
								{player ? player.username : "Sit here"}
							</span>
						</>
					)

					return (
						<li
							key={i}
							className={`pointer-events-none absolute inset-0 ${player && !player.is_connected ? "opacity-50" : ""}`}
							style={{ transform: `rotate(${spin}deg)` }}
						>
							<div className="absolute left-1/2 top-[2%] w-[24%] -translate-x-1/2">
								{player ? (
									<span
										className="pointer-events-auto flex w-full flex-col items-center gap-2.5 text-center"
										style={upright}
									>
										{face}
									</span>
								) : (
									<button
										type="button"
										onClick={() => onSeat(i)}
										aria-label={`Sit in seat ${i + 1}`}
										className="group pointer-events-auto flex w-full cursor-pointer flex-col items-center gap-2.5 text-center"
										style={upright}
									>
										{face}
									</button>
								)}
							</div>
						</li>
					)
				})}
			</ul>
		</div>
	)
}

export default LobbyTable
