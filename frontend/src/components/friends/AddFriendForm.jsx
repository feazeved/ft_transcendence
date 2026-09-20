import { useState } from "react"
import Button from "@/components/ui/Button.jsx"
import FormField from "@/components/ui/FormField.jsx"
import { ErrorMessage } from "@/components/ui/Message.jsx"
import { sendRequest } from "@/lib/friends.js"

// A real <form>, so Enter in the field sends it. The label is there for screen
// readers even though the design shows only the placeholder.
function AddFriendForm({ onSent }) {
	const [username, setUsername] = useState("")
	const [sending, setSending] = useState(false)
	const [error, setError] = useState("")

	const submit = async (e) => {
		e.preventDefault()
		const name = username.trim()
		if (!name) return

		setSending(true)
		setError("")
		try {
			await sendRequest(name)
			setUsername("")
			await onSent?.()
		} catch (err) {
			// The server's own words — "No such user.", "Already friends." …
			setError(err.message)
		} finally {
			setSending(false)
		}
	}

	return (
		<form onSubmit={submit} className="flex flex-col gap-3">
			<div className="flex flex-wrap items-start gap-2.5">
				<FormField
					label="Username"
					labelClassName="sr-only"
					type="text"
					value={username}
					onChange={(e) => setUsername(e.target.value)}
					placeholder="Add someone by username"
					className="min-w-0 flex-[1_1_240px]"
				/>
				<Button
					type="submit"
					variant="outline"
					color="green"
					disabled={sending || !username.trim()}
					className="px-[22px] py-3 text-sm"
				>
					{sending ? "Sending..." : "Send request"}
				</Button>
			</div>
			{error && <ErrorMessage>{error}</ErrorMessage>}
		</form>
	)
}

export default AddFriendForm
