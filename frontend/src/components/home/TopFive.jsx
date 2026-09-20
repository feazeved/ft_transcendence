import { useEffect, useState } from "react"
import { Link } from "react-router"
import Avatar from "@/components/ui/Avatar.jsx"
import { EmptyMessage, ErrorMessage, Loading } from "@/components/ui/Message.jsx"
import { getLeaderboard } from "@/lib/leaderboard.js"

// The same lib call the Leaderboard page uses, asking for one page of five.
// The design's "+4s" column is gone: nothing counts them.
const HEAD = "pb-2 font-mono text-[11px] tracking-[0.16em] text-muted"

function TopFive() {
	const [players, setPlayers] = useState([])
	const [status, setStatus] = useState("loading")
	const [error, setError] = useState("")

	useEffect(() => {
		let ignore = false

		getLeaderboard({ page: 1, pageSize: 5 })
			.then((result) => {
				if (ignore) return
				setPlayers(result.results ?? [])
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

	return (
		<section
			id="ranking"
			className="mx-auto flex w-full max-w-[1240px] scroll-mt-24 flex-col gap-6 px-[clamp(16px,4vw,24px)] pb-[88px]"
		>
			<header className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-4">
				<div className="flex flex-col gap-2">
					<p className="font-mono text-xs tracking-[0.18em] text-green-soft">LEADERBOARD</p>
					<h2 className="font-title text-[clamp(26px,5.5vw,34px)] font-extrabold text-white">Top 5</h2>
				</div>
				<Link
					to="/leaderboard"
					className="rounded-md border-2 border-line-strong px-5 py-3 font-mono text-[13px] tracking-[0.08em] text-soft transition-colors hover:border-yellow hover:text-yellow"
				>
					FULL RANKING →
				</Link>
			</header>

			{status === "loading" && <Loading className="py-8 text-center">Loading...</Loading>}

			{status === "error" && (
				<ErrorMessage className="py-8 text-center">Couldn't load the ranking. {error}</ErrorMessage>
			)}

			{status === "ready" && players.length === 0 && (
				<EmptyMessage className="py-8 text-center">No finished games yet - be the first.</EmptyMessage>
			)}

			{status === "ready" && players.length > 0 && (
				<table className="w-full border-separate border-spacing-y-2">
					<caption className="sr-only">The five players with the most wins</caption>
					<thead>
						<tr>
							<th scope="col" className={`${HEAD} w-[clamp(28px,5vw,56px)] px-5 text-left`}>
								#
							</th>
							<th scope="col" className={`${HEAD} text-left`}>
								PLAYER
							</th>
							<th scope="col" className={`${HEAD} w-[100px] px-2 text-right`}>
								WINS
							</th>
							<th scope="col" className={`${HEAD} w-[100px] px-2 text-right`}>
								WIN %
							</th>
						</tr>
					</thead>
					<tbody>
						{players.map((player, i) => (
							<tr key={player.public_id} className="bg-panel">
								<td className="rounded-l-md border border-r-0 border-white/10 px-5 py-4 font-mono font-bold text-yellow">
									{String(i + 1).padStart(2, "0")}
								</td>
								<td className="border-y border-white/10 py-4">
									<span className="flex min-w-0 items-center gap-3">
										<Avatar src={player.avatar_url} name={player.username} size="xs" />
										<span className="truncate text-white">{player.username}</span>
									</span>
								</td>
								<td className="border-y border-white/10 px-2 text-right font-mono text-white/70">
									{player.games_won}
								</td>
								<td className="rounded-r-md border border-l-0 border-white/10 px-2 text-right font-mono text-white/70">
									{Math.round(player.win_rate)}%
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</section>
	)
}

export default TopFive
