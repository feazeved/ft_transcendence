import { cardName, cardSrc } from "@/lib/cards.js"
import { canPlay } from "@/lib/game.js"

// My own cards, fanned along the bottom.
//
// --card is one card's width. Every card after the first is pulled left by a
// negative margin, so the whole hand always fits the row and simply overlaps more
// as it grows: 22 cards fit on a laptop without a scrollbar.
//
// Nothing is dimmed, because a hand you can't read is worse than a hand you can't
// play: what is playable is *raised* instead. On my turn that is every legal card;
// out of turn it is the jump-in cards, which also get a blue outline. The card
// waiting on a choice stands highest of all, and clicking it again takes the
// choice back.
function Hand({ hand, game, choice = null, enabled = true, onPlay, onCancel }) {
	const isOver = game.winner_id != null
	const myTurn = !isOver && game.current_player_id === game.your_player_id

	return (
		<ul className="flex flex-none justify-center pt-[clamp(4px,1vh,12px)]" style={{ "--card": "min(clamp(52px,14vw,108px),15vh)" }}>
			{hand.map((card, i) => {
				const chosen = choice?.index === i
				const playable = !choice && canPlay(card, game)
				const jumpable = playable && !myTurn
				const lift = chosen
					? "-translate-y-[38px]"
					: playable
						? `${jumpable ? "-translate-y-[10px]" : "-translate-y-[18px]"} enabled:hover:-translate-y-[26px]`
						: "enabled:hover:-translate-y-2"

				return (
					<li
						key={`${card.color}-${card.card_type}-${card.value}-${i}`}
						className="flex-none"
						style={
							i === 0
								? { width: "var(--card)" }
								: {
										width: "var(--card)",
										marginLeft: `calc(min(var(--card) * 0.75, (100% - var(--card)) / ${hand.length - 1}) - var(--card))`,
									}
						}
					>
						<button
							type="button"
							disabled={!enabled || (choice != null && !chosen)}
							onClick={() => (chosen ? onCancel?.() : onPlay?.(card, i))}
							aria-label={cardName(card)}
							className={`block w-full transition-transform enabled:cursor-pointer ${lift} ${isOver ? "opacity-45" : ""}`}
						>
							<img
								src={cardSrc(card)}
								alt=""
								className="block w-full rounded-lg"
								style={{
									boxShadow: jumpable
										? "0 0 0 2px #0077B9, 0 8px 20px rgba(0,0,0,0.5)"
										: "0 8px 20px rgba(0,0,0,0.5)",
								}}
							/>
						</button>
					</li>
				)
			})}
		</ul>
	)
}

export default Hand
