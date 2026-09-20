import { useEffect, useRef, useState } from "react"
import ActionBar from "@/components/game/ActionBar.jsx"
import CenterPile from "@/components/game/CenterPile.jsx"
import Hand from "@/components/game/Hand.jsx"
import OpponentArc from "@/components/game/OpponentArc.jsx"
import ResultPanel from "@/components/game/ResultPanel.jsx"
import SpectatorNote from "@/components/game/SpectatorNote.jsx"
import SwapPrompt from "@/components/game/SwapPrompt.jsx"
import TableNotices from "@/components/game/TableNotices.jsx"
import TableStatus from "@/components/game/TableStatus.jsx"
import { COMPACT_HEIGHT, TIGHT_HEIGHT } from "@/components/game/arena.js"
import { ErrorMessage } from "@/components/ui/Message.jsx"
import { canPlay, gameNotices, nextPlayer, offersSwap, playerById, seatOrder, secondsLeft } from "@/lib/game.js"
import { useNow } from "@/lib/useNow.js"

// How long the card I just drew stays on screen before the turn passes by itself.
const AUTO_PASS_MS = 1200

// How long a notice stays up. It is not a timer: the clock that ticks for the
// countdown expires the notices too (see below).
const NOTICE_MS = 3200

// The game, in one screen. This file holds only the state that several sections
// share and puts the sections in order; every piece of markup lives in a section
// of its own.
//
// The state it keeps:
// - `pending`: the choice a card is waiting on (a wild's colour, a 7's target).
//   It has to live here because Hand, OpponentArc and ActionBar all read it.
// - `notices`: what just happened, worked out by comparing the last state with the
//   new one, since the server sends no events.
//
// `error` is the room's last refused move — `{ text, at }`, not a string. It is
// drawn like a notice and expires like one, on the same clock, because a warning
// about a card that could not be played has no business sitting on the table for
// the rest of the game.
// - `arenaHeight`: measured, not guessed. Under COMPACT_HEIGHT the table switches
//   to its compact set, and under TIGHT_HEIGHT the seats also clear the middle
//   column, which is where the pile has had to move.
function GameTable({ game, send, error, onRematch, rematchBusy }) {
	const [pending, setPending] = useState(null) // { card, index, pick: "color" | "swap" | "target", at }
	const [notices, setNotices] = useState([]) // [{ id, text, at }]
	const [arena, setArena] = useState(null)
	const [arenaHeight, setArenaHeight] = useState(0)

	const passedFor = useRef(null)
	// The state as it was before this render's `game`, and the target_id I sent with
	// a 7. Refs, not state: changing them must not cause a render, and they have to
	// survive from one render to the next.
	const previous = useRef(null)
	const swapTarget = useRef(null)
	const nextNoticeId = useRef(0)

	const now = useNow()

	const isOver = game.winner_id != null
	const me = playerById(game, game.your_player_id)
	const myTurn = !isOver && game.current_player_id === game.your_player_id
	const canDraw = myTurn && !game.has_drawn_this_turn
	const current = playerById(game, game.current_player_id)
	const upNext = nextPlayer(game)
	const hand = me?.hand ?? []
	const seconds = secondsLeft(game, now)
	const compact = arenaHeight > 0 && arenaHeight < COMPACT_HEIGHT
	const tight = arenaHeight > 0 && arenaHeight < TIGHT_HEIGHT

	// A card's own identity isn't enough to know whether a choice is still about
	// the same moment in the game: `moment` changes whenever the turn, the draw pile
	// or my hand does, which drops a stale colour picker instead of applying it to
	// whatever card now sits at that index.
	const moment = `${game.current_player_id}:${game.draw_pile_count}:${hand.length}`
	const handEnabled = myTurn || (!isOver && Boolean(game.settings?.jump_in))
	const choice = !isOver && pending?.at === moment ? pending : null

	const mustPass = myTurn && game.has_drawn_this_turn && !hand.some((card) => canPlay(card, game))

	// Drawing is the move now — there is no Pass button. The engine still ends a
	// turn with `pass_turn` after a `draw_card`, so the table sends it itself once
	// the drawn card turns out to be unplayable. It is deliberately not sent with
	// the draw: under Draw until playable you keep drawing until something plays,
	// and passing straight away would throw the turn out.
	useEffect(() => {
		if (!mustPass || passedFor.current === moment) return undefined
		const timer = setTimeout(() => {
			if (send({ action: "pass_turn" }) !== false) passedFor.current = moment
		}, AUTO_PASS_MS)
		return () => clearTimeout(timer)
	}, [mustPass, moment, send])

	// One ResizeObserver, on the arena. `observe` fires straight away with the
	// current size, so there is nothing to measure by hand.
	useEffect(() => {
		if (!arena || typeof ResizeObserver !== "function") return undefined
		const watch = new ResizeObserver(([entry]) => setArenaHeight(Math.round(entry.contentRect.height)))
		watch.observe(arena)
		return () => watch.disconnect()
	}, [arena])

	// Every new payload is compared with the one before it. The comparison happens
	// first, then `previous` is moved on — the other way round there would be
	// nothing left to compare against.
	//
	// The notices carry the time they were made and are dropped from the list on the
	// next arrival. What takes them off the screen is `now`, the clock that already
	// ticks for the countdown, so there is no second timer to start, clear, or leak.
	useEffect(() => {
		// The same payload twice is not news, and it must not throw away a target_id
		// that is still waiting for the state that answers it.
		if (previous.current === game) return
		const fresh = gameNotices(previous.current, game, swapTarget.current)
		previous.current = game
		swapTarget.current = null
		if (fresh.length === 0) return
		const at = Date.now()
		const batch = fresh.map((text) => ({ id: nextNoticeId.current++, text, at }))
		setNotices((shown) => [...shown.filter((notice) => at - notice.at < NOTICE_MS), ...batch])
	}, [game])

	const others = me ? seatOrder(game).slice(1) : game.players
	const visibleNotices = notices.filter((notice) => now - notice.at < NOTICE_MS)
	// The refusal keeps the notices' lifetime, off the same ticking clock: there
	const errorText = error && now - error.at < NOTICE_MS ? error.text : ""

	const status = isOver
		? "Game over."
		: !me
			? `Watching ${current?.name ?? "…"}`
			: mustPass
				? "Nothing to play · passing…"
				: `${myTurn ? "Your turn" : `Waiting for ${current?.name ?? "…"}`} · next: ${
						upNext === me ? "you" : upNext?.name ?? "…"
					}`

	const playCard = (card, index) => {
		if (card.color === "wild") return setPending({ card, index, pick: "color", at: moment })
		if (offersSwap(card, game)) return setPending({ card, index, pick: "swap", at: moment })
		send({ action: "play_card", card })
	}

	// Sends the card the choice was about, with whatever the choice added. A
	// target_id is kept in a ref as well: the answering state is the only thing that
	// says a swap happened, and it can't say who with.
	const finish = (extra = {}) => {
		if (extra.target_id) swapTarget.current = extra.target_id
		send({ action: "play_card", card: choice.card, ...extra })
		setPending(null)
	}

	return (
		<section className="relative mx-auto flex min-h-0 w-full max-w-[1240px] flex-1 flex-col gap-[clamp(6px,1.2vh,16px)] px-[clamp(14px,4vw,24px)] pb-[clamp(74px,9vh,88px)] pt-[clamp(10px,1.8vh,24px)] text-white">
			<TableStatus
				status={status}
				myTurn={myTurn}
				seconds={me && !isOver ? seconds : null}
				waitingFor={current?.name ?? ""}
				direction={game.direction}
			/>

			{/* The arena. `mt-auto` pushes it down so the seats sit as close to the
			    hand as the height allows, and max-height keeps a tall window from
			    stretching the arc away from the pile. */}
			<div
				ref={setArena}
				className={`relative mt-auto flex max-h-[clamp(210px,46vh,430px)] min-h-0 flex-1 justify-center py-[clamp(4px,1vh,12px)] ${
					compact ? "items-start" : "items-center"
				}`}
			>
				<OpponentArc
					opponents={others}
					currentPlayerId={isOver ? null : game.current_player_id}
					compact={compact}
					tight={tight}
					seconds={seconds}
					totalSeconds={game.turn_timer_seconds}
					targeting={choice?.pick === "target"}
					onPick={(player) => finish({ target_id: player.player_id })}
				/>
				<CenterPile
					game={game}
					canDraw={canDraw}
					onDraw={() => send({ action: "draw_card" })}
					compact={compact}
				/>
			</div>

			<TableNotices notices={visibleNotices} />

			{me && !isOver && (
				<div className="flex flex-none flex-wrap items-center justify-center gap-3">
					{game.settings?.seven_swap && (
						<SwapPrompt
							step={choice?.pick}
							onYes={() => setPending({ ...choice, pick: "target" })}
							onNo={() => finish()}
						/>
					)}
					<ActionBar
						picking={choice?.pick === "color"}
						choosing={Boolean(choice)}
						onPickColor={(color) => finish({ chosen_color: color })}
						onCancel={() => setPending(null)}
					/>
				</div>
			)}

			{errorText && <ErrorMessage boxed className="self-center">{errorText}</ErrorMessage>}

			{me ? (
				<Hand
					hand={hand}
					game={game}
					choice={choice}
					enabled={handEnabled}
					onPlay={playCard}
					onCancel={() => setPending(null)}
				/>
			) : (
				<SpectatorNote count={game.spectator_count} />
			)}

			{isOver && (
				<ResultPanel
					winner={playerById(game, game.winner_id)?.name ?? "Somebody"}
					iWon={game.winner_id === game.your_player_id}
					onRematch={onRematch}
					busy={rematchBusy}
					tournamentCode={game.tournament}
				/>
			)}
		</section>
	)
}

export default GameTable
