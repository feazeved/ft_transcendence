// The five house rules, under the names CONTEXT.md fixes. The design's themed
// names survive as a subtitle, never on their own.
//
// The design opens a rule on hover, which leaves out anyone on a phone or a
// keyboard. <details>/<summary> is the same open-and-close, built into the
// browser: click, Enter or Space, and it is announced as expandable.
const RULES = [
	{
		title: "Stacking draw cards",
		themed: "Stacking +2",
		color: "bg-red",
		body: "Instead of drawing, you may answer a +2 with another +2, or a +4 with another +4. The total stacks and passes along: 2 → 4 → 6, and so on. Whoever cannot answer draws the whole accumulated total and loses their turn.",
		extra: "A +2 can't answer a +4, and a +4 can't answer a +2.",
	},
	{
		title: "Jump in",
		themed: "Interception",
		color: "bg-red",
		body: "If you hold a card identical to the top of the discard pile — same color and same number or symbol — you may play it out of turn, cutting the line. Play then continues from you.",
		extra: "This works for every card, including +2, +4 and wilds. An intercepted +2 passes the stack along: if Player 1 plays a +2 and Player 3 intercepts with another +2 of the same color, the one who draws 4 is Player 4 — Player 2 is skipped.",
	},
	{
		title: "Draw until playable",
		themed: "Continuous Draw",
		color: "bg-yellow",
		body: "No playable card? Keep drawing until you find one that works. The card you find may be played immediately.",
	},
	{
		title: "Seven swap",
		themed: "Orbit Swap",
		color: "bg-blue",
		body: "When you play a 7, you may swap your hand with a player of your choice. Swapping is optional: without one, the 7 plays like any other card.",
	},
	{
		title: "Zero rotate",
		themed: "Zero Gravity",
		color: "bg-green",
		body: "When anyone plays a 0, every hand passes to the next player, in the current direction of play. Nobody chooses anything.",
	},
]

function HouseRules() {
	return (
		<section
			id="houserules"
			className="mx-auto flex w-full max-w-[1240px] scroll-mt-24 flex-col gap-6 px-[clamp(16px,4vw,24px)] pb-[88px]"
		>
			<header className="flex flex-col gap-2 border-b border-white/10 pb-4">
				<p className="font-mono text-xs tracking-[0.18em] text-yellow">HOUSE RULES</p>
				<h2 className="font-logo text-[clamp(26px,5.5vw,34px)] font-bold text-white">This House's Special Rules</h2>
				<p className="mt-1 text-[15px] text-white/70">Open a rule to read it. A room can switch on any of them.</p>
			</header>

			<ul className="flex flex-col gap-2.5">
				{RULES.map((rule) => (
					<li key={rule.title}>
						<details className="group overflow-hidden rounded-lg border border-white/10 bg-panel">
							<summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-[22px] py-[18px] [&::-webkit-details-marker]:hidden">
								<span className="flex items-center gap-3.5">
									<i aria-hidden="true" className={`h-[26px] w-1.5 rounded-sm ${rule.color}`} />
									<span className="flex flex-col gap-0.5">
										<h3 className="font-logo text-[18px] font-bold text-white">{rule.title}</h3>
										<span className="font-mono text-[11px] tracking-[0.08em] text-muted">{rule.themed}</span>
									</span>
								</span>
								<span
									aria-hidden="true"
									className="font-mono text-[18px] text-white/70 transition-transform duration-200 group-open:rotate-45"
								>
									+
								</span>
							</summary>
							<div className="flex flex-col gap-2.5 px-[22px] pb-5 pl-[42px]">
								<p className="text-[15px] leading-relaxed text-white/70">{rule.body}</p>
								{rule.extra && <p className="text-[15px] leading-relaxed text-white/70">{rule.extra}</p>}
							</div>
						</details>
					</li>
				))}
			</ul>
		</section>
	)
}

export default HouseRules
