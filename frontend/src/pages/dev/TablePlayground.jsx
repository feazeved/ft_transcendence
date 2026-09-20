import { useMemo, useRef, useState } from "react"
import { useSearchParams } from "react-router"
import GameHeader from "@/components/game/GameHeader.jsx"
import GameTable from "@/components/game/GameTable.jsx"
import Footer from "@/components/layout/Footer.jsx"
import Header from "@/components/layout/Header.jsx"
import Lobby from "@/components/room/Lobby.jsx"
import { FIXTURES } from "@/lib/fakeGameState.js"

const SIMULATED_ERROR = "It's not your turn."

const ME = { username: "daniel" }

const now = () => new Date().toISOString()

const CHIP = "shrink-0 rounded-md border px-2 py-0.5 cursor-pointer"
const IDLE = "border-white/10 bg-white/5 hover:border-white/40"
const ON = "border-white bg-white font-bold text-black"

// A fixture's `next` is a patch, not a whole state. It is fixture-only, so it is
// dropped before the payload reaches the table.
function apply(state, advanced) {
	const merged = advanced && state.next ? { ...state, ...state.next } : state
	const copy = { ...merged }
	delete copy.next
	return copy
}

// Dev only — see routes.jsx. Renders the Lobby or the GameTable from a fake payload
// instead of the socket, so every situation (ten players, spectating, game over, a
// stacked draw…) is one click away with no backend and no second browser tab.
//
// It draws the same frame Room does — the site header around a lobby, the slim game
// header around a table, and nothing that scrolls — because the table measures its
// own arena: previewing it inside a taller page would never show the compact arena.
//
// `send` goes nowhere. It records what the table tried to send, which is the part
// worth checking: that a wild carries `chosen_color`, that a 7 carries `target_id`.
//
// **Next state** is what makes the notices visible. The notices come from comparing
// the payload before with the payload after, so they only exist while the table
// keeps its memory: the button swaps the payload without changing the table's `key`,
// which would remount it and wipe that memory.
function TablePlayground() {
	const [params, setParams] = useSearchParams()
	const [sent, setSent] = useState([])
	const [error, setError] = useState("")
	const [connected, setConnected] = useState(true)
	const [advanced, setAdvanced] = useState(false)
	const [turnStartedAt, setTurnStartedAt] = useState(now)
	const nextId = useRef(0)

	// The fixture lives in the URL (?fixture=tenPlayers), so a refresh keeps it.
	const fixture = FIXTURES.find((f) => f.name === params.get("fixture")) ?? FIXTURES[0]

	// Memoised, and not for speed: the table compares each payload with the one
	// before it, so a payload rebuilt on every render would look like a brand new
	// state every time — and would wipe the target_id a Seven swap is waiting on.
	// This way the payload only changes when the fixture or the state does.
	//
	// The fixtures keep a fixed turn_started_at that is long past, so every turn
	// would already have timed out. Picking a fixture (or clicking it again) starts
	// the turn now instead. A null stays null.
	const game = useMemo(() => {
		const payload = apply(fixture.game, advanced)
		return payload.turn_started_at ? { ...payload, turn_started_at: turnStartedAt } : payload
	}, [fixture, advanced, turnStartedAt])
	const isLobby = game.type === "lobby"

	const choose = (name) => {
		setParams({ fixture: name }, { replace: true })
		setSent([])
		setError("")
		setAdvanced(false)
		setTurnStartedAt(now())
	}

	const send = (message) => {
		const id = nextId.current++
		setSent((log) => [{ id, message }, ...log].slice(0, 5))
		return true
	}

	const controls = (
		<div className="mx-auto w-full max-w-[1240px] shrink-0 space-y-1 px-[clamp(14px,4vw,24px)] pt-2 text-xs text-white">
			<div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
				<span className="shrink-0 font-bold uppercase tracking-wide text-yellow">Dev</span>
				{FIXTURES.map((f) => (
					<button
						key={f.name}
						type="button"
						onClick={() => choose(f.name)}
						aria-pressed={f.name === fixture.name}
						className={`${CHIP} ${f.name === fixture.name ? ON : IDLE}`}
					>
						{f.name}
					</button>
				))}
			</div>

			<div className="flex items-center gap-2">
				<p className="min-w-0 flex-1 truncate text-white/70" title={fixture.note}>
					{fixture.note}
				</p>
				{fixture.game.next && (
					<button
						type="button"
						onClick={() => setAdvanced((was) => !was)}
						aria-pressed={advanced}
						className={`${CHIP} ${advanced ? ON : "border-yellow bg-yellow/10 text-yellow hover:bg-yellow/20"}`}
					>
						{advanced ? "Back to first state" : "Next state"}
					</button>
				)}
				{isLobby && (
					<button type="button" onClick={() => setConnected((was) => !was)} aria-pressed={!connected} className={`${CHIP} ${IDLE}`}>
						{connected ? "Drop socket" : "Reconnect"}
					</button>
				)}
				<button type="button" onClick={() => setError(error ? "" : SIMULATED_ERROR)} className={`${CHIP} ${IDLE}`}>
					{error ? "Clear error" : "Simulate error"}
				</button>
				{/* Opens on top of the table instead of pushing it down. */}
				<details className="relative shrink-0">
					<summary className={`${CHIP} ${IDLE} list-none`}>Sent ({sent.length}) · Payload</summary>
					<div className="absolute right-0 top-full z-20 mt-1 w-[min(90vw,40rem)] space-y-3 rounded-lg border border-white/10 bg-black/90 p-3">
						<ol className="space-y-1 font-mono text-white/70">
							{sent.length ? (
								sent.map(({ id, message }) => <li key={id}>{JSON.stringify(message)}</li>)
							) : (
								<li className="text-white/40">Nothing yet. Click a card, the draw pile or a seat.</li>
							)}
						</ol>
						<pre className="max-h-96 overflow-auto font-mono text-white/70">{JSON.stringify(game, null, 2)}</pre>
					</div>
				</details>
			</div>
		</div>
	)

	// A lobby payload: the same frame Room gives it, header and footer included.
	if (isLobby) {
		return (
			<div className="flex min-h-dvh flex-col bg-page">
				{controls}
				<Header />
				<main className="flex flex-1 flex-col">
					<Lobby
						lobby={game}
						user={ME}
						connected={connected}
						error={error}
						onSeat={(index) => send({ action: "seat", index })}
						onSpectate={() => send({ action: "spectate" })}
						onStart={() => send({ action: "start" })}
						onLeave={() => send({ action: "leave" })}
					/>
				</main>
				<Footer />
			</div>
		)
	}

	// `state: null` is a game that hasn't started. Room keeps the lobby up for it,
	// so there's no table to draw.
	if (game.state === null) {
		return (
			<div className="flex min-h-dvh flex-col bg-page">
				{controls}
				<p className="mx-auto my-6 w-[min(88vw,860px)] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
					No table: <code>state</code> is null, so Room shows the lobby here, not GameTable.
				</p>
			</div>
		)
	}

	// The table is keyed by fixture so its own state (an open colour picker, the
	// notices) doesn't carry over from one fixture to the next — but **not** by the
	// state within a fixture, which is what lets Next state be compared with what
	// came before it.
	return (
		<div className="flex h-dvh flex-col overflow-hidden bg-page">
			{controls}
			<GameHeader code="7F2K" watching={game.spectator_count ?? 0} />
			<main className="flex min-h-0 flex-1 flex-col">
				<GameTable key={fixture.name} game={game} send={send} error={error} roomCode="7F2K" />
			</main>
		</div>
	)
}

export default TablePlayground
