import { useEffect, useId, useRef } from "react"

// The design's dialog, built on the native <dialog>.
//
// Why showModal() and not just <dialog open>: the `open` attribute shows the
// box with no backdrop, no focus trap and no Escape. Only the method gives the
// modal behaviour, so a ref reaches the real element and an effect keeps it in
// step with the `open` prop.
//
// The parent owns `open`. Escape fires the dialog's `cancel` event, which we
// stop so the browser doesn't close behind the parent's back — onClose() sets
// `open` to false and the effect does the closing. The page behind is kept from
// scrolling by `body:has(dialog[open])` in index.css.
// `width` was added in area 06: the create-tournament dialog puts the form and a
// live structure preview side by side, which needs more than the 600px every
// other dialog wants. It is a class on the <dialog> itself, because that is the
// element the browser sizes.
function Dialog({ open, onClose, title, accent = "green", width = "w-[min(100%-2rem,600px)]", className = "", children }) {
	const ref = useRef(null)
	const titleId = useId()

	useEffect(() => {
		const dialog = ref.current
		if (!dialog) return
		if (open && !dialog.open) dialog.showModal()
		if (!open && dialog.open) dialog.close()
	}, [open])

	const ACCENTS = {
		red: "border-t-red",
		blue: "border-t-blue",
		green: "border-t-green",
		yellow: "border-t-yellow",
	}

	return (
		<dialog
			ref={ref}
			aria-labelledby={title ? titleId : undefined}
			onCancel={(e) => {
				e.preventDefault()
				onClose?.()
			}}
			// The backdrop belongs to the <dialog> itself, so a click whose target
			// is the dialog landed outside the content below.
			onClick={(e) => {
				if (e.target === ref.current) onClose?.()
			}}
			className={`m-auto bg-transparent p-0 text-white backdrop:bg-black/80 ${width}`}
		>
			<div
				className={`flex max-h-[calc(100vh-3rem)] flex-col gap-5 overflow-y-auto rounded-lg border border-white/10 border-t-4 bg-panel p-[clamp(20px,4vw,28px)] ${
					ACCENTS[accent] ?? ACCENTS.green
				} ${className}`}
			>
				<div className="flex items-center justify-between gap-4">
					{title && (
						<h2 id={titleId} className="font-title text-2xl font-bold text-white">
							{title}
						</h2>
					)}
					<button
						type="button"
						onClick={() => onClose?.()}
						aria-label="Close"
						className="ml-auto h-9 w-9 flex-none cursor-pointer rounded-md border-2 border-line-strong font-mono text-base text-soft transition-colors hover:border-white hover:text-white"
					>
						&times;
					</button>
				</div>
				{children}
			</div>
		</dialog>
	)
}

export default Dialog
