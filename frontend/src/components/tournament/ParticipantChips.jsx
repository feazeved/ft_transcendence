import { useId } from "react"
import Avatar from "@/components/ui/Avatar.jsx"

// Everybody signed up, as chips with their photo. The host is marked, and you are
// highlighted so you can find yourself in a crowd of forty.
//
// Photos everywhere, not the design's letter initials (spec.md, "Avatars") —
// `ui/Avatar` keeps the initial as the fallback for a photo that is missing or
// fails to load. Each photo is `alt=""`, because the name it belongs to is right
// beside it and a screen reader would otherwise say it twice.
//
// The host is derived from the tournament's `created_by`, not from a flag stored
// on each participant: `TournamentParticipant` has no `is_host` and does not need
// one, and two places to look would be two places to disagree.
function ParticipantChips({ participants, max, hostUsername, myUsername }) {
	const headingId = useId()

	return (
		<section aria-labelledby={headingId} className="flex flex-col gap-3.5">
			<h2 id={headingId} className="font-logo text-[19px] font-bold text-white">
				Participants{" "}
				<span className="font-mono text-sm font-normal text-muted">
					{participants.length}/{max}
				</span>
			</h2>

			{participants.length === 0 ? (
				<p className="font-mono text-xs text-muted">No one has signed up yet.</p>
			) : (
				<ul className="flex max-h-[200px] flex-wrap gap-2 overflow-y-auto rounded-lg border border-white/10 bg-panel p-[18px]">
					{participants.map(({ user }) => {
						const isMe = Boolean(myUsername) && user.username === myUsername
						return (
							<li
								key={user.username}
								className={`flex items-center gap-2 rounded-[5px] border py-1.5 pl-1.5 pr-3 font-mono text-xs ${
									isMe ? "border-blue bg-blue text-white" : "border-transparent bg-white/8 text-white/80"
								}`}
							>
								<Avatar src={user.avatar_url} name={user.username} size="chip" />
								{user.username}
								{user.username === hostUsername && " · host"}
							</li>
						)
					})}
				</ul>
			)}
		</section>
	)
}

export default ParticipantChips
