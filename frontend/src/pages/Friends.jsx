import { useCallback, useEffect, useMemo, useState } from "react"
import api from "@/lib/api.js"
import { useAuth } from "@/lib/auth.jsx"

const inputClass = "rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/40"
const actionButton = "rounded-lg borderd border-white/30 px-3 py-1 text-sm transition-transform hover:scale-105 cursor-pointer disabled:opacity-40 disabled:hover:scale-100"

function PersonRow({ person, children }) {
	return (
		<li className="flex items-center gap-3 rounded-xl border border-white/15 bg-black px-4 py-2.5">
			<img
			src={person.avatar_url}
			alt=""
			className="h-9 w-9 shrink-0 rounded-full border border-white/20 object-cover"
			/>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-bold leading-tight">
					{person.display_name || person.username}
				</span>
				<span className="flex items-center gap-1.5 text-xs text-white/50">
					<span
						aria-hidden="true"
						className={`inline-block h-2 w-2 rounded-full ${
							person.is_online ? "bg-green" : "bg-white/30"
						}`}
					/>
					{person.is_online ? "Online" : "Offline"}
				</span>
			</span>
			<span className="flex shrink-0 gap-2">{children}</span>
		</li>
	)
}

function FriendsSection({ title, count, empty, children }) {
	return (
		<section className="mb-6">
			<h3 className="mb-2 text-sm uppercase tracking-[0.15em] text-white/50">
				{title} {count > 0 && <span className="text-white">({count})</span>}
			</h3>
			{count === 0 ? (
				<p className="text-sm text-white/50">{empty}</p>
			) : (
				<ul className="space-y-2">{children}</ul>
			)}
		</section>
	)
}

function Friends() {
	const { user } = useAuth()

	const [rows, setRows] = useState([])
	const [status, setStatus] = useState("loading")
	const [error, setError] = useState("")

	const [username, setUsername] = useState("")
	const [formError, setFormError] = useState("")
	const [adding, setAdding] = useState(false)
	const [busyId, setBusyId] = useState(null)

	const load = useCallback(async () => {
		try {
			const data = await api.get("/friendships")
			setRows(Array.isArray(data) ? data : (data.results ?? []))
			setStatus("ready")
		} catch (err) {
			setError(err.message)
			setStatus("error")
		}
	}, [])

	useEffect(() => {
		load()
	}, [load])

	const { friends, incoming, outgoing } = useMemo(() => {
		const me = user?.public_id
		const friends = []
		const incoming = []
		const outgoing = []

		for (const row of rows) {
			const iAmRequester = row.requester?.public_id === me
			const other = iAmRequester ? row.addressee : row.requester

			if (row.status === "accepted") friends.push({ id: row.id, person: other})
			else if (row.status === "pending" && iAmRequester) outgoing.push({ id: row.id, person: other})
			else if (row.status === "pending") incoming.push({ id: row.id, person: other})
		}
		return { friends, incoming, outgoing }
	}, [rows, user?.public_id])

	const act = async (id, run) => {
		setBusyId(id)
		setFormError("")
		try {
			await run()
			await load()
		} catch (err) {
			setFormError(err.message)
		} finally {
			setBusyId(null)
		}
	}

	const addFriend = async (e) => {
		e.preventDefault()
		const name = username.trim()
		if (!name) return

		setAdding(true)
		setFormError("")
		try {
			await api.post("/friendship/", { username: name })
			setUsername("")
			await load()
		} catch (err) {
			setFormError(err.message)
		} finally {
			setAdding(false)
		}
	}
}

export default Friends
