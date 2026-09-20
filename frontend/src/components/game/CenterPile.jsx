import { arenaSizes } from "@/components/game/arena.js"
import { cardName, cardSrc, CARD_BACK, COLOR_HEX } from "@/lib/cards.js"
import table from "@/assets/table_inclined.png"

// Which card answers a stack, in the words printed on the card itself.
const STACK_ANSWER = { draw_two: "+2", wild_draw_four: "+4" }

// The middle of the table: the draw pile on the left, the top of the discard pile
// on the right, and the stacked-draw badge underneath when one is running.
//
// `draw_stack` has been sent since 2026-09-18 (§2.3); before that it arrived
// nowhere and the badge simply never rendered. Every use stays optional-chained
// anyway — a client outlives the server it was built against, and a missing
// badge is a better failure than a crash. The colour in play is written out in words
// as well as painted as a glow, because after a wild the card is black and a glow
// alone says nothing to a colour-blind player.
function CenterPile({ game, canDraw, onDraw, compact = false }) {
	const { reserve, pileCard } = arenaSizes(compact)
	const glow = COLOR_HEX[game.current_color] ?? "#FFFFFF"
	const stack = game.draw_stack

	return (
		<div
			className="relative isolate flex flex-col items-center gap-[clamp(6px,1.1vh,14px)]"
			// A short arena can't centre the pile and still clear the top seat, so the
			// pile drops below the seat band instead of fighting it for the middle.
			style={{ marginTop: compact ? `${reserve}px` : 0 }}
		>
			{/* The table top, decoration behind the two piles. Hidden in a short arena,
			    where there is no room for it. */}
			{!compact && (
				<img
					src={table}
					alt=""
					className="pointer-events-none absolute left-1/2 top-[38%] -z-10 w-[170%] max-w-none -translate-x-1/2 -translate-y-1/2 opacity-90 drop-shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
				/>
			)}

			<div className="flex items-start justify-center gap-[clamp(14px,5vw,40px)]">
				{/* The draw pile IS the draw button. It glows while drawing is allowed. */}
				<button
					type="button"
					disabled={!canDraw}
					onClick={onDraw}
					aria-label={`Draw a card, ${game.draw_pile_count} left`}
					className="flex flex-col items-center gap-[clamp(5px,0.9vh,10px)] transition-transform enabled:cursor-pointer enabled:hover:-translate-y-1"
					style={{ width: pileCard }}
				>
					<span
						className="block aspect-[2/3] w-full rounded-lg"
						style={canDraw ? { boxShadow: "0 0 18px 3px rgba(255,255,255,0.5)" } : undefined}
					>
						<img src={CARD_BACK} alt="" className="h-full w-full rounded-lg object-cover" />
					</span>
					<span
						className={`font-logo text-sm font-bold tracking-[0.06em] text-white ${canDraw ? "" : "invisible"}`}
					>
						{stack?.count ? `Draw +${stack.count}` : "Draw"}
					</span>
				</button>

				<div className="flex flex-col items-center gap-[clamp(5px,0.9vh,10px)]" style={{ width: pileCard }}>
					<img
						src={cardSrc(game.top_card)}
						alt={`${cardName(game.top_card)} on the pile, ${game.current_color} in play`}
						className="aspect-[2/3] w-full rounded-lg object-cover"
						style={{ boxShadow: `0 0 22px 4px ${glow}88` }}
					/>
					<span className="flex items-center gap-2 font-logo text-sm font-bold uppercase tracking-[0.06em] text-white">
						<i aria-hidden="true" className="h-[11px] w-[11px] rounded-full" style={{ background: glow }} />
						{game.current_color}
					</span>
				</div>
			</div>

			{stack?.count ? (
				<p className="flex flex-wrap items-center justify-center gap-2.5 rounded-full border border-red bg-red/10 px-3.5 py-2 font-mono text-[11px] tracking-[0.14em] text-red-soft">
					<b className="font-logo text-sm text-white">+{stack.count} incoming</b>
					ANSWER WITH {STACK_ANSWER[stack.card_type] ?? "+2"} OR DRAW
				</p>
			) : null}
		</div>
	)
}

export default CenterPile
