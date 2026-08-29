// Full page at /rules (never a modal — it's long-form reading). Linked from
// Home and reachable directly by URL. Mirrors the layout of PrivacyPolicy /
// TermsOfService: a centered column of Section cards.
import { Link } from "react-router"
import Section from "../components/Section"

function Rules() {
	return (
		<div className="min-h-screen text-white px-6 py-16">
			<div className="mx-auto max-w-3xl">
				<h1 className="text-center text-5xl font-bold">Rules</h1>
				<p className="mt-4 text-center text-slate-400">
					Everything you need to know to play ONE.
				</p>

				<div className="mt-12 flex flex-col gap-6">
					<Section title="How to Play">
						<p>
							<strong>Goal :</strong> be the first to run out of cards in your hand.
						</p>
						<p>
							<strong>Setup :</strong> each player is dealt 7 cards. The rest forms
							the draw pile. The first card flipped over starts the discard pile.
						</p>
						<p>
							On your turn, you must play a card that matches the top of the
							discard pile by <strong>color</strong>, <strong>number</strong>, or{" "}
							<strong>symbol</strong>. Wild cards may be played at any time.
						</p>
						<p>
							If you have no playable card, you draw. When you are down to a single
							card, shout <strong>"ONE"</strong> before the next turn begins.
						</p>
						<p>
							<strong>Winning :</strong> whoever discards their last card wins the
							round.
						</p>
					</Section>

					<Section title="Action & Special Cards">
						<ul className="list-inside list-disc space-y-2">
							<li>
								<strong>+2 (Overload)</strong> — The next player draws 2 cards and
								loses their turn. Can only be played on the same color or on
								another +2.
							</li>
							<li>
								<strong>Reverse (Reverse Orbit)</strong> — Changes the direction of
								play.
							</li>
							<li>
								<strong>Skip (System Failure)</strong> — The next player loses
								their turn.
							</li>
							<li>
								<strong>Wild (Change Color)</strong> — Choose the next color. Can
								be played at any time.
							</li>
							<li>
								<strong>Wild +4 (Meteor Shower)</strong> — Choose the color; the
								next player draws 4 cards and loses their turn.{" "}
								<strong>Restriction:</strong> may only be played if you have no
								card of the current color in your hand.
							</li>
						</ul>
					</Section>

					<Section title="This House's Special Rules">
						<div className="space-y-4">
							<div>
								<h3 className="font-bold">Stacking +2</h3>
								<p>
									Instead of drawing, you may answer a +2 with another +2. The
									total stacks and passes along: 2 → 4 → 6, and so on. Whoever
									cannot answer with a +2 draws the whole accumulated total and
									loses their turn.
								</p>
							</div>
							<div>
								<h3 className="font-bold">Orbit Swap (7)</h3>
								<p>
									When you play a 7, swap your hand with a player of your choice.
								</p>
							</div>
							<div>
								<h3 className="font-bold">Zero Gravity (0)</h3>
								<p>
									When you play a 0, every hand passes to the next player, in the
									current direction of play.
								</p>
							</div>
							<div>
								<h3 className="font-bold">Continuous Draw</h3>
								<p>
									No playable card? Keep drawing until you find one that works.
									The card you find may be played immediately.
								</p>
							</div>
							<div>
								<h3 className="font-bold">Jump-In (Interception)</h3>
								<p>
									If you hold a card identical to the top of the discard pile —
									same color and same number/symbol — you may play it out of turn,
									cutting the line. Play then continues from you.
								</p>
								<p>
									This works for every card, including +2, +4 and wilds. An
									intercepted +2 passes the stack along: if Player 1 plays a +2
									and Player 3 intercepts with another +2 of the same color, the
									one who draws 4 is Player 4 — Player 2 is skipped.
								</p>
							</div>
						</div>
					</Section>

					<Section title="Penalties">
						<strong>Forgetting to shout "ONE"</strong> — If another player
						catches it before the next turn begins, you draw 2 cards.
					</Section>
				</div>

				<div className="mt-10 text-center">
					<Link
						to="/"
						className="inline-block underline transition-transform duration-200 hover:scale-110"
					>
						Back home
					</Link>
				</div>
			</div>
		</div>
	)
}

export default Rules
