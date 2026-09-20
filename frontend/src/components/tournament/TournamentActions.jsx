import Button from "@/components/ui/Button.jsx"
import ButtonLink from "@/components/ui/ButtonLink.jsx"
import { ErrorMessage } from "@/components/ui/Message.jsx"
import { isEntered } from "@/lib/tournaments.js"

// What you can do about this tournament, worked out from the tournament itself
// and who you are. Nothing here is stored: `joined`, `isHost` and `isFull` are
// derived on every render, so they cannot drift from the roster above them.
//
// Back is a `<Link>` because it navigates; everything else is a real `<button>`
// because it acts.
//
// The server guards every one of these again. A button being disabled here is
// not the rule — it is the rule made visible, and the error it would have
// returned said out loud before it is provoked.
// Keyed on status, but read through the `pending` check below rather than
// directly: `Tournament.status` is a `GameStatus` and can hold any of the four,
// `cancelled` included (`lib/contracts.test.js` pins that). Only a pending
// tournament can be joined or started — the server refuses anything else with
// "Registration is closed." — so anything that is not pending gets a note, and a
// status nobody thought of still cannot produce a live Join button.
const NOTES = {
	in_progress: "Tournament in progress",
	finished: "Tournament finished",
	cancelled: "Tournament canceled",
}

const MIN_TO_START = 2

function TournamentActions({ tournament, myUsername, busy, error, onJoin, onLeave, onStart }) {
	const isHost = Boolean(myUsername) && tournament.created_by?.username === myUsername
	const joined = isEntered(tournament, myUsername)
	const isFull = tournament.participant_count >= tournament.max_participants
	const canStart = tournament.participant_count >= MIN_TO_START
	const note = tournament.status === "pending" ? null : (NOTES[tournament.status] ?? "Tournament closed")

	return (
		<div className="flex flex-col items-center gap-3 pt-3">
			<div className="flex flex-wrap items-center justify-center gap-3.5">
				<ButtonLink to="/tournament" variant="small" className="px-[26px] py-4 font-logo text-base">
					Back
				</ButtonLink>

				{note ? (
					<p className="rounded-md border-2 border-white/10 px-[26px] py-4 font-mono text-[13px] text-muted">
						{note}
					</p>
				) : isHost ? (
					<Button color="green" onClick={onStart} disabled={busy || !canStart} className="px-[30px] py-4 text-[17px]">
						{busy ? "Starting…" : "Start tournament"}
					</Button>
				) : (
					<>
						<Button
							color="white"
							onClick={onJoin}
							disabled={busy || joined || isFull}
							className="px-[30px] py-4 text-[17px]"
						>
							{joined ? "You're in" : isFull ? "Tournament full" : busy ? "Joining…" : "Join tournament"}
						</Button>
						{/* The only way back out of a tournament you signed up for by
						    mistake. It is the quiet button on purpose: the loud one
						    still says where you stand. */}
						{joined && (
							<Button variant="small" onClick={onLeave} disabled={busy} className="px-6 py-3.5 text-sm">
								Leave tournament
							</Button>
						)}
					</>
				)}
			</div>

			{/* Said out loud instead of hidden in a `title` tooltip, which a keyboard
			    or touch user never sees — and a disabled button can't be hovered. */}
			{!note && isHost && !canStart && (
				<p className="font-mono text-[13px] text-muted">
					Needs at least {MIN_TO_START} participants to start.
				</p>
			)}

			{error && <ErrorMessage>{error}</ErrorMessage>}
		</div>
	)
}

export default TournamentActions
