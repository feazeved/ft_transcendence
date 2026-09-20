import { useEffect, useRef, useState } from "react"

const TRIGGER =
	"h-10 w-10 flex-none cursor-pointer rounded-md border-2 border-line-strong bg-transparent font-logo text-base font-bold leading-none text-dim transition-colors hover:border-white hover:text-white"

const ITEM =
	"w-full cursor-pointer rounded-md border-none bg-transparent px-3.5 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"

const COLORS = { dim: "text-dim", red: "text-red-soft" }

// The ⋮ of a friend row.
//
// Once a row has live actions — Chat today, Watch match and Join lobby when
// presence grows a place — Remove and Block would make four buttons in a row on
// a phone. The design moves the two destructive ones in here, where they are one
// step further from a stray tap.
//
// It is a real menu: a `<button aria-expanded>` that owns a `role="menu"`, closed
// by Escape and by a click anywhere else. Escape puts focus back on the button
// that opened it, because the thing that had focus has just disappeared.
function FriendMenu({ label, items }) {
	const [open, setOpen] = useState(false)
	const boxRef = useRef(null)
	const triggerRef = useRef(null)

	useEffect(() => {
		if (!open) return undefined

		const onKey = (event) => {
			if (event.key !== "Escape") return
			setOpen(false)
			triggerRef.current?.focus()
		}
		// pointerdown, not click: the menu has to be gone before whatever was
		// clicked underneath it reacts.
		const onDown = (event) => {
			if (!boxRef.current?.contains(event.target)) setOpen(false)
		}

		document.addEventListener("keydown", onKey)
		document.addEventListener("pointerdown", onDown)
		return () => {
			document.removeEventListener("keydown", onKey)
			document.removeEventListener("pointerdown", onDown)
		}
	}, [open])

	return (
		<span ref={boxRef} className="relative flex">
			<button
				ref={triggerRef}
				type="button"
				onClick={() => setOpen(!open)}
				aria-expanded={open}
				aria-haspopup="menu"
				aria-label={label}
				className={TRIGGER}
			>
				&#8942;
			</button>

			{open && (
				<span
					role="menu"
					aria-label={label}
					className="absolute right-0 top-[46px] z-10 flex min-w-[190px] flex-col rounded-lg border border-white/15 bg-bar p-1.5 shadow-[0_18px_40px_rgba(0,0,0,.6)]"
				>
					{items.map((item) => (
						<button
							key={item.label}
							type="button"
							role="menuitem"
							disabled={item.disabled}
							onClick={() => {
								setOpen(false)
								item.onClick()
							}}
							className={`${ITEM} ${COLORS[item.color] ?? COLORS.dim}`}
						>
							{item.label}
						</button>
					))}
				</span>
			)}
		</span>
	)
}

export default FriendMenu
