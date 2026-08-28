import { useEffect, useRef, useId } from "react"
import { createPortal } from "react-dom"

// Everything inside the panel that a keyboard user can land on.
// Used to keep Tab focus from escaping the modal while it's open.
const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// Generic, reusable popup. It doesn't know about routing or what it shows —
// give it `children` and an `onClose` and it handles the dialog behaviour:
// backdrop, Escape / click-outside to close, body scroll lock and focus.
const Modal = ({ open = true, onClose, title, children, className = "" }) => {
	const panelRef = useRef(null)
	const titleId = useId()

	// Escape closes; Tab cycles focus inside the panel instead of leaving it.
	useEffect(() => {
		if (!open) return

		const onKeyDown = (e) => {
			if (e.key === "Escape") {
				onClose?.()
				return
			}
			if (e.key !== "Tab") return

			const items = panelRef.current?.querySelectorAll(FOCUSABLE)
			if (!items || items.length === 0) return
			const first = items[0]
			const last = items[items.length - 1]

			if (e.shiftKey && document.activeElement === first) {
				e.preventDefault()
				last.focus()
			} else if (!e.shiftKey && document.activeElement === last) {
				e.preventDefault()
				first.focus()
			}
		}

		document.addEventListener("keydown", onKeyDown)
		return () => document.removeEventListener("keydown", onKeyDown)
	}, [open, onClose])

	// Stop the page behind the modal from scrolling while it's open.
	useEffect(() => {
		if (!open) return
		const previous = document.body.style.overflow
		document.body.style.overflow = "hidden"
		return () => { document.body.style.overflow = previous }
	}, [open])

	// Move focus into the modal when it opens, put it back where it was on close.
	useEffect(() => {
		if (!open) return
		const previouslyFocused = document.activeElement
		panelRef.current?.focus()
		return () => {
			if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
		}
	}, [open])

	if (!open) return null

	// createPortal renders this markup at the end of <body>, so the modal isn't
	// clipped or stacked under whatever container it was written inside.
	return createPortal(
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
			// The panel is this element's only child, so a mousedown whose target
			// IS this element happened on the dimmed area outside the panel → close.
			// Using mousedown (not click) means selecting text inside the panel and
			// releasing outside it doesn't count as a click-away.
			onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={title ? titleId : undefined}
				tabIndex={-1}
				className={`relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl border border-white/10 bg-black text-white outline-none
					shadow-[-4px_-4px_20px_0_#E02130,4px_-4px_20px_0_#FAB243,4px_4px_20px_0_#169A4F,-4px_4px_20px_0_#0077B9] ${className}`}
			>
				<div className="sticky top-0 flex items-center justify-between gap-4 border-b border-white/10 bg-black px-6 py-4">
					<h2 id={titleId} className="text-xl font-bold">{title}</h2>
					<button
						type="button"
						onClick={() => onClose?.()}
						aria-label="Close"
						className="rounded-lg px-2 text-2xl leading-none transition-transform hover:scale-110 hover:text-red cursor-pointer"
					>
						&times;
					</button>
				</div>
				<div className="px-6 py-5">
					{children}
				</div>
			</div>
		</div>,
		document.body,
	)
}

export default Modal
