import { useState } from "react"
import { useNavigate, useParams, useLocation } from "react-router"
import { useAuth } from "@/lib/auth.jsx"
import { computeStructure, FORMATS, MAX_RECOMMENDED_ROUNDS } from "@/lib/tournamentStructure.js"
import { enabledHouseRuleLabels, formatDate, mockTournament, STATUS_COLORS, STATUS_LABELS } from "@/lib/tournaments.js"

function TournamentDetail() {
	const { id } = useParams()
	const location = useLocation()
	const navigate = useNavigate()
	const { user } = useAuth()

	// TODO backend: when state is missing, fetch it with api.get(`/tournaments/${id}`)
	const fromNav = location.state?.tournament
	const tournament = fromNav?.id === id ? fromNav : mockTournament(id)

	const { config } = tournament
	const format = FORMATS[config.format]
	const structure = computeStructure(config)
	const rules = enabledHouseRuleLabels(config.houseRules)

	// TODO backend: POST /tournaments/:id/join, then read the live roster back
	// (and, once matches exist, redirect a signed-up player into their table).
	const [participants, setParticipants] = useState(tournament.participants ?? [])
	const [status, setStatus] = useState(tournament.status)
	const isHost = !!user && tournament.host === user.username
	const joined = !!user && participants.some((p) => p.name === user.username)
	const isFull = participants.length >= config.players

	function joinTournament() {
		if (!user) {
			navigate("/login", { state: { from: `/tournament/${id}` } })
			return
		}
		if (isHost || joined || isFull) return
		setParticipants((ps) => [...ps, { name: user.username, avatar: user.avatar ?? "/profile/default.jpg", isHost: false }])
	}

	// TODO backend: POST /tournaments/:id/start — the server locks the roster,
	// draws the first round's tables and moves everyone into their match.
	function startTournament() {
		if (!isHost || status !== "scheduled" || participants.length < 2) return
		setStatus("ongoing")
	}

	return (
		<section className="text-white mx-auto w-[min(88vw,860px)] py-2">
			<div className="mb-6 flex flex-wrap items-center gap-3">
				<div>
					<h2 className="text-2xl font-bold">{tournament.name}</h2>
					<p className="text-sm text-white/60">
						{format.label} · <span className={STATUS_COLORS[status]}>{STATUS_LABELS[status]}</span>
					</p>
				</div>
				<span className="ml-auto text-sm text-white/50">{formatDate(tournament.createdAt)}</span>
			</div>

			{status === "finished" && tournament.results?.length > 0 && (
				<div className="mb-6">
					<h3 className="mb-3 text-lg font-bold">Final results</h3>
					<ol className="flex flex-wrap gap-3">
						{tournament.results.map((name, i) => (
							<li
								key={name}
								className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2"
							>
								<span className="text-xl">{["🥇", "🥈", "🥉"][i]}</span>
								<span>
									<span className="block text-xs text-white/50">{["1st", "2nd", "3rd"][i]} place</span>
									<span className="font-bold">{name}</span>
								</span>
							</li>
						))}
					</ol>
				</div>
			)}

			<div className="mb-6">
				<h3 className="mb-3 text-lg font-bold">
					Participants <span className="text-sm font-normal text-white/50">{participants.length}/{config.players}</span>
				</h3>
				{participants.length ? (
					<ul className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto rounded-lg border border-white/10 bg-white/5 p-3">
						{participants.map((p) => (
							<li
								key={p.name}
								className={`rounded-md px-2 py-0.5 text-xs ${
									p.name === user?.username ? "bg-blue font-bold text-white" : "bg-white/10 text-white/80"
								}`}
							>
								{p.name}
								{p.isHost && " · host"}
							</li>
						))}
					</ul>
				) : (
					<p className="text-xs text-white/40">No one has signed up yet.</p>
				)}
			</div>

			<div className="grid gap-6 sm:grid-cols-[1fr_auto]">
				<div>
					<h3 className="mb-3 text-lg font-bold">Structure</h3>

					{!structure.converged ? (
						<p role="alert" className="text-sm text-red-400">
							With this table size and this many players advancing, the tournament never reduces to a single final table.
						</p>
					) : (
						<>
							<ol className="space-y-2">
								{structure.rounds.map((r) => (
									<li
										key={r.round}
										className="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
									>
										{r.isFinal ? (
											<span className="font-bold">Final — {r.players} players</span>
										) : (
											<span>
												<span className="font-bold">Round {r.round}</span> — {r.players} players · {r.tables} tables → {r.advancing} advance
											</span>
										)}
									</li>
								))}
							</ol>
							{structure.tooManyRounds && (
								<p className="mt-2 text-sm text-amber-400">
									Heads up: {structure.totalRounds} rounds is more than recommended ({MAX_RECOMMENDED_ROUNDS}).
								</p>
							)}
						</>
					)}
				</div>

				<aside className="rounded-xl border border-white/10 bg-white/5 p-4 sm:w-64">
					<h3 className="mb-3 text-lg font-bold">Settings</h3>
					<dl className="space-y-1 text-sm">
						<div className="flex justify-between gap-2">
							<dt className="text-white/90">Players</dt>
							<dd>{config.players}</dd>
						</div>
						<div className="flex justify-between gap-2">
							<dt className="text-white/90">Players per table</dt>
							<dd>{config.playersPerTable}</dd>
						</div>
						<div className="flex justify-between gap-2">
							<dt className="text-white/90">Advance per table</dt>
							<dd>{config.advancePerTable}</dd>
						</div>
						<div className="flex justify-between gap-2">
							<dt className="text-white/90">Starting cards</dt>
							<dd>{config.startingCards}</dd>
						</div>
						<div className="flex justify-between gap-2">
							<dt className="text-white/90">Turn timer</dt>
							<dd>{config.turnTimeSeconds}s</dd>
						</div>
						{config.format === "knockout" ? (
							<div className="flex justify-between gap-2">
								<dt className="text-white/90">Final</dt>
								<dd>{config.finalBestOf3 ? "Best of 3" : "1 match"}</dd>
							</div>
						) : (
							<>
								<div className="flex justify-between gap-2">
									<dt className="text-white/90">Matches per round</dt>
									<dd>{config.matchesPerRound}</dd>
								</div>
								<div className="flex justify-between gap-2">
									<dt className="text-white/90">Matches in the final</dt>
									<dd>{config.matchesInFinal}</dd>
								</div>
							</>
						)}
					</dl>

					<h4 className="mb-2 mt-4 text-sm text-white/90">House rules</h4>
					{rules.length ? (
						<ul className="flex flex-wrap gap-1.5">
							{rules.map((label) => (
								<li key={label} className="rounded-md bg-blue/80 px-2 py-0.5 text-xs text-white">
									{label}
								</li>
							))}
						</ul>
					) : (
						<p className="text-xs text-white/40">Classic rules only.</p>
					)}
				</aside>
			</div>

			<div className="mt-8 flex items-center justify-center gap-3">
				<button
					type="button"
					onClick={() => navigate("/tournament")}
					className="rounded-lg border border-white px-5 py-2 font-bold transition-transform hover:scale-105 cursor-pointer"
				>
					Back
				</button>
				{status === "finished" ? (
					<span className="rounded-lg border border-white/10 px-5 py-2 text-sm text-white/40">Tournament finished</span>
				) : status === "ongoing" ? (
					<span className="rounded-lg border border-white/10 px-5 py-2 text-sm text-white/40">Tournament in progress</span>
				) : isHost ? (
					<button
						type="button"
						onClick={startTournament}
						disabled={participants.length < 2}
						title={participants.length < 2 ? "Needs at least 2 participants to start" : undefined}
						className="rounded-lg bg-white px-5 py-2 font-bold text-black transition-transform hover:scale-105 cursor-pointer disabled:opacity-40 disabled:hover:scale-100"
					>
						Start tournament
					</button>
				) : (
					<button
						type="button"
						onClick={joinTournament}
						disabled={joined || isFull}
						className="rounded-lg bg-white px-5 py-2 font-bold text-black transition-transform hover:scale-105 cursor-pointer disabled:opacity-40 disabled:hover:scale-100"
					>
						{joined ? "You're in" : isFull ? "Tournament full" : "Join tournament"}
					</button>
				)}
			</div>
		</section>
	)
}

export default TournamentDetail
