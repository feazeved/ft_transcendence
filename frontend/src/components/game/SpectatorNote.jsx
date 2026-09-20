// What a spectator gets where the hand would be. No cards, nothing to click: the
// payload never carries a hand for someone who isn't seated, so there is nothing
// to hide — the table simply has no hand to draw.
function SpectatorNote({ count = 0 }) {
	return (
		<section className="flex flex-col items-center gap-2 rounded-lg border border-white/10 border-t-4 border-t-blue bg-panel p-[clamp(12px,2vh,22px)]">
			<h2 className="font-title text-[22px] font-bold text-white">You're watching this game.</h2>
			<p className="font-mono text-xs tracking-[0.14em] text-muted">{count} WATCHING</p>
		</section>
	)
}

export default SpectatorNote
