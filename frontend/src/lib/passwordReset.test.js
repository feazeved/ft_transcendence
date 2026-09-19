import { describe, expect, it } from "vitest"
import { resetCredentials, splitResetKey } from "./passwordReset.js"

describe("splitResetKey", () => {
	it("splits allauth's single segment on the first hyphen", () => {
		// The token itself contains hyphens; only the first one separates.
		expect(splitResetKey("3k-cka2np-8f0e1d")).toEqual({ uid: "3k", token: "cka2np-8f0e1d" })
	})

	it("keeps a key with no hyphen as the uid, so the server is the one to refuse it", () => {
		expect(splitResetKey("3k")).toEqual({ uid: "3k", token: "" })
	})
})

describe("resetCredentials", () => {
	it("takes the two-segment route as it comes", () => {
		expect(resetCredentials({ uid: "3k", token: "cka2np-8f0e1d" })).toEqual({
			uid: "3k",
			token: "cka2np-8f0e1d",
		})
	})

	it("splits the one-segment route", () => {
		expect(resetCredentials({ key: "3k-cka2np-8f0e1d" })).toEqual({
			uid: "3k",
			token: "cka2np-8f0e1d",
		})
	})

	it("answers empty for a link with neither, rather than throwing on render", () => {
		expect(resetCredentials({})).toEqual({ uid: "", token: "" })
	})
})
