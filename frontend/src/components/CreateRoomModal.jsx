import { useState } from "react"
import Modal from "./Modal.jsx"
import {
	MIN_PLAYERS,
	MAX_PLAYERS,
	MIN_HAND_SIZE,
	MIN_TURN_TIMER,
	MAX_TURN_TIMER,
	RULE_TOGGLES,
	defaultRoomSettings,
} from "@/lib/rooms.js"

// Small brand-styled on/off switch. Reused for every optional rule.
const Toggle = ({ checked, onChange, label, hint }) => (
	<label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
		<span className="min-w-0">
			<span className="block font-medium">{label}</span>
			{hint && <span className="block text-xs text-white/50">{hint}</span>}
		</span>
		<span className="relative mt-1 shrink-0">
			<input
				type="checkbox"
				checked={checked}
				onChange={(e) => onChange(e.target.checked)}
				className="peer sr-only"
			/>
			<span className="block h-6 w-11 rounded-full bg-white/15 transition-colors peer-checked:bg-green peer-focus-visible:ring-2 peer-focus-visible:ring-white/60" />
			<span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
		</span>
	</label>
)

const fieldClass =
	"w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/40"

// Popup for creating a room: a display name plus every game setting. It doesn't
// talk to the backend itself — on submit it hands the validated settings object
// back through `onCreate`, and the caller (Play) decides what to do with it.
//
// The caller remounts this via a `key` tied to `open`, so state starts fresh
// on every open and there's no reset-on-open effect to write.
const CreateRoomModal = ({ open, onClose, onCreate }) => {
	const [name, setName] = useState("")
	const [settings, setSettings] = useState(defaultRoomSettings)
	const [error, setError] = useState("")

	const setNumber = (key) => (e) => {
		const value = e.target.value === "" ? "" : Number(e.target.value)
		setSettings((s) => ({ ...s, [key]: value }))
	}

	const setToggle = (key) => (checked) =>
		setSettings((s) => ({ ...s, [key]: checked }))

	const submit = (e) => {
		e.preventDefault()

		const trimmed = name.trim()
		if (!trimmed) return setError("Give the room a name.")

		const { max_players, starting_hand_size, turn_timer_seconds } = settings
		if (max_players < MIN_PLAYERS || max_players > MAX_PLAYERS)
			return setError(`Max players must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}.`)
		if (starting_hand_size < MIN_HAND_SIZE)
			return setError(`Starting hand needs at least ${MIN_HAND_SIZE} cards.`)
		if (turn_timer_seconds < MIN_TURN_TIMER || turn_timer_seconds > MAX_TURN_TIMER)
			return setError(`Turn timer must be between ${MIN_TURN_TIMER} and ${MAX_TURN_TIMER} seconds.`)

		onCreate({ name: trimmed, settings })
	}

	return (
		<Modal open={open} onClose={onClose} title="Create a room" className="w-[min(92vw,520px)]">
			<form onSubmit={submit} className="flex flex-col gap-4 text-white">
				<div>
					<label htmlFor="room-name" className="mb-1 block text-sm text-white/60">
						Room name
					</label>
					<input
						id="room-name"
						type="text"
						value={name}
						onChange={(e) => setName(e.target.value)}
						placeholder="Simba's table"
						maxLength={30}
						autoFocus
						className={fieldClass}
					/>
				</div>

				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<div>
						<label htmlFor="room-max" className="mb-1 block text-sm text-white/60">
							Max players
						</label>
						<input
							id="room-max"
							type="number"
							min={MIN_PLAYERS}
							max={MAX_PLAYERS}
							value={settings.max_players}
							onChange={setNumber("max_players")}
							className={fieldClass}
						/>
					</div>
					<div>
						<label htmlFor="room-hand" className="mb-1 block text-sm text-white/60">
							Starting hand
						</label>
						<input
							id="room-hand"
							type="number"
							min={MIN_HAND_SIZE}
							value={settings.starting_hand_size}
							onChange={setNumber("starting_hand_size")}
							className={fieldClass}
						/>
					</div>
					<div>
						<label htmlFor="room-timer" className="mb-1 block text-sm text-white/60">
							Turn timer (s)
						</label>
						<input
							id="room-timer"
							type="number"
							min={MIN_TURN_TIMER}
							max={MAX_TURN_TIMER}
							step={5}
							value={settings.turn_timer_seconds}
							onChange={setNumber("turn_timer_seconds")}
							className={fieldClass}
						/>
					</div>
				</div>

				<fieldset className="flex flex-col gap-2">
					<legend className="mb-1 text-sm text-white/60">Optional rules</legend>
					{RULE_TOGGLES.map((rule) => (
						<Toggle
							key={rule.key}
							label={rule.label}
							hint={rule.hint}
							checked={settings[rule.key]}
							onChange={setToggle(rule.key)}
						/>
					))}
				</fieldset>

				{error && (
					<p role="alert" className="text-sm text-red-400">
						{error}
					</p>
				)}

				<div className="mt-1 flex justify-end gap-3">
					<button
						type="button"
						onClick={onClose}
						className="rounded-lg px-4 py-2 font-bold transition-transform hover:scale-105 cursor-pointer"
					>
						Cancel
					</button>
					<button
						type="submit"
						className="rounded-lg bg-yellow px-5 py-2 font-bold text-black transition-transform hover:scale-105 cursor-pointer"
					>
						Create room
					</button>
				</div>
			</form>
		</Modal>
	)
}

export default CreateRoomModal
