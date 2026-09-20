import { useState } from "react"
import { useNavigate } from "react-router"
import Button from "@/components/ui/Button.jsx"
import Dialog from "@/components/ui/Dialog.jsx"
import FormField from "@/components/ui/FormField.jsx"
import StructurePanel from "@/components/tournament/StructurePanel.jsx"
import SwitchRow from "@/components/ui/SwitchRow.jsx"
import { MODIFIER_TOGGLES } from "@/lib/rooms.js"
import { createTournament } from "@/lib/tournaments.js"
import { computeStructure, FORMATS, LIMITS, makeDefaultConfig, validateConfig } from "@/lib/tournamentStructure.js"

// Creating a tournament, in two steps: pick a format, then set it up.
//
// **All of it is one `config` object**, because `lib/tournamentStructure.js`
// already keys that object by the exact field names the backend wants — so it
// goes to `createTournament()` as it is, with no mapping step. That is the same
// rule `room/CreateRoomDialog.jsx` follows for a game room.
//
// Two things that read like shortcuts and are not:
//
//  - **Picking a format only sets `format`.** Every format's fields live in the
//    one config with a default already in them, and `validateConfig` only checks
//    the ones the chosen format uses — so there is nothing to reset, and going
//    back to step 1 cannot throw away what you typed on step 2.
//  - **The preview is not a second implementation.** `computeStructure()` runs on
//    the half-typed config on every keystroke and `StructurePanel` draws the
//    answer. The detail page hands the same panel a stored tournament. One pure
//    function, one panel, two callers.
//
// The format cards are **real radio buttons** under the paint, not two buttons
// with `aria-pressed`: picking one of two exclusive options is what a radio group
// is, and it comes with arrow-key navigation that we would otherwise have to
// write. `ui/SwitchRow` uses the same trick for its checkbox.
const FORMAT_LIST = Object.values(FORMATS)

const MAX_NAME = 40

