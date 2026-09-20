import { useState } from "react"
import { useNavigate } from "react-router"
import Button from "@/components/ui/Button.jsx"
import Panel from "@/components/ui/Panel.jsx"
import PasswordInput from "@/components/ui/PasswordInput.jsx"
import { ErrorMessage } from "@/components/ui/Message.jsx"
import api from "@/lib/api.js"
import { useAuth } from "@/lib/auth.jsx"

// Changing a password is its own endpoint with its own validation, so it gets
// its own form. Folding it into the profile save is what made the old field a
// no-op: it looked editable, went nowhere, and reported nothing.
function PasswordPanel() {
	const { logout } = useAuth()
	const navigate = useNavigate()
	const [open, setOpen] = useState(false)
	const [next, setNext] = useState("")
	const [confirm, setConfirm] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState("")
	const [done, setDone] = useState(false)

	const close = () => {
		setOpen(false)
		setNext("")
		setConfirm("")
		setError("")
	}

	const submit = async (e) => {
		e.preventDefault()
		setError("")
		if (next !== confirm) return setError("The two passwords don't match.")

		setBusy(true)
		try {
			await api.post("/auth/password/change/", { new_password1: next, new_password2: confirm })
			// Changing the password rotates Django's session auth hash, so the
			// cookie we are holding is already dead — every later call would 403.
			// Say so plainly instead of leaving a page that silently stops working.
			close()
			setDone(true)
		} catch (err) {
			// The server rejects weak or too-common passwords — show what it said.
			setError(err.message || "Could not change your password.")
		} finally {
			setBusy(false)
		}
	}

	return (
		<Panel title="PASSWORD" accent="blue">
			{open ? (
				<form onSubmit={submit} className="flex flex-col gap-3.5">
					<PasswordInput
						label="NEW PASSWORD"
						name="new-password"
						value={next}
						onChange={(e) => setNext(e.target.value)}
					/>
					<PasswordInput
						label="CONFIRM NEW PASSWORD"
						name="confirm-password"
						value={confirm}
						onChange={(e) => setConfirm(e.target.value)}
					/>
					{error && <ErrorMessage>{error}</ErrorMessage>}
					<div className="flex flex-wrap gap-3">
						<Button type="submit" color="blue" disabled={busy || !next} className="px-5 py-3.5 font-mono text-[13px]">
							{busy ? "Updating…" : "Update password"}
						</Button>
						<Button variant="small" onClick={close} disabled={busy} className="px-5 py-3.5 text-[13px]">
							Cancel
						</Button>
					</div>
				</form>
			) : done ? (
				<div className="flex flex-col gap-3.5 rounded-md border border-white/10 bg-white/5 p-[18px]">
					<p className="text-[15px] leading-relaxed text-white/70">
						Password updated. Changing it signs you out everywhere, so you need to log in again with the new one.
					</p>
					<Button
						variant="small"
						onClick={() => {
							logout()
							navigate("/login", { state: { from: "/profile" } })
						}}
						className="self-start border-white px-5 py-3 text-[13px] text-white"
					>
						Log in again
					</Button>
				</div>
			) : (
				<div className="flex items-center justify-between gap-4">
					<p className="font-mono text-[22px] tracking-[0.2em] text-white">{"•".repeat(8)}</p>
					<Button
						variant="outline"
						color="blue"
						onClick={() => setOpen(true)}
						className="px-5 py-3 font-mono text-[13px] tracking-[0.08em]"
					>
						Change
					</Button>
				</div>
			)}
		</Panel>
	)
}

export default PasswordPanel
