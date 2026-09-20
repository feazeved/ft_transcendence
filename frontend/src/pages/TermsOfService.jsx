import { Link } from "react-router"
import LegalPage from "@/components/legal/LegalPage.jsx"

// The words are the ones this page always had; only the tags around them
// changed. The ids match the design's, so a link shared from it still lands.
const SECTIONS = [
	{
		id: "tos1",
		title: "1. Acceptance of these terms",
		body: (
			<>
				<p>
					These Terms of Service ("Terms") govern your access to and use
					of ONE ("the Service"), a real-time multiplayer card game
					developed as an educational project (ft_transcendence, 42
					School). By creating an account or otherwise using the Service,
					you agree to these Terms. If you do not agree, please do not use
					the Service.
				</p>
			</>
		),
	},
	{
		id: "tos2",
		title: "2. Description of the service",
		body: (
			<>
				<p>
					ONE lets you create an account, add friends, and play a
					card game against other players or AI opponents,
					individually or in tournaments, with in-game chat between
					participants. Because this is a student project built for
					evaluation purposes, features may change, be incomplete, or be
					temporarily unavailable.
				</p>
			</>
		),
	},
	{
		id: "tos3",
		title: "3. Eligibility",
		body: (
			<>
				<p>
					You must be at least 13 years old to create an account. By
					registering, you confirm that the information you provide is
					accurate and that you meet this age requirement.
				</p>
			</>
		),
	},
	{
		id: "tos4",
		title: "4. Your account",
		body: (
			<>
				<ul>
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
						<Link to="/privacy-policy">
							Privacy Policy
						</Link>{" "}
						for details on what happens to your data.
					</li>
				</ul>
			</>
		),
	},
	{
		id: "tos5",
		title: "5. Acceptable use",
		body: (
			<>
				<p>While using the Service, you agree not to:</p>
				<ul>
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
			</>
		),
	},
	{
		id: "tos6",
		title: "6. Your content",
		body: (
			<>
				<p>
					You keep ownership of the content you submit (such as your
					display name, avatar, and chat messages). By submitting it, you
					grant us the limited right to store and display it within the
					Service to other players as intended (for example, showing your
					messages to other participants in the same game). You are solely
					responsible for the content you post and confirm you have the
					right to share it.
				</p>
			</>
		),
	},
	{
		id: "tos7",
		title: "7. Games and tournaments",
		body: (
			<>
				<p>
					Match results, rankings, and tournament outcomes are determined
					by the game rules implemented in the Service. Game state (such
					as match history and results) may be kept even after a match
					ends, to support features like leaderboards and tournament
					brackets, as described in our Privacy Policy.
				</p>
			</>
		),
	},
	{
		id: "tos8",
		title: "8. Third-party sign-in",
		body: (
			<>
				<p>
					If you choose to sign in with Google, that authentication is
					subject to Google's own terms and privacy policy in addition to
					these Terms. We are not responsible for the availability or
					behavior of third-party authentication providers.
				</p>
			</>
		),
	},
	{
		id: 'tos9',
		title: '9. Service provided "as is"',
		body: (
			<>
				<p>
					This is a student project built for learning and evaluation
					purposes. The Service is provided "as is" and "as available",
					without warranties of any kind, whether express or implied,
					including but not limited to warranties of merchantability,
					fitness for a particular purpose, or non-infringement. We do not
					guarantee that the Service will be uninterrupted, error-free, or
					available at all times.
				</p>
			</>
		),
	},
	{
		id: "tos10",
		title: "10. Limitation of liability",
		body: (
			<>
				<p>
					To the fullest extent permitted by law, the developers of ONE
					will not be liable for any indirect, incidental, or
					consequential damages arising from your use of, or inability to
					use, the Service, including loss of data or game progress.
				</p>
			</>
		),
	},
	{
		id: "tos11",
		title: "11. Termination",
		body: (
			<>
				<p>
					You may stop using the Service and request account deletion at
					any time. We may suspend or terminate your access if you violate
					these Terms, including the acceptable use rules in Section 5.
				</p>
			</>
		),
	},
	{
		id: "tos12",
		title: "12. Changes to these terms",
		body: (
			<>
				<p>
					We may update these Terms as the Service evolves. When we make
					significant changes, we will update the "Last updated" date
					above. Continuing to use the Service after a change means you
					accept the revised Terms.
				</p>
			</>
		),
	},
	{
		id: "tos13",
		title: "13. Contact",
		body: (
			<>
				<p>
					Questions about these Terms can be sent to the maintainers of
					this project through the{" "}
					<a
						href="https://github.com/feazeved/ft_transcendence"
						target="_blank"
						rel="noopener noreferrer"
					>
						project repository
					</a>
					.
				</p>
			</>
		),
	},
]

function TermsOfService() {
	return (
		<LegalPage
			title="Terms of Service"
			updated={{ iso: "2026-08-26", label: "August 26, 2026" }}
			sections={SECTIONS}
		/>
	)
}

export default TermsOfService
