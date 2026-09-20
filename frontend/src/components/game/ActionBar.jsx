import { COLOR_HEX } from "@/lib/cards.js"

const WILD_COLORS = ["red", "yellow", "green", "blue"]

const CANCEL =
	"cursor-pointer rounded-md border-2 border-white/30 px-[18px] py-3 font-logo text-sm text-soft transition-colors hover:border-white hover:text-white"

// What is on offer once a card needs something more than a click: the four colours
// of a wild, and Cancel.
//
// There is no Pass button any more — drawing is the move. The turn still ends with
// a `pass_turn` on the wire, but the table sends that itself; see GameTable.
//
// Each colour button carries its colour's *name*, because a round swatch with no
// text is unusable by a screen reader and unreliable for a colour-blind player.
function ActionBar({ picking = false, choosing = false, onPickColor, onCancel }) {
	if (!picking && !choosing) return null

	return (
		<>
			{picking && (
				<>
					<span className="text-sm text-white/60">Pick a colour:</span>
					{WILD_COLORS.map((color) => (
						<button
							key={color}
							type="button"
							onClick={() => onPickColor?.(color)}
							aria-label={color}
							style={{ background: COLOR_HEX[color] }}
							className="h-9 w-9 cursor-pointer rounded-full border-2 border-white/20 transition-colors hover:border-white"
						/>
					))}
				</>
			)}
			{choosing && (
				<button type="button" onClick={onCancel} className={CANCEL}>
					Cancel
				</button>
			)}
		</>
	)
}

export default ActionBar
