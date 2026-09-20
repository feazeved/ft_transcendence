const ME = "12"

const num = (color, value) => ({ color, card_type: "number", value })
const action = (color, card_type) => ({ color, card_type, value: null })
const wild = () => ({ color: "wild", card_type: "wild", value: null })
const wildDrawFour = () => ({ color: "wild", card_type: "wild_draw_four", value: null })

function player(player_id, name, hand_count, extra = {}) {
	return { player_id, name, hand_count, is_connected: true, avatar_url: "/profile/default.jpg", ...extra }
}

function me(hand) {
	return { ...player(ME, "daniel", hand.length, { avatar_url: "/profile/daniel.png" }), hand }
}

const NO_RULES = { draw_stacking: false, jump_in: false, draw_until_playable: false, seven_swap: false, zero_swap: false }

function gameState(fields) {
	return {
		type: "game_state",
		status: "in_progress",
		your_player_id: ME,
		is_spectator: false,
		spectator_count: 0,
		top_card: num("red", 5),
		current_color: "red",
		current_player_id: ME,
		direction: 1,
		has_drawn_this_turn: false,
		draw_pile_count: 60,
		// The running total of stacked +2/+4 cards, or null when nothing is
		// stacked. Today's backend never sends it (§2.3), so every screen has to
		// cope with it missing as well as null.
		draw_stack: null,
		winner_id: null,
		turn_timer_seconds: 60,
		turn_started_at: "2026-09-12T14:00:00.000000+00:00",
		settings: { ...NO_RULES },
		players: [],
		...fields,
	}
}

// Seven cards against a red 5. The yellow 0 is on purpose: value 0 is the easiest card to break.
const HAND = [
	num("red", 2), num("blue", 5), num("green", 9), action("yellow", "skip"),
	action("red", "draw_two"), num("yellow", 0), action("blue", "reverse"),
]

// HAND plus 15 more: 22 cards, to see whether a big hand still fits.
const BIG_HAND = [
	...HAND,
	num("red", 8), num("red", 8), num("blue", 1), num("blue", 3), num("green", 4),
	num("green", 6), num("yellow", 7), num("yellow", 9), action("green", "skip"), action("yellow", "reverse"),
	action("blue", "draw_two"), wild(), wildDrawFour(), num("red", 0), num("blue", 9),
]

export const myTurn = gameState({
	players: [
		me(HAND),
		player("13", "alice", 5, { avatar_url: "/profile/cat.jpg" }),
		player("14", "bruno", 7, { avatar_url: "/profile/dog.jpg" }),
		player("15", "chloe", 3, { avatar_url: "/profile/duck.jpg" }),
	],
})

export const spectating = gameState({
	your_player_id: null,
	is_spectator: true,
	spectator_count: 3,
	current_player_id: "14",
	players: [player("13", "alice", 5), player("14", "bruno", 7), player("15", "chloe", 3), player("16", "diego", 6)],
})

// Seven swap is on and I hold a red 7. `next` is the answer to playing it and
// choosing alice: the 7 is on the pile and our hands have changed places. The
// notice only names her if the table still remembers the target_id it sent, which
// is why the swap has to be clicked through rather than jumped to.
export const sevenSwap = gameState({
	settings: { ...NO_RULES, seven_swap: true },
	players: [me([num("red", 7), ...HAND]), player("13", "alice", 5), player("14", "bruno", 2)],
	next: {
		top_card: num("red", 7),
		current_player_id: "14",
		players: [
			me([num("blue", 3), num("green", 6), action("red", "skip"), num("yellow", 7), num("blue", 9)]),
			player("13", "alice", 7),
			player("14", "bruno", 2),
		],
	},
})

export const twoPlayers = gameState({
	players: [
		me(HAND),
		player("13", "alice", 5, { avatar_url: "/profile/girl.jpg" }),
	],
})

export const theirTurn = gameState({
	current_player_id: "11",
	direction: -1,
	top_card: action("blue", "reverse"),
	current_color: "blue",
	players: [
		player("11", "daninin", 5),
		me(HAND),
		player("13", "bruno", 4),
	],
})

export const afterWild = gameState({
	top_card: wild(),
	current_color: "red",
	players: [
		player("11", "daninin", 5),
		me(HAND),
		player("13", "bruno", 4),
	],
})

export const wildPending = gameState({
	players: [
		me([wild(), wildDrawFour(), num("green", 4), action("blue", "skip")]),
		player("13", "alice", 6),
	],
})

