import { useState } from "react"
import { useNavigate } from "react-router"
import Button from "@/components/ui/Button.jsx"
import Dialog from "@/components/ui/Dialog.jsx"
import FormField from "@/components/ui/FormField.jsx"
import SwitchRow from "@/components/ui/SwitchRow.jsx"
import { ErrorMessage } from "@/components/ui/Message.jsx"
import {
	createRoom,
	defaultRoomSettings,
	MAX_PLAYERS,
	MAX_TURN_TIMER,
	MIN_HAND_SIZE,
	MIN_PLAYERS,
	MIN_TURN_TIMER,
	MODIFIER_TOGGLES,
} from "@/lib/rooms.js"

// Every setting lives in one object, because `lib/rooms.js` already keys it by
// the backend's own field names — so it goes to POST /games/ as it is.
function CreateRoomDialog({ open, onClose }) {
	const navigate = useNavigate()
	const [name, setName] = useState("")
	const [settings, setSettings] = useState(defaultRoomSettings)
	const [error, setError] = useState("")
	const [busy, setBusy] = useState(false)

	// One setter for every field: the [key] takes the variable's value as the
	// field name, so the five house rules share this.
	const setField = (key, value) => setSettings((s) => ({ ...s, [key]: value }))
	// <input type="number"> hands back a string.
	const setNumber = (key) => (e) => setField(key, e.target.value === "" ? "" : Number(e.target.value))

	const submit = async (e) => {
		e.preventDefault()

		const trimmed = name.trim()
		if (!trimmed) return setError("Give the room a name.")

		const { max_seats, starting_hand_size, turn_timer_seconds } = settings
		if (max_seats < MIN_PLAYERS || max_seats > MAX_PLAYERS)
			return setError(`Max players must be between ${MIN_PLAYERS} and ${MAX_PLAYERS}.`)
		if (starting_hand_size < MIN_HAND_SIZE)
			return setError(`Starting hand needs at least ${MIN_HAND_SIZE} cards.`)
		if (turn_timer_seconds < MIN_TURN_TIMER || turn_timer_seconds > MAX_TURN_TIMER)
			return setError(`Turn timer must be between ${MIN_TURN_TIMER} and ${MAX_TURN_TIMER} seconds.`)

		setBusy(true)
		setError("")
		try {
			const room = await createRoom({ name: trimmed, settings })
			navigate(`/room/${room.join_code}`)
		} catch (err) {
			setError(err.message)
		} finally {
			setBusy(false)
		}
	}

	return (
		<Dialog open={open} onClose={onClose} title="Create a room" accent="green">
			<form onSubmit={submit} className="flex flex-col gap-5">
				<FormField
					label="ROOM NAME"
					type="text"
					value={name}
					onChange={(e) => setName(e.target.value)}
					placeholder="Simba's table"
					maxLength={30}
					hint={`${name.length}/30`}
				/>

				<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,160px),1fr))] gap-3.5">
					<FormField
						label="MAX PLAYERS"
						type="number"
						min={MIN_PLAYERS}
						max={MAX_PLAYERS}
						value={settings.max_seats}
						onChange={setNumber("max_seats")}
						hint={`${MIN_PLAYERS}–${MAX_PLAYERS}`}
					/>
					<FormField
						label="STARTING HAND"
						type="number"
						min={MIN_HAND_SIZE}
						value={settings.starting_hand_size}
						onChange={setNumber("starting_hand_size")}
						hint={`${MIN_HAND_SIZE} or more`}
					/>
					<FormField
						label="TURN TIMER (S)"
						type="number"
						min={MIN_TURN_TIMER}
						max={MAX_TURN_TIMER}
						value={settings.turn_timer_seconds}
						onChange={setNumber("turn_timer_seconds")}
						hint={`${MIN_TURN_TIMER}–${MAX_TURN_TIMER}`}
					/>
				</div>

				<fieldset className="flex flex-col gap-3 border-t border-white/10 pt-4.5">
					<legend className="font-mono text-[11px] tracking-[0.14em] text-muted">HOUSE RULES</legend>
					{MODIFIER_TOGGLES.map((rule) => (
						<SwitchRow
							key={rule.key}
							label={rule.label}
							hint={rule.hint}
							checked={settings[rule.key]}
							onChange={(on) => setField(rule.key, on)}
						/>
					))}
					<SwitchRow
						label="Allow spectators"
						hint="Let people watch your game without holding a seat."
						checked={settings.allow_spectators}
						onChange={(on) => setField("allow_spectators", on)}
					/>
				</fieldset>

				{error && <ErrorMessage>{error}</ErrorMessage>}

				<div className="flex flex-wrap justify-end gap-2.5">
					<Button variant="small" onClick={onClose} disabled={busy} className="px-5 py-3.5 text-sm">
						Cancel
					</Button>
					<Button type="submit" color="green" disabled={busy} className="px-6 py-3.5 font-mono text-sm">
						{busy ? "Creating…" : "Create room"}
					</Button>
				</div>
			</form>
		</Dialog>
	)
}

export default CreateRoomDialog
