// The rules, corrected against `backend/game_engine/engine.py` rather than
// copied from the design:
//   - a +4 has no restriction: `is_playable` returns True for it, always
//   - a +2 and a +4 make the next player draw and skip them (`_apply_standard
//     _effects`), so with the classic rules nobody can answer one. Answering is
//     what the Stacking draw cards house rule adds, so it is described there.
//   - the hand size is the room's `starting_hand_size`, 7 by default
//   - nobody has to shout anything; there is no such move
//   - one game, one winner — there are no rounds outside a tournament
//
// Themed names stay as flavour next to the plain ones, never instead of them.
const SETUP = [
	{
		term: "Goal",
		text: "be the first to run out of cards in your hand.",
	},
	{
		term: "Setup",
		text: "each player is dealt 7 cards by default, and the host can change that when creating the room. The rest forms the draw pile, and the first card flipped starts the discard pile.",
	},
]

const PLAY = [
	"On your turn, you must play a card that matches the top of the discard pile by color, by number, or by symbol. Wild cards can always be played.",
	"If you have no playable card, you draw one. If it can be played, you may play it straight away; otherwise the turn moves on.",
]

const WINNING = "the first player to discard their last card wins the game."

const CARDS = [
	{
		name: "+2 (Overload)",
		text: "The next player draws 2 cards and loses their turn — with the classic rules they never get to answer it. Stacking draw cards, in House rules, is what lets a +2 be answered with another +2.",
	},
	{ name: "Reverse (Reverse Orbit)", text: "Changes the direction of play." },
	{ name: "Skip (System Failure)", text: "The next player loses their turn." },
	{ name: "Wild (Change Color)", text: "Choose the color that carries on. It can be played at any time." },
	{
		name: "Wild +4 (Meteor Shower)",
		text: "Choose the color; the next player draws 4 cards and loses their turn, with no chance to answer either. It can be played at any time, with no restriction. Stacking draw cards lets a +4 be answered with another +4.",
	},
]

const CARD_PANEL = "flex flex-col gap-3.5 rounded-lg border border-white/10 bg-panel p-[clamp(18px,4vw,26px)]"
const PARAGRAPH = "text-[15px] leading-relaxed text-[#b3b3b3]"

function HowToPlay() {
	return (
		<section
			id="howtoplay"
			className="mx-auto flex w-full max-w-[1240px] scroll-mt-24 flex-col gap-6 px-[clamp(16px,4vw,24px)] pb-[88px]"
		>
			<header className="flex flex-col gap-2 border-b border-line pb-4">
				<p className="font-mono text-xs tracking-[0.18em] text-blue-soft">RULES</p>
				<h2 className="font-logo text-[clamp(26px,5.5vw,34px)] font-bold text-white">
					Everything you need to know to play ONE.
				</h2>
			</header>

			<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] items-stretch gap-4">
				<div className={`${CARD_PANEL} border-t-4 border-t-red`}>
					<h3 className="font-logo text-[22px] font-bold text-white">How to Play</h3>
					{SETUP.map((item) => (
						<p key={item.term} className={PARAGRAPH}>
							<strong className="text-white">{item.term} :</strong> {item.text}
						</p>
					))}
					{PLAY.map((text) => (
						<p key={text} className={PARAGRAPH}>
							{text}
						</p>
					))}
					<p className={PARAGRAPH}>
						<strong className="text-white">Winning :</strong> {WINNING}
					</p>
				</div>

				<div className={`${CARD_PANEL} border-t-4 border-t-blue`}>
					<h3 className="font-logo text-[22px] font-bold text-white">Action &amp; Special Cards</h3>
					<ul className="flex list-disc flex-col gap-2.5 pl-5">
						{CARDS.map((card) => (
							<li key={card.name} className={PARAGRAPH}>
								<strong className="text-white">{card.name}</strong> — {card.text}
							</li>
						))}
					</ul>
				</div>
			</div>
		</section>
	)
}

export default HowToPlay
