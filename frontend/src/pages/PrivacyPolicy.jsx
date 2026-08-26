import { Link } from "react-router";

function Section({ title, children }) {
	return (
		<div
			className="text-white rounded-xl p-6 border-2 border-transparent flex-1 min-w-[280px] max-w-full
			lg:backdrop-blur-lg shadow-lg shadow-black"
		>
			<h2 className="text-2xl font-bold mb-3 text-white">{title}</h2>
			<div className="space-y-3 leading-relaxed text-white">
				{children}
			</div>
		</div>
	);
}

function PrivacyPolicy() {
	return (
		<section className="min-h-screen text-white px-6 py-16">
			<div className="max-w-3xl mx-auto">
				<h1 className="text-5xl font-bold text-center">Privacy Policy</h1>
				<p className="mt-4 text-center text-slate-400">
					Last updated: August 26, 2026
				</p>

				<div className="mt-12 flex flex-wrap gap-6">
					<Section title="1. Who we are">
						<p>
							ONE ("the Service", "we", "us") is a real-time multiplayer card
							game built as an educational project (ft_transcendence, 42
							School). It is not operated as a commercial product, but we
							still take the privacy of everyone who creates an account
							seriously and explain here exactly what data we handle and why.
						</p>
					</Section>

					<Section title="2. Information we collect">
						<p>When you use ONE, we may collect and store:</p>
						<ul className="list-disc list-inside space-y-1">
							<li>
								<strong>Account data:</strong> username, email address, a
								securely hashed password (we never store your password in
								plain text), display name, and avatar image or avatar URL.
							</li>
							<li>
								<strong>Third-party sign-in data:</strong> if you sign in with
								Google, we store the provider name and your provider account
								identifier so we can match future logins to your account. We
								do not receive or store your Google password.
							</li>
							<li>
								<strong>Two-factor authentication (2FA):</strong> if you enable
								2FA, your TOTP secret is stored encrypted at rest and is only
								used to verify login codes.
							</li>
							<li>
								<strong>Preferences:</strong> your chosen language and
								light/dark theme.
							</li>
							<li>
								<strong>Gameplay data:</strong> games and tournaments you host
								or join, your seat, hand state during an active game, match
								results, win/loss history, and your last-seen timestamp.
							</li>
							<li>
								<strong>Social data:</strong> friend requests you send or
								receive and their status (pending, accepted, declined,
								blocked).
							</li>
							<li>
								<strong>In-game chat messages:</strong> messages you send in a
								game's chat, associated with your account and the game they
								were sent in.
							</li>
							<li>
								<strong>Session data:</strong> an authentication token is
								stored in your browser (localStorage) to keep you signed in
								between visits.
							</li>
						</ul>
					</Section>

					<Section title="3. How we use your information">
						<p>We use the data above strictly to operate the Service:</p>
						<ul className="list-disc list-inside space-y-1">
							<li>Create and authenticate your account, including 2FA.</li>
							<li>
								Run games and tournaments, keep the game state in sync between
								players in real time, and record results and leaderboards.
							</li>
							<li>
								Show your display name and avatar to other players inside a
								game or on your profile.
							</li>
							<li>Deliver chat messages to other participants in a game.</li>
							<li>Manage friend lists and friend requests.</li>
							<li>Remember your language and theme preferences.</li>
							<li>
								Keep the Service secure, prevent abuse, and debug problems.
							</li>
						</ul>
						<p>
							We do not sell your data, and we do not use it for advertising
							or share it with third parties for marketing purposes.
						</p>
					</Section>

					<Section title="4. Cookies and local storage">
						<p>
							We do not use advertising or tracking cookies. The Service uses
							your browser's local storage to keep your session token so you
							stay logged in, and to remember interface preferences such as
							theme. Clearing your browser storage will sign you out.
						</p>
					</Section>

					<Section title="5. Data sharing">
						<p>
							Other players can see your username, display name, avatar, and
							anything you post in an in-game chat. If you sign in with
							Google, the exchange with Google is limited to verifying your
							identity. We do not otherwise share your personal data with
							third parties.
						</p>
					</Section>

					<Section title="6. Data retention">
						<p>
							We keep your account and gameplay data for as long as your
							account exists, so that features like match history, tournament
							results, and leaderboards keep working correctly. If you ask us
							to delete your account, we will remove or anonymize your
							personal data, except where a short retention is required to
							keep the integrity of shared records such as completed
							tournaments (for example, replacing your identifying details
							with a generic placeholder while keeping the match result
							itself).
						</p>
					</Section>

					<Section title="7. Your rights">
						<p>You can, at any time:</p>
						<ul className="list-disc list-inside space-y-1">
							<li>Access the personal data we hold about you.</li>
							<li>Correct inaccurate profile information yourself, from your account settings.</li>
							<li>Ask us to delete your account and associated personal data.</li>
							<li>Withdraw consent for optional features such as 2FA or Google sign-in by disabling them in your account settings.</li>
						</ul>
						<p>
							To exercise any of these rights, contact us using the details in
							the "Contact" section below.
						</p>
					</Section>

					<Section title="8. Security">
						<p>
							Passwords are stored using a one-way hash, never in plain text.
							2FA secrets are encrypted at rest. We restrict access to the
							underlying database to the project's maintainers. No online
							service can guarantee absolute security, but we take reasonable
							measures to protect your data against unauthorized access.
						</p>
					</Section>

					<Section title="9. Children's privacy">
						<p>
							The Service is not directed at children under 13, and we do not
							knowingly collect personal data from them. If you believe a
							child has created an account, please contact us so we can remove
							it.
						</p>
					</Section>

					<Section title="10. Changes to this policy">
						<p>
							We may update this Privacy Policy as the Service evolves. When we
							make significant changes, we will update the "Last updated" date
							above. Continuing to use the Service after a change means you
							accept the revised policy.
						</p>
					</Section>

					<Section title="11. Contact">
						<p>
							Questions about this policy or requests regarding your data can
							be sent to the maintainers of this project through the{" "}
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
		</section>
	);
}

export default PrivacyPolicy;
