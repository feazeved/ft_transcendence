import { Link } from "react-router"
import BrandMark from "@/components/ui/BrandMark.jsx"

const LEAVE =
	"rounded-md border-2 border-line-strong px-[18px] py-2.5 font-logo text-[13px] font-semibold text-soft transition-colors hover:border-red hover:text-red-soft"

// The table's own header, in place of the site header: the room code, how many
// people are watching, and the way out. The game needs the height, so this is
// everything it gets.
//
// Leave game is a real button since §2.6: it tells the server first, so the seat
// goes quiet for everyone else straight away instead of looking present until the
// socket happens to drop. The seat itself stays — the hand is dealt and the match
// history reads it — and the turn timer carries the game past whoever left.
function GameHeader({ code, watching = 0, onLeave }) {
	return (
		<header className="flex-none border-b border-line bg-bar">
			<div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-[18px] gap-y-3 px-[clamp(14px,4vw,24px)] py-[clamp(8px,1.4vh,14px)]">
				<Link to="/" aria-label="ONE, home">
					<BrandMark />
				</Link>
				{/* The table shows no title, but the page still needs one h1 for the
				    headings below it to hang off. */}
				<h1 className="sr-only">Game in room {code}</h1>
				<div className="flex flex-wrap items-center gap-3">
					<p className="font-mono text-xs tracking-[0.14em] text-muted">ROOM {code}</p>
					<p className="font-mono text-xs tracking-[0.14em] text-muted">{watching} WATCHING</p>
					<button type="button" onClick={onLeave} className={LEAVE}>
						Leave game
					</button>
				</div>
			</div>
		</header>
	)
}

export default GameHeader
