import { useEffect, useMemo, useState } from "react"
import { useAuth } from "@/lib/auth.jsx"
import api from "@/lib/api.js"

const SORTS = [
	{ key: "wins", label: "Wins", get: (p) => p.wins },
	{ key: "winRate", label: "Win rate", get: (p) => p.winRate },
	{ key: "games", label: "Games", get: (p) => p.games },
]

const MEDALS = ["🥇", "🥈", "🥉"]

function Leaderboard() {
	const { user } = useAuth()
	const [sortKey, setSortKey] = useState("wins")
	const [players, setPlayers] = useState([])
	const [status, setStatus] = useState("loading")
	const [error, setError] = useState("")

	useEffect(() => {
		let ignore = false

		async function load() {
			try {
				const data = await api.get("/leaderboard/?page_size=100")
				if (ignore) return
				setPlayers(data.results ?? [])
				setStatus("ready")
			} catch (err) {
				if (ignore) return
				setError(err.message)
				setStatus("error")
			}
		}

		load()
		return () => {
			ignore = true
		}
	}, [])

	const rows = useMemo(() => {
		const sort = SORTS.find((s) => s.key === sortKey) ?? SORTS[0]
		return players
			.map((p) => ({
				id: p.public_id,
				username: p.username,
				avatar: p.avatar_url,
				games: p.games_played,
				wins: p.games_won,
				losses: p.games_played - p.games_won,
				winRate: Math.round(p.win_rate),
			}))
			.sort((a, b) => sort.get(b) - sort.get(a) || b.wins - a.wins)
			.map((p, i) => ({ ...p, rank: i + 1}))
	}, [players, sortKey])

	return (
		<section className="text-white mx-auto w-[min(88vw,860px)] py-2">
			<div className="mb-4 flex flex-wrap items-center gap-3">
				<h2 className="text-2xl font-bold">Leaderboard</h2>
				{status === "ready" && <span className="text-white/50">{rows.length} players</span>}
				<div className="ml-auto flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 p-1 text-sm">
					{SORTS.map((s) => (
						<button
							key={s.key}
							type="button"
							onClick={() => setSortKey(s.key)}
							aria-pressed={sortKey === s.key}
							className={`rounded-md px-3 py-1 transition-transform hover:scale-105 cursor-pointer ${
								sortKey === s.key ? "bg-white font-bold text-black" : "text-white/70"
							}`}
						>
							{s.label}
						</button>
					))}
				</div>
			</div>

			{/* Column headers — hidden on narrow screens where the stats wrap under
			    the name. */}
			<div className="mb-2 hidden grid-cols-[2.5rem_1fr_4rem_4rem_4rem] gap-3 px-4 text-xs uppercase tracking-wide text-white/40 sm:grid">
				<span>#</span>
				<span>Player</span>
				<span className="text-right">Wins</span>
				<span className="text-right">Losses</span>
				<span className="text-right">Rate</span>
			</div>

			{status === "loading" && (
				<p className="py-8 text-center text-white/50">Loading...</p>
			)}

			{status === "error" && (
				<p role="alert" className="py-8 text-center text-red">
					Couldn't load the leaderboard. {error}
				</p>
			)}

			{status === "ready" && rows.length === 0 && (
				<p className="py-8 text-center text-white/50">
					No finished games yet - be the first.
				</p>
			)}

			{status === "ready" && rows.length > 0 && (
				<ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
					{rows.map((p) => {
						const isMe = p.username === user?.username
						const medal = MEDALS[p.rank - 1]
						return (
							<li key={p.id}>
								<div
									className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-xl border bg-black px-4 py-2.5 sm:grid-cols-[2.5rem_1fr_4rem_4rem_4rem] ${p.rank === 1 ? `border-yellow` : isMe ? "border-white" : "border-white/15"
										}`}
								>
									<span className="text-center text-lg font-bold">
										{medal ?? <span className="text-white/50">{p.rank}</span>}
									</span>

									<span className="flex min-w-0 items-center gap-3">
										<img
											src={p.avatar}
											alt=""
											className="h-9 w-9 shrink-0 rounded-full border border-white/20 object-cover"
										/>
										<span className="min-w-0">
											<span className="block truncate font-bold leading-tight">
												{p.username}
												{isMe && <span className="ml-2 text-xs text-yellow">you</span>}
											</span>
											{/* Narrow-screen stat line; the sm: columns replace it. */}
											<span className="text-xs text-white/50 sm:hidden">
												{p.wins}W · {p.losses}L · {p.winRate}%
											</span>
										</span>
									</span>

									<span className="hidden text-right font-bold text-green sm:block">{p.wins}</span>
									<span className="hidden text-right text-white/70 sm:block">{p.losses}</span>
									<span className="hidden text-right font-bold sm:block">{p.winRate}%</span>
								</div>
							</li>
						)
					})}
				</ul>
			)}
		</section>
	)
}

export default Leaderboard
