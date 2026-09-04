// Rendered as a full page on /leaderboard, and as a popup when opened from the
// navbar (see routes.jsx). Keep the markup layout-agnostic so it looks right in
// both: no min-h-screen, no fixed positioning — just a centered content block.
import { useMemo, useState } from "react"
import { useAuth } from "@/lib/auth.jsx"

// Defined once in index.css (`.rainbow-shadow` / the --rainbow-* vars).
const RAINBOW = "rainbow-shadow"

// TODO(backend): replace with api.get("/leaderboard") — expect
// [{ username, avatar, wins, losses }, ...]; rank/sort can stay client-side.
const MOCK_PLAYERS = [
	{ username: "simssba", avatar: "/profile/daniel.png", wins: 128, losses: 41 },
	{ username: "feazeved", avatar: "/profile/fifipe.png", wins: 113, losses: 52 },
	{ username: "wallace", avatar: "/profile/wallace.png", wins: 97, losses: 60 },
	{ username: "ana", avatar: "/profile/girl.jpg", wins: 88, losses: 44 },
	{ username: "lucas", avatar: "/profile/alex.png", wins: 74, losses: 71 },
	{ username: "simba", avatar: "/profile/dog.jpg", wins: 63, losses: 39 },
	{ username: "the_duck", avatar: "/profile/duck.jpg", wins: 51, losses: 55 },
	{ username: "roswell", avatar: "/profile/alien.jpg", wins: 44, losses: 48 },
	{ username: "mr_whiskers", avatar: "/profile/cat.jpg", wins: 37, losses: 66 },
	{ username: "guest_11", avatar: "/profile/smiley.jpg", wins: 22, losses: 74 },
	{ username: "newbie", avatar: "/profile/default.jpg", wins: 6, losses: 19 },
]

// How the table can be ordered. `get` pulls the sort value off a derived row.
const SORTS = [
	{ key: "wins", label: "Wins", get: (p) => p.wins },
	{ key: "winRate", label: "Win rate", get: (p) => p.winRate },
	{ key: "games", label: "Games", get: (p) => p.games },
]

const MEDALS = ["🥇", "🥈", "🥉"]

function Leaderboard() {
	const { user } = useAuth()
	const [sortKey, setSortKey] = useState("wins")

	// Derive games / win rate once, then order by the chosen column. Ties fall
	// back to win count so the list stays stable when sorting by rate or games.
	const rows = useMemo(() => {
		const sort = SORTS.find((s) => s.key === sortKey) ?? SORTS[0]
		return MOCK_PLAYERS.map((p) => {
			const games = p.wins + p.losses
			return { ...p, games, winRate: games ? Math.round((p.wins / games) * 100) : 0 }
		})
			.sort((a, b) => sort.get(b) - sort.get(a) || b.wins - a.wins)
			.map((p, i) => ({ ...p, rank: i + 1 }))
	}, [sortKey])

	return (
		<section className="text-white mx-auto w-[min(88vw,860px)] py-2">
			<div className="mb-4 flex flex-wrap items-center gap-3">
				<h2 className="text-2xl font-bold">Leaderboard</h2>
				<span className="text-white/50">{rows.length} players</span>
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

			<ul className="max-h-[50vh] space-y-2 overflow-y-auto pr-1">
				{rows.map((p) => {
					const isMe = p.username === user?.username
					const medal = MEDALS[p.rank - 1]
					return (
						<li key={p.username}>
							<div
								className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-3 rounded-xl border bg-black px-4 py-2.5 sm:grid-cols-[2.5rem_1fr_4rem_4rem_4rem] ${
									p.rank === 1 ? `border-yellow` : isMe ? "border-white" : "border-white/15"
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
		</section>
	)
}

export default Leaderboard
