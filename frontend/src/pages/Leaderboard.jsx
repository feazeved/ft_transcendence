import { useEffect, useState } from "react"
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable.jsx"
import Pager from "@/components/leaderboard/Pager.jsx"
import PageHeader from "@/components/ui/PageHeader.jsx"
import { EmptyMessage, ErrorMessage, Loading } from "@/components/ui/Message.jsx"
import { getLeaderboard } from "@/lib/leaderboard.js"
import { useAuth } from "@/lib/auth.jsx"

const PAGE_SIZE = 25

const SORTS = [
	{ key: "wins", label: "Wins" },
	{ key: "win_rate", label: "Win rate" },
	{ key: "games", label: "Games" },
]

function Leaderboard() {
	const { user } = useAuth()
	const [page, setPage] = useState(1)
	const [ordering, setOrdering] = useState("wins")
	const [data, setData] = useState({ count: 0, results: [] })
	const [status, setStatus] = useState("loading")
	const [error, setError] = useState("")

	// Runs again whenever the page or the ordering changes. It doesn't set
	// "loading" itself — the click that changed the page or the ordering does,
	// which keeps the effect from starting a second render before it has data.
	useEffect(() => {
		let ignore = false

		getLeaderboard({ page, pageSize: PAGE_SIZE, ordering })
			.then((result) => {
				// Click page 2 then page 3 quickly and page 2's answer can land last.
				// The cleanup below flips `ignore`, so the stale one is dropped.
				if (ignore) return
				setData({ count: result.count ?? 0, results: result.results ?? [] })
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
	}, [page, ordering])

	const pickSort = (key) => {
		if (key === ordering) return
		setStatus("loading")
		setOrdering(key)
		// A different order means a different page 1.
		setPage(1)
	}

	const goToPage = (next) => {
		if (next === page) return
		setStatus("loading")
		setPage(next)
	}

	return (
		<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-[clamp(16px,4vw,24px)] pb-[clamp(48px,8vw,88px)] pt-[clamp(28px,6vw,56px)]">
			<PageHeader
				eyebrow="LEADERBOARD"
				eyebrowColor="green"
				title="Leaderboard"
				count={status === "ready" ? `${data.count.toLocaleString("en-US")} PLAYERS` : undefined}
			>
				<div className="flex gap-2 rounded-lg border border-white/10 bg-panel p-1.5">
					{SORTS.map((sort) => (
						<button
							key={sort.key}
							type="button"
							onClick={() => pickSort(sort.key)}
							aria-pressed={ordering === sort.key}
							className={`cursor-pointer rounded-md border-2 px-[18px] py-2.5 font-logo text-sm font-semibold transition-colors ${
								ordering === sort.key
									? "border-yellow bg-yellow text-on-yellow"
									: "border-transparent text-dim hover:border-line-strong hover:text-white"
							}`}
						>
							{sort.label}
						</button>
					))}
				</div>
			</PageHeader>

			{status === "loading" && <Loading className="py-12 text-center">Loading...</Loading>}

			{status === "error" && (
				<ErrorMessage className="py-12 text-center">Couldn't load the leaderboard. {error}</ErrorMessage>
			)}

			{status === "ready" && data.results.length === 0 && (
				<EmptyMessage className="py-12 text-center">No finished games yet - be the first.</EmptyMessage>
			)}

			{status === "ready" && data.results.length > 0 && (
				<>
					<LeaderboardTable
						players={data.results}
						page={page}
						pageSize={PAGE_SIZE}
						myUsername={user?.username}
					/>
					<Pager page={page} pageSize={PAGE_SIZE} count={data.count} onPage={goToPage} />
				</>
			)}
		</div>
	)
}

export default Leaderboard
