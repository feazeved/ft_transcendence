import { Link } from "react-router"
import cards from "@/assets/cards.svg"

// The big 404 is decoration: aria-hidden keeps a screen reader from reading
// "4, 0, 4" before the actual heading. The way back is one link with everything
// inside it, so it is announced once, as "Back to the table…".
function NotFound() {
	return (
		<section className="flex flex-1 flex-col items-center justify-center gap-[26px] px-6 py-20 text-center">
			<p aria-hidden="true" className="flex select-none font-logo text-[clamp(96px,16vw,168px)] font-extrabold leading-none">
				<span className="text-red">4</span>
				<span className="text-yellow">0</span>
				<span className="text-blue">4</span>
			</p>

			<h1 className="font-title text-[clamp(32px,4vw,44px)] font-extrabold text-white">No such card in this deck</h1>

			<p className="max-w-[540px] text-[18px] leading-relaxed text-white/70 text-pretty">
				You tried to play a card that doesn't exist. House rules say that's an automatic penalty draw &mdash; lucky for
				you, the way back is free.
			</p>

			<Link
				to="/"
				className="flex w-[min(100%,320px)] flex-col items-center gap-3.5 rounded-lg border border-white/10 border-t-4 border-t-green bg-panel px-[26px] py-[30px] transition-colors hover:border-green focus-visible:border-green"
			>
				<img src={cards} alt="" className="h-[88px] w-[88px]" />
				<span className="font-title text-2xl font-bold text-white">Back to the table</span>
				<span className="text-[15px] text-white/70">Draw yourself back into the game.</span>
			</Link>
		</section>
	)
}

export default NotFound
