import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { rememberDestination, takeDestination } from "./oauth.js"

// Node has no sessionStorage, so the tests bring their own.
function fakeStorage() {
	const map = new Map()
	return {
		getItem: (k) => (map.has(k) ? map.get(k) : null),
		setItem: (k, v) => map.set(k, String(v)),
		removeItem: (k) => map.delete(k),
		size: () => map.size,
	}
}

let storage

beforeEach(() => {
	storage = fakeStorage()
	globalThis.sessionStorage = storage
})

afterEach(() => {
	delete globalThis.sessionStorage
})

describe("the OAuth destination", () => {
	it("comes back out the way it went in", () => {
		rememberDestination("/friends")
		expect(takeDestination()).toBe("/friends")
	})

	// Otherwise the next sign-in would inherit where the last one was headed.
	it("is used once and then forgotten", () => {
		rememberDestination("/friends")
		takeDestination()
		expect(takeDestination()).toBe("/")
		expect(storage.size()).toBe(0)
	})

	it("falls back to the home page when nothing was stored", () => {
		expect(takeDestination()).toBe("/")
		expect(takeDestination("/play")).toBe("/play")
	})

	// A private window, or blocked site data, must not break signing in.
	it("survives storage that throws", () => {
		globalThis.sessionStorage = {
			getItem() {
				throw new Error("blocked")
			},
			setItem() {
				throw new Error("blocked")
			},
			removeItem() {
				throw new Error("blocked")
			},
		}
		expect(() => rememberDestination("/friends")).not.toThrow()
		expect(takeDestination()).toBe("/")
	})
})
