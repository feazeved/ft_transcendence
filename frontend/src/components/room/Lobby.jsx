import { useState } from "react"
import { enabledRuleLabels } from "@/lib/rooms.js"
import cardVerse from "@/assets/one_card_verse.svg"
import table from "@/assets/table-2.png"

const RAINBOW = "rainbow-shadow"

// The room while it is still filling up: seats around the table, the settings
// panel, the spectator list, and the host's start button.
//
// Like GameTable, this takes everything as props and reaches for nothing on its
// own — the actions are handed down so the page stays the only thing that knows
// how to talk to the server.
function Lobby({ lobby, user, connected, error, onSeat, onSpectate, onStart, onLeave }) {
	const [copied, setCopied] = useState(false)

	const seats = lobby.seats
	const spectators = lobby.spectators
	const mySeat = lobby.your_seat
	const amSpectator = lobby.you_are_spectating
	const isHost = lobby.host === user.username
	const rules = enabledRuleLabels(lobby.settings)
	const seatCount = seats.length
	const seated = seats.filter(Boolean).length
	const spectatorsFull = spectators.length >= lobby.max_spectators

	const copyCode = async () => {
		try {
			await navigator.clipboard.writeText(lobby.code)
			setCopied(true)
			setTimeout(() => setCopied(false), 1500)
		} catch {
			/* clipboard blocked — the code is visible next to the button anyway */
		}
	}

	return (
		<section className="text-white mx-auto w-[min(88vw,860px)] py-2">
			<div className="mb-6 flex flex-wrap items-center gap-3">
				<div>
					<h2 className="text-2xl font-bold">{lobby.name}</h2>
					<p className="text-sm text-white/60">
						Hosted by {lobby.host}
						{!connected && <span className="ml-2 text-yellow">· reconnecting…</span>}
					</p>
				</div>
				<button
					type="button"
					onClick={copyCode}
					className="ml-auto flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm transition-transform hover:scale-105 cursor-pointer"
					aria-label="Copy room id"
				>
					<span className="text-white/50">Room id</span>
					<span className="font-bold tracking-widest">{lobby.code}</span>
					<span className="text-white/50">{copied ? "copied!" : "⧉"}</span>
				</button>
			</div>

			<div className="grid gap-6 sm:grid-cols-[1fr_auto]">
				<div>
					<h3 className="mb-3 text-lg font-bold">
						Players <span className="text-white/50">{seated}/{seatCount}</span>
					</h3>

					{amSpectator && (
						<p className="mb-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white/70">
							You're spectating. Take a free seat to join the game.
						</p>
					)}

					{/* Chairs laid out around table.png: each is placed on a circle
					    by its index. A free chair is a button that seats you in it. */}
					<div className="relative mx-auto aspect-square w-full max-w-150">
						<img
							src={table}
							alt=""
							className="pointer-events-none absolute left-1/2 top-1/2 w-[58%] -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-[0_16px_40px_rgba(0,0,0,0.55)]"
						/>
						{seats.map((player, i) => {
							const mine = mySeat === i
							const canSit = !player
							const spin = (360 / seatCount) * i
							return (
								<div
									key={i}
									className="pointer-events-none absolute inset-0"
									style={{ transform: `rotate(${spin}deg)` }}
								>
									<div className="absolute left-1/2 top-[3%] w-[22%] -translate-x-1/2">
										<button
											type="button"
											disabled={!canSit}
											onClick={() => onSeat(i)}
											aria-label={
												player
													? `Seat ${i + 1}: ${player.username}${player.is_host ? " (host)" : ""}`
													: `Sit in seat ${i + 1}`
											}
											style={{ transform: `rotate(${-spin}deg)` }}
											className={`group pointer-events-auto flex w-full flex-col items-center gap-1.5 text-center ${
												canSit ? "cursor-pointer" : ""
											}`}
										>
											<span
												className={`relative flex aspect-square w-[55%] min-w-11 items-center justify-center rounded-full ${
													mine ? RAINBOW : ""
												}`}
											>
												<span
													className={`flex h-full w-full items-center justify-center overflow-hidden rounded-full border bg-white/5 transition ${
														mine
															? "border-blue-700"
															: player
																? player.is_connected
																	? "border-white/20"
																	: "border-white/10 opacity-50"
																: "border-dashed border-white/30 group-hover:scale-105 group-hover:border-white"
													}`}
												>
													{player ? (
														<img src={player.avatar_url} alt="" className="h-full w-full object-cover" />
													) : (
														<img src={cardVerse} alt="" className="w-1/3 opacity-60" />
													)}
												</span>
												{player?.is_host && (
													<span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
														host
													</span>
												)}
											</span>
											<span className="w-full truncate text-sm font-bold leading-tight">
												{player ? player.username : "Sit here"}
											</span>
										</button>
									</div>
								</div>
							)
						})}
					</div>
				</div>

				<aside className="rounded-xl border border-white/10 bg-white/5 p-4 sm:w-56">
					<h3 className="mb-3 text-lg font-bold">Settings</h3>
					<dl className="space-y-1 text-sm">
						<div className="flex justify-between gap-2">
							<dt className="text-white/90">Max players</dt>
							<dd>{lobby.settings.max_seats}</dd>
						</div>
						<div className="flex justify-between gap-2">
							<dt className="text-white/90">Starting hand</dt>
							<dd>{lobby.settings.starting_hand_size}</dd>
						</div>
						<div className="flex justify-between gap-2">
							<dt className="text-white/90">Turn timer</dt>
							<dd>{lobby.settings.turn_timer_seconds}s</dd>
						</div>
					</dl>
					<h4 className="mb-2 mt-4 text-sm text-white/90">Optional rules</h4>
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

					<h4 className="mb-2 mt-4 text-sm text-white/90">
						Spectators{" "}
						<span className="text-white/50">
							{spectators.length}/{lobby.max_spectators}
						</span>
					</h4>
					{!lobby.settings.allow_spectators ? (
						<p className="text-xs text-white/40">Spectating is off for this room.</p>
					) : spectators.length ? (
						<ul className="space-y-1 text-sm">
							{spectators.map((s) => (
								<li
									key={s.username}
									className={`truncate ${s.username === user.username ? "font-bold text-white" : "text-white/70"}`}
								>
									{s.username}
								</li>
							))}
						</ul>
					) : (
						<p className="text-xs text-white/40">No one's watching.</p>
					)}

					{mySeat !== null && lobby.settings.allow_spectators && (
						<button
							type="button"
							onClick={onSpectate}
							disabled={spectatorsFull}
							className="mt-4 w-full rounded-lg border border-white px-3 py-2 text-sm font-bold transition-transform hover:scale-105 cursor-pointer disabled:opacity-40 disabled:hover:scale-100"
						>
							{spectatorsFull ? "Spectators full" : "Spectate"}
						</button>
					)}
				</aside>
			</div>

			{error && (
				<p role="alert" className="mt-4 text-center text-sm text-red-400">
					{error}
				</p>
			)}

			<div className="mt-8 flex items-center justify-center gap-3">
				<button
					type="button"
					onClick={onLeave}
					className="rounded-lg border border-white px-5 py-2 font-bold transition-transform hover:scale-105 cursor-pointer"
				>
					Leave room
				</button>
				{isHost && (
					<button
						type="button"
						onClick={onStart}
						disabled={seated < 2}
						className="rounded-lg bg-white px-5 py-2 font-bold text-black transition-transform hover:scale-105 cursor-pointer disabled:opacity-40 disabled:hover:scale-100"
					>
						Start game
					</button>
				)}
			</div>
		</section>
	)
}

export default Lobby
