import { useEffect, useRef, useState } from "react"
import { Link, useParams } from "react-router"
import AuthCard from "@/components/auth/AuthCard.jsx"
import ButtonLink from "@/components/ui/ButtonLink.jsx"
import { ErrorMessage, Loading } from "@/components/ui/Message.jsx"
import { api } from "@/lib/api.js"

// Where the link in the confirmation e-mail lands. There is nothing to fill in:
// the key is the whole message, so the page sends it and reports back.
function ConfirmEmail() {
	const { key } = useParams()
	const [state, setState] = useState("working")
	const [error, setError] = useState("")

	// The key is spent once it is used, and StrictMode runs this effect twice in
	// development — without the guard the second call fails and paints an error
	// over a confirmation that worked.
	const sent = useRef(false)

	useEffect(() => {
		if (sent.current) return
		sent.current = true

		api
			.post("/auth/registration/verify-email/", { key })
			.then(() => setState("done"))
			.catch((err) => {
				setError(err.message || "This confirmation link is no longer valid.")
				setState("failed")
			})
	}, [key])

	return (
		<AuthCard eyebrow="EMAIL" title="Confirming your address">
			{state === "working" && <Loading>Confirming…</Loading>}

			{state === "done" && (
				<div className="flex flex-col gap-3.5 rounded-md border border-green bg-green/10 p-[18px]">
					<p className="text-[15px] leading-relaxed text-white">
						Your e-mail address is confirmed. That is all it needed.
					</p>
					<ButtonLink to="/login" variant="outline" color="green" className="self-start px-5 py-3 text-sm">
						Go to login
					</ButtonLink>
				</div>
			)}

			{state === "failed" && (
				<div className="flex flex-col gap-3.5">
					<ErrorMessage boxed>{error}</ErrorMessage>
					{/* Confirming is optional here (ACCOUNT_EMAIL_VERIFICATION =
					    'optional'), so a dead link is not a locked account — say so
					    rather than leaving somebody stuck on this page. */}
					<p className="text-[15px] leading-relaxed text-white/70">
						You can still sign in: confirming is not required to play.
					</p>
					<ButtonLink to="/login" variant="outline" color="green" className="self-start px-5 py-3 text-sm">
						Go to login
					</ButtonLink>
				</div>
			)}

			<p className="text-center text-[15px] text-white/70">
				Back to
				<Link to="/" className="ml-3.5 font-bold text-yellow hover:text-white">
					Home
				</Link>
			</p>
		</AuthCard>
	)
}

export default ConfirmEmail
