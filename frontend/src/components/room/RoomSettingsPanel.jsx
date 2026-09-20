import HouseRuleChips from "@/components/room/HouseRuleChips.jsx"
import { MAX_SPECTATORS } from "@/lib/rooms.js"

const SPECTATE =
	"cursor-pointer rounded-md border-2 border-line-strong px-[18px] py-3.5 font-logo text-sm font-semibold text-soft transition-colors hover:border-white hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:border-line-strong disabled:hover:text-soft"

// How the room is set up, and who is watching it.
//
// An <aside> with a <dl>: three label/value pairs are a description list, which is
// what the HTML is for. The house rules are chips (HouseRuleChips, which the
// tournament pages reuse), never "Optional rules".
//
// Everything here copes with a field that hasn't arrived. The backend has sent
// the full shape since 2026-09-18 (§1.1), so in practice every branch below takes
// the good path — but they stay: a client is served from a CDN and outlives the
// server it was built against, so during a deploy it can be talking to the older
// one. Reading `spectators` as either a list or a count, falling back to the
// frontend's own MAX_SPECTATORS and showing a dash for a missing number all cost
// nothing and turn a blank panel into a slightly thinner one. "No one's
// watching." is only ever said when the count agrees: with a count but no list,
// the heading's "2/6" says it all, and a contradiction would be worse than
// saying nothing.
function RoomSettingsPanel({ lobby, user, onSpectate }) {
	const settings = lobby.settings ?? {}
	const list = Array.isArray(lobby.spectators) ? lobby.spectators : []
	const count = Array.isArray(lobby.spectators) ? lobby.spectators.length : lobby.spectators ?? 0
	const max = lobby.max_spectators ?? MAX_SPECTATORS
	const full = count >= max
	const seated = lobby.your_seat !== null && lobby.your_seat !== undefined

	return (
		<aside className="flex flex-[0_1_300px] flex-col gap-5 rounded-lg border border-white/10 border-t-4 border-t-green bg-panel p-6">
			<h2 className="font-logo text-[19px] font-bold text-white">Settings</h2>

			<dl className="flex flex-col gap-[11px] text-sm">
				<div className="flex items-baseline justify-between gap-3">
					<dt className="text-white/70">Max players</dt>
					<dd className="font-mono text-white">{settings.max_seats ?? "—"}</dd>
				</div>
				<div className="flex items-baseline justify-between gap-3">
					<dt className="text-white/70">Starting hand</dt>
					<dd className="font-mono text-white">{settings.starting_hand_size ?? "—"}</dd>
				</div>
				<div className="flex items-baseline justify-between gap-3">
					<dt className="text-white/70">Turn timer</dt>
					<dd className="font-mono text-white">
						{settings.turn_timer_seconds ? `${settings.turn_timer_seconds}s` : "—"}
					</dd>
				</div>
			</dl>

			<div className="flex flex-col gap-2.5 border-t border-white/10 pt-4">
				<h3 className="text-sm text-white/70">House rules</h3>
				<HouseRuleChips settings={settings} />
			</div>

			<div className="flex flex-col gap-2.5 border-t border-white/10 pt-4">
				<h3 className="text-sm text-white/70">
					Spectators <span className="font-mono text-[13px] text-muted">{count}/{max}</span>
				</h3>
				{settings.allow_spectators === false ? (
					<p className="font-mono text-xs text-muted">Spectating is off for this room.</p>
				) : list.length > 0 ? (
					<ul className="flex flex-col gap-1.5">
						{list.map((spectator) => (
							<li
								key={spectator.username}
								className={`truncate font-mono text-[13px] ${
									spectator.username === user?.username ? "font-bold text-white" : "text-white/70"
								}`}
							>
								{spectator.username}
							</li>
						))}
					</ul>
				) : count === 0 ? (
					<p className="font-mono text-xs text-muted">No one's watching.</p>
				) : null}
			</div>

			{/* Only someone holding a seat has anything to switch to. */}
			{seated && settings.allow_spectators !== false && (
				<button type="button" onClick={onSpectate} disabled={full} className={SPECTATE}>
					{full ? "Spectators full" : "Spectate"}
				</button>
			)}
		</aside>
	)
}

export default RoomSettingsPanel
