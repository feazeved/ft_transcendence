// Shared shape + helpers for game rooms, used by the create-room dialog, the
// open-rooms list on Home, the enter-code dialog and the room page.
import api from "./api.js"

// Every setting key here is exactly the field name the backend `Game` model
// uses (backend/game_api/models.py), so a settings object goes straight into
// POST /api/games/ with no step in between.

export const MIN_PLAYERS = 2
export const MAX_PLAYERS = 10
export const MIN_HAND_SIZE = 2
export const MIN_TURN_TIMER = 10
export const MAX_TURN_TIMER = 300

export const MAX_SPECTATORS = 6

export const MODIFIER_TOGGLES = [
	{ key: "draw_stacking", label: "Stacking draw cards", hint: "Answer a +2 with a +2, or a +4 with a +4, instead of drawing (no cross-stacking)." },
	{ key: "jump_in", label: "Jump in", hint: "Play an identical card out of turn to cut in." },
	{ key: "draw_until_playable", label: "Draw until playable", hint: "Keep drawing until you get a card you can play." },
	{ key: "seven_swap", label: "Seven swap", hint: "Playing a 7 swaps hands with a player of your choice." },
	{ key: "zero_swap", label: "Zero rotate", hint: "Playing a 0 passes every hand to the next player." },
]

export const RULE_TOGGLES = [
	...MODIFIER_TOGGLES,
	{ key: "allow_spectators", label: "Allow spectators", hint: "Let people watch your game without holding a seat." },
]

export function defaultRoomSettings() {
	return {
		max_seats: 4,
		starting_hand_size: 7,
		turn_timer_seconds: 60,
		draw_stacking: false,
		jump_in: false,
		draw_until_playable: false,
		seven_swap: false,
		zero_swap: false,
		allow_spectators: true,
	}
}

export function enabledRuleLabels(source = {}) {
	return MODIFIER_TOGGLES.filter((rule) => source[rule.key]).map((rule) => rule.label)
}

export function hasAnyModifier(source = {}) {
	return MODIFIER_TOGGLES.some((rule) => source[rule.key])
}

// The room-code alphabet: A–Z and 2–9, with I, O, 0 and 1 left out because
// nobody can read them apart when a code is passed on out loud (CONTEXT.md).
export const ROOM_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
export const ROOM_CODE_LENGTH = 4

// Pure: keep only characters that could be in a code, uppercased. Used by both
// typing a character and pasting a whole code.
export function sanitizeRoomCode(text = "") {
	return [...text.toUpperCase()].filter((char) => ROOM_CODE_ALPHABET.includes(char)).join("")
}

export function listRooms() {
	return api.get("/games/")
}

export function getRoom(code) {
	return api.get(`/games/${code}/`)
}

// The settings keys are already the backend's field names, so the object goes
// over as it is.
export function createRoom({ name, settings }) {
	return api.post("/games/", { name, ...settings })
}

export function spectateRoom(code) {
	return api.post(`/games/${code}/spectate/`)
}

// A room nobody else can sit in: every seat taken, or the game already going.
export function isRoomFull(room) {
	return room.player_count >= room.max_seats || room.status !== "pending"
}

export function canSpectate(room) {
	return Boolean(room.allow_spectators) && (room.spectator_count ?? 0) < MAX_SPECTATORS
}
