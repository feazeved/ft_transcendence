import { useEffect, useRef, useState } from "react"
import { cardSrc, CARD_BACK, COLOR_HEX } from "@/lib/cards.js"
import table from "@/assets/table_inclined.png"
import Seat from "@/components/game/Seat.jsx"
import { arcPositions, canPlay, nextPlayer, offersSwap, seatOrder } from "@/lib/game.js"

const WILD_COLORS = ["red", "yellow", "green", "blue"]

// How long the card I just drew stays on screen before the turn passes by itself.
const AUTO_PASS_MS = 1200

function GameTable({ game, send, error }) {
	const [pending, setPending] = useState(null) // { card, index, pick: "color" | "swap" | "target", at }
	const passedFor = useRef(null)
	const isOver = game.winner_id != null
	const me = game.players.find((p) => p.player_id === game.your_player_id)
	const myTurn = !isOver && game.current_player_id === game.your_player_id
	const canDraw = myTurn && !game.has_drawn_this_turn
	const current = game.players.find((p) => p.player_id === game.current_player_id)
	const next = nextPlayer(game)
	const glow = COLOR_HEX[game.current_color]
	const hand = me?.hand ?? []


	const moment = `${game.current_player_id}:${game.draw_pile_count}:${hand.length}`
	const handEnabled = myTurn || (!isOver && Boolean(game.settings?.jump_in))
	const choice = !isOver && pending?.at === moment ? pending : null

	const mustPass = myTurn && game.has_drawn_this_turn && !hand.some((card) => canPlay(card, game))

	useEffect(() => {
		if (!mustPass || passedFor.current === moment) return
		const timer = setTimeout(() => {
			if (send({ action: "pass_turn" }) !== false) passedFor.current = moment
		}, AUTO_PASS_MS)
		return () => clearTimeout(timer)
	}, [mustPass, moment, send])

	const others = me ? seatOrder(game).slice(1) : game.players
	const spots = arcPositions(others.length)

	const status = isOver
		? "Game over."
		: mustPass
			? "Nothing to play · passing…"
			: `${myTurn ? "Your turn" : `Waiting for ${current?.name ?? "…"}`} · next: ${next === me ? "you" : next.name}`

	const playCard = (card, index) => {
		if (card.color === "wild") return setPending({ card, index, pick: "color", at: moment })
		if (offersSwap(card, game)) return setPending({ card, index, pick: "swap", at: moment })
		send({ action: "play_card", card })
	}

	const finish = (chosen = {}) => {
		send({ action: "play_card", card: choice.card, ...chosen })
		setPending(null)
	}

	return (
		<section className="mx-auto flex min-h-0 w-[min(94vw,1100px)] flex-1 flex-col text-white">
			{/* The table area takes the height the hand leaves over. The absolute box
			    inside gets that size before its contents are laid out, which is what
			    makes cqw and cqh (its width and height) usable. As a plain flex item
			    it would measure 0 tall, because the page's height isn't fixed. */}
			<div className="relative min-h-0 flex-1">
				<div className="absolute inset-0 flex items-end justify-center [container-type:size]">
					{/* The table keeps a 16:9 shape, as big as fits. */}
					<div className="relative aspect-video w-[min(100cqw,calc(100cqh*16/9))] [container-type:inline-size]">
						<img
							src={table}
							alt=""
							className="pointer-events-none absolute left-1/2 top-[30%] w-[64%] -translate-x-1/2 drop-shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
						/>
						<div className="absolute left-1/2 top-[60%] flex -translate-x-1/2 -translate-y-1/2 items-start gap-[3cqw]">
							{/* The draw pile is the Draw button, glowing while I'm allowed to draw. */}
							<button
								type="button"
								disabled={!canDraw}
								onClick={() => send({ action: "draw_card" })}
								aria-label={`Draw a card, ${game.draw_pile_count} left`}
								className="flex w-[7cqw] cursor-pointer flex-col items-center gap-[0.6cqw] transition-transform enabled:hover:-translate-y-[0.6cqw] disabled:cursor-default"
							>
								<span
									className="relative w-full rounded-[0.6cqw]"
									style={canDraw ? { boxShadow: "0 0 2.5cqw 0.6cqw rgba(255,255,255,0.7)" } : undefined}
								>
									<img src={CARD_BACK} alt="" className="w-full" />
								</span>
								<span className={`text-[max(11px,1.3cqw)] font-bold uppercase tracking-wide ${canDraw ? "" : "invisible"}`}>
									Draw
								</span>
							</button>

							<div className="flex w-[7cqw] flex-col items-center gap-[0.6cqw]">
								<img
									src={cardSrc(game.top_card)}
									alt={`Top card, ${game.current_color} in play`}
									className="w-full rounded-[0.6cqw]"
									style={{ boxShadow: `0 0 0 0.35cqw ${glow}, 0 0 2.5cqw 0.5cqw ${glow}88` }}
								/>
								{/* The colour in play, in words: after a wild the card is black, and a
								    glow on its own doesn't help a colour-blind player. */}
								<span className="flex items-center gap-[0.5cqw] text-[max(11px,1.3cqw)] font-bold uppercase tracking-wide">
									<span className="size-[max(8px,1cqw)] rounded-full" style={{ background: glow }} />
									{game.current_color}
								</span>
							</div>
						</div>
					</div>

					{/* Seats use the whole width, not just the table's, so a full table still fits.
					    8% wide: 10 seats (a spectator of a full game) sit 8.4% apart. Once I've
					    said yes to a swap, every seat becomes a button that picks that player. */}
					{others.map((player, i) => {
						const place = { left: `${spots[i].x}%`, top: `calc(${spots[i].y}% + 0.5rem)` }
						const seat = <Seat player={player} isTurn={player.player_id === game.current_player_id} isMe={false} />
						return choice?.pick === "target" ? (
							<button
								key={player.player_id}
								type="button"
								onClick={() => finish({ target_id: player.player_id })}
								aria-label={`Swap hands with ${player.name}`}
								className="absolute w-[min(8%,6.5rem)] -translate-x-1/2 cursor-pointer rounded-xl outline-2 outline-offset-4 outline-yellow/60 transition hover:scale-110 hover:outline-yellow"
								style={place}
							>
								{seat}
							</button>
						) : (
							<div key={player.player_id} className="absolute w-[min(8%,6.5rem)] -translate-x-1/2" style={place}>
								{seat}
							</div>
						)
					})}

					<p className={`absolute bottom-2 left-0 text-sm ${myTurn ? "font-bold text-yellow" : "text-white/70"}`}>
						{status}
						{game.spectator_count > 0 && (
							<span className="ml-3 text-xs font-normal text-white/50">{game.spectator_count} watching</span>
						)}
					</p>

					{me && (
						<div className="absolute bottom-2 right-0 flex items-center gap-2">
							{choice?.pick === "color" && (
								<>
									<span className="text-sm text-white/60">Pick a colour:</span>
									{WILD_COLORS.map((color) => (
										<button
											key={color}
											type="button"
											onClick={() => finish({ chosen_color: color })}
											style={{ background: COLOR_HEX[color] }}
											className="h-8 w-8 cursor-pointer rounded-full"
											aria-label={color}
										/>
									))}
								</>
							)}
							{/* The swap is optional: No plays the 7 as an ordinary card. */}
							{choice?.pick === "swap" && (
								<>
									<span className="text-sm text-white/60">Swap hands with someone?</span>
									<button
										type="button"
										onClick={() => setPending({ ...choice, pick: "target" })}
										className="rounded-lg border border-white px-4 py-1.5 text-sm font-bold cursor-pointer"
									>
										Yes
									</button>
									<button
										type="button"
										onClick={() => finish()}
										className="rounded-lg border border-white px-4 py-1.5 text-sm font-bold cursor-pointer"
									>
										No
									</button>
								</>
							)}
							{choice?.pick === "target" && <span className="text-sm text-white/60">Click a player to swap hands with</span>}
							{choice ? (
								<button
									type="button"
									onClick={() => setPending(null)}
									className="rounded-lg border border-white/30 px-3 py-1.5 text-sm cursor-pointer"
								>
									Cancel
								</button>
							) : (
								<button
									type="button"
									disabled={!myTurn || !game.has_drawn_this_turn}
									onClick={() => send({ action: "pass_turn" })}
									className="rounded-lg border border-white px-4 py-1.5 text-sm font-bold cursor-pointer disabled:opacity-40"
								>
									Pass
								</button>
							)}
						</div>
					)}

					{error && (
						<p role="alert" className="absolute bottom-12 left-1/2 z-10 -translate-x-1/2 rounded-lg bg-red-500/90 px-3 py-1.5 text-sm">
							{error}
						</p>
					)}
				</div>
			</div>

			{me ? (
				// --card is one card's width: 6rem, or less on a short screen. Every card after
				// the first is pulled left so the whole hand fits the row, overlapping more as it grows.
				//
				// Cards I could play right now sit raised: on my turn, or out of turn a card I
				// could jump in with. Nothing gets dimmed, so the whole hand stays easy to read;
				// only a finished game dims it. The card waiting on a choice stands highest, and
				// the rest hold still until the choice is made or cancelled; clicking it again
				// cancels too.
				<div className="flex justify-center pb-3 pt-6" style={{ "--card": "min(6rem, 11dvh)" }}>
					{hand.map((card, i) => {
						const chosen = choice?.index === i
						const lift = chosen
							? "-translate-y-8"
							: !choice && canPlay(card, game)
								? "-translate-y-5 enabled:hover:-translate-y-7"
								: "enabled:hover:-translate-y-2"
						return (
							<button
								key={`${card.color}-${card.card_type}-${card.value}-${i}`}
								type="button"
								disabled={!handEnabled || (choice != null && !chosen)}
								onClick={() => (chosen ? setPending(null) : playCard(card, i))}
								style={i === 0 ? undefined : { marginLeft: `calc(min(var(--card) * 0.75, (100% - var(--card)) / ${hand.length - 1}) - var(--card))` }}
								className={`w-(--card) shrink-0 cursor-pointer transition disabled:cursor-default ${lift} ${isOver ? "opacity-45" : ""}`}
							>
								<img src={cardSrc(card)} alt="" className="w-full" />
							</button>
						)
					})}
				</div>
			) : (
				<p className="pb-4 pt-2 text-center text-white/50">You're watching this game.</p>
			)}
		</section>
	)
}

export default GameTable
