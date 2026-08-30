// Shared shape + mock helpers for game rooms, used by the create-room popup
// (CreateRoomModal), the room list (Play) and the room page (Room).
//
// The setting keys line up with the backend `Game` model (game_api/models.py)
// so the create payload is close to submit-ready:
//   max_players         -> Game.max_seats
//   starting_hand_size   -> Game.starting_hand_size
//   turn_timer_seconds   -> Game.turn_timer_seconds
//   stacking_draw_two    -> Game.stacking_draw_two
//   jump_in              -> Game.jump_in
//   draw_until_playable  -> Game.draw_until_playable
//   seven_swap / zero    -> Game.seven_zero  (backend keeps a single flag today)

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 10
export const MIN_HAND_SIZE = 2
export const MIN_TURN_TIMER = 10
export const MAX_TURN_TIMER = 300

// A room that's full still lets people in to watch. Spectators hold no chair and
// can't act; when a seat frees up any of them may claim it and start playing.
export const MAX_SPECTATORS = 6

// Optional rule modifiers, in display order. Each renders as a toggle.
export const RULE_TOGGLES = [
	{ key: "stacking_draw_two", label: "Stacking draw cards", hint: "Answer a +2 with a +2, or a +4 with a +4, instead of drawing (no cross-stacking)." },
	{ key: "jump_in", label: "Jump in", hint: "Play an identical card out of turn to cut in." },
	{ key: "draw_until_playable", label: "Draw until playable", hint: "Keep drawing until you get a card you can play." },
	{ key: "seven_swap", label: "Seven swap", hint: "Playing a 7 swaps hands with a player of your choice." },
	{ key: "zero", label: "Zero rotate", hint: "Playing a 0 passes every hand to the next player." },
	{ key: "spectate", label: "Allow spectator", hint: "Allow players to spectate your game." },
]

export function defaultRoomSettings() {
	return {
		max_players: 4,
		starting_hand_size: 7,
		turn_timer_seconds: 60,
		stacking_draw_two: false,
		jump_in: false,
		draw_until_playable: false,
		seven_swap: false,
		zero: false,
		spectate: true,
	}
}

// Short human-friendly id others type to find the room (Game.join_code is
// max 8 chars). Ambiguous characters (0/O, 1/I) left out on purpose.
export function makeRoomCode(length = 4) {
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
	let code = ""
	for (let i = 0; i < length; i++) {
		code += alphabet[Math.floor(Math.random() * alphabet.length)]
	}
	return code
}

// Turns the settings object into "Stacking +2 · Seven swap · Hand 7" style
// chips for the room list / room header.
export function enabledRuleLabels(settings = {}) {
	return RULE_TOGGLES.filter((r) => settings[r.key]).map((r) => r.label)
}

export function hasAnyModifier(settings = {}) {
	return RULE_TOGGLES.some((r) => settings[r.key])
}

// Returns a copy of `room` with `user` added. By default they take a free chair
// in `players`, falling back to `spectators` when every seat is filled. Pass
// `{ asSpectator: true }` to go straight to `spectators` even with seats open.
// Either list is capped (max_players / MAX_SPECTATORS); the player count drives
// the "x/y" count and the seat grid, the spectator count drives the watchers
// list. Dedup is by username across BOTH lists, so it's safe to call more than
// once (Play on join + Room on mount).
// TODO(backend): this is POST /games/:code/join done client-side. The real
// version returns the updated roster + the role the server assigned, and a
// socket pushes the other players' joins/leaves/seat-changes so every client's
// counts move, not just the one who joined.
export function joinRoom(room, user, { asSpectator = false } = {}) {
	if (!user?.username) return room
	const spectators = room.spectators ?? []
	const alreadyIn =
		room.players.some((p) => p.name === user.username) ||
		spectators.some((s) => s.name === user.username)
	if (alreadyIn) return room

	const person = {
		name: user.username,
		avatar: user.avatar ?? "/profile/default.jpg",
		isHost: room.host === user.username,
	}
	if (!asSpectator && room.players.length < room.settings.max_players) {
		return { ...room, players: [...room.players, person] }
	}
	// Room has spectating switched off: no seat means no entry at all.
	if (room.settings.spectate === false) return room
	if (spectators.length < MAX_SPECTATORS) {
		return { ...room, spectators: [...spectators, person] }
	}
	// No room left in the role they asked for. Caller keeps the user out.
	return room
}

// True when the room can't take another person in any role.
export function roomIsFull(room) {
	const spectators = room.spectators ?? []
	const seatsFull = room.players.length >= room.settings.max_players
	if (room.settings.spectate === false) return seatsFull
	return seatsFull && spectators.length >= MAX_SPECTATORS
}

// Fallback room used when the Room page is opened directly / refreshed and the
// navigation state from Play was lost. Replace with a real GET /games/:code.
export function mockRoom(code) {
	const settings = defaultRoomSettings()
	return {
		code,
		name: `Room ${code}`,
		host: "simba",
		status: "pending",
		settings,
		players: [
			{ name: "simba", avatar: "/profile/daniel.png", isHost: true },
			{ name: "feazeved", avatar: "/profile/fifipe.png", isHost: false },
		],
		spectators: [],
	}
}
