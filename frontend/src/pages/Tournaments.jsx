import { useEffect, useState } from "react"
import { useNavigate } from "react-router"
import CreateTournamentDialog from "@/components/tournament/CreateTournamentDialog.jsx"
import SelectedTournament from "@/components/tournament/SelectedTournament.jsx"
import TournamentList from "@/components/tournament/TournamentList.jsx"
import Button from "@/components/ui/Button.jsx"
import PageHeader from "@/components/ui/PageHeader.jsx"
import { listTournaments } from "@/lib/tournaments.js"
import { useAuth } from "@/lib/auth.jsx"

// Every tournament there is. The page keeps the list, which one is selected and
// whether the dialog is open; the sections draw.
function Tournaments() {
	const navigate = useNavigate()
	const { user } = useAuth()
	const [tournaments, setTournaments] = useState([])
	const [status, setStatus] = useState("loading")
	const [error, setError] = useState("")
	const [selectedId, setSelectedId] = useState(null)
	const [creating, setCreating] = useState(false)

	useEffect(() => {
		// `ignore` is the same guard the Leaderboard uses: StrictMode mounts the
		// effect twice in development, so a late answer has to check it still
		// matters.
		let ignore = false

		listTournaments()
			.then((rows) => {
				if (ignore) return
				setTournaments(rows)
				setStatus("ready")
			})
			.catch((err) => {
				if (ignore) return
				setError(err.message)
				setStatus("error")
			})

		return () => {
			ignore = true
		}
	}, [])

	// Clicking the card you already picked puts it back down.
	const select = (id) => setSelectedId((current) => (current === id ? null : id))

	// Creating needs an account, so a guest goes to the Login first, carrying
	// where they were headed — the same pattern as `home/OpenRooms.jsx`.
	const startCreating = () => {
		if (!user) return navigate("/login", { state: { from: "/tournament" } })
		setCreating(true)
	}

	const selected = tournaments.find((tournament) => tournament.id === selectedId)

	return (
		<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-[clamp(16px,4vw,24px)] pb-[clamp(48px,8vw,88px)] pt-[clamp(28px,6vw,56px)]">
			<PageHeader eyebrow="TOURNAMENTS" eyebrowColor="red" title="Tournaments">
				<Button color="red" onClick={startCreating}>
					Create tournament
				</Button>
			</PageHeader>

			<TournamentList
				tournaments={tournaments}
				status={status}
				error={error}
				selectedId={selectedId}
				onSelect={select}
			/>

			{selected && <SelectedTournament tournament={selected} />}

			{/* The key resets the form every time the dialog reopens. */}
			<CreateTournamentDialog
				key={creating ? "create-open" : "create-closed"}
				open={creating}
				onClose={() => setCreating(false)}
			/>
		</div>
	)
}

export default Tournaments
