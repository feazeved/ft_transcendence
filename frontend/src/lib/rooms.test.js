import { describe, expect, it } from "vitest"
import {
	defaultRoomSettings,
	enabledRuleLabels,
	hasAnyModifier,
	MAX_PLAYERS,
	MAX_TURN_TIMER,
	MIN_HAND_SIZE,
	MIN_PLAYERS,
	MIN_TURN_TIMER,
	MODIFIER_TOGGLES,
	ROOM_CODE_ALPHABET,
	ROOM_CODE_LENGTH,
	RULE_TOGGLES,
	sanitizeRoomCode,
} from "./rooms.js"

describe("defaultRoomSettings", () => {
	// If this ever became one shared module-level object, two rooms would share
	// settings and editing one would leak into the other.
	it("returns a fresh object on every call", () => {
		const first = defaultRoomSettings()
		first.max_seats = 10
		first.seven_swap = true

		const second = defaultRoomSettings()
		expect(second).not.toBe(first)
		expect(second.max_seats).toBe(4)
		expect(second.seven_swap).toBe(false)
	})

	it("starts with every house rule off and spectators allowed", () => {
		const settings = defaultRoomSettings()
		expect(MODIFIER_TOGGLES.filter(({ key }) => settings[key] !== false)).toEqual([])
		expect(settings.allow_spectators).toBe(true)
	})

	it("stays inside the room limits", () => {
		const { max_seats, starting_hand_size, turn_timer_seconds } = defaultRoomSettings()
		expect(max_seats).toBeGreaterThanOrEqual(MIN_PLAYERS)
		expect(max_seats).toBeLessThanOrEqual(MAX_PLAYERS)
		expect(starting_hand_size).toBeGreaterThanOrEqual(MIN_HAND_SIZE)
		expect(turn_timer_seconds).toBeGreaterThanOrEqual(MIN_TURN_TIMER)
		expect(turn_timer_seconds).toBeLessThanOrEqual(MAX_TURN_TIMER)
	})
})

describe("enabledRuleLabels", () => {
	it("returns an empty list when nothing is enabled", () => {
		expect(enabledRuleLabels(defaultRoomSettings())).toEqual([])
	})

	it("returns only the enabled labels, in toggle order", () => {
		expect(enabledRuleLabels({ zero_swap: true, jump_in: true, seven_swap: false })).toEqual(["Jump in", "Zero rotate"])
	})

	// A lobby's settings also carry max_seats, the timer and allow_spectators.
	// None of those are house rules, however truthy they are.
	it("ignores keys that are not house rules", () => {
		expect(enabledRuleLabels({ max_seats: 4, turn_timer_seconds: 60, allow_spectators: true })).toEqual([])
	})

	it("survives an undefined argument", () => {
		expect(enabledRuleLabels()).toEqual([])
	})
})

describe("hasAnyModifier", () => {
	it("is false for the default settings", () => {
		expect(hasAnyModifier(defaultRoomSettings())).toBe(false)
	})

	it("is true as soon as one house rule is on", () => {
		expect(hasAnyModifier({ ...defaultRoomSettings(), draw_until_playable: true })).toBe(true)
	})

	it("is not fooled by allow_spectators", () => {
		expect(hasAnyModifier({ allow_spectators: true })).toBe(false)
	})

	it("survives an undefined argument", () => {
		expect(hasAnyModifier()).toBe(false)
	})
})

describe("RULE_TOGGLES", () => {
	it("gives every toggle a key, a label and a hint", () => {
		const filled = expect.stringMatching(/\S/)
		expect(RULE_TOGGLES).toEqual(RULE_TOGGLES.map(() => ({ key: filled, label: filled, hint: filled })))
	})

	it("has no duplicate keys", () => {
		const keys = RULE_TOGGLES.map((toggle) => toggle.key)
		expect(new Set(keys).size).toBe(keys.length)
	})

	it("offers every house rule, then allow_spectators", () => {
		expect(RULE_TOGGLES.map((toggle) => toggle.key)).toEqual([
			...MODIFIER_TOGGLES.map((toggle) => toggle.key),
			"allow_spectators",
		])
	})
})

describe("sanitizeRoomCode", () => {
	it("uppercases what it keeps", () => {
		expect(sanitizeRoomCode("7f2k")).toBe("7F2K")
	})

	// I/O and 0/1 are left out of the alphabet on purpose: read a code out loud
	// with them in and nobody knows which one they heard.
	it("drops the characters a code can never contain", () => {
		expect(sanitizeRoomCode("IO01")).toBe("")
		expect(sanitizeRoomCode("7I2O")).toBe("72")
	})

	it("drops spaces, punctuation and anything else pasted along", () => {
		expect(sanitizeRoomCode(" 7f2k \n")).toBe("7F2K")
		expect(sanitizeRoomCode("code: 7F2K!")).toBe("CDE7F2K")
	})

	it("keeps every character of the alphabet", () => {
		expect(sanitizeRoomCode(ROOM_CODE_ALPHABET)).toBe(ROOM_CODE_ALPHABET)
		expect(ROOM_CODE_ALPHABET).toHaveLength(32)
		expect(ROOM_CODE_LENGTH).toBe(4)
	})
})
