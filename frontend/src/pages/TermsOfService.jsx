import { Link } from "react-router";
import Section from "../components/Section";

function TermsOfService() {
	return (
		<div className="min-h-screen text-white px-6 py-16">
			<div className="max-w-3xl mx-auto">
				<h1 className="text-5xl font-bold text-center">Terms of Service</h1>
				<p className="mt-4 text-center text-white">
					Last updated: <time dateTime="2026-08-26">August 26, 2026</time>
				</p>

				<div className="mt-12 flex flex-wrap gap-6">
					<Section title="1. Acceptance of these terms">
						<p>
							These Terms of Service ("Terms") govern your access to and use
							of ONE ("the Service"), a real-time multiplayer card game
							developed as an educational project (ft_transcendence, 42
							School). By creating an account or otherwise using the Service,
							you agree to these Terms. If you do not agree, please do not use
							the Service.
						</p>
					</Section>

					<Section title="2. Description of the service">
						<p>
							ONE lets you create an account, add friends, and play a
							UNO-style card game against other players or AI opponents,
							individually or in tournaments, with in-game chat between
							participants. Because this is a student project built for
							evaluation purposes, features may change, be incomplete, or be
							temporarily unavailable.
						</p>
					</Section>

					<Section title="3. Eligibility">
						<p>
							You must be at least 13 years old to create an account. By
							registering, you confirm that the information you provide is
							accurate and that you meet this age requirement.
						</p>
					</Section>

					<Section title="4. Your account">
						<ul className="list-disc list-inside space-y-1">
							<li>
								You are responsible for keeping your password (and, if
								enabled, your two-factor authentication method) confidential,
								and for all activity that happens under your account.
							</li>
							<li>
								You may sign in with a username and password or with a
								supported third-party provider (Google). You are responsible
								for the security of that third-party account as well.
							</li>
							<li>
								Notify us as soon as possible if you suspect unauthorized
								access to your account.
							</li>
							<li>
								You may request deletion of your account at any time; see our{" "}
								<Link to="/privacy-policy" className="underline hover:text-plum-200">
									Privacy Policy
								</Link>{" "}
								for details on what happens to your data.
							</li>
						</ul>
					</Section>

					<Section title="5. Acceptable use">
						<p>While using the Service, you agree not to:</p>
						<ul className="list-disc list-inside space-y-1">
							<li>
								Harass, threaten, or abuse other players, including through
								in-game chat.
							</li>
							<li>
								Cheat, exploit bugs, use bots, or otherwise interfere with the
								fairness of a game or tournament.
							</li>
							<li>
								Attempt to gain unauthorized access to other accounts, the
								Service's infrastructure, or interfere with its normal
								operation (for example, through denial-of-service attacks).
							</li>
							<li>
								Impersonate another person, or use an offensive username,
								display name, or avatar.
							</li>
							<li>Use the Service for any unlawful purpose.</li>
						</ul>
						<p>
							We may remove content or suspend or terminate accounts that
							violate these rules.
						</p>
					</Section>

					<Section title="6. Your content">
						<p>
							You keep ownership of the content you submit (such as your
							display name, avatar, and chat messages). By submitting it, you
							grant us the limited right to store and display it within the
							Service to other players as intended (for example, showing your
							messages to other participants in the same game). You are solely
							responsible for the content you post and confirm you have the
							right to share it.
						</p>
					</Section>

					<Section title="7. Games and tournaments">
						<p>
							Match results, rankings, and tournament outcomes are determined
							by the game rules implemented in the Service. Game state (such
							as match history and results) may be kept even after a match
							ends, to support features like leaderboards and tournament
							brackets, as described in our Privacy Policy.
						</p>
					</Section>

					<Section title="8. Third-party sign-in">
						<p>
							If you choose to sign in with Google, that authentication is
							subject to Google's own terms and privacy policy in addition to
							these Terms. We are not responsible for the availability or
							behavior of third-party authentication providers.
						</p>
					</Section>

					<Section title='9. Service provided "as is"'>
						<p>
							This is a student project built for learning and evaluation
							purposes. The Service is provided "as is" and "as available",
							without warranties of any kind, whether express or implied,
							including but not limited to warranties of merchantability,
							fitness for a particular purpose, or non-infringement. We do not
							guarantee that the Service will be uninterrupted, error-free, or
							available at all times.
						</p>
					</Section>

					<Section title="10. Limitation of liability">
						<p>
							To the fullest extent permitted by law, the developers of ONE
							will not be liable for any indirect, incidental, or
							consequential damages arising from your use of, or inability to
							use, the Service, including loss of data or game progress.
						</p>
					</Section>

					<Section title="11. Termination">
						<p>
							You may stop using the Service and request account deletion at
							any time. We may suspend or terminate your access if you violate
							these Terms, including the acceptable use rules in Section 5.
						</p>
					</Section>

					<Section title="12. Changes to these terms">
						<p>
							We may update these Terms as the Service evolves. When we make
							significant changes, we will update the "Last updated" date
							above. Continuing to use the Service after a change means you
							accept the revised Terms.
						</p>
					</Section>

					<Section title="13. Contact">
						<p>
							Questions about these Terms can be sent to the maintainers of
							this project through the{" "}
							<a
								href="https://github.com/feazeved/ft_transcendence"
								target="_blank"
								rel="noopener noreferrer"
								className="underline hover:text-plum-200"
							>
								project repository
							</a>
							.
						</p>
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
	);
}

export default TermsOfService;
