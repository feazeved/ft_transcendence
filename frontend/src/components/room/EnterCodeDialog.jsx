import { useRef, useState } from "react"
import { useNavigate } from "react-router"
import Button from "@/components/ui/Button.jsx"
import Dialog from "@/components/ui/Dialog.jsx"
import { canSpectate, getRoom, isRoomFull, ROOM_CODE_LENGTH, sanitizeRoomCode, spectateRoom } from "@/lib/rooms.js"

const EMPTY = Array(ROOM_CODE_LENGTH).fill("")

const BOX =
	"h-[68px] w-[54px] rounded-md border-2 border-line-strong bg-page text-center font-mono text-[26px] font-bold uppercase text-white outline-none transition-colors focus:border-green"

// Four boxes instead of one field, because a room code is read out and typed in
// four characters at a time. All four live in one array of state; each box gets
// a ref so focus can walk between them.
function EnterCodeDialog({ open, onClose }) {
	const navigate = useNavigate()
	const boxes = useRef([])
	const [chars, setChars] = useState(EMPTY)
	const [message, setMessage] = useState(null) // { text, tone }
	const [spectatable, setSpectatable] = useState(false)
	const [busy, setBusy] = useState(false)

	const code = chars.join("")

	// Writes one character and moves on. Pasting is just this, run per character.
	const writeAt = (index, char) => {
		setChars((was) => was.map((old, i) => (i === index ? char : old)))
		if (char && index < ROOM_CODE_LENGTH - 1) boxes.current[index + 1]?.focus()
	}

	const onChange = (index) => (e) => {
		const clean = sanitizeRoomCode(e.target.value)
		setMessage(null)
		setSpectatable(false)
		// Typing over a filled box replaces it, so take the last character.
		writeAt(index, clean.slice(-1))
	}

	const onKeyDown = (index) => (e) => {
		if (e.key === "Enter") {
			e.preventDefault()
			void join()
		} else if (e.key === "Backspace" && !chars[index] && index > 0) {
			e.preventDefault()
			writeAt(index - 1, "")
			boxes.current[index - 1]?.focus()
		} else if (e.key === "ArrowLeft" && index > 0) {
			e.preventDefault()
			boxes.current[index - 1]?.focus()
		} else if (e.key === "ArrowRight" && index < ROOM_CODE_LENGTH - 1) {
			e.preventDefault()
			boxes.current[index + 1]?.focus()
		}
	}

	const onPaste = (index) => (e) => {
		e.preventDefault()
		const pasted = sanitizeRoomCode(e.clipboardData.getData("text"))
		if (!pasted) return
		setMessage(null)
		setSpectatable(false)
		setChars((was) =>
			was.map((old, i) => {
				const offset = i - index
				return offset >= 0 && offset < pasted.length ? pasted[offset] : old
			}),
		)
		const landed = Math.min(index + pasted.length, ROOM_CODE_LENGTH - 1)
		boxes.current[landed]?.focus()
	}

	const join = async () => {
		if (code.length < ROOM_CODE_LENGTH) return setMessage({ text: "Type all four characters.", tone: "error" })

		setBusy(true)
		setMessage(null)
		setSpectatable(false)
		try {
			const room = await getRoom(code)
			if (!isRoomFull(room)) {
				navigate(`/room/${code}`)
				return
			}
			if (canSpectate(room)) {
				setMessage({ text: "That room is full. You can still watch it.", tone: "notice" })
				setSpectatable(true)
			} else {
				setMessage({ text: "That room is full.", tone: "error" })
			}
		} catch (err) {
			// api.js puts the HTTP status on the error, which is what tells a
			// missing room apart from a server that fell over.
			setMessage({
				text: err.status === 404 ? "No room with that code." : err.message,
				tone: "error",
			})
		} finally {
			setBusy(false)
		}
	}

	const spectate = async () => {
		setBusy(true)
		try {
			await spectateRoom(code)
			navigate(`/room/${code}`)
		} catch (err) {
			setMessage({ text: err.message, tone: "error" })
		} finally {
			setBusy(false)
		}
	}

	return (
		<Dialog open={open} onClose={onClose} title="Enter code" accent="blue">
			<fieldset className="flex flex-col gap-3">
				<legend className="pb-2 font-mono text-[11px] tracking-[0.14em] text-muted">ROOM CODE</legend>
				<div className="flex justify-center gap-[clamp(8px,3vw,14px)]">
					{chars.map((char, index) => (
						<label key={index}>
							<span className="sr-only">{`Character ${index + 1} of ${ROOM_CODE_LENGTH}`}</span>
							<input
								ref={(el) => {
									boxes.current[index] = el
								}}
								type="text"
								inputMode="text"
								autoComplete="off"
								maxLength={1}
								value={char}
								onChange={onChange(index)}
								onKeyDown={onKeyDown(index)}
								onPaste={onPaste(index)}
								onFocus={(e) => e.target.select()}
								className={BOX}
							/>
						</label>
					))}
				</div>
				<p className="text-center font-mono text-[11px] leading-relaxed text-muted">
					4 CHARACTERS · A–Z AND 2–9 · NO I, O, 0 OR 1
				</p>
			</fieldset>

			{message && (
				<p
					role="alert"
					className={`rounded-md border px-4 py-3.5 font-mono text-[13px] ${
						message.tone === "notice" ? "border-blue bg-blue/10 text-blue-soft" : "border-red bg-red/10 text-red-soft"
					}`}
				>
					{message.text}
				</p>
			)}

			<div className="flex flex-wrap justify-end gap-2.5">
				<Button variant="small" onClick={onClose} disabled={busy} className="px-5 py-3.5 text-sm">
					Cancel
				</Button>
				{spectatable && (
					<Button color="blue" onClick={spectate} disabled={busy} className="px-6 py-3.5 font-mono text-sm">
						Spectate
					</Button>
				)}
				<Button color="green" onClick={join} disabled={busy} className="px-6 py-3.5 font-mono text-sm">
					{busy ? "Looking…" : "Join room"}
				</Button>
			</div>
		</Dialog>
	)
}

export default EnterCodeDialog
