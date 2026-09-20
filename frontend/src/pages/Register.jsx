import { useState } from "react"
import { Link } from "react-router"
import AuthCard from "@/components/auth/AuthCard.jsx"
import OAuthButtons from "@/components/auth/OAuthButtons.jsx"
import PasswordChecklist from "@/components/auth/PasswordChecklist.jsx"
import Button from "@/components/ui/Button.jsx"
import ButtonLink from "@/components/ui/ButtonLink.jsx"
import FormField from "@/components/ui/FormField.jsx"
import PasswordInput from "@/components/ui/PasswordInput.jsx"
import { ErrorMessage } from "@/components/ui/Message.jsx"
import { api } from "@/lib/api.js"
import { rememberDestination } from "@/lib/oauth.js"

function Register() {
	const [username, setUsername] = useState("")
	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [confirmPassword, setConfirmPassword] = useState("")
	const [error, setError] = useState("")
	const [loading, setLoading] = useState(false)
	// The account exists: the form gives way to the "what now" panel instead of
	// jumping straight to the Login, which looked like nothing had happened.
	const [done, setDone] = useState(false)
	// Which OAuth provider we are redirecting to, if any. Set on click so the
	// buttons lock until the browser leaves the page.
	const [oauth, setOauth] = useState(null)

	const startOAuth = (provider, url) => {
		setOauth(provider)
		// Nowhere in particular to return to from here, but this also clears
		// anything a previous sign-in attempt left behind.
		rememberDestination("/")
		window.location.href = url
	}

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError("")

		if (password !== confirmPassword) {
			setError("Passwords do not match.")
			return
		}

		setLoading(true)
		try {
			await api.post("/auth/registration/", {
				username,
				email,
				password1: password,
				password2: confirmPassword,
			})
			setDone(true)
		} catch (err) {
			setError(err.message || "Register failed. Please check your details and try again.")
		} finally {
			setLoading(false)
		}
	}

	const busy = loading || oauth !== null

	return (
		<AuthCard eyebrow="NEW PLAYER" title="Sign up">
			{done ? (
				<div className="flex flex-col gap-3.5 rounded-md border border-green bg-green/10 p-[18px]">
					<p className="text-[15px] leading-relaxed text-white">
						Account created. Log in with your new credentials to take a seat.
					</p>
					<ButtonLink to="/login" variant="outline" color="green" className="self-start px-5 py-3 text-sm">
						Go to login
					</ButtonLink>
				</div>
			) : (
				<form onSubmit={handleSubmit} className="flex flex-col gap-[26px]">
					<div className="flex flex-col gap-[18px]">
						<FormField
							label="USERNAME"
							tone="soft"
							type="text"
							name="username"
							placeholder="username"
							value={username}
							onChange={(e) => setUsername(e.target.value)}
							required
						/>
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
						{/* The rules live next to the field being typed, rather than
						    arriving as a rejection after the round trip. */}
						<div className="flex flex-col gap-2.5">
							<PasswordInput
								value={password}
								onChange={(e) => setPassword(e.target.value)}
								placeholder="••••••••"
								aria-describedby="password-rules"
								required
							/>
							<PasswordChecklist
								id="password-rules"
								password={password}
								username={username}
								email={email}
							/>
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
						disabled={busy}
						className="w-full py-[18px] text-[19px] shadow-[0_0_28px_rgba(22,154,79,0.3)]"
					>
						{loading ? "Registering…" : "Register"}
					</Button>

					{error && <ErrorMessage boxed>{error}</ErrorMessage>}
				</form>
			)}

			<OAuthButtons page="register" disabled={busy} oauth={oauth} onStart={startOAuth} />

			<p className="text-center text-[15px] text-white/70">
				Already have an account?
				<Link to="/login" className="ml-3.5 font-bold text-yellow hover:text-white">
					Login
				</Link>
			</p>
		</AuthCard>
	)
}

export default Register