export const disconnected = gameState({
	current_player_id: "14",
	players: [
		me(HAND),
		player("13", "alice", 6),
		player("14", "chloe", 4, { is_connected: false }),
	],
})

export const won = gameState({
	status: "finished",
	winner_id: ME,
	top_card: num("green", 7),
	current_color: "green",
	players: [
		me([]),
		player("13", "alice", 3),
		player("14", "chloe", 4),
	],
})

export const lost = gameState({
	status: "finished",
	winner_id: "13",
	players: [
		me(HAND),
		player("13", "alice", 0),
		player("14", "chloe", 4),
	],
})

export const bigHand = gameState({
	players: [
		me(BIG_HAND),
		player("13", "alice", 2),
		player("14", "bruno", 3),
	],
})

export const tenPlayers = gameState({
	top_card: num("yellow", 8),
	current_color: "yellow",
	current_player_id: "38",
	draw_pile_count: 31,
	players: [
		player("31", "alice", 7, { avatar_url: "/profile/alex.png" }),
		player("32", "bruno", 4, { avatar_url: "/profile/alien.jpg" }),
		player("33", "chloe", 9, { avatar_url: "/profile/cat.jpg" }),
		player("34", "diego", 2, { avatar_url: "/profile/dog.jpg" }),
		player("35", "maximilian_the_magnificent", 6, { avatar_url: "/profile/duck.jpg" }),
		player("36", "felix", 11, { avatar_url: "/profile/fifipe.png" }),
		me(HAND),
		player("37", "gabi", 1, { avatar_url: "/profile/girl.jpg" }),
		player("38", "hugo", 5, { avatar_url: "/profile/smiley.jpg" }),
		player("39", "ines", 8, { avatar_url: "/profile/wallace.png" }),
	],
})

// I had nothing to play on the red 5, drew, and the green 3 I got doesn't play either.
export const afterDraw = gameState({
	has_drawn_this_turn: true,
	players: [
		me([num("green", 9), action("yellow", "skip"), num("yellow", 0), action("blue", "reverse"), num("green", 3)]),
		player("13", "alice", 5, { avatar_url: "/profile/cat.jpg" }),
		player("14", "bruno", 7, { avatar_url: "/profile/dog.jpg" }),
	],
})

// Jump-in lets anyone play out of turn, but only a card identical to the top one.
export const jumpIn = gameState({
	settings: { ...NO_RULES, jump_in: true },
	current_player_id: "13",
	top_card: num("green", 4),
	current_color: "green",
	players: [
		me([num("green", 4), ...HAND]),
		player("13", "alice", 5),
		player("14", "bruno", 6),
	],
})

// turn_started_at stays set on purpose: the countdown must key off turn_timer_seconds alone.
export const noTimer = gameState({
	turn_timer_seconds: null,
	players: [me(HAND), player("13", "alice", 5), player("14", "bruno", 7)],
})

// Exactly what `dev` sends today, written out by hand because gameState() adds
// fields it doesn't send yet: no `settings` or `avatar_url` (backend Task 8), and
// `turn_started_at` is null because the start endpoint never saves it.
export const livePayload = {
	type: "game_state",
	status: "in_progress",
	your_player_id: ME,
	is_spectator: false,
	spectator_count: 1,
	top_card: num("red", 5),
	current_color: "red",
	current_player_id: ME,
	direction: 1,
	has_drawn_this_turn: false,
	draw_pile_count: 60,
	winner_id: null,
	turn_timer_seconds: 60,
	turn_started_at: null,
	players: [
		{ player_id: ME, name: "daniel", hand_count: HAND.length, is_connected: true, hand: HAND },
		{ player_id: "13", name: "alice", hand_count: 5, is_connected: true },
		{ player_id: "14", name: "bruno", hand_count: 7, is_connected: true },
	],
}

// What the socket sends for a game the host hasn't started. It isn't a game, so
// Room must never hand it to GameTable.
export const notStarted = { type: "game_state", status: "pending", state: null }

// Drew, but the hand still has plays, so nothing happens by itself: I play or pass.
export const drewPlayable = gameState({
	has_drawn_this_turn: true,
	players: [me(HAND), player("13", "alice", 5), player("14", "bruno", 7)],
})

// Someone answered a +2 with a +2 twice over: six cards are waiting for whoever
// can't answer, and right now that's me. `next` is what arrives if I take them.
export const stackPending = gameState({
	top_card: action("blue", "draw_two"),
	current_color: "blue",
	draw_stack: { card_type: "draw_two", count: 6 },
	players: [me(HAND), player("13", "alice", 5), player("14", "bruno", 4)],
	next: {
		draw_stack: null,
		draw_pile_count: 54,
		current_player_id: "13",
		players: [
			me([...HAND, num("green", 3), num("green", 6), num("blue", 1), num("yellow", 9), wild(), num("red", 8)]),
			player("13", "alice", 5),
			player("14", "bruno", 4),
		],
	},
})