function CreateTournamentDialog({ open, onClose }) {
	const navigate = useNavigate()
	const [step, setStep] = useState(1)
	const [config, setConfig] = useState(() => makeDefaultConfig("knockout"))
	const [errors, setErrors] = useState([])
	const [busy, setBusy] = useState(false)

	// One setter for every field: [key] takes the variable's value as the field
	// name, so the five house rules and the two format toggles all share it.
	const setField = (key, value) => {
		setConfig((current) => ({ ...current, [key]: value }))
		// Errors belong to the config that was submitted, so any edit clears them.
		setErrors([])
	}
	// <input type="number"> hands back a string, and an emptied field hands back
	// "". Number("") is 0, which would silently pass a validity check, so the
	// empty string is kept as it is and `validateConfig` refuses it.
	const setNumber = (key) => (event) =>
		setField(key, event.target.value === "" ? "" : Number(event.target.value))
	const setChoice = (key) => (event) => setField(key, Number(event.target.value))

	const close = () => {
		if (!busy) onClose()
	}

	const submit = async (event) => {
		event.preventDefault()

		const trimmed = { ...config, name: config.name.trim() }
		const { ok, errors: found } = validateConfig(trimmed)
		if (!ok) return setErrors(found)

		setBusy(true)
		setErrors([])
		try {
			const created = await createTournament(trimmed)
			navigate(`/tournament/${created.id}`)
		} catch (error) {
			setErrors([error.message])
		} finally {
			setBusy(false)
		}
	}

	return (
		<Dialog
			open={open}
			onClose={close}
			title="Create tournament"
			accent="red"
			width="w-[min(100%-2rem,880px)]"
		>
			<p className="font-mono text-[11px] tracking-[0.14em] text-muted">
				{step === 1 ? "STEP 1 OF 2 · FORMAT" : "STEP 2 OF 2 · SETTINGS"}
			</p>

			{step === 1 ? (
				<>
					<fieldset className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-3.5">
						<legend className="sr-only">Format</legend>
						{FORMAT_LIST.map((format) => (
							<label
								key={format.id}
								className="flex cursor-pointer flex-col items-start gap-3 rounded-lg border-2 border-white/10 bg-page p-[22px] transition-colors has-[:checked]:border-red hover:border-white/40"
							>
								<span className="flex items-center gap-3">
									<input
										type="radio"
										name="format"
										value={format.id}
										checked={config.format === format.id}
										onChange={() => setField("format", format.id)}
										className="h-3.5 w-3.5 flex-none cursor-pointer appearance-none rounded-full border-2 border-white/30 checked:border-red checked:bg-red"
									/>
									<span className="font-title text-[22px] font-bold text-white">{format.label}</span>
								</span>
								<span className="text-sm leading-relaxed text-white/70">{format.description}</span>
							</label>
						))}
					</fieldset>

					<div className="flex flex-wrap items-center justify-end gap-2.5">
						<Button variant="small" onClick={close} className="px-[22px] py-3.5 text-sm">
							Cancel
						</Button>
						<Button color="white" onClick={() => setStep(2)} className="px-[30px] py-3.5 text-sm">
							Next
						</Button>
					</div>
				</>
			) : (
				<form onSubmit={submit} className="flex flex-col gap-5">
					<div className="flex flex-wrap items-start gap-5">
						<div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
							<FormField
								label="TOURNAMENT NAME"
								type="text"
								value={config.name}
								onChange={(event) => setField("name", event.target.value)}
								placeholder="Friday tournament"
								maxLength={MAX_NAME}
								hint={`${config.name.length}/${MAX_NAME}`}
								disabled={busy}
								// Step 2 mounts when Next is pressed, and the button that was
								// focused disappears with step 1 — so focus has to be put
								// somewhere, and the first field is where the work starts.
								autoFocus
							/>

							<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,150px),1fr))] gap-3.5">
								{/* The fix: this field writes `max_participants`, the key the
								    rest of the form and the backend both read. It used to
								    write `players`, so typing in it did nothing at all. */}
								<FormField
									label="NUMBER OF PLAYERS"
									type="number"
									min={LIMITS.max_participants.min}
									max={LIMITS.max_participants.max}
									value={config.max_participants}
									onChange={setNumber("max_participants")}
									hint={`${LIMITS.max_participants.min}–${LIMITS.max_participants.max}`}
									disabled={busy}
								/>
								<FormField
									label="PLAYERS PER TABLE"
									type="number"
									min={LIMITS.players_per_table.min}
									max={LIMITS.players_per_table.max}
									value={config.players_per_table}
									onChange={setNumber("players_per_table")}
									hint={`${LIMITS.players_per_table.min}–${LIMITS.players_per_table.max}`}
									disabled={busy}
								/>
								<FormField
									label="ADVANCE PER TABLE"
									as="select"
									value={config.advance_per_table}
									onChange={setChoice("advance_per_table")}
									hint="1, 2 OR 3"
									disabled={busy}
								>
									{[1, 2, 3].map((count) => (
										<option key={count} value={count}>
											{count}
										</option>
									))}
								</FormField>
								<FormField
									label="STARTING CARDS"
									type="number"
									min={LIMITS.starting_hand_size.min}
									max={LIMITS.starting_hand_size.max}
									value={config.starting_hand_size}
									onChange={setNumber("starting_hand_size")}
									hint={`${LIMITS.starting_hand_size.min}–${LIMITS.starting_hand_size.max}`}
									disabled={busy}
								/>
								<FormField
									label="TURN TIMER (S)"
									type="number"
									min={LIMITS.turn_timer_seconds.min}
									max={LIMITS.turn_timer_seconds.max}
									value={config.turn_timer_seconds}
									onChange={setNumber("turn_timer_seconds")}
									hint={`${LIMITS.turn_timer_seconds.min}–${LIMITS.turn_timer_seconds.max}`}
									disabled={busy}
								/>

								{/* Only a best-of has several matches in a round to set up. */}
								{config.format === "bestof" && (
									<>
										<FormField
											label="MATCHES PER ROUND"
											as="select"
											value={config.matches_per_round}
											onChange={setChoice("matches_per_round")}
											hint="3, 5 OR 7"
											disabled={busy}
										>
											{[3, 5, 7].map((count) => (
												<option key={count} value={count}>
													{count}
												</option>
											))}
										</FormField>
										<FormField
											label="MATCHES IN THE FINAL"
											type="number"
											min={1}
											step={2}
											value={config.matches_in_final}
											onChange={setNumber("matches_in_final")}
											hint="ODD, MIN 1"
											disabled={busy}
										/>
									</>
								)}
							</div>

							{/* A knockout's final can be played best of 3. It is a setting of
							    the format, not a house rule, so it sits outside the group. */}
							{config.format === "knockout" && (
								<SwitchRow
									label="Final played best of 3"
									checked={config.final_best_of_3}
									onChange={(on) => setField("final_best_of_3", on)}
									disabled={busy}
								/>
							)}

							<fieldset className="flex flex-col gap-3 border-t border-white/10 pt-4">
								<legend className="font-mono text-[11px] tracking-[0.14em] text-muted">HOUSE RULES</legend>
								{MODIFIER_TOGGLES.map((rule) => (
									<SwitchRow
										key={rule.key}
										label={rule.label}
										hint={rule.hint}
										checked={config[rule.key]}
										onChange={(on) => setField(rule.key, on)}
										disabled={busy}
									/>
								))}
							</fieldset>
						</div>

						<div className="flex min-w-0 flex-[1_1_300px] flex-col">
							<StructurePanel structure={computeStructure(config)} label="STRUCTURE" compact />
						</div>
					</div>

					{errors.length > 0 && (
						<ul
							role="alert"
							className="flex list-disc flex-col gap-1.5 rounded-md border border-red bg-red/10 py-4 pl-9 pr-[18px] font-mono text-[13px] text-red-soft"
						>
							{errors.map((message) => (
								<li key={message}>{message}</li>
							))}
						</ul>
					)}

					<div className="flex flex-wrap items-center justify-between gap-2.5">
						<Button variant="small" onClick={() => setStep(1)} disabled={busy} className="px-[22px] py-3.5 text-sm">
							Back
						</Button>
						<div className="ml-auto flex flex-wrap gap-2.5">
							<Button variant="small" onClick={close} disabled={busy} className="px-[22px] py-3.5 text-sm">
								Cancel
							</Button>
							<Button type="submit" color="red" disabled={busy} className="px-[26px] py-3.5 text-sm">
								{busy ? "Creating…" : "Create tournament"}
							</Button>
						</div>
					</div>
				</form>
			)}
		</Dialog>
	)
}

export default CreateTournamentDialog
