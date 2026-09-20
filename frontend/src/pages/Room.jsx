import { useCallback, useEffect, useRef, useState } from "react"
import { Navigate, useNavigate, useParams } from "react-router"
import ChatDock from "@/components/chat/ChatDock.jsx"
import { useChatRoom } from "@/components/chat/ChatProvider.jsx"
import GameHeader from "@/components/game/GameHeader.jsx"
import GameTable from "@/components/game/GameTable.jsx"
import TableChat from "@/components/game/TableChat.jsx"
import Footer from "@/components/layout/Footer.jsx"
import Header from "@/components/layout/Header.jsx"
import Lobby from "@/components/room/Lobby.jsx"
import Button from "@/components/ui/Button.jsx"
import { ErrorMessage, Loading } from "@/components/ui/Message.jsx"
import api from "@/lib/api.js"
import { useAuth } from "@/lib/auth.jsx"
import { getGameMessages, sortMessages } from "@/lib/chat.js"
import { useGameSocket } from "@/lib/socket.js"

// Owns the room's connection and decides which view is on screen. The two views
// (Lobby, GameTable) are dumb by design — they take a payload and hand actions
// back up, so this is the only file that knows the server exists.
//
// It also draws its own frame, which is why this route sits outside Layout: the
// lobby wants the site header and footer, and the game wants neither. The table
// gets a slim header of its own and every pixel of the height.
function Room() {
	const { id } = useParams()
	const navigate = useNavigate()
	const { user } = useAuth()

	// `lobby` and `game` are whole payloads straight off the socket. The server
	// pushes one the moment we connect, so there is nothing to seed by hand — we
	// only wait for the first message to arrive.
	const [lobby, setLobby] = useState(null)
	const [game, setGame] = useState(null)
	const [publicId, setPublicId] = useState(null)
	// The room's own code. The route param can be either a code or a UUID, and the
	// chat needs the code: an invite message is tagged with it.
	const [joinCode, setJoinCode] = useState(null)
	const [error, setError] = useState("")
	const [tableError, setTableError] = useState(null) // { text, at }
	// The table's chat, kept here because this is the file that owns the socket it
	// rides on. It is not the dock's: those messages come down `ws/chat/`.
	const [tableMessages, setTableMessages] = useState([])
	// How many of those came from the history fetch. The panel needs to know, so it
	// does not badge the conversation you walked in on as unread.
	const [tableHistoryCount, setTableHistoryCount] = useState(0)

	// Claim a place before opening the socket — the server only lets players and
	// spectators listen. Doing it here rather than on the Play page means a
	// shared link, a refresh and a click all take the same path.
	//
	// The route param can be a join code (e.g. from the room list) rather than
	// the UUID, but the socket route only accepts the UUID — so we resolve it
	// from the game payload before opening the socket.
	// One join per room, however often the effect runs. `cancelled` below only
	// stops state being set — it cannot call back a request already sent, so two
	// overlapping runs both read "not in this room yet" from their own GET and
	// both posted. The second was refused with "You're already in this game as a
	// player.", and that error replaced the lobby the first one had just earned.
	const joinedRef = useRef(null)

	useEffect(() => {
		if (!user) return
		let cancelled = false

		;(async () => {
			try {
				const room = await api.get(`/games/${id}/`)
				// A cancelled room still answers on the REST side, but its socket has
				// nothing to say — so walking into one from a stale link or a
				// bookmarked code left the page sitting on "Joining room…" for ever.
				// Say it plainly instead, and let the error panel offer the way back.
				if (room.status === "cancelled") {
					if (!cancelled) setError("This room has closed.")
					return
				}
				// A player arrives nested under `user`; a spectator has `username` on
				// the row itself. Reading both the same way sent spectators back to
				// join, which then refused them.
				const isMe = (person) => (person?.user?.username ?? person?.username) === user.username
				const alreadyIn = room.players.some(isMe) || room.spectators.some(isMe)
				if (!alreadyIn && joinedRef.current !== id) {
					joinedRef.current = id
					await api.post(`/games/${id}/join/`, {})
				}
				if (!cancelled) {
					setPublicId(room.public_id)
					setJoinCode(room.join_code)
				}
			} catch (err) {
				if (!cancelled) setError(err.message)
			}
		})()

		return () => {
			cancelled = true
		}
	}, [id, user])

	const handleMessage = useCallback((data) => {
		if (data.type === "chat_message") {
			// Same frame name as the dock's, a different connection: this one is the
			// room talking to itself.
			setTableMessages((current) =>
				current.some((message) => message.id === data.message.id)
					? current
					: [...current, data.message],
			)
		} else if (data.type === "lobby") {
			setLobby(data)
			setGame(null)
		} else if (data.type === "game_state") {
			// The payload type flipping IS the "game started" signal.
			if (data.state === null)
				return
			setGame(data)
		} else if (data.type === "error") {
			setTableError({ text: data.message, at: Date.now() })
		}
	}, [])

	const [rematchBusy, setRematchBusy] = useState(false)
	const { connected, send } = useGameSocket(publicId, handleMessage)

	// What the room is called, so the dock's "Invite to Play" has somewhere to
	// send people. A table counts: a room outlives its game, the server accepts
	// an invite to one that is already running, and "come and play in my room"
	// is a reasonable thing to say from a seat. Only a finished room is nowhere
	// worth being sent.
	const over = Boolean(game?.winner_id)
	useChatRoom({ gameId: publicId, roomCode: joinCode ?? id, joinable: !over })

	// The game's own chat history, fetched once the game is on screen. It is a
	// plain GET, not a socket replay: the socket only carries what happens next.
	useEffect(() => {
		if (!publicId || !game) return undefined
		let ignore = false

		void (async () => {
			try {
				const history = await getGameMessages(publicId)
				if (!ignore) {
					// The log is not counted as unread, so it is not part of the mark.
					setTableHistoryCount(history.filter((message) => message.message_type !== "system").length)
					setTableMessages((current) => {
						const seen = new Set(history.map((message) => message.id))
						return sortMessages([...history, ...current.filter((m) => !seen.has(m.id))])
					})
				}
			} catch {
				/* no history is not a reason to take the chat away */
			}
		})()

		return () => {
			ignore = true
		}
		// Only the first payload matters: the history does not change under us.
		// oxlint-disable-next-line react-hooks/exhaustive-deps
	}, [publicId, Boolean(game)])

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
		navigate("/#rooms")
	}

	// Reopening the room after a game (§2.5). The code stays the same but now
	// points at a brand new pending room, so there is nowhere to navigate to —
	// pointing the socket at the new room is the whole move, and the `lobby`
	// message it answers with puts the lobby back on screen.
	const backToRoom = async () => {
		setRematchBusy(true)
		setError("")
		try {
			const room = await api.post(`/games/${id}/rematch/`, {})
			setPublicId(room.public_id)
			setJoinCode(room.join_code)
			setGame(null)
		} catch (err) {
			setError(err.message)
		} finally {
			setRematchBusy(false)
		}
	}

	// The game takes the whole window and scrolls nowhere: the arena measures itself
	// against this height, which is what makes the compact arena possible.
	if (game) {
		return (
			<div className="flex h-dvh flex-col overflow-hidden bg-page">
				<GameHeader code={id} watching={game.spectator_count ?? 0} onLeave={leaveRoom} />
				<main className="flex min-h-0 flex-1 flex-col">
					<GameTable
						game={game}
						send={send}
						error={tableError}
						onRematch={backToRoom}
						rematchBusy={rematchBusy}
					/>
				</main>
				<TableChat
					roomCode={id}
					messages={tableMessages}
					players={game.players?.length ?? 0}
					myPublicId={user.public_id}
					historyCount={tableHistoryCount}
					onSend={(body) => send({ action: "chat", body })}
				/>
				<ChatDock />
			</div>
		)
	}

	// Everything else — the lobby, loading, a failure — sits in the normal frame.
	return (
		<div className="flex min-h-dvh flex-col bg-page">
			<Header />
			<main className="flex flex-1 flex-col">
				{error && !lobby ? (
					<section className="mx-auto flex w-full max-w-[1240px] flex-col items-center gap-5 px-[clamp(16px,4vw,24px)] py-16 text-center">
						<ErrorMessage boxed>{error}</ErrorMessage>
						<Button variant="outline" color="yellow" onClick={() => navigate("/#rooms")}>
							Back to rooms
						</Button>
					</section>
				) : lobby ? (
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
				) : (
					<Loading className="py-16 text-center">Joining room…</Loading>
				)}
			</main>
			<Footer />
			<ChatDock />
		</div>
	)
}

export default Room
