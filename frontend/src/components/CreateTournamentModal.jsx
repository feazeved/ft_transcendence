import { useState } from "react"
import Modal from "./Modal.jsx"
import TournamentStructurePreview from "./TournamentStructurePreview.jsx"
import { HOUSE_RULE_TOGGLES } from "@/lib/tournaments.js"
import { FORMATS, LIMITS, makeDefaultConfig, validateConfig } from "@/lib/tournamentStructure.js"

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
			<span className="block h-6 w-11 rounded-full bg-white/15 transition-colors peer-checked:bg-blue peer-focus-visible:ring-2 peer-focus-visible:ring-white/60" />
			<span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white transition-transform peer-checked:translate-x-5" />
		</span>
	</label>
)

const fieldClass =
	"w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none focus:border-white/40"

const FORMAT_LIST = Object.values(FORMATS)

const CreateTournamentModal = ({ open, onClose, onCreate }) => {
	const [step, setStep] = useState(1)
	const [name, setName] = useState("")
	const [config, setConfig] = useState(() => makeDefaultConfig("knockout"))
	const [errors, setErrors] = useState([])

	const pickFormat = (format) => setConfig(makeDefaultConfig(format))

	const setNumber = (key) => (e) => {
		const value = e.target.value === "" ? "" : Number(e.target.value)
		setConfig((c) => ({ ...c, [key]: value }))
	}

	const setValue = (key) => (e) => setConfig((c) => ({ ...c, [key]: Number(e.target.value) }))

	const setToggle = (key) => (checked) => setConfig((c) => ({ ...c, [key]: checked }))

	const setHouseRule = (key) => (checked) =>
		setConfig((c) => ({ ...c, houseRules: { ...c.houseRules, [key]: checked } }))

	const goToSettings = () => setStep(2)
	const goBack = () => setStep(1)

	const submit = (e) => {
		e.preventDefault()

		const trimmed = name.trim()
		const fullConfig = { ...config, name: trimmed }
		const { ok, errors: validationErrors } = validateConfig(fullConfig)
		if (!ok) return setErrors(validationErrors)

		onCreate({ name: trimmed, config })
	}

	return (
		<Modal open={open} onClose={onClose} title="Create tournament" className="w-[min(92vw,560px)]">
			{step === 1 ? (
				<div className="flex flex-col gap-4 text-white">
					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						{FORMAT_LIST.map((format) => {
							const isSelected = config.format === format.id
							return (
								<button
									key={format.id}
									type="button"
									onClick={() => pickFormat(format.id)}
									aria-pressed={isSelected}
									className={`flex flex-col gap-2 rounded-xl border bg-black p-4 text-left transition-transform hover:scale-105 cursor-pointer ${
										isSelected ? "border-yellow rainbow-shadow" : "border-white/20"
									}`}
								>
									<span className="font-bold">{format.label}</span>
									<span className="text-sm text-white/70">{format.description}</span>
								</button>
							)
						})}
					</div>

					<div className="mt-1 flex justify-end gap-3">
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg px-4 py-2 font-bold transition-transform hover:scale-105 cursor-pointer"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={goToSettings}
							className="rounded-lg bg-white px-5 py-2 font-bold text-black transition-transform hover:scale-105 cursor-pointer"
						>
							Next
						</button>
					</div>
				</div>
			) : (
				<form onSubmit={submit} className="flex flex-col gap-4 text-white">
					<div>
						<label htmlFor="tournament-name" className="mb-1 block text-sm text-white/60">
							Tournament name
						</label>
						<input
							id="tournament-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Friday tournament"
							maxLength={40}
							autoFocus
							className={fieldClass}
						/>
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						<div>
							<label htmlFor="t-players" className="mb-1 block text-sm text-white/60">
								Number of players
							</label>
							<input
								id="t-players"
								type="number"
								min={LIMITS.players.min}
								max={LIMITS.players.max}
								value={config.players}
								onChange={setNumber("players")}
								className={fieldClass}
							/>
						</div>
						<div>
							<label htmlFor="t-per-table" className="mb-1 block text-sm text-white/60">
								Players per table
							</label>
							<input
								id="t-per-table"
								type="number"
								min={LIMITS.playersPerTable.min}
								max={LIMITS.playersPerTable.max}
								value={config.playersPerTable}
								onChange={setNumber("playersPerTable")}
								className={fieldClass}
							/>
						</div>
						<div>
							<label htmlFor="t-advance" className="mb-1 block text-sm text-white/60">
								Advance per table
							</label>
							<select
								id="t-advance"
								value={config.advancePerTable}
								onChange={setValue("advancePerTable")}
								className={fieldClass}
							>
								<option value={1}>1</option>
								<option value={2}>2</option>
								<option value={3}>3</option>
							</select>
						</div>
					</div>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
						<div>
							<label htmlFor="t-cards" className="mb-1 block text-sm text-white/60">
								Starting cards
							</label>
							<input
								id="t-cards"
								type="number"
								min={LIMITS.startingCards.min}
								max={LIMITS.startingCards.max}
								value={config.startingCards}
								onChange={setNumber("startingCards")}
								className={fieldClass}
							/>
						</div>
						<div>
							<label htmlFor="t-timer" className="mb-1 block text-sm text-white/60">
								Turn timer (s)
							</label>
							<input
								id="t-timer"
								type="number"
								min={LIMITS.turnTimeSeconds.min}
								max={LIMITS.turnTimeSeconds.max}
								value={config.turnTimeSeconds}
								onChange={setNumber("turnTimeSeconds")}
								className={fieldClass}
							/>
						</div>
					</div>

					{config.format === "knockout" ? (
						<Toggle
							label="Final played best of 3"
							checked={config.finalBestOf3}
							onChange={setToggle("finalBestOf3")}
						/>
					) : (
						<div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
							<div>
								<label htmlFor="t-matches-round" className="mb-1 block text-sm text-white/60">
									Matches per round
								</label>
								<select
									id="t-matches-round"
									value={config.matchesPerRound}
									onChange={setValue("matchesPerRound")}
									className={fieldClass}
								>
									<option value={3}>3</option>
									<option value={5}>5</option>
									<option value={7}>7</option>
								</select>
							</div>
							<div>
								<label htmlFor="t-matches-final" className="mb-1 block text-sm text-white/60">
									Matches in the final
								</label>
								<input
									id="t-matches-final"
									type="number"
									min={1}
									step={2}
									value={config.matchesInFinal}
									onChange={setNumber("matchesInFinal")}
									className={fieldClass}
								/>
							</div>
						</div>
					)}

					<fieldset className="flex flex-col gap-2">
						<legend className="mb-1 text-sm text-white/60">House rules</legend>
						{HOUSE_RULE_TOGGLES.map((rule) => (
							<Toggle
								key={rule.key}
								label={rule.label}
								hint={rule.hint}
								checked={config.houseRules[rule.key]}
								onChange={setHouseRule(rule.key)}
							/>
						))}
					</fieldset>

					<TournamentStructurePreview config={config} />

					{errors.length > 0 && (
						<ul role="alert" className="list-disc space-y-1 pl-5 text-sm text-red-400">
							{errors.map((err) => (
								<li key={err}>{err}</li>
							))}
						</ul>
					)}

					<div className="mt-1 flex justify-end gap-3">
						<button
							type="button"
							onClick={goBack}
							className="mr-auto rounded-lg px-4 py-2 font-bold transition-transform hover:scale-105 cursor-pointer"
						>
							Back
						</button>
						<button
							type="button"
							onClick={onClose}
							className="rounded-lg px-4 py-2 font-bold transition-transform hover:scale-105 cursor-pointer"
						>
							Cancel
						</button>
						<button
							type="submit"
							className="rounded-lg bg-white px-5 py-2 font-bold text-black transition-transform hover:scale-105 cursor-pointer"
						>
							Create tournament
						</button>
					</div>
				</form>
			)}
		</Modal>
	)
}

export default CreateTournamentModal
