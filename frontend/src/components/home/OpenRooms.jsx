import { useCallback, useEffect, useState } from "react"
import { useNavigate } from "react-router"
import CreateRoomDialog from "@/components/room/CreateRoomDialog.jsx"
import EnterCodeDialog from "@/components/room/EnterCodeDialog.jsx"
import RoomCard from "@/components/home/RoomCard.jsx"
import { EmptyMessage, ErrorMessage, Loading } from "@/components/ui/Message.jsx"
import { listRooms } from "@/lib/rooms.js"
import { useAuth } from "@/lib/auth.jsx"

// Rooms are cheap to fetch, so just re-ask on a timer.
const REFRESH_MS = 5000

const HEADER_BUTTON =
	"cursor-pointer rounded-md border-2 border-line-strong px-5 py-3 font-mono text-[13px] tracking-[0.08em] text-soft transition-colors hover:border-yellow hover:text-yellow"

function OpenRooms() {
	const navigate = useNavigate()
	const { user } = useAuth()
	const [rooms, setRooms] = useState([])
	const [status, setStatus] = useState("loading")
	const [error, setError] = useState("")
	const [creating, setCreating] = useState(false)
	const [entering, setEntering] = useState(false)

	const loadRooms = useCallback(async () => {
		try {
			setRooms(await listRooms())
			setStatus("ready")
		} catch (err) {
			setError(err.message)
			setStatus((was) => (was === "ready" ? "ready" : "error"))
		}
	}, [])

	useEffect(() => {
		// The cleanup is the point: without clearInterval the timer would keep
		// asking for rooms after you leave Home, and coming back would start a
		// second one on top of it.
		// Wrapped so nothing sets state while the effect body is still running.
		void (async () => {
			await loadRooms()
		})()
		const timer = setInterval(loadRooms, REFRESH_MS)
		return () => clearInterval(timer)
	}, [loadRooms])

	// Anything that needs an account sends a guest to the Login first, carrying
	// where they were headed.
	const requireAccount = (to) => {
		if (user) return true
		navigate("/login", { state: { from: to } })
		return false
	}

	const joinRoom = (room) => {
		const to = `/room/${room.join_code}`
		// Room takes it from here: it claims a seat itself, so arriving by a
		// shared link or a refresh works the same as clicking.
		if (requireAccount(to)) navigate(to)
	}

	return (
		<section
			id="rooms"
			className="mx-auto flex w-full max-w-[1240px] scroll-mt-24 flex-col gap-6 px-[clamp(16px,4vw,24px)] pb-[88px]"
		>
			<header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
				<div className="flex flex-col gap-2">
					<p className="font-mono text-xs tracking-[0.18em] text-red-soft">OPEN ROOMS</p>
					<h2 className="font-title text-[clamp(26px,5.5vw,34px)] font-extrabold text-white">Jump into a room</h2>
				</div>
				<div className="flex flex-wrap gap-2.5">
					<button
						type="button"
						onClick={() => requireAccount("/#rooms") && setCreating(true)}
						className={HEADER_BUTTON}
					>
						CREATE ROOM
					</button>
					<button
						type="button"
						onClick={() => requireAccount("/#rooms") && setEntering(true)}
						className={HEADER_BUTTON}
					>
						ENTER CODE
					</button>
				</div>
			</header>

			{status === "loading" && <Loading className="py-8 text-center">Loading...</Loading>}

			{status === "error" && <ErrorMessage className="py-8 text-center">Couldn't load the rooms. {error}</ErrorMessage>}

			{status === "ready" && rooms.length === 0 && (
				<EmptyMessage className="py-8 text-center">No open rooms - create the first one.</EmptyMessage>
			)}

			{status === "ready" && rooms.length > 0 && (
				<ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,280px),1fr))] gap-4">
					{rooms.map((room) => (
						<RoomCard key={room.join_code} room={room} onJoin={joinRoom} />
					))}
				</ul>
			)}

			{/* The key resets the form every time the dialog reopens. */}
			<CreateRoomDialog key={creating ? "create-open" : "create-closed"} open={creating} onClose={() => setCreating(false)} />
			<EnterCodeDialog key={entering ? "enter-open" : "enter-closed"} open={entering} onClose={() => setEntering(false)} />
		</section>
	)
}

export default OpenRooms
