import { Link } from "react-router"

const BACK =
	"flex-none rounded-md border-2 border-white px-[26px] py-[15px] font-logo text-[15px] font-bold text-white transition-colors hover:bg-white hover:text-page"

// The end of a game: who won, and the way out.
//
// There are two ways out, because there are two kinds of table.
//
// An ordinary room offers a rematch, and "Back to room" is a button and not a
// link because it *acts*: the room has to be reopened before there is anything
// to go back to (§2.5), and the URL never changes — the code now points at the
// fresh lobby, so the table simply becomes the lobby again under the same
// address. Pressing it when somebody else already has is harmless; the server
// hands back the room they made.
//
// A tournament table offers neither: a rematch would be a room outside the
// round, and what happens next is decided by the tournament — the next round's
// tables are created the moment the last match of this one finishes. So it is a
// link back to the tournament, which is the page that knows where to send
// everybody. Without it a round ended with the players sitting at a dead table
// and no way to reach the next one.
function ResultPanel({ winner, iWon, onRematch, busy = false, tournamentCode = null }) {
	const accent = iWon ? "border-t-green" : "border-t-blue"
	const eyebrow = iWon ? "text-green-soft" : "text-blue-soft"
	const who = iWon ? "You" : winner

	return (
		<section
			className={`flex flex-wrap items-center justify-between gap-4 rounded-lg border border-white/10 border-t-4 bg-panel p-[clamp(12px,2vh,22px)] ${accent}`}
		>
			<div className="flex min-w-0 flex-col gap-2">
				<p className={`font-mono text-[11px] tracking-[0.18em] ${eyebrow}`}>{iWon ? "YOU WON" : "GAME OVER"}</p>
				<h2 className="font-title text-[clamp(24px,5vw,30px)] font-extrabold text-white">
					{iWon ? "You won" : `${winner} won`}
				</h2>
				<p className="font-mono text-[13px] text-white/70">{who} went out first.</p>
				<p className="font-mono text-[13px] text-muted">
					{tournamentCode ? "The tournament decides what happens next." : "The room stays open for a rematch."}
				</p>
			</div>
			{tournamentCode ? (
				<Link to={`/tournament/${tournamentCode}`} className={BACK}>
					Back to the tournament
				</Link>
			) : (
				<button type="button" onClick={onRematch} disabled={busy} className={BACK}>
					{busy ? "Opening…" : "Back to room"}
				</button>
			)}
		</section>
	)
}

export default ResultPanel
