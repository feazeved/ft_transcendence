import { useEffect, useRef, useId } from "react"
import { createPortal } from "react-dom"

const FOCUSABLE =
	'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

const Modal = ({ open = true, onClose, title, children, className = "" }) => {
	const panelRef = useRef(null)
	const titleId = useId()

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

	useEffect(() => {
		if (!open) return
		const previous = document.body.style.overflow
		document.body.style.overflow = "hidden"
		return () => { document.body.style.overflow = previous }
	}, [open])

	useEffect(() => {
		if (!open) return
		const previouslyFocused = document.activeElement
		panelRef.current?.focus()
		return () => {
			if (previouslyFocused instanceof HTMLElement) previouslyFocused.focus()
		}
	}, [open])

	if (!open) return null

	return createPortal(
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
			onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}
		>
			<div
				ref={panelRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={title ? titleId : undefined}
				tabIndex={-1}
				className={`relative z-10 w-fit max-h-[calc(100vh-2rem)] overflow-y-auto rounded-2xl border border-white/10 bg-black text-white outline-none
					rainbow-shadow ${className}`}
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
