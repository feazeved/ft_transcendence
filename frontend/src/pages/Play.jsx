// Rendered as a full page on /play, and as a popup when opened from the navbar
// (see routes.jsx). Keep the markup layout-agnostic so it works in both: no
// min-h-screen, no fixed positioning — just a centered content block.
import { useState } from "react"
import { useNavigate } from "react-router"
import CreateRoomModal from "@/components/CreateRoomModal.jsx"
import { useAuth } from "@/lib/auth.jsx"
import { defaultRoomSettings, hasAnyModifier, makeRoomCode, seatPlayer } from "@/lib/rooms.js"
import cardVerse from "../assets/one_card_verse.svg"

// Mockup rooms until the backend serves the real list. It's ONE (UNO), so a
// room has no theme — just a host, its players and which rule modifiers are on.
// Shape matches lib/rooms.js so a created room slots straight in.
const ROOMS = [
	room("3i2", "simba", 3, { ...defaultRoomSettings(), max_players: 5, jump_in: true }),
	room("38G", "daniel", 2, { ...defaultRoomSettings(), max_players: 6 }),
	room("18r", "feazeved", 4, { ...defaultRoomSettings(), max_players: 5, seven_swap: true }),
	room("178", "guest_11", 9, { ...defaultRoomSettings(), max_players: 10 }),
	room("10x", "lucas", 3, { ...defaultRoomSettings(), max_players: 10, stacking_draw_two: true }),
	room("9Qk", "ana", 1, { ...defaultRoomSettings(), max_players: 10 }),
	room("21n", "pedro", 3, { ...defaultRoomSettings(), max_players: 5, zero: true }),
]

function room(code, host, playerCount, settings) {
	return {
		code,
		name: `${host}'s table`,
		host,
		status: "pending",
		settings,
		players: Array.from({ length: playerCount }, (_, i) => ({
			name: i === 0 ? host : `player_${i + 1}`,
			avatar: "/profile/default.jpg",
			isHost: i === 0,
		})),
	}
}

// Brand glow reused from Modal/HoverLink, marks the selected room.
const RAINBOW =
	"shadow-[-4px_-4px_16px_0_#E02130,4px_-4px_16px_0_#FAB243,4px_4px_16px_0_#169A4F,-4px_4px_16px_0_#0077B9]"

function Play() {
	const navigate = useNavigate()
	const { user } = useAuth()
	const [rooms, setRooms] = useState(ROOMS)
	const [query, setQuery] = useState("")
	const [selected, setSelected] = useState(null)
	const [creating, setCreating] = useState(false)

	const visible = rooms.filter((r) =>
		`${r.name} ${r.host} #${r.code}`.toLowerCase().includes(query.trim().toLowerCase()),
	)

	function handleCreate({ name, settings }) {
		const code = makeRoomCode()
		const host = user?.username ?? "you"
		const newRoom = {
			code,
			name,
			host,
			status: "pending",
			settings,
			players: [{ name: host, avatar: user?.avatar ?? "/profile/default.jpg", isHost: true }],
		}
		// TODO(backend): POST /games/ with { name, ...settings } (map max_players
		// -> max_seats, seven_swap|zero -> seven_zero), use the returned join_code.
		setRooms((rs) => [newRoom, ...rs])
		setCreating(false)
		navigate(`/room/${code}`, { state: { room: newRoom } })
	}

	// Seat the current user in the room, reflect that in the list's "x/y" count,
	// and open the room page. Anyone not logged in is sent to sign in first —
	// a room needs a name + avatar to show, and you can't leave/start without one.
	function openRoom(room) {
		if (!user) {
			navigate("/login", { state: { from: `/room/${room.code}` } })
			return
		}
		// TODO(backend): POST /games/:code/join, then navigate with the server room.
		const joined = seatPlayer(room, user)
		setRooms((rs) => rs.map((r) => (r.code === joined.code ? joined : r)))
		navigate(`/room/${joined.code}`, { state: { room: joined } })
	}

	function joinRoom() {
		if (!selected) return
		openRoom(selected)
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
				{visible.map((r) => {
					const isSelected = selected?.code === r.code
					const modifiers = hasAnyModifier(r.settings)
					return (
						<li key={r.code}>
							<button
								type="button"
								onClick={() => setSelected(r)}
								onDoubleClick={() => openRoom(r)}
								aria-pressed={isSelected}
								className={`flex w-full flex-col items-center gap-2 rounded-xl border bg-black p-4 text-center transition-transform hover:scale-105 cursor-pointer ${
									isSelected ? `border-yellow ${RAINBOW}` : "border-white"
								}`}
							>
								<span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/5 text-2xl">
									<img src={cardVerse} alt="one card verse" width={20} />
								</span>
								<span className="font-bold leading-tight">
									{r.host} <span className="text-white/50">#{r.code}</span>
								</span>
								<span className="flex items-center gap-3 text-sm text-white/70">
									<span>👤 {r.players.length}/{r.settings.max_players}</span>
									<span className={modifiers ? "text-green" : "text-white/40"}>
										{modifiers ? "Modifiers on" : "Modifiers off"}
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
					onClick={() => setCreating(true)}
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

			<CreateRoomModal
				key={creating ? "open" : "closed"}
				open={creating}
				onClose={() => setCreating(false)}
				onCreate={handleCreate}
			/>
		</section>
	)
}

export default Play
