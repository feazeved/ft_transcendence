const YES =
	"cursor-pointer rounded-md border-2 border-yellow bg-yellow px-[22px] py-3 font-logo text-sm font-bold text-on-yellow transition-colors hover:border-yellow-hover hover:bg-yellow-hover"

const NO =
	"cursor-pointer rounded-md border-2 border-line-strong px-[22px] py-3 font-logo text-sm font-semibold text-soft transition-colors hover:border-white hover:text-white"

// The Seven swap, in two steps.
//
// Swapping is optional (CONTEXT.md), so the first step asks, and No plays the 7 as
// an ordinary card. Saying Yes turns the opponents on the arc into targets, and
// the second step is only a line of text: the click happens on a seat, not here.
// Cancel lives in the ActionBar next to this, and covers both steps.
function SwapPrompt({ step, onYes, onNo }) {
	if (step === "swap") {
		return (
			<>
				<span className="font-logo text-[15px] font-semibold text-yellow">Swap hands with someone?</span>
				<button type="button" onClick={onYes} className={YES}>
					Yes
				</button>
				<button type="button" onClick={onNo} className={NO}>
					No
				</button>
			</>
		)
	}

	if (step === "target") {
		return <span className="font-logo text-[15px] font-semibold text-yellow">Click a player to swap hands with</span>
	}

	return null
}

export default SwapPrompt
