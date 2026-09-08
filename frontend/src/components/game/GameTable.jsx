import { useState } from "react"
import { cardSrc, CARD_BACK, COLOR_HEX } from "@/lib/cards.js"

const WILD_COLORS = ["red", "yellow", "green", "blue"]

// The table while a game is running.
//
// This is a pure function of its props on purpose: no socket, no router, no api
// calls. Everything it draws comes from `game`, and everything it does goes out
// through `send`. That's what lets it be rendered against a fixture payload
// without a backend — see the plan's step 1.
//
// TEMPORARY. This is a plain panel so the socket can be exercised end to end;
// it is not the table. Replace it with the real one.
function GameTable({ game, send, error }) {
	const [pendingWild, setPendingWild] = useState(null)

	const me = game.players.find((p) => p.player_id === game.your_player_id)
	const myTurn = game.current_player_id === game.your_player_id
	const glow = COLOR_HEX[game.current_color]

	const playCard = (card) => {
		if (card.color === "wild") return setPendingWild(card)
		send({ action: "play_card", card })
	}
	const playWild = (color) => {
		send({ action: "play_card", card: pendingWild, chosen_color: color })
		setPendingWild(null)
	}

	return (
		<section className="mx-auto w-[min(88vw,860px)] py-4 text-white">
			<p className="mb-4 rounded-lg border border-yellow/40 bg-yellow/10 px-3 py-2 text-xs text-white/70">
				Placeholder table — wiring check only.
			</p>

			<div className="mb-6 flex items-center justify-center gap-8">
				<img src={CARD_BACK} alt="draw pile" className="w-20" />
				<div
					className="rounded-xl"
					style={{ boxShadow: `0 0 0 4px ${glow}, 0 0 28px 6px ${glow}88` }}
				>
					<img src={cardSrc(game.top_card)} alt="top card" className="w-20" />
				</div>
			</div>

			<p className="mb-4 text-center">
				{game.winner_id
					? "Game over."
					: myTurn
						? "Your turn."
						: `Waiting for ${game.players.find((p) => p.player_id === game.current_player_id)?.name ?? "…"}.`}
			</p>

			<ul className="mb-6 flex justify-center gap-4 text-sm text-white/70">
				{game.players.map((p) => (
					<li key={p.player_id} className={p.player_id === game.current_player_id ? "font-bold text-white" : ""}>
						{p.name} · {p.hand_count} {p.is_connected ? "" : "(away)"}
					</li>
				))}
			</ul>

			{game.you_are_spectating ? (
				<p className="text-center text-white/50">You're watching this game.</p>
			) : (
				<>
					<div className="flex flex-wrap justify-center gap-2">
						{me?.hand?.map((card, i) => (
							<button
								key={`${card.color}-${card.card_type}-${card.value}-${i}`}
								type="button"
								disabled={!myTurn}
								onClick={() => playCard(card)}
								className="transition-transform hover:scale-110 disabled:opacity-40 cursor-pointer"
							>
								<img src={cardSrc(card)} alt="" className="w-16" />
							</button>
						))}
					</div>

					{pendingWild && (
						<div className="mt-4 flex items-center justify-center gap-2">
							<span className="text-sm text-white/60">Pick a colour:</span>
							{WILD_COLORS.map((color) => (
								<button
									key={color}
									type="button"
									onClick={() => playWild(color)}
									style={{ background: COLOR_HEX[color] }}
									className="h-8 w-8 rounded-full cursor-pointer"
									aria-label={color}
								/>
							))}
						</div>
					)}

					<div className="mt-6 flex justify-center gap-3">
						<button
							type="button"
							disabled={!myTurn}
							onClick={() => send({ action: "draw_card" })}
							className="rounded-lg border border-white px-5 py-2 font-bold cursor-pointer disabled:opacity-40"
						>
							Draw
						</button>
						<button
							type="button"
							disabled={!myTurn || !game.has_drawn_this_turn}
							onClick={() => send({ action: "pass_turn" })}
							className="rounded-lg border border-white px-5 py-2 font-bold cursor-pointer disabled:opacity-40"
						>
							Pass
						</button>
					</div>
				</>
			)}

			{error && <p role="alert" className="mt-4 text-center text-sm text-red-400">{error}</p>}
		</section>
	)
}

export default GameTable
