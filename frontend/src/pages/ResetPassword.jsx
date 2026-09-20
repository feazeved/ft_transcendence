import { useState } from "react"
import { Link, useParams } from "react-router"
import AuthCard from "@/components/auth/AuthCard.jsx"
import PasswordChecklist from "@/components/auth/PasswordChecklist.jsx"
import Button from "@/components/ui/Button.jsx"
import ButtonLink from "@/components/ui/ButtonLink.jsx"
import PasswordInput from "@/components/ui/PasswordInput.jsx"
import { ErrorMessage } from "@/components/ui/Message.jsx"
import { api } from "@/lib/api.js"
import { resetCredentials } from "@/lib/passwordReset.js"

// Where the link in the password-reset e-mail lands. Two routes point here
// because the backend writes the link in two shapes — see lib/passwordReset.js.
function ResetPassword() {
	const { uid, token } = resetCredentials(useParams())

	const [password, setPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [error, setError] = useState("")
	const [loading, setLoading] = useState(false)
	const [done, setDone] = useState(false)

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError("")

		if (password !== confirmPassword) {
			setError("Passwords do not match.")
			return
		}

		setLoading(true)
		try {
			await api.post("/auth/password/reset/confirm/", {
				uid,
				token,
				new_password1: password,
				new_password2: confirmPassword,
			})
			setDone(true)
		} catch (err) {
			// The server refuses a spent or expired link here, and that is worth
			// saying plainly: the form is fine, the link is not.
			setError(err.message || "This link is no longer valid. Ask for a new one.")
		} finally {
			setLoading(false)
		}
	}

	if (done) {
		return (
			<AuthCard eyebrow="RESET" title="Password changed">
				<div className="flex flex-col gap-3.5 rounded-md border border-green bg-green/10 p-[18px]">
					<p className="text-[15px] leading-relaxed text-white">
						Your new password is set. Sign in with it to take a seat.
					</p>
					<ButtonLink to="/login" variant="outline" color="green" className="self-start px-5 py-3 text-sm">
						Go to login
					</ButtonLink>
				</div>
			</AuthCard>
		)
	}

	return (
		<AuthCard eyebrow="RESET" title="Set a new password">
			<form onSubmit={handleSubmit} className="flex flex-col gap-[26px]">
				<div className="flex flex-col gap-[18px]">
					{/* The same rules Register shows, next to the field being typed. */}
					<div className="flex flex-col gap-2.5">
						<PasswordInput
							label="NEW PASSWORD"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							placeholder="••••••••"
							aria-describedby="password-rules"
							required
						/>
						<PasswordChecklist id="password-rules" password={password} />
					</div>
					<PasswordInput
						label="CONFIRM PASSWORD"
						name="confirmPassword"
						value={confirmPassword}
						onChange={(e) => setConfirmPassword(e.target.value)}
						placeholder="••••••••"
						required
					/>
				</div>

				<Button
					type="submit"
					color="green"
					disabled={loading}
					className="w-full py-[18px] text-[19px] shadow-[0_0_28px_rgba(22,154,79,0.3)]"
				>
					{loading ? "Saving…" : "Save the new password"}
				</Button>

				{error && <ErrorMessage boxed>{error}</ErrorMessage>}
			</form>

			<p className="text-center text-[15px] text-white/70">
				Link expired?
				<Link to="/forgot-password" className="ml-3.5 font-bold text-yellow hover:text-white">
					Ask for another
				</Link>
			</p>
		</AuthCard>
	)
}

export default ResetPassword
