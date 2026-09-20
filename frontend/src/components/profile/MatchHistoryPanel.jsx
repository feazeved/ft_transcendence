import Avatar from "@/components/ui/Avatar.jsx"
import Panel from "@/components/ui/Panel.jsx"
import { EmptyMessage, ErrorMessage, Loading } from "@/components/ui/Message.jsx"
import { formatPlayedAt, matchOutcome, opponentsOf } from "@/lib/profiles.js"

// Every finished game, newest first. It draws and nothing else, so one panel
// serves both your own profile and somebody else's. `publicId` is whose history
// this is — only used to leave them out of their own list of opponents.
function MatchHistoryPanel({ matches, publicId, status = "ready", error = "" }) {
	return (
		<Panel title="MATCH HISTORY" accent="blue">
			{status === "loading" && <Loading className="py-6 text-center">Loading...</Loading>}

			{status === "error" && (
				<ErrorMessage className="py-6 text-center">Couldn't load the match history. {error}</ErrorMessage>
			)}

			{status === "ready" && matches.length === 0 && (
				<EmptyMessage className="py-6 text-center">No finished games yet.</EmptyMessage>
			)}

			{status === "ready" && matches.length > 0 && (
				<ol className="flex flex-col gap-2.5">
					{matches.map((match) => {
						const outcome = matchOutcome(match)
						const opponents = opponentsOf(match, publicId)

						return (
							<li
								key={match.public_id}
								className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 rounded-md border border-white/10 bg-page px-[18px] py-3.5"
							>
								<span className="flex min-w-0 flex-col gap-1.5">
									<span className={`font-logo text-base font-bold ${outcome.color}`}>{outcome.label}</span>
									<span className="flex flex-wrap items-center gap-2">
										{opponents.length === 0 ? (
											<span className="font-mono text-xs text-muted">Played alone</span>
										) : (
											opponents.map((player) => (
												<span
													key={player.id}
													className="flex items-center gap-1.5 rounded-[5px] bg-white/8 py-1 pl-1 pr-2.5 font-mono text-xs text-white/80"
												>
													<Avatar src={player.user?.avatar_url} name={player.display_name} size="chip" />
													{player.display_name}
												</span>
											))
										)}
									</span>
								</span>

								<span className="font-mono text-[11px] tracking-[0.08em] text-muted">
									{formatPlayedAt(match.finished_at)}
								</span>
							</li>
						)
					})}
				</ol>
			)}
		</Panel>
	)
}

export default MatchHistoryPanel
