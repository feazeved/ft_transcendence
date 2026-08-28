// Rendered as a full page on /play, and as a popup when opened from the navbar
// (see routes.jsx). Keep the markup layout-agnostic so it works in both: no
// min-h-screen, no fixed positioning — just a centered content block.
import { useState } from "react"

// Mockup rooms until the backend serves the real list. It's ONE (UNO), so a
// room has no theme — just a host, a player count, and whether the optional
// rule modifiers are switched on.
const ROOMS = [
	{ code: "3i2", host: "simba", players: 3, max: 5, modifiers: true },
	{ code: "38G", host: "daniel", players: 2, max: 6, modifiers: false },
	{ code: "18r", host: "feazeved", players: 4, max: 5, modifiers: true },
	{ code: "178", host: "guest_11", players: 11, max: 15, modifiers: false },
	{ code: "10", host: "lucas", players: 3, max: 10, modifiers: true },
	{ code: "9Qk", host: "ana", players: 1, max: 10, modifiers: false },
	{ code: "21n", host: "pedro", players: 3, max: 5, modifiers: true },
]

// Brand glow reused from Modal/HoverLink, marks the selected room.
const RAINBOW =
	"shadow-[-4px_-4px_16px_0_#E02130,4px_-4px_16px_0_#FAB243,4px_4px_16px_0_#169A4F,-4px_4px_16px_0_#0077B9]"

function Play() {
	const [rooms] = useState(ROOMS)
	const [query, setQuery] = useState("")
	const [selected, setSelected] = useState(null)

	const visible = rooms.filter((r) =>
		`${r.host} #${r.code}`.toLowerCase().includes(query.trim().toLowerCase()),
	)

	function createRoom() {
		// TODO(backend): POST /rooms, then navigate into the new room.
		console.log("room created")
	}

	function joinRoom() {
		// TODO(backend): POST /rooms/:code/join, then navigate into the room.
		if (!selected) return
		console.log("room joined", selected.code)
	}

	return (
		<section className="text-white mx-auto w-[min(88vw,860px)] py-2">
			<div className="mb-4 flex items-center gap-3">
				<h2 className="text-2xl font-bold">Rooms</h2>
				<input
					type="search"
					value={query}
					onChange={(e) => setQuery(e.target.value)}
					placeholder="Search rooms…"
					className="ml-auto w-48 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/40"
				/>
			</div>

			<ul className="grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto p-6 sm:grid-cols-3">
				{visible.map((room) => {
					const isSelected = selected?.code === room.code
					return (
						<li key={room.code}>
							<button
								type="button"
								onClick={() => setSelected(room)}
								aria-pressed={isSelected}
								className={`flex w-full flex-col items-center gap-2 rounded-xl border bg-black p-4 text-center transition-transform hover:scale-105 cursor-pointer ${
									isSelected ? `border-yellow ${RAINBOW}` : "border-white"
								}`}
							>
								<span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5 text-2xl">
									🃏
								</span>
								<span className="font-bold leading-tight">
									{room.host} <span className="text-white/50">#{room.code}</span>
								</span>
								<span className="flex items-center gap-3 text-sm text-white/70">
									<span>👤 {room.players}/{room.max}</span>
									<span
										className={
											room.modifiers ? "text-green" : "text-white/40"
										}
									>
										{room.modifiers ? "Modifiers on" : "Modifiers off"}
									</span>
								</span>
							</button>
						</li>
					)
				})}
				{visible.length === 0 && (
					<li className="col-span-full py-8 text-center text-white/50">
						No rooms match “{query}”.
					</li>
				)}
			</ul>

			<div className="mt-5 flex items-center justify-center gap-3">
				<button
					type="button"
					onClick={createRoom}
					className="rounded-lg border border-white px-5 py-2 font-bold transition-transform hover:scale-105 cursor-pointer"
				>
					New room
				</button>
				<button
					type="button"
					onClick={joinRoom}
					disabled={!selected}
					className="rounded-lg bg-yellow px-5 py-2 font-bold text-black transition-transform hover:scale-105 cursor-pointer disabled:opacity-40 disabled:hover:scale-100"
				>
					{selected ? `Join ${selected.host} #${selected.code}` : "Join room"}
				</button>
			</div>
		</section>
	)
}

export default Play
