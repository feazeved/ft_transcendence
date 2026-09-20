// Shared by Button and ButtonLink. It lives in a .js file because a .jsx file
// that exports both a component and a plain function trips the lint rule
// react/only-export-components.

const BASE =
	"inline-flex items-center justify-center gap-2 rounded-md border-2 transition-colors disabled:cursor-not-allowed disabled:opacity-50"

// solid: colored fill, dark text. The main action on a screen.
const SOLID = {
	red: "bg-red border-red text-white hover:bg-red-hover hover:border-red-hover",
	blue: "bg-blue border-blue text-white hover:bg-blue-hover hover:border-blue-hover",
	green: "bg-green border-green text-on-green hover:bg-green-hover hover:border-green-hover",
	yellow: "bg-yellow border-yellow text-on-yellow hover:bg-yellow-hover hover:border-yellow-hover",
	// Added in area 06: the design's white main action, used for "Join tournament"
	// so it reads apart from the green "Start tournament" beside it.
	white: "bg-white border-white text-page hover:bg-soft hover:border-soft",
}

// outline: colored border and text, filling in on hover.
const OUTLINE = {
	red: "border-[3px] bg-transparent border-red text-red-soft hover:bg-red hover:text-white",
	blue: "border-[3px] bg-transparent border-blue text-blue-soft hover:bg-blue hover:text-white",
	green: "border-[3px] bg-transparent border-green text-green-soft hover:bg-green hover:text-on-green",
	yellow: "border-[3px] bg-transparent border-yellow text-yellow hover:bg-yellow hover:text-on-yellow",
}

const SIZES = {
	solid: "px-6 py-4 font-logo text-base font-bold",
	outline: "px-6 py-4 font-logo text-base font-bold",
	small: "px-4 py-[9px] font-mono text-xs tracking-[0.06em]",
}

// small: the quiet bordered button of the footer and the room cards. One look,
// not four, so `color` is ignored here.
const SMALL = "border-line-strong bg-transparent text-dim hover:border-yellow hover:text-yellow"

export function buttonClasses({ variant = "solid", color = "yellow", className = "" } = {}) {
	const look =
		variant === "small" ? SMALL : (variant === "outline" ? OUTLINE : SOLID)[color] ?? SOLID.yellow
	return `${BASE} ${SIZES[variant] ?? SIZES.solid} ${look} ${className}`.trim()
}

export default buttonClasses
