import { useState } from "react"
import { Link } from "react-router"
import AuthCard from "@/components/auth/AuthCard.jsx"
import Button from "@/components/ui/Button.jsx"
import FormField from "@/components/ui/FormField.jsx"
import { ErrorMessage } from "@/components/ui/Message.jsx"
import { api } from "@/lib/api.js"

function ForgotPassword() {
	const [email, setEmail] = useState("")
	const [error, setError] = useState("")
	const [loading, setLoading] = useState(false)
	const [sent, setSent] = useState(false)

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError("")
		setLoading(true)

		try {
			await api.post("/auth/password/reset/", { email })
			setSent(true)
		} catch (err) {
			setError(err.message || "Could not send the reset link. Please try again.")
		} finally {
			setLoading(false)
		}
	}

	return (
		<AuthCard eyebrow="RESET" title="Forgot your password?">
			{sent ? (
				// Deliberately says nothing about whether that address has an account:
				// this form would otherwise tell anybody who asks which e-mails are
				// registered here.
				<div className="flex flex-col gap-3.5 rounded-md border border-green bg-green/10 p-[18px]">
					<p className="text-[15px] leading-relaxed text-white">
						If an account exists for {email}, a link to set a new password is on its way. It is good
						for a limited time.
					</p>
					<p className="text-[15px] leading-relaxed text-white/70">
						Nothing arrived? Check the spam folder before asking for another one.
					</p>
				</div>
			) : (
				<form onSubmit={handleSubmit} className="flex flex-col gap-[26px]">
					<p className="text-[15px] leading-relaxed text-white/70">
						Type the address you signed up with and we will send you a link to set a new password.
					</p>

					<FormField
						label="EMAIL"
						tone="soft"
						type="email"
						name="email"
						placeholder="player1@gmail.com"
						value={email}
						onChange={(e) => setEmail(e.target.value)}
						required
					/>

					<Button
						type="submit"
						color="green"
						disabled={loading}
						className="w-full py-[18px] text-[19px] shadow-[0_0_28px_rgba(22,154,79,0.3)]"
					>
						{loading ? "Sending…" : "Send the link"}
					</Button>

					{error && <ErrorMessage boxed>{error}</ErrorMessage>}
				</form>
			)}

			<p className="text-center text-[15px] text-white/70">
				Remembered it?
				<Link to="/login" className="ml-3.5 font-bold text-yellow hover:text-white">
					Login
				</Link>
			</p>
		</AuthCard>
	)
}

export default ForgotPassword
