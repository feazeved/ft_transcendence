import { Link } from "react-router"
import Avatar from "@/components/ui/Avatar.jsx"

// Ranked numbers in rows and columns are a table: a screen reader can then say
// "Wins, row 3" instead of reading five loose values. A grid of divs can't.
//
// The top three get the design's medal colours; everyone else is muted.
const RANKS = [
	{ text: "text-yellow", ring: "yellow", border: "border-l-yellow" },
	{ text: "text-blue-soft", ring: "blue", border: "border-l-blue" },
	{ text: "text-green-soft", ring: "green", border: "border-l-green" },
]

const HEAD = "pb-2 font-mono text-[11px] tracking-[0.16em] text-muted"
const NUMBER = "px-2 text-right font-mono text-base"

function LeaderboardTable({ players, page, pageSize, myUsername }) {
	return (
		<table className="w-full border-separate border-spacing-y-2">
			<caption className="sr-only">Players ranked by wins</caption>
			<colgroup>
				<col className="w-[clamp(30px,5vw,60px)]" />
				<col />
				<col className="w-[80px]" />
				<col className="w-[80px]" />
				<col className="w-[80px]" />
			</colgroup>
			<thead>
				<tr>
					<th scope="col" className={`${HEAD} px-5 text-left`}>
						#
					</th>
					<th scope="col" className={`${HEAD} text-left`}>
						PLAYER
					</th>
					<th scope="col" className={`${HEAD} px-2 text-right`}>
						WINS
					</th>
					<th scope="col" className={`${HEAD} hidden px-2 text-right sm:table-cell`}>
						LOSSES
					</th>
					<th scope="col" className={`${HEAD} hidden px-2 text-right sm:table-cell`}>
						RATE
					</th>
				</tr>
			</thead>
			<tbody>
				{players.map((player, i) => {
					const rank = (page - 1) * pageSize + i + 1
					const medal = RANKS[rank - 1]
					const isMe = player.username === myUsername
					const losses = player.games_played - player.games_won
					const rate = Math.round(player.win_rate)

					return (
						<tr key={player.public_id} className="bg-panel">
							<td
								className={`rounded-l-md border border-r-0 border-white/10 border-l-4 px-5 py-3.5 font-mono text-[18px] font-bold ${
									medal ? `${medal.border} ${medal.text}` : "border-l-line-strong text-muted"
								}`}
							>
								{rank}
							</td>
							<td className="border-y border-white/10 py-3.5">
								<span className="flex min-w-0 items-center gap-3.5">
									<Avatar src={player.avatar_url} name={player.username} size="sm" ring={medal?.ring} />
									<span className="flex min-w-0 flex-col gap-0.5">
										<span className="flex items-center gap-2.5">
											{/* The ranking shows the username, not the display name: it is the
										    name the leaderboard is kept under. */}
										<Link
											to={`/users/${player.public_id}`}
											className="truncate font-title text-[19px] font-bold text-white underline-offset-4 hover:underline"
										>
											{player.username}
										</Link>
											{isMe && (
												<span className="rounded-sm border border-yellow px-1.5 py-0.5 font-mono text-[11px] tracking-[0.12em] text-yellow">
													you
												</span>
											)}
										</span>
										<span className="font-mono text-[11px] tracking-[0.08em] text-muted">
											{player.games_played} GAMES
											{/* The two columns that hide on a phone come back here. */}
											<span className="sm:hidden">
												{" · "}
												{losses}L · {rate}%
											</span>
										</span>
									</span>
								</span>
							</td>
							<td
								className={`${NUMBER} rounded-r-md border-y border-r border-white/10 font-bold text-green sm:rounded-none sm:border-r-0`}
							>
								{player.games_won}
							</td>
							<td className={`${NUMBER} hidden border-y border-white/10 text-white/70 sm:table-cell`}>{losses}</td>
							<td className={`${NUMBER} hidden rounded-r-md border border-l-0 border-white/10 font-bold text-white sm:table-cell`}>
								{rate}%
							</td>
						</tr>
					)
				})}
			</tbody>
		</table>
	)
}

export default LeaderboardTable
