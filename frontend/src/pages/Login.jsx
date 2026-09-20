import { useState } from "react"
import { Link, useLocation, useNavigate } from "react-router"
import AuthCard from "@/components/auth/AuthCard.jsx"
import OAuthButtons from "@/components/auth/OAuthButtons.jsx"
import Button from "@/components/ui/Button.jsx"
import FormField from "@/components/ui/FormField.jsx"
import PasswordInput from "@/components/ui/PasswordInput.jsx"
import { ErrorMessage } from "@/components/ui/Message.jsx"
import { api } from "@/lib/api.js"
import { rememberDestination } from "@/lib/oauth.js"
import { useAuth } from "@/lib/auth.jsx"

function Login() {
	const navigate = useNavigate()
	const location = useLocation()
	const { login } = useAuth()
	// Where to land after signing in — set when a guard (e.g. /room/:id or
	// RequireAuth) bounced the visitor here. Falls back to the home page.
	const from = location.state?.from ?? "/"

	const [email, setEmail] = useState("")
	const [password, setPassword] = useState("")
	const [error, setError] = useState("")
	const [loading, setLoading] = useState(false)
	// Which OAuth provider we are redirecting to, if any. Set on click so the
	// buttons lock until the browser leaves the page.
	const [oauth, setOauth] = useState(null)

	const startOAuth = (provider, url) => {
		setOauth(provider)
		// The browser is about to leave the site, taking `location.state` with
		// it, so `from` is parked somewhere that survives the round trip.
		rememberDestination(from)
		window.location.href = url
	}

	const handleSubmit = async (e) => {
		e.preventDefault()
		setError("")
		setLoading(true)

		try {
			await api.post("/auth/login/", { email, password })
			const user = await api.get("/auth/user/")
			login(user)
			navigate(from, { replace: true })
		} catch {
			setError("Login failed. Please check your credentials and try again.")
			setLoading(false)
		}
	}

	const busy = loading || oauth !== null

	return (
		<AuthCard eyebrow="SIGN IN" title="Welcome back">
			<form onSubmit={handleSubmit} className="flex flex-col gap-[26px]">
				<div className="flex flex-col gap-[18px]">
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
					<PasswordInput
						value={password}
						onChange={(e) => setPassword(e.target.value)}
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
					{loading ? "Logging in…" : "Login with us"}
				</Button>

				{error && <ErrorMessage boxed>{error}</ErrorMessage>}
			</form>

			<p className="text-center text-[15px] text-white/70">
				<Link to="/forgot-password" className="font-bold text-yellow hover:text-white">
					Forgot your password?
				</Link>
			</p>

			<OAuthButtons page="login" disabled={busy} oauth={oauth} onStart={startOAuth} />

			<p className="text-center text-[15px] text-white/70">
				Still do not have an account?
				<Link to="/register" className="ml-3.5 font-bold text-yellow hover:text-white">
					Register
				</Link>
			</p>
		</AuthCard>
	)
}

export default Login
