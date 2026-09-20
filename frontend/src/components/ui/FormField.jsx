import { useId } from "react"

// A labelled input or select, with an optional hint and error under it.
// Everything else (value, onChange, type, min, required…) is forwarded to the
// field itself, so this behaves like the element it wraps.
//
// useId() gives ids that are unique on the page, which is what ties the label,
// the hint and the error to the field.
//
// `tone` picks between the design's two field looks: "panel" for a field on the
// page background (dialogs, Create room) and "soft" for one inside a panel
// (Login, Register, Profile). `trailing` puts a control inside the field, like
// PasswordInput's eye toggle.
const TONES = {
	panel: "border-2 border-line-strong bg-page px-4 py-3 text-[15px] focus:border-green",
	soft: "border border-white/10 bg-white/5 px-4 py-3.5 text-[17px] focus:border-green",
}

function FormField({
	label,
	labelClassName = "",
	hint,
	error,
	as = "input",
	tone = "panel",
	trailing,
	className = "",
	children,
	...rest
}) {
	const id = useId()
	const hintId = `${id}-hint`
	const errorId = `${id}-error`
	const describedBy = [hint && hintId, error && errorId].filter(Boolean).join(" ") || undefined

	const fieldClasses = `w-full rounded-md text-white outline-none transition-colors disabled:text-white/50 read-only:text-white/50 ${
		TONES[tone] ?? TONES.panel
	} ${error ? "border-red focus:border-red" : ""} ${trailing ? "pr-14" : ""}`

	const field =
		as === "select" ? (
			<select id={id} aria-describedby={describedBy} aria-invalid={Boolean(error)} className={fieldClasses} {...rest}>
				{children}
			</select>
		) : (
			<input id={id} aria-describedby={describedBy} aria-invalid={Boolean(error)} className={fieldClasses} {...rest} />
		)

	return (
		<div className={`flex flex-col gap-2 ${className}`}>
			{/* labelClassName is how a caller hides the label with sr-only: the label
			    still exists for a screen reader, it just isn't drawn. */}
			<label htmlFor={id} className={`font-mono text-[11px] tracking-[0.16em] text-muted ${labelClassName}`}>
				{label}
			</label>
			{trailing ? (
				<span className="relative flex items-center">
					{field}
					<span className="absolute right-2 flex items-center">{trailing}</span>
				</span>
			) : (
				field
			)}
			{hint && (
				<p id={hintId} className="font-mono text-[11px] text-muted">
					{hint}
				</p>
			)}
			{error && (
				<p id={errorId} role="alert" className="font-mono text-[11px] text-red-soft">
					{error}
				</p>
			)}
		</div>
	)
}

export default FormField
