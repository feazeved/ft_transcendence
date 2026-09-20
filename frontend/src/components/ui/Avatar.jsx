import { useState } from "react"

const SIZES = {
	xs: "h-7 w-7 text-xs",
	sm: "h-9 w-9 text-sm",
	md: "h-12 w-12 text-base",
	lg: "h-16 w-16 text-xl",
	xl: "h-[clamp(88px,18vw,120px)] w-[clamp(88px,18vw,120px)] text-4xl",
	// Added in area 03: a lobby seat and a seat at the table size their own circle
	// (it follows the arena's height), so the photo just fills whatever it is given.
	fill: "h-full w-full text-base",
	// Added in area 06: the face inside a tournament participant chip, which is
	// smaller than `xs` because the chip is only a line of mono text tall.
	chip: "h-[22px] w-[22px] text-[10px]",
}

const RINGS = {
	red: "ring-2 ring-red",
	blue: "ring-2 ring-blue",
	green: "ring-2 ring-green",
	yellow: "ring-2 ring-yellow",
}

const INITIAL_COLORS = ["bg-red", "bg-blue", "bg-green", "bg-yellow"]

// Always the same color for the same person, so a face you know keeps its circle
// while the photo loads.
function colorFor(name = "") {
	let sum = 0
	for (const char of name) sum += char.codePointAt(0)
	return INITIAL_COLORS[sum % INITIAL_COLORS.length]
}

// The photo sits on top of the initial, so the letter shows while the photo
// loads and stays if it never arrives. `failed` is per-photo state, which is why
// Avatar renders this with key={src}: a new src means a brand new component with
// `failed` back to false.
function AvatarImage({ src, alt }) {
	const [failed, setFailed] = useState(false)
	if (!src || failed) return null
	return (
		<img
			src={src}
			alt={alt}
			onError={() => setFailed(true)}
			className="absolute inset-0 h-full w-full rounded-full object-cover"
		/>
	)
}

// `alt` is "" by default: an avatar almost always sits next to the name it
// belongs to, and repeating it makes a screen reader say it twice. Pass an alt
// when the photo stands alone, like the header's account link.
function Avatar({ src, name = "", size = "sm", ring, alt = "", className = "" }) {
	const initial = name.trim().charAt(0).toUpperCase() || "?"

	return (
		<span
			className={`relative flex flex-none items-center justify-center overflow-hidden rounded-full font-logo font-extrabold text-white ${
				colorFor(name)
			} ${SIZES[size] ?? SIZES.sm} ${ring ? RINGS[ring] ?? "" : ""} ${className}`}
		>
			<span aria-hidden="true">{initial}</span>
			<AvatarImage key={src} src={src} alt={alt} />
		</span>
	)
}

export default Avatar
