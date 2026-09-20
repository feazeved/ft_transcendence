// The Profile's two icons, drawn here instead of imported as `.svg` files.
//
// `src/assets/pencil.svg` and `src/assets/logout.svg` were leftovers from before
// the redesign — Bootstrap and Streamline drawings at a different weight and
// corner style from the icon set `layout/Header.jsx` uses. Worse, an `<img>` is
// opaque to CSS: it cannot take a colour from the button it sits in, so the Edit
// button's yellow text never reached its icon and `ProfileCard` had to size them
// by hand.
//
// Drawn inline they are ordinary SVG in the page, so `stroke="currentColor"`
// makes them inherit the button's colour and follow its hover.
//
// One file with two components and one shared props object, which is exactly how
// `layout/Header.jsx` holds its four icons — and `ui/Message.jsx` already
// establishes that several small components can share a file.
//
// Both are decorative: the buttons say "Edit" and "Logout" in words, and the
// badge on the avatar carries `aria-label="Change profile picture"`. So they are
// `aria-hidden` and have no title of their own.
const iconProps = {
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.3,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
}

// A pencil lying at 45°: the wooden body, the rounded cap at the top, and the
// line across the sharpened tip.
export function PencilIcon({ className = "" }) {
	return (
		<svg {...iconProps} className={className}>
			<path d="M3.6 20.4l1-3.7L14.9 6.4l2.7 2.7L7.3 19.4l-3.7 1Z" />
			<path d="M14.9 6.4l1.9-1.9a2.7 2.7 0 0 1 2.7 2.7l-1.9 1.9" />
			<path d="M4.6 16.7l2.7 2.7" />
		</svg>
	)
}

// A door left open on the right, with an arrow walking out of it.
export function LogoutIcon({ className = "" }) {
	return (
		<svg {...iconProps} className={className}>
			<path d="M14.4 4.6H6.2a1.6 1.6 0 0 0-1.6 1.6v11.6a1.6 1.6 0 0 0 1.6 1.6h8.2" />
			<path d="M19 12H9.8" />
			<path d="M15.8 8.8L19 12l-3.2 3.2" />
		</svg>
	)
}
