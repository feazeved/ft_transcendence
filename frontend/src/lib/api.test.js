import { describe, expect, it } from "vitest"
import { extractErrorMessage } from "./api.js"

describe("extractErrorMessage", () => {
	it("prefers detail when present", () => {
		expect(extractErrorMessage({ detail: "Only the host can start the game.", message: "ignored" }, 403)).toBe(
			"Only the host can start the game.",
		)
	})

	it("falls back to message", () => {
		expect(extractErrorMessage({ message: "This game is full." }, 400)).toBe("This game is full.")
	})

	// The password endpoint really does send several reasons at once for a weak
	// password. This is what turns them into one sentence.
	it("joins every field error into one line", () => {
		const data = {
			new_password2: [
				"This password is too short. It must contain at least 8 characters.",
				"This password is too common.",
			],
			non_field_errors: ["The two password fields didn't match."],
		}
		expect(extractErrorMessage(data, 400)).toBe(
			"This password is too short. It must contain at least 8 characters. This password is too common. The two password fields didn't match.",
		)
	})

	// A view that raises ValidationError("...") sends a bare list, not an object.
	it("reads a bare list of messages", () => {
		expect(extractErrorMessage(["This game has already started or finished."], 400)).toBe(
			"This game has already started or finished.",
		)
	})

	// A nested serializer's errors are objects. Joining them would print "[object Object]".
	it("skips values it can't show as text", () => {
		expect(extractErrorMessage({ players: [{ index: ["Seat taken."] }], code: 7 }, 400)).toBe(
			"Request failed with status 400",
		)
	})

	it("falls back to the status line for an empty body", () => {
		expect(extractErrorMessage({}, 500)).toBe("Request failed with status 500")
	})

	it("survives a null body", () => {
		expect(extractErrorMessage(null, 502)).toBe("Request failed with status 502")
	})

	// A non-JSON response — nginx's error page — arrives here as a plain string.
	it("never shows a text body", () => {
		expect(extractErrorMessage("<html><body>502 Bad Gateway</body></html>", 502)).toBe(
			"Request failed with status 502",
		)
	})
})
