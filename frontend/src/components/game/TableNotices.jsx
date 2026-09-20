// What just happened, in words: "Direction reversed ←", "You drew 3 cards".
//
// The backend sends no events, only whole game states, so these are worked out by
// comparing the old state with the new one — `gameNotices` in lib/game.js, where
// the rules are tested. This component only shows what it is handed.
//
// aria-live="polite" is the reason this is a list and not a toast: it is the only
// way somebody who can't see the table learns that the direction flipped. Polite,
// so it waits for the screen reader to finish whatever it was saying.
function TableNotices({ notices }) {
	return (
		<ul aria-live="polite" className="flex flex-none flex-col items-center gap-2 empty:hidden">
			{notices.map(({ id, text }) => (
				<li
					key={id}
					className="rounded-full border border-blue bg-blue/10 px-[18px] py-2.5 font-mono text-[13px] tracking-[0.04em] text-blue-soft"
				>
					{text}
				</li>
			))}
		</ul>
	)
}

export default TableNotices
