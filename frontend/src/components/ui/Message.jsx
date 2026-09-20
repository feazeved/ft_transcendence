// The three small states every list and form needs. They announce themselves:
// there is no HTML tag for "this text just appeared", so the ARIA roles are the
// right tool here — polite for loading, assertive for an error.
export function Loading({ children = "Loading…", className = "" }) {
	return (
		<p role="status" className={`font-mono text-[13px] tracking-[0.06em] text-muted ${className}`}>
			{children}
		</p>
	)
}

// `boxed` is the design's louder error: the same red text inside a tinted,
// outlined box. Used where an error is the answer to something the person just
// did, like a failed sign-in or a rejected upload.
export function ErrorMessage({ children, boxed = false, className = "" }) {
	return (
		<p
			role="alert"
			className={`font-mono text-[13px] tracking-[0.06em] text-red-soft ${
				boxed ? "rounded-md border border-red bg-red/10 px-4 py-3.5" : ""
			} ${className}`}
		>
			{children}
		</p>
	)
}

export function EmptyMessage({ children, className = "" }) {
	return <p className={`font-mono text-[13px] tracking-[0.06em] text-muted ${className}`}>{children}</p>
}
