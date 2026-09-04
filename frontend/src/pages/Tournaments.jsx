// Rendered as a full page on /tournament, and as a popup when opened from the
// navbar (see routes.jsx). Keep the markup layout-agnostic so it works in both.
import { useState } from "react"
import { useNavigate } from "react-router"
import CreateTournamentModal from "@/components/CreateTournamentModal.jsx"
import { useAuth } from "@/lib/auth.jsx"
import { buildTournament, formatDate, mockTournaments, STATUS_COLORS, STATUS_LABELS } from "@/lib/tournaments.js"
import { FORMATS } from "@/lib/tournamentStructure.js"

function Tournaments() {
	const navigate = useNavigate()
	const { user } = useAuth()
	const [tournaments, setTournaments] = useState(mockTournaments)
	const [creating, setCreating] = useState(false)

	function handleCreate({ name, config }) {
		const tournament = buildTournament({ name, host: user?.username ?? "you", avatar: user?.avatar, config })
		// TODO backend: POST /tournaments/ with { name, ...config }, use the
		// returned tournament instead of the client-built one.
		setTournaments((ts) => [tournament, ...ts])
		setCreating(false)
		navigate(`/tournament/${tournament.id}`, { state: { tournament } })
	}

	function openTournament(tournament) {
		navigate(`/tournament/${tournament.id}`, { state: { tournament } })
	}

	return (
		<section className="text-white mx-auto w-[min(88vw,860px)] py-2">
			<h2 className="mb-4 text-2xl font-bold">Tournaments</h2>

			<ul className="grid max-h-[52vh] grid-cols-2 gap-3 overflow-y-auto p-6 sm:grid-cols-3">
				{tournaments.map((t) => (
					<li key={t.id}>
						<button
							type="button"
							onClick={() => openTournament(t)}
							className="flex w-full flex-col items-center gap-2 rounded-xl border border-white bg-black p-4 text-center transition-transform hover:scale-105 cursor-pointer"
						>
							<span className="font-bold leading-tight">{t.name}</span>
							<span className="text-sm text-white/70">{FORMATS[t.config.format].label}</span>
							<span className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-sm text-white/70">
								<span>👤 {t.participants.length}/{t.config.players}</span>
								<span className={STATUS_COLORS[t.status]}>{STATUS_LABELS[t.status]}</span>
							</span>
							<span className="text-xs text-white/50">{formatDate(t.createdAt)}</span>
						</button>
					</li>
				))}
				{tournaments.length === 0 && (
					<li className="col-span-full py-8 text-center text-white/50">No tournaments yet.</li>
				)}
			</ul>

			<div className="mt-5 flex justify-center">
				<button
					type="button"
					onClick={() => setCreating(true)}
					className="rounded-lg border border-white px-5 py-2 font-bold transition-transform hover:scale-105 cursor-pointer"
				>
					Create tournament
				</button>
			</div>

			<CreateTournamentModal
				key={creating ? "open" : "closed"}
				open={creating}
				onClose={() => setCreating(false)}
				onCreate={handleCreate}
			/>
		</section>
	)
}

export default Tournaments
