import { useEffect, useState } from "react"
import { Link, useParams } from "react-router"
import MatchHistoryPanel from "@/components/profile/MatchHistoryPanel.jsx"
import RecordPanel from "@/components/profile/RecordPanel.jsx"
import Avatar from "@/components/ui/Avatar.jsx"
import ButtonLink from "@/components/ui/ButtonLink.jsx"
import PageHeader from "@/components/ui/PageHeader.jsx"
import { ErrorMessage, Loading } from "@/components/ui/Message.jsx"
import { presenceColor, presenceLabel } from "@/lib/chat.js"
import { formatDay, getMatchHistory, getPublicProfile, getUserStats } from "@/lib/profiles.js"
import { useAuth } from "@/lib/auth.jsx"

const HISTORY_SIZE = 10

// Somebody else's profile, at /users/<public_id> — the page the leaderboard and
// the chat point at. Three requests, and only the first can take the page down:
// a profile that draws without its numbers is still a profile.
function UserProfile() {
	const { publicId } = useParams()
	const { user } = useAuth()

	// Kept with the id it was fetched for, so a route change cannot leave one
	// person's record under another one's name.
	const [data, setData] = useState({ id: null, profile: null, error: "" })
	const [stats, setStats] = useState(null)
	const [history, setHistory] = useState({ id: null, status: "loading", matches: [], error: "" })

	useEffect(() => {
		let ignore = false

		getPublicProfile(publicId)
			.then((profile) => {
				if (!ignore) setData({ id: publicId, profile, error: "" })
			})
			.catch((err) => {
				if (!ignore) setData({ id: publicId, profile: null, error: err.message })
			})

		return () => {
			ignore = true
		}
	}, [publicId])

	useEffect(() => {
		let ignore = false

		// If the numbers fail the panel keeps its dashes.
		getUserStats(publicId)
			.then((result) => {
				if (!ignore) setStats(result)
			})
			.catch(() => {
				if (!ignore) setStats(null)
			})

		getMatchHistory(publicId, { pageSize: HISTORY_SIZE })
			.then((page) => {
				if (!ignore) setHistory({ id: publicId, status: "ready", matches: page.results ?? [], error: "" })
			})
			.catch((err) => {
				if (!ignore) setHistory({ id: publicId, status: "error", matches: [], error: err.message })
			})

		return () => {
			ignore = true
		}
	}, [publicId])

	const fresh = data.id === publicId
	const profile = fresh ? data.profile : null
	const loadError = fresh ? data.error : ""
	const historyFor = history.id === publicId ? history : { status: "loading", matches: [], error: "" }

	if (loadError)
		return <ErrorMessage className="py-16 text-center">Couldn't load this profile. {loadError}</ErrorMessage>

	if (!profile) return <Loading className="py-16 text-center">Loading...</Loading>

	const isMe = Boolean(user) && user.public_id === profile.public_id

	return (
		<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-[clamp(16px,4vw,24px)] pb-[clamp(48px,8vw,88px)] pt-[clamp(28px,6vw,56px)]">
			<PageHeader eyebrow="PLAYER" eyebrowColor="yellow" title={profile.display_name || profile.username}>
				{isMe ? (
					<ButtonLink to="/profile" variant="small" className="px-[26px] py-4 font-logo text-base">
						Edit my profile
					</ButtonLink>
				) : (
					<ButtonLink to="/leaderboard" variant="small" className="px-[26px] py-4 font-logo text-base">
						Leaderboard
					</ButtonLink>
				)}
			</PageHeader>

			<section className="flex flex-wrap items-center gap-5 rounded-lg border border-white/10 border-t-4 border-t-yellow bg-panel p-[clamp(18px,4vw,26px)]">
				<h2 className="sr-only">Player</h2>
				<Avatar src={profile.avatar_url} name={profile.username} size="xl" ring="yellow" />

				<div className="flex min-w-0 flex-col gap-1.5">
					<p className="truncate font-title text-[clamp(22px,4.5vw,28px)] font-extrabold text-white">
						{profile.username}
					</p>
					{profile.display_name && profile.display_name !== profile.username && (
						<p className="truncate text-[15px] text-white/70">{profile.display_name}</p>
					)}
					<p className={`font-mono text-[11px] tracking-[0.12em] ${presenceColor(profile.presence)}`}>
						{presenceLabel(profile.presence).toUpperCase()}
					</p>
					{profile.date_joined && (
						<p className="font-mono text-[11px] tracking-[0.08em] text-muted">
							PLAYING SINCE {formatDay(profile.date_joined).toUpperCase()}
						</p>
					)}
				</div>
			</section>

			<div className="grid gap-5 lg:grid-cols-[minmax(260px,1fr)_2fr]">
				<RecordPanel stats={stats} />
				<MatchHistoryPanel
					matches={historyFor.matches}
					publicId={publicId}
					status={historyFor.status}
					error={historyFor.error}
				/>
			</div>

			<p className="font-mono text-[11px] tracking-[0.08em] text-muted">
				Looking for someone else? <Link to="/leaderboard" className="text-yellow underline underline-offset-4">Browse the leaderboard</Link>.
			</p>
		</div>
	)
}

export default UserProfile
