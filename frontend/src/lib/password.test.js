import { describe, expect, it } from "vitest"
import { MIN_LENGTH, meetsLocalRules, passwordRules, quickRatio, tooSimilar } from "./password.js"

const state = (password, user, id) => passwordRules(password, user).find((rule) => rule.id === id).state

describe("quickRatio", () => {
	it("matches difflib on identical strings", () => {
		expect(quickRatio("alice", "alice")).toBe(1)
	})

	it("counts each shared character only once", () => {
		// "aa" vs "a": one match, 2*1/3.
		expect(quickRatio("aa", "a")).toBeCloseTo(2 / 3)
	})

	it("is 1 for two empty strings, the way _calculate_ratio is", () => {
		expect(quickRatio("", "")).toBe(1)
	})
})

// These verdicts were taken from Django's own UserAttributeSimilarityValidator
// running against the project's settings, so the two cannot drift silently.
describe("tooSimilar agrees with Django", () => {
	const user = ["alice", "alice@example.com"]

	it.each([
		["alice2026", true],
		["alice", true],
		["aliceee", true],
		["example.com", true],
		["correct horse battery", false],
		["12345678", false],
		["Tr0ub4dour&3", false],
	])("%s -> %s", (password, expected) => {
		expect(tooSimilar(password, user)).toBe(expected)
	})

	it("compares the parts of an email, not just the whole", () => {
		expect(tooSimilar("MailExample", ["bob", "mail@example.com"])).toBe(true)
	})

	it("says nothing about an empty password", () => {
		expect(tooSimilar("", ["alice", "alice@example.com"])).toBe(false)
	})
})

describe("passwordRules", () => {
	const user = { username: "alice", email: "alice@example.com" }

	it("turns the length rule green only at the minimum", () => {
		expect(state("a".repeat(MIN_LENGTH - 1), user, "length")).toBe("unmet")
		expect(state("a".repeat(MIN_LENGTH), user, "length")).toBe("met")
	})

	it("refuses an all-number password", () => {
		expect(state("12345678", user, "numeric")).toBe("unmet")
		expect(state("1234567a", user, "numeric")).toBe("met")
	})

	it("holds the similarity rule against the username and the email", () => {
		expect(state("alice2026", user, "similar")).toBe("unmet")
		expect(state("correct horse battery", user, "similar")).toBe("met")
	})

	it("leaves every rule unmet for an empty password", () => {
		const empty = passwordRules("", user)
		expect(empty.filter((rule) => rule.state === "met")).toHaveLength(0)
	})

	it("shows only the rules the browser can actually settle", () => {
		// The server's common-password check is deliberately not listed: it could
		// never go green while you typed, so it read as a rule you had failed.
		expect(passwordRules("anything", user).map((rule) => rule.id)).toEqual(["length", "numeric", "similar"])
	})
})

describe("meetsLocalRules", () => {
	const user = { username: "alice", email: "alice@example.com" }

	it("is true once everything the browser can check passes", () => {
		expect(meetsLocalRules("correct horse battery", user)).toBe(true)
	})

	it("is false while a rule is unmet", () => {
		expect(meetsLocalRules("short", user)).toBe(false)
	})
})
