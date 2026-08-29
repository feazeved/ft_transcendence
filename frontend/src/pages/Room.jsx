// Full page at /room/:id — never a popup. Reached from Play after creating or
// joining a room, or directly by anyone who types the room id. Shows the room
// name, its share id, the chosen rules and who's currently seated.
import { useState } from "react"
import { Navigate, useNavigate, useParams, useLocation } from "react-router"
import { useAuth } from "@/lib/auth.jsx"
import { enabledRuleLabels, mockRoom, seatPlayer } from "@/lib/rooms.js"
import cardVerse from "../assets/one_card_verse.svg"
import table from "../assets/table.png"

const RAINBOW =
	"shadow-[-4px_-4px_16px_0_#E02130,4px_-4px_16px_0_#FAB243,4px_4px_16px_0_#169A4F,-4px_4px_16px_0_#0077B9]"

function Room() {
	const { id } = useParams()
	const location = useLocation()
	const navigate = useNavigate()
	const { user } = useAuth()
	const [copied, setCopied] = useState(false)

	// Play passes the freshly built room through navigation state. On a direct
	// visit / refresh that's gone, so fall back to a mock.
	// TODO(backend): when state is missing, fetch it with api.get(`/games/${id}`)
	// and keep it live over a socket so the seats also move when *other* players
	// come, go or change chair.
	const fromNav = location.state?.room
	const baseRoom = fromNav?.code === id ? fromNav : mockRoom(id)
	// Seat whoever opened the page, so the table includes them — covers a shared
	// link or a refresh, where Play never got to add them.
	const seededRoom = seatPlayer(baseRoom, user)

	// One slot per chair around the table, `null` when free. A player keeps the
	// slot they land in; clicking a free slot moves you there (`moveToSeat`).
	const [seats, setSeats] = useState(() =>
		Array.from(
			{ length: seededRoom.settings.max_players },
			(_, i) => seededRoom.players[i] ?? null,
		),
	)

	// A room has nothing to show for a signed-out visitor (no name, no avatar)
	// and none of its actions work, so send them to sign in and come back.
	if (!user) return <Navigate to="/login" replace state={{ from: `/room/${id}` }} />

	const room = baseRoom
	const seatCount = seats.length
	const players = seats.filter(Boolean)
	const mySeat = seats.findIndex((p) => p?.name === user.username)
	const isHost = room.host === user.username
	const rules = enabledRuleLabels(room.settings)

	// Move the current player into a free chair. No-op if it's taken, if it's
	// the one they're already in, or if they aren't seated at all.
	// TODO(backend): POST /games/:code/seat { index }, broadcast over the socket.
	const moveToSeat = (target) => {
		setSeats((prev) => {
			if (prev[target]) return prev
			const from = prev.findIndex((p) => p?.name === user.username)
			if (from === -1 || from === target) return prev
			const next = [...prev]
			next[target] = prev[from]
			next[from] = null
			return next
		})
	}

	const copyId = async () => {
		try {
			await navigator.clipboard.writeText(room.code)
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch {
			/* clipboard blocked — the id is visible next to the button anyway */
		}
	}

	const leaveRoom = () => {
		// TODO(backend): POST /games/:code/leave
		navigate("/")
	}

	const startGame = () => {
		// TODO(backend): POST /games/:code/start, then go to the table.
		console.log("start game", room.code)
	}

	return (
		<section className="text-white mx-auto w-[min(88vw,860px)] py-2">
			<div className="mb-6 flex flex-wrap items-center gap-3">
				<div>
					<h2 className="text-2xl font-bold">{room.name}</h2>
					<p className="text-sm text-white/60">Hosted by {room.host}</p>
				</div>
				<button
					type="button"
					onClick={copyId}
					className="ml-auto flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm transition-transform hover:scale-105 cursor-pointer"
					aria-label="Copy room id"
				>
					<span className="text-white/50">Room id</span>
					<span className="font-bold tracking-widest">{room.code}</span>
					<span className="text-white/50">{copied ? "copied!" : "⧉"}</span>
				</button>
			</div>

			<div className="grid gap-6 sm:grid-cols-[1fr_auto]">
				<div>
					<h3 className="mb-3 text-lg font-bold">
						Players{" "}
						<span className="text-white/50">
							{players.length}/{seatCount}
						</span>
					</h3>

					{/* Chairs laid out around table.png: each is placed on a circle
					    by its index. A free chair is a button that seats you in it. */}
					<div className="relative mx-auto aspect-square w-full max-w-150">
						<img
							src={table}
							alt=""
							className="pointer-events-none absolute left-1/2 top-1/2 w-[58%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
						/>
						{seats.map((player, i) => {
							const mine = player?.name === user.username
							const canSit = !player && mySeat !== -1
							// Every seat is built identically and pinned to the top-centre
							// of a full-size wrapper; spinning the wrapper drops it onto the
							// ring, so the gap to the table is the same all the way around,
							// whatever the label height. The centring translate lives on
							// `.seat-pos` and the upright counter-spin on the button — two
							// separate elements on purpose: a `translateX` in the same
							// transform as the counter-spin gets rotated with it and pulls
							// the seat off its radius (the ring then drifts off-centre).
							const spin = (360 / seatCount) * i
							return (
								<div
									key={i}
									className="pointer-events-none absolute inset-0"
									style={{ transform: `rotate(${spin}deg)` }}
								>
									<div className="absolute left-1/2 top-[3%] w-[22%] -translate-x-1/2">
										<button
											type="button"
											disabled={!canSit}
											onClick={() => moveToSeat(i)}
											aria-label={
												player
													? `Seat ${i + 1}: ${player.name}${player.isHost ? " (host)" : ""}`
													: canSit
														? `Sit in seat ${i + 1}`
														: `Empty seat ${i + 1}`
											}
											style={{ transform: `rotate(${-spin}deg)` }}
											className={`group pointer-events-auto flex w-full flex-col items-center gap-1.5 text-center ${
												canSit ? "cursor-pointer" : ""
											}`}
										>
												<span
													className={`relative flex aspect-square w-[55%] min-w-11 items-center justify-center rounded-full ${
														mine ? RAINBOW : ""
													}`}
												>
													<span
														className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full border bg-white/5 transition ${
															mine
																? "border-yellow"
																: player
																	? "border-white/20"
																	: canSit
																		? "border-dashed border-white/30 group-hover:scale-105 group-hover:border-white/80"
																		: "border-dashed border-white/20"
														}`}
													>
														{player ? (
															<img src={player.avatar} alt="" className="h-full w-full object-cover" />
														) : (
															<img src={cardVerse} alt="" className="w-1/3 opacity-60" />
														)}
													</span>
													{player?.isHost && (
														<span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-yellow px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-black">
															host
														</span>
													)}
												</span>
												<span className="w-full truncate text-sm font-bold leading-tight">
													{player ? player.name : canSit ? "Sit here" : "Waiting…"}
												</span>
											</button>
										</div>
									</div>
							)
						})}
					</div>
				</div>

				<aside className="rounded-xl border border-white/10 bg-white/5 p-4 sm:w-56">
					<h3 className="mb-3 text-lg font-bold">Settings</h3>
					<dl className="space-y-1 text-sm">
						<div className="flex justify-between gap-2">
							<dt className="text-white/50">Max players</dt>
							<dd>{room.settings.max_players}</dd>
						</div>
						<div className="flex justify-between gap-2">
							<dt className="text-white/50">Starting hand</dt>
							<dd>{room.settings.starting_hand_size}</dd>
						</div>
						<div className="flex justify-between gap-2">
							<dt className="text-white/50">Turn timer</dt>
							<dd>{room.settings.turn_timer_seconds}s</dd>
						</div>
					</dl>
					<h4 className="mb-2 mt-4 text-sm text-white/50">Optional rules</h4>
					{rules.length ? (
						<ul className="flex flex-wrap gap-1.5">
							{rules.map((label) => (
								<li key={label} className="rounded-md bg-green/20 px-2 py-0.5 text-xs text-green-200">
									{label}
								</li>
							))}
						</ul>
					) : (
						<p className="text-xs text-white/40">Classic rules only.</p>
					)}
				</aside>
			</div>

			<div className="mt-8 flex items-center justify-center gap-3">
				<button
					type="button"
					onClick={leaveRoom}
					className="rounded-lg border border-white px-5 py-2 font-bold transition-transform hover:scale-105 cursor-pointer"
				>
					Leave room
				</button>
				{isHost && (
					<button
						type="button"
						onClick={startGame}
						disabled={players.length < 2}
						className="rounded-lg bg-yellow px-5 py-2 font-bold text-black transition-transform hover:scale-105 cursor-pointer disabled:opacity-40 disabled:hover:scale-100"
					>
						Start game
					</button>
				)}
			</div>
		</section>
	)
}

export default Room
