// The arena's measurements, in one place because three components have to agree
// on them: OpponentArc places the seats inside "the arena height minus one seat",
// CenterPile drops below that same band when the arena is short, and GameTable is
// the one that measures the arena and decides which set is in use.
//
// It is a .js file, not .jsx: a file that exports both a component and plain
// values trips the react/only-export-components lint rule.

// Below this much arena height a seat and the two piles can't both fit, so the
// table switches to its compact set: smaller seats and cards, no card backs, and
// the pile below the seats instead of in the middle of them.
export const COMPACT_HEIGHT = 250

// Shorter still, and the pile now sits below the seats rather than among them, so
// the middle of the arena belongs to it: `arcPositions(count, { tight: true })`
// pushes any seat out of that middle column. A phone held sideways gets here.
export const TIGHT_HEIGHT = 200

// When a turn's countdown turns red — the seat's bar and the status pill have to
// agree, so the number lives here rather than in both of them.
export const URGENT_SECONDS = 5

// What one seat needs, top to bottom. `arcPositions` gives a 0–1 fraction which
// is applied inside `calc(100% - reserve)`, so the top seat always has this much
// room under the header, however short the window gets.
const SIZES = {
	normal: {
		reserve: 118,
		seatWidth: "clamp(66px,9vw,104px)",
		avatar: "min(clamp(40px,6vw,58px),8vh)",
		pileCard: "min(clamp(54px,15vw,104px),13vh)",
	},
	compact: {
		reserve: 94,
		seatWidth: "78px",
		avatar: "34px",
		pileCard: "min(56px,12vw)",
	},
}

export function arenaSizes(compact) {
	return compact ? SIZES.compact : SIZES.normal
}
