import { describe, expect, it } from "vitest"
import { pageItems } from "./leaderboard.js"

describe("pageItems", () => {
	it("lists every page when none has to be skipped", () => {
		expect(pageItems(2, 4)).toEqual([1, 2, 3, 4])
	})

	// Four pages already collapse from page 1: only 1, 2 and the last survive.
	it("starts collapsing as soon as a page falls outside the window", () => {
		expect(pageItems(1, 5)).toEqual([1, 2, "gap", 5])
	})

	it("keeps the first, the last, the current and its neighbours", () => {
		expect(pageItems(6, 12)).toEqual([1, "gap", 5, 6, 7, "gap", 12])
	})

	it("only opens a gap on the side that needs one", () => {
		expect(pageItems(2, 12)).toEqual([1, 2, 3, "gap", 12])
		expect(pageItems(11, 12)).toEqual([1, "gap", 10, 11, 12])
	})

	// Two gaps in a row would draw "… …", which says nothing.
	it("never puts two gaps side by side", () => {
		const items = pageItems(6, 20)
		items.forEach((item, i) => {
			if (item === "gap") expect(items[i + 1]).not.toBe("gap")
		})
	})

	it("handles a single page and an empty list", () => {
		expect(pageItems(1, 1)).toEqual([1])
		expect(pageItems(1, 0)).toEqual([])
	})
})
