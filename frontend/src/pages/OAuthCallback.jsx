import { useEffect } from "react"
import { useNavigate, useSearchParams } from "react-router"
import { Loading } from "@/components/ui/Message.jsx"
import { api } from "@/lib/api.js"
import { useAuth } from "@/lib/auth.jsx"
import { takeDestination } from "@/lib/oauth.js"

// Landed on after a Google/42 redirect completes on the backend (see
// AccountAdapter.get_login_redirect_url). The provider handshake already signed
// us into a Django session; we fetch who that is and finish the same login()
// the email/password flow does, then go wherever the sign-in started from.
const POLL_MS = 500
const GIVE_UP_MS = 5000

function OAuthCallback() {
	const navigate = useNavigate()
	const { login } = useAuth()
	const [params] = useSearchParams()
	// Only a brand new account carries this: the adapter's signup redirect adds
	// it, the ordinary login redirect doesn't.
	const isFirstLogin = params.get("first") === "1"

	useEffect(() => {
		let cancelled = false
		let timer = null

		const finish = (user) => {
			if (cancelled) return
			login(user)
			navigate(takeDestination(), { replace: true })
		}

		// On a first login the provider picture is still downloading in a
		// background thread on the server, so the first answer carries the
		// default avatar. Asking again until it changes is what stops a new
		// account from storing the default and looking wrong until a reload.
		//
		// Chained setTimeout rather than setInterval: each round waits for the
		// answer before booking the next, so a slow reply can't stack requests.
		const waitForThePicture = (first) => {
			const deadline = Date.now() + GIVE_UP_MS

			const askAgain = () => {
				timer = setTimeout(() => {
					api
						.get("/auth/user/")
						.then((fresh) => {
							if (cancelled) return
							if (fresh.avatar_url !== first.avatar_url || Date.now() >= deadline) finish(fresh)
							else askAgain()
						})
						// The picture is a nicety; a failed retry still signs you in.
						.catch(() => finish(first))
				}, POLL_MS)
			}

			askAgain()
		}

		api
			.get("/auth/user/")
			.then((user) => {
				if (cancelled) return
				if (isFirstLogin) waitForThePicture(user)
				else finish(user)
			})
			.catch(() => {
				if (cancelled) return
				navigate("/login", { replace: true })
			})

		return () => {
			cancelled = true
			if (timer) clearTimeout(timer)
		}
	}, [isFirstLogin, login, navigate])

	return (
		<div className="flex flex-1 items-center justify-center p-6">
			<Loading>Signing you in…</Loading>
		</div>
	)
}

export default OAuthCallback