// Zero rotate is on. Playing the yellow 0 in my hand passes every hand along,
// which is what `next` shows: a 0 on the pile and a different hand for me.
export const rotation = gameState({
	settings: { ...NO_RULES, zero_swap: true },
	players: [me(HAND), player("13", "alice", 5), player("14", "bruno", 4)],
	next: {
		top_card: num("yellow", 0),
		current_color: "yellow",
		current_player_id: "13",
		players: [
			me([num("blue", 3), num("green", 6), action("red", "skip"), num("yellow", 7), num("blue", 9)]),
			player("13", "alice", 7),
			player("14", "bruno", 5),
		],
	},
})

// I play the blue reverse: play turns around and bruno, not alice, is next.
export const reverse = gameState({
	top_card: num("blue", 9),
	current_color: "blue",
	players: [me(HAND), player("13", "alice", 5), player("14", "bruno", 4)],
	next: {
		top_card: action("blue", "reverse"),
		direction: -1,
		current_player_id: "14",
		players: [
			me(HAND.filter((card) => card.card_type !== "reverse")),
			player("13", "alice", 5),
			player("14", "bruno", 4),
		],
	},
})

// Stacking is off and I had nothing to play, so a +4 landed on me: three cards
// with the pile untouched, which is a draw and nothing else.
export const drewThree = gameState({
	players: [me(HAND), player("13", "alice", 5), player("14", "bruno", 4)],
	next: {
		draw_pile_count: 57,
		has_drawn_this_turn: true,
		players: [
			me([...HAND, num("green", 3), num("blue", 1), num("yellow", 9)]),
			player("13", "alice", 5),
			player("14", "bruno", 4),
		],
	},
})

/* ---------------------------------------------------------------------------
 * Lobby payloads
 *
 * The exact shape of the `lobby` message in BACKEND_REDESIGN_TASKS.md §1.1, which
 * is the contract the backend has to match — and, since 2026-09-18, does: the
 * real message now carries `name`, `code`, `max_spectators`, `spectators` as a
 * list of names, seats flat, and `settings` with the hand size and all five
 * house rules. `backend/game_api/tests/test_lobby_payload.py` asserts this
 * shape field by field, so the two cannot drift apart again without a red test.
 * ------------------------------------------------------------------------- */

const seat = (username, extra = {}) => ({
	username,
	avatar_url: "/profile/default.jpg",
	is_host: false,
	is_connected: true,
	...extra,
})

const ME_SEAT = seat("daniel", { avatar_url: "/profile/daniel.png" })
const RITA = seat("rita_c", { avatar_url: "/profile/girl.jpg" })
const INES = seat("ines.p", { avatar_url: "/profile/cat.jpg" })
const GUEST = seat("guesttt")

function lobbyState(fields) {
	return {
		type: "lobby",
		name: "Sala do Diogo",
		host: "daniel",
		code: "7F2K",
		seats: [{ ...ME_SEAT, is_host: true }, RITA, null, null],
		your_seat: 0,
		you_are_spectating: false,
		spectators: [],
		max_spectators: 6,
		settings: {
			max_seats: 4,
			starting_hand_size: 7,
			turn_timer_seconds: 60,
			allow_spectators: true,
			...NO_RULES,
		},
		...fields,
	}
}

// I'm the host, one other player is in, and two seats are still free.
export const lobbyHost = lobbyState({})

// Every seat taken: Start game is the only thing left to do.
export const lobbyFull = lobbyState({
	seats: [{ ...ME_SEAT, is_host: true }, RITA, INES, GUEST],
	spectators: [{ username: "wildboy42" }],
})

// I'm watching, rita_c hosts, and there is a free seat I could take.
export const lobbySpectating = lobbyState({
	host: "rita_c",
	seats: [{ ...RITA, is_host: true }, INES, null, null],
	your_seat: null,
	you_are_spectating: true,
	spectators: [{ username: "daniel" }, { username: "guesttt" }],
})

// guesttt dropped out. The seat stays theirs for the grace period, faded.
export const lobbyAway = lobbyState({
	seats: [{ ...ME_SEAT, is_host: true }, { ...GUEST, is_connected: false }, INES, null],
})

