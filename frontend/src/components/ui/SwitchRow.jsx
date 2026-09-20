import { useId } from "react"

// One house rule: its name, a hint and an on/off switch.
//
// It holds no state of its own — the value comes in as `checked` and goes back
// out through `onChange(next)`. A real <input type="checkbox"> under the paint
// means Space and Tab work without any code, and role="switch" makes a screen
// reader say "on/off" instead of "checked".
function SwitchRow({ label, hint, checked = false, onChange, disabled = false, className = "" }) {
	const id = useId()
	const hintId = `${id}-hint`

	return (
		<div
			className={`flex items-start gap-3.5 rounded-md border border-white/10 bg-page p-4 transition-colors has-[:checked]:border-green/60 ${className}`}
		>
			<input
				id={id}
				type="checkbox"
				role="switch"
				checked={checked}
				disabled={disabled}
				onChange={(e) => onChange?.(e.target.checked)}
				aria-describedby={hint ? hintId : undefined}
				className="mt-0.5 h-6 w-11 flex-none cursor-pointer appearance-none rounded-full bg-line-strong transition-colors before:ml-[3px] before:block before:h-[18px] before:w-[18px] before:translate-y-[3px] before:rounded-full before:bg-muted before:transition-transform checked:bg-green checked:before:translate-x-5 checked:before:bg-on-green disabled:cursor-not-allowed disabled:opacity-50"
			/>
			<span className="flex flex-col gap-1">
				<label htmlFor={id} className="cursor-pointer text-[15px] font-semibold text-white">
					{label}
				</label>
				{hint && (
					<span id={hintId} className="text-[13px] text-white/70">
						{hint}
					</span>
				)}
			</span>
		</div>
	)
}

export default SwitchRow
