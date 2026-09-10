import { useCallback, useEffect, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router"
import GameTable from "@/components/game/GameTable.jsx"
import Lobby from "@/components/room/Lobby.jsx"
import api from "@/lib/api.js"
import { useAuth } from "@/lib/auth.jsx"
import { useGameSocket } from "@/lib/socket.js"

// Owns the room's connection and decides which view is on screen. The two views
// (Lobby, GameTable) are dumb by design — they take a payload and hand actions
// back up, so this is the only file that knows the server exists.
function Room() {
	const { id } = useParams()
	const navigate = useNavigate()
	const { user } = useAuth()

	// `lobby` and `game` are whole payloads straight off the socket. The server
	// pushes one the moment we connect, so there is nothing to seed by hand — we
	// only wait for the first message to arrive.
	const [lobby, setLobby] = useState(null)
	const [game, setGame] = useState(null)
	const [ready, setReady] = useState(false)
	const [error, setError] = useState("")

	// Claim a place before opening the socket — the server only lets players and
	// spectators listen. Doing it here rather than on the Play page means a
	// shared link, a refresh and a click all take the same path.
	useEffect(() => {
		if (!user) return
		let cancelled = false

		;(async () => {
			try {
				const room = await api.get(`/games/${id}/`)
				const mine = (person) => person?.user?.username === user.username
				const alreadyIn = room.players.some(mine) || room.spectators.some(mine)
				if (!alreadyIn) await api.post(`/games/${id}/join/`, {})
				if (!cancelled) setReady(true)
			} catch (err) {
				if (!cancelled) setError(err.message)
			}
		})()

		return () => {
			cancelled = true
		}
	}, [id, user])

	const handleMessage = useCallback((data) => {
		if (data.type === "lobby") {
			setLobby(data)
			setGame(null)
		} else if (data.type === "game_state") {
			// The payload type flipping IS the "game started" signal.
			setGame(data)
		} else if (data.type === "error") {
			setError(data.message)
		}
	}, [])

	const { connected, send } = useGameSocket(ready ? id : null, handleMessage)

	if (!user) return <Navigate to="/login" replace state={{ from: `/room/${id}` }} />

	const act = async (path, body) => {
		setError("")
		try {
			await api.post(`/games/${id}/${path}/`, body ?? {})
		} catch (err) {
			setError(err.message)
		}
	}

	// No optimistic updates anywhere: the server broadcasts the new room to
	// everyone, and the views redraw from that.
	const takeSeat = (index) => act("seat", { index })
	const goSpectate = () => act("spectate")
	const startGame = () => act("start")
	const leaveRoom = async () => {
		await act("leave")
		navigate("/play")
	}

	if (error && !lobby && !game) {
		return (
			<section className="mx-auto w-[min(88vw,860px)] py-10 text-center text-white">
				<p role="alert" className="mb-4 text-red-400">{error}</p>
				<button
					type="button"
					onClick={() => navigate("/play")}
					className="rounded-lg border border-white px-5 py-2 font-bold cursor-pointer"
				>
					Back to rooms
				</button>
			</section>
		)
	}

	if (!lobby && !game) {
		return <section className="py-10 text-center text-white/60">Joining room…</section>
	}

	if (game) return <GameTable game={game} send={send} error={error} />

	return (
		<Lobby
			lobby={lobby}
			user={user}
			connected={connected}
			error={error}
			onSeat={takeSeat}
			onSpectate={goSpectate}
			onStart={startGame}
			onLeave={leaveRoom}
		/>
	)
}

export default Room