// Three house rules on, so the chips have something to show.
export const lobbyHouseRules = lobbyState({
	settings: {
		max_seats: 4,
		starting_hand_size: 5,
		turn_timer_seconds: 30,
		allow_spectators: true,
		...NO_RULES,
		draw_stacking: true,
		jump_in: true,
		seven_swap: true,
	},
})

// A room nobody can watch: no spectator list, no Spectate button.
export const lobbyNoSpectators = lobbyState({
	settings: {
		max_seats: 4,
		starting_hand_size: 7,
		turn_timer_seconds: 60,
		allow_spectators: false,
		...NO_RULES,
	},
})

// The order the playground shows them in. `note` says what to look at.
export const FIXTURES = [
	{ name: "myTurn", game: myTurn, note: "My turn at a table of 4. Red 5 on top: the reds and the blue 5 can be played." },
	{ name: "afterDraw", game: afterDraw, note: "I drew and still have nothing to play on the red 5. The draw pile is off, and the turn passes by itself after a moment." },
	{ name: "drewPlayable", game: drewPlayable, note: "I drew and can still play the reds or the blue 5. No automatic pass: Pass stays on for me to choose." },
	{ name: "theirTurn", game: theirTurn, note: "I just played a reverse (direction -1), so daninin is up. I'm 2nd in the list, but my hand still belongs at the bottom." },
	{ name: "twoPlayers", game: twoPlayers, note: "The smallest table: me and one opponent." },
	{ name: "tenPlayers", game: tenPlayers, note: "A full table. I'm 7th of 10, one name is too long, and gabi has one card left." },
	{ name: "wildPending", game: wildPending, note: "My turn with two wilds in hand. Clicking one should open the colour picker." },
	{ name: "afterWild", game: afterWild, note: "A black wild on top with red in play. The glow is the only clue." },
	{ name: "sevenSwap", game: sevenSwap, note: "Seven swap is on. Click the red 7: No plays it normally; Yes, then a player on the arc, sends their target_id. Then Next state to see the swap notice." },
	{ name: "jumpIn", game: jumpIn, note: "alice's turn, but jump-in is on and I hold the same green 4 that's on top. It sits raised, ready to jump in with." },
	{ name: "spectating", game: spectating, note: "Watching: nobody is me, no hand anywhere, nothing to click." },
	{ name: "disconnected", game: disconnected, note: "chloe lost connection, and it's her turn." },
	{ name: "won", game: won, note: "Game over: I won." },
	{ name: "lost", game: lost, note: "Game over: alice won." },
	{ name: "bigHand", game: bigHand, note: "22 cards in my hand. Does it still fit?" },
	{ name: "noTimer", game: noTimer, note: "This room has no turn timer, so no countdown anywhere, even though turn_started_at is set." },
	{ name: "livePayload", game: livePayload, note: "Exactly what dev sends today: no settings, no avatars, turn_started_at null. It still has to render." },
	{ name: "notStarted", game: notStarted, note: "Sent before the host presses Start. Room should ignore it, so there's no table to draw." },
	{ name: "stackPending", game: stackPending, note: "Six +2 cards are stacked on me. The pile reads Draw +6 and the badge says +6 incoming. Next state: I take them." },
	{ name: "rotation", game: rotation, note: "Zero rotate is on. Next state puts a 0 on the pile and hands everyone a new hand — watch for \"Hands rotated\"." },
	{ name: "reverse", game: reverse, note: "Next state turns play around: the arrow and \"Direction reversed\" both flip." },
	{ name: "drewThree", game: drewThree, note: "Next state adds three cards to my hand with the same card on the pile — a draw, not a rotation." },
	// Lobby payloads (§1.1). The playground draws Lobby for these, not the table.
	{ name: "lobbyHost", game: lobbyHost, note: "I host, one other player is seated and two seats are free. Start game needs two players." },
	{ name: "lobbyFull", game: lobbyFull, note: "Every seat taken, one spectator watching. No free seat to tab to." },
	{ name: "lobbySpectating", game: lobbySpectating, note: "I'm watching rita_c's room and could still take a free seat." },
	{ name: "lobbyAway", game: lobbyAway, note: "guesttt lost connection: the seat is faded, and this is not the page's own \"reconnecting…\"." },
	{ name: "lobbyHouseRules", game: lobbyHouseRules, note: "Three house rules on, a 5-card starting hand and a 30s turn timer." },
	{ name: "lobbyNoSpectators", game: lobbyNoSpectators, note: "Spectating is off for this room, so there is no list and no Spectate button." },
]
