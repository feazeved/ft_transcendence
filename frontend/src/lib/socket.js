// WebSocket client for a game room.
//
// One socket serves the whole room: while the game is pending the server sends
// `{type: "lobby"}` payloads (seats, spectators, settings) and once the host
// starts it switches to `{type: "game_state"}` on the same connection. The
// payload type changing is the signal that the game began — there is no
// separate "started" event to listen for.
//
// Auth rides along on the session cookie, so there is nothing to attach here.

import { useEffect, useRef, useState } from "react"

// Vite (dev) and nginx (prod) both proxy /ws to the backend, so the socket goes
// to this same host — https pages need wss, http needs ws.
function socketUrl(path) {
	const scheme = window.location.protocol === "https:" ? "wss:" : "ws:"
	return `${scheme}//${window.location.host}${path}`
}

const FIRST_RETRY_MS = 500
const MAX_RETRY_MS = 8000

// Opens `path` and keeps it open, reconnecting with a widening delay whenever
// the connection drops. Returns a handle: send(obj) and close().
export function openSocket(path, { onMessage, onOpen, onClose } = {}) {
	let socket = null
	let retryMs = FIRST_RETRY_MS
	let retryTimer = null
	let closedByUs = false

	const connect = () => {
		socket = new WebSocket(socketUrl(path))

		socket.onopen = () => {
			retryMs = FIRST_RETRY_MS // a good connection earns a fast retry next time
			onOpen?.()
		}

		socket.onmessage = (event) => {
			try {
				onMessage?.(JSON.parse(event.data))
			} catch {
				/* a frame we can't parse is not worth tearing the socket down for */
			}
		}

		socket.onclose = () => {
			onClose?.()
			if (closedByUs) return
			retryTimer = setTimeout(connect, retryMs)
			retryMs = Math.min(retryMs * 2, MAX_RETRY_MS)
		}

		// onerror is always followed by onclose, which already handles the retry.
		socket.onerror = () => socket.close()
	}

	connect()

	return {
		send(payload) {
			if (socket?.readyState === WebSocket.OPEN) {
				socket.send(JSON.stringify(payload))
				return true
			}
			return false
		},
		close() {
			closedByUs = true
			clearTimeout(retryTimer)
			socket?.close()
		},
	}
}

// React wrapper around openSocket for a single room.
//
// `onMessage` is kept in a ref so that passing a fresh arrow function on every
// render doesn't tear the socket down and rebuild it each time.
export function useGameSocket(code, onMessage) {
	const handlerRef = useRef(onMessage)
	const socketRef = useRef(null)
	const [connected, setConnected] = useState(false)

	// Kept in an effect rather than assigned during render: writing to a ref
	// while rendering is not allowed under StrictMode / concurrent rendering.
	useEffect(() => {
		handlerRef.current = onMessage
	}, [onMessage])

	useEffect(() => {
		if (!code) return undefined

		const handle = openSocket(`/ws/games/${code}/`, {
			onMessage: (data) => handlerRef.current?.(data),
			onOpen: () => setConnected(true),
			onClose: () => setConnected(false),
		})
		socketRef.current = handle

		return () => {
			handle.close()
			socketRef.current = null
		}
	}, [code])

	// Player actions during a game: play_card, draw_card, pass_turn.
	const send = (payload) => socketRef.current?.send(payload) ?? false

	return { connected, send }
}
