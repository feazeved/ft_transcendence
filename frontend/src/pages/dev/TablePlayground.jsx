import { useRef, useState } from "react"
import { useSearchParams } from "react-router"
import GameTable from "@/components/game/GameTable.jsx"
import { FIXTURES } from "@/lib/fakeGameState.js"

const SIMULATED_ERROR = "It's not your turn."

const now = () => new Date().toISOString()

const CHIP = "shrink-0 rounded-md border px-2 py-0.5 cursor-pointer"
const IDLE = "border-white/10 bg-white/5 hover:border-white/40"

// Dev only — see routes.jsx. Renders GameTable from a fake game state instead of
// the socket, so every situation (ten players, spectating, game over…) is one
// click away with no backend and no second browser tab.
//
// `send` goes nowhere. It records what the table tried to send, which is the part
// worth checking: that a wild carries `chosen_color`, that a 7 carries `target_id`.
//
// The controls are squeezed into two thin rows so the table gets the rest of the
// screen, the same way it does inside Room.
function TablePlayground() {
	const [params, setParams] = useSearchParams()
	const [sent, setSent] = useState([])
	const [error, setError] = useState("")
	const [turnStartedAt, setTurnStartedAt] = useState(now)
	const nextId = useRef(0)

	// The fixture lives in the URL (?fixture=tenPlayers), so a refresh keeps it.
	const fixture = FIXTURES.find((f) => f.name === params.get("fixture")) ?? FIXTURES[0]

	// The fixtures keep a fixed turn_started_at that is long past, so every turn
	// would already have timed out. Picking a fixture (or clicking it again) starts
	// the turn now instead. A null stays null.
	const game = fixture.game.turn_started_at ? { ...fixture.game, turn_started_at: turnStartedAt } : fixture.game

	const choose = (name) => {
		setParams({ fixture: name }, { replace: true })
		setSent([])
		setError("")
		setTurnStartedAt(now())
	}

	const send = (message) => {
		const id = nextId.current++
		setSent((log) => [{ id, message }, ...log].slice(0, 5))
	}

	return (
		<div className="flex min-h-0 flex-1 flex-col">
			<div className="mx-auto w-[min(94vw,1100px)] space-y-1 pt-2 text-xs text-white">
				<div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
					<span className="shrink-0 font-bold uppercase tracking-wide text-yellow">Dev</span>
					{FIXTURES.map((f) => {
						const active = f.name === fixture.name
						return (
							<button
								key={f.name}
								type="button"
								onClick={() => choose(f.name)}
								aria-pressed={active}
								className={`${CHIP} ${active ? "border-white bg-white font-bold text-black" : IDLE}`}
							>
								{f.name}
							</button>
						)
					})}
				</div>

				<div className="flex items-center gap-2">
					<p className="min-w-0 flex-1 truncate text-white/70" title={fixture.note}>
						{fixture.note}
					</p>
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
									<li className="text-white/40">Nothing yet. Click a card, the draw pile or Pass.</li>
								)}
							</ol>
							<pre className="max-h-96 overflow-auto font-mono text-white/70">{JSON.stringify(game, null, 2)}</pre>
						</div>
					</details>
				</div>
			</div>

			{/* `state: null` is a game that hasn't started. Room keeps the lobby up for
			    it, so there's no table to draw. Otherwise the table is keyed by fixture
			    so its own state (an open colour picker) doesn't carry over from one
			    fixture to the next. */}
			{game.state === null ? (
				<p className="mx-auto my-6 w-[min(88vw,860px)] rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
					No table: <code>state</code> is null, so Room shows the lobby here, not GameTable.
				</p>
			) : (
				<GameTable key={fixture.name} game={game} send={send} error={error} />
			)}
		</div>
	)
}

export default TablePlayground
