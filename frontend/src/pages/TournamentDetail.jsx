import { useEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router"
import FinalResults from "@/components/tournament/FinalResults.jsx"
import ParticipantChips from "@/components/tournament/ParticipantChips.jsx"
import RoundsPanel from "@/components/tournament/RoundsPanel.jsx"
import StructurePanel from "@/components/tournament/StructurePanel.jsx"
import TournamentActions from "@/components/tournament/TournamentActions.jsx"
import TournamentHeader from "@/components/tournament/TournamentHeader.jsx"
import TournamentSettingsPanel from "@/components/tournament/TournamentSettingsPanel.jsx"
import { ErrorMessage, Loading } from "@/components/ui/Message.jsx"
import {
	getTournament,
	joinTournament,
	leaveTournament,
	liveMatchId,
	startTournament,
} from "@/lib/tournaments.js"
import { computeStructure } from "@/lib/tournamentStructure.js"
import { useAuth } from "@/lib/auth.jsx"

const POLL_MS = 3000

// One tournament. The page holds the tournament itself and whether a button is
// mid-flight; every section draws from that one object.
//
// Joining, leaving and starting each answer with the whole fresh tournament, so
// there is nothing to patch by hand and no second copy of the roster to keep in
// step — the answer replaces what was on screen.
function TournamentDetail() {
	const { id } = useParams()
	const navigate = useNavigate()
	const { user } = useAuth()
	// The tournament is kept together with the id it belongs to, in one piece of
	// state. Whether the page has what it is currently showing is then *derived*
	// during render — so a route change cannot leave one tournament's roster under
	// another one's name, and there is no "loading" flag to set from inside an
	// effect and keep in step.
	const [data, setData] = useState({ id: null, tournament: null, error: "" })
	const [actionError, setActionError] = useState("")
	const [busy, setBusy] = useState(false)

	const fresh = data.id === id
	const tournament = fresh ? data.tournament : null
	const loadError = fresh ? data.error : ""

	const live = !tournament || tournament.status === "pending" || tournament.status === "in_progress"

	const myMatchId = liveMatchId(tournament, user?.public_id)
	const sentTo = useRef(null)

	useEffect(() => {
		// `ignore` is the same guard the Leaderboard uses: StrictMode mounts the
		// effect twice in development, so a late answer has to check it still
		// matters. It also covers a route change — one tournament's answer must
		// not land under another one's name.
		let ignore = false

		const load = () =>
			getTournament(id)
				.then((tournament) => {
					if (!ignore) setData({ id, tournament, error: "" })
				})
				.catch((err) => {
					if (!ignore) setData((current) => (current.tournament ? current : { id, tournament: null, error: err.message }))
				})

		if (busy) return () => {
			ignore = true
		}

		void load()

		if (!live) return () => {
			ignore = true
		}

		const timer = setInterval(load, POLL_MS)

		return () => {
			ignore = true
			clearInterval(timer)
		}
	}, [id, live, busy])

	useEffect(() => {
		if (!myMatchId || sentTo.current === myMatchId) return
		sentTo.current = myMatchId
		navigate(`/room/${myMatchId}`)
	}, [myMatchId, navigate])

	// Every button follows the same shape: lock, run, take the answer, unlock.
	const act = async (run) => {
		setBusy(true)
		setActionError("")
		try {
			setData({ id, tournament: await run(), error: "" })
		} catch (err) {
			setActionError(err.message)
		} finally {
			setBusy(false)
		}
	}

	// Joining needs an account, so a guest goes to the Login first and comes back
	// here (spec.md, "Sign-in and guests").
	const join = () => {
		if (!user) return navigate("/login", { state: { from: `/tournament/${id}` } })
		return act(() => joinTournament(id))
	}

	if (loadError)
		return <ErrorMessage className="py-16 text-center">Couldn't load the tournament. {loadError}</ErrorMessage>

	if (!tournament) return <Loading className="py-16 text-center">Loading...</Loading>

	return (
		<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-[26px] px-[clamp(16px,4vw,24px)] pb-[clamp(48px,8vw,88px)] pt-[clamp(28px,6vw,56px)]">
			<TournamentHeader tournament={tournament} />

			<FinalResults tournament={tournament} />

			<ParticipantChips
				participants={tournament.participants}
				max={tournament.max_participants}
				hostUsername={tournament.created_by?.username}
				myUsername={user?.username}
			/>

			{/* Who is actually playing whom, once there is a draw to show. */}
			<RoundsPanel rounds={tournament.rounds} myPublicId={user?.public_id} />

			<div className="flex flex-wrap items-start gap-4">
				{/* A tournament *is* its own config — the settings sit flat on it — so
				    the pure structure function reads it with no mapping step. */}
				<StructurePanel structure={computeStructure(tournament)} />
				<TournamentSettingsPanel tournament={tournament} />
			</div>

			<TournamentActions
				tournament={tournament}
				myUsername={user?.username}
				busy={busy}
				error={actionError}
				onJoin={join}
				onLeave={() => act(() => leaveTournament(id))}
				onStart={() => act(() => startTournament(id))}
			/>
		</div>
	)
}

export default TournamentDetail
