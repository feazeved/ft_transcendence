import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router"
import CreateRoomModal from "@/components/CreateRoomModal.jsx"
import api from "@/lib/api.js"
import { useAuth } from "@/lib/auth.jsx"
import { hasAnyModifier, MAX_SPECTATORS } from "@/lib/rooms.js"
import cardVerse from "../assets/one_card_verse.svg"

const RAINBOW = "rainbow-shadow"

// Rooms are cheap to fetch, so just re-ask on a timer.
const REFRESH_MS = 5000

function Play() {
	const navigate = useNavigate()
	const { user } = useAuth()
	const [rooms, setRooms] = useState([])
	const [query, setQuery] = useState("")
	const [selectedCode, setSelectedCode] = useState(null)
	const [creating, setCreating] = useState(false)
	const [loading, setLoading] = useState(true)
	const [error, setError] = useState("")

	const loadRooms = useCallback(async () => {
		try {
			setRooms(await api.get("/games/"))
			setError("")
		} catch (err) {
			setError(err.message)
		} finally {
			setLoading(false)
		}
	}, [])

	useEffect(() => {
		// loadRooms is async: the setState calls land after the await, never
		// synchronously. The rule can't see through the async boundary.
		// oxlint-disable-next-line react/set-state-in-effect
		loadRooms()
		const timer = setInterval(loadRooms, REFRESH_MS)
		return () => clearInterval(timer)
	}, [loadRooms])

	const visible = rooms.filter((r) =>
		`${r.name} ${r.host?.username ?? ""} #${r.join_code}`
			.toLowerCase()
			.includes(query.trim().toLowerCase()),
	)

	const selected = rooms.find((r) => r.join_code === selectedCode) ?? null
	const selectedFull = !!selected && selected.player_count >= selected.max_seats
	const selectedCanSpectate =
		!!selected?.allow_spectators && (selected?.spectator_count ?? 0) < MAX_SPECTATORS

	async function handleCreate({ name, settings }) {
		// The settings keys are already the backend's field names, so the whole
		// object goes over as-is.
		try {
			const room = await api.post("/games/", { name, ...settings })
			setCreating(false)
			navigate(`/room/${room.join_code}`)
		} catch (err) {
			setError(err.message)
		}
	}

	function openRoom(room) {
		if (!user) {
			navigate("/login", { state: { from: `/room/${room.join_code}` } })
			return
		}
		// Room takes it from here: it claims a seat (or a spectator slot) itself,
		// so arriving by a shared link or a refresh works the same as clicking.
		navigate(`/room/${room.join_code}`)
	}

	function joinSelected() {
		if (selected) openRoom(selected)
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
					const isSelected = selectedCode === r.join_code
					const modifiers = hasAnyModifier(r)
					return (
						<li key={r.join_code}>
							<button
								type="button"
								onClick={() => setSelectedCode(r.join_code)}
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
									{r.host?.username ?? "—"} <span className="text-white/70">#{r.join_code}</span>
								</span>
								<span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-white/70">
									<span>👤 {r.player_count}/{r.max_seats}</span>
									{r.allow_spectators ? (
										<span className="text-white/70">
											👁 {r.spectator_count}/{MAX_SPECTATORS}
										</span>
									) : (
										<span className="text-white/40" title="Spectating off">
											🙈 0/0
										</span>
									)}
									<span className={modifiers ? "text-green" : "text-white/40"}>
										{modifiers ? "Modifiers on" : "Modifiers off"}
									</span>
								</span>
							</button>
						</li>
					)
				})}
				{loading && rooms.length === 0 && (
					<li className="col-span-full py-8 text-center text-white/50">Loading rooms…</li>
				)}
				{!loading && visible.length === 0 && (
					<li className="col-span-full py-8 text-center text-white/50">
						{rooms.length === 0 ? "No open rooms yet — make one." : `No rooms match “${query}”.`}
					</li>
				)}
			</ul>

			{error && (
				<p role="alert" className="mt-3 text-center text-sm text-red-400">
					{error}
				</p>
			)}

			<div className="mt-5 flex flex-wrap items-center justify-center gap-3">
				<button
					type="button"
					onClick={() => setCreating(true)}
					className="rounded-lg border border-white px-5 py-2 font-bold transition-transform hover:scale-105 cursor-pointer"
				>
					New room
				</button>
				<button
					type="button"
					onClick={joinSelected}
					disabled={!selected || (selectedFull && !selectedCanSpectate)}
					className="rounded-lg bg-white px-5 py-2 font-bold text-black transition-transform hover:scale-105 cursor-pointer disabled:opacity-40 disabled:hover:scale-100"
				>
					{!selected
						? "Join room"
						: selectedFull
							? selectedCanSpectate
								? `Spectate ${selected.host?.username} #${selected.join_code}`
								: `${selected.host?.username} #${selected.join_code} is full`
							: `Join ${selected.host?.username} #${selected.join_code}`}
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
