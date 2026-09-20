import { useCallback, useEffect, useState } from "react"
import AddFriendForm from "@/components/friends/AddFriendForm.jsx"
import FriendRow from "@/components/friends/FriendRow.jsx"
import FriendSection from "@/components/friends/FriendSection.jsx"
import Button from "@/components/ui/Button.jsx"
import PageHeader from "@/components/ui/PageHeader.jsx"
import { ErrorMessage, Loading } from "@/components/ui/Message.jsx"
import { acceptRequest, blockUser, declineRequest, groupFriendships, listFriendships, removeFriendship } from "@/lib/friends.js"
import { useChat } from "@/components/chat/ChatProvider.jsx"
import { useAuth } from "@/lib/auth.jsx"

const ACTION = "px-4 py-2.5 text-sm"

function Friends() {
	const { user } = useAuth()
	// Bumped whenever the presence socket says a friendship changed, so a request
	// that arrives while this page is open lands in the list instead of only on
	// the header's badge.
	const { friendshipVersion } = useChat()

	// Only the server's answer is kept. The four groups are worked out on every
	// render instead of being stored, so they can never disagree with `rows`.
	const [rows, setRows] = useState([])
	// One status instead of separate booleans: "loading and failed" can't happen.
	const [status, setStatus] = useState("loading")
	const [error, setError] = useState("")
	const [busyId, setBusyId] = useState(null)

	const load = useCallback(async () => {
		try {
			const data = await listFriendships()
			setRows(Array.isArray(data) ? data : (data.results ?? []))
			setStatus("ready")
		} catch (err) {
			setError(err.message)
			setStatus("error")
		}
	}, [])

	useEffect(() => {
		// Wrapped in an async call so nothing sets state while the effect body is
		// still running: the state changes happen after the request resolves.
		void (async () => {
			await load()
		})()
	}, [load, friendshipVersion])

	// Every button follows the same shape: lock the row, run it, reload, unlock.
	const act = async (id, run) => {
		setBusyId(id)
		setError("")
		try {
			await run()
			await load()
		} catch (err) {
			setError(err.message)
		} finally {
			setBusyId(null)
		}
	}

	const { incoming, friends, sent, blocked } = groupFriendships(rows, user?.public_id)

	const requests = (
		<FriendSection
			key="requests"
			title="Requests"
			accent="yellow"
			count={incoming.length}
			empty="No pending requests."
		>
			{incoming.map(({ id, person }) => (
				<FriendRow key={id} person={person} accent="yellow" busy={busyId === id}>
					<Button
						variant="outline"
						color="green"
						disabled={busyId === id}
						onClick={() => act(id, () => acceptRequest(id))}
						className={ACTION}
					>
						Accept
					</Button>
					<Button
						variant="small"
						disabled={busyId === id}
						onClick={() => act(id, () => declineRequest(id))}
						className={ACTION}
					>
						Decline
					</Button>
				</FriendRow>
			))}
		</FriendSection>
	)

	const yours = (
		<FriendSection
			key="friends"
			title="Your friends"
			accent="green"
			count={friends.length}
			empty="No friends yet - add someone above."
		>
			{/* The only section with live actions, so the only one where Remove and
			    Block move into the ⋮ — see FriendRow. */}
			{friends.map(({ id, person }) => (
				<FriendRow
					key={id}
					person={person}
					accent="green"
					busy={busyId === id}
					chatWith={person.username}
					menu={[
						{ label: "Remove friend", color: "dim", onClick: () => act(id, () => removeFriendship(id)) },
						{ label: "Block", color: "red", onClick: () => act(id, () => blockUser(person.username)) },
					]}
				/>
			))}
		</FriendSection>
	)

	const sentSection = (
		<FriendSection key="sent" title="Sent" accent="blue" count={sent.length} empty="Nothing waiting.">
			{sent.map(({ id, person }) => (
				<FriendRow key={id} person={person} accent="blue" busy={busyId === id}>
					<Button
						variant="small"
						disabled={busyId === id}
						onClick={() => act(id, () => removeFriendship(id))}
						className={ACTION}
					>
						Cancel
					</Button>
				</FriendRow>
			))}
		</FriendSection>
	)

	return (
		<div className="mx-auto flex w-full max-w-[900px] flex-col gap-7 px-[clamp(16px,4vw,24px)] pb-[clamp(48px,8vw,88px)] pt-[clamp(28px,6vw,56px)]">
			<PageHeader
				eyebrow="FRIENDS"
				title="Friends"
				count={status === "ready" ? `${friends.length} FRIENDS · ${incoming.length} PENDING` : undefined}
			/>

			<AddFriendForm onSent={load} />

			{error && status === "ready" && <ErrorMessage>{error}</ErrorMessage>}

			{status === "loading" && <Loading className="py-12 text-center">Loading...</Loading>}

			{status === "error" && (
				<ErrorMessage className="py-12 text-center">Couldn't load your friends. {error}</ErrorMessage>
			)}

			{status === "ready" && (
				<div className="flex flex-col gap-8">
					{/* Waiting requests come first: they are the thing to act on. */}
					{incoming.length > 0 ? [requests, yours, sentSection] : [yours, requests, sentSection]}

					{blocked.length > 0 && (
						<FriendSection title="Blocked" accent="red" count={blocked.length} empty="Nobody blocked.">
							{blocked.map(({ id, person }) => (
								<FriendRow key={id} person={person} accent="red" busy={busyId === id}>
									<Button
										variant="small"
										disabled={busyId === id}
										onClick={() => act(id, () => removeFriendship(id))}
										className={ACTION}
									>
										Unblock
									</Button>
								</FriendRow>
							))}
						</FriendSection>
					)}
				</div>
			)}
		</div>
	)
}

export default Friends
