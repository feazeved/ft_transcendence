import { Link } from "react-router"
import BrandMark from "@/components/ui/BrandMark.jsx"
import Avatar from "@/components/ui/Avatar.jsx"
import { useChat } from "@/components/chat/ChatProvider.jsx"
import { useAuth } from "@/lib/auth.jsx"

// The design's icons, copied as JSX: hyphenated SVG attributes become camelCase
// (stroke-width → strokeWidth). They are decorative — each link carries its own
// name in an sr-only span — so they are aria-hidden.
const iconProps = {
	width: 24,
	height: 24,
	viewBox: "0 0 24 24",
	fill: "none",
	stroke: "currentColor",
	strokeWidth: 1.3,
	strokeLinecap: "round",
	strokeLinejoin: "round",
	"aria-hidden": "true",
}

function TournamentIcon() {
	return (
		<svg {...iconProps}>
			<rect x="2.6" y="3.6" width="5.4" height="3.8" rx="1.1" />
			<rect x="2.6" y="16.6" width="5.4" height="3.8" rx="1.1" />
			<rect x="15.8" y="10.1" width="5.6" height="3.8" rx="1.1" />
			<path d="M8 5.5h3.6V12h4.2" />
			<path d="M8 18.5h3.6V12" />
		</svg>
	)
}

function LeaderboardIcon() {
	return (
		<svg {...iconProps}>
			<path d="M12 2.8l2.05 4.1 4.55.66-3.3 3.2.78 4.52L12 13.15l-4.08 2.13.78-4.52-3.3-3.2 4.55-.66L12 2.8Z" />
			<rect x="9.4" y="17" width="5.2" height="4.4" rx="1" />
			<path d="M9.4 21.4H3.6v-2.9h5.8" />
			<path d="M14.6 21.4h5.8v-1.7h-5.8" />
		</svg>
	)
}

function FriendsIcon() {
	return (
		<svg {...iconProps}>
			<circle cx="9.4" cy="8.6" r="3.3" />
			<path d="M3.4 20.2c0-3.3 2.7-6 6-6s6 2.7 6 6" />
			<path d="M16.2 5.8a3.3 3.3 0 0 1 0 5.6" />
			<path d="M18 14.7c1.8.9 3 2.7 3 5.5" />
		</svg>
	)
}

function PersonIcon() {
	return (
		<svg {...iconProps}>
			<circle cx="12" cy="8.2" r="3.6" />
			<path d="M4.8 20.4c0-4 3.2-7.2 7.2-7.2s7.2 3.2 7.2 7.2" />
		</svg>
	)
}

const ICON_LINK =
	"relative flex h-11 w-[clamp(40px,11vw,48px)] items-center justify-center rounded-md border-2 text-dim transition-colors"

const NAV_LINKS = [
	{ to: "/tournament", label: "Tournaments", Icon: TournamentIcon, hover: "border-transparent hover:border-red hover:text-red-soft" },
	{ to: "/leaderboard", label: "Leaderboard", Icon: LeaderboardIcon, hover: "border-transparent hover:border-blue hover:text-blue-soft" },
	{ to: "/friends", label: "Friends", Icon: FriendsIcon, hover: "border-transparent hover:border-green hover:text-green-soft" },
]

function Header() {
	const { user } = useAuth()
	// Friend requests waiting for an answer. It arrives over the presence socket
	// the moment somebody sends one, so the badge does not wait for a page load.
	const { incomingCount } = useChat()

	return (
		<header className="sticky top-0 z-20 border-b border-line bg-bar">
			<div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-x-6 gap-y-4 px-[clamp(14px,4vw,24px)] py-4">
				<Link to="/" aria-label="ONE, home">
					<BrandMark />
				</Link>
				<nav aria-label="Main">
					<ul className="flex items-center gap-1.5">
						{NAV_LINKS.map(({ to, label, Icon, hover }) => (
							<li key={to}>
								<Link to={to} className={`${ICON_LINK} ${hover}`}>
									<Icon />
									<span className="sr-only">{label}</span>
									{to === "/friends" && incomingCount > 0 && (
										<span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-red px-1.5 py-0.5 text-center font-mono text-[11px] font-bold leading-4 text-white">
											{incomingCount}
											<span className="sr-only"> friend requests waiting</span>
										</span>
									)}
								</Link>
							</li>
						))}
						<li>
							{user ? (
								<Link
									to="/profile"
									className={`${ICON_LINK} border-line-strong hover:border-yellow hover:text-yellow`}
								>
									<Avatar src={user.avatar} name={user.username} size="xs" alt="Your profile" />
								</Link>
							) : (
								<Link
									to="/login"
									className={`${ICON_LINK} border-line-strong hover:border-yellow hover:text-yellow`}
								>
									<PersonIcon />
									<span className="sr-only">Sign in</span>
								</Link>
							)}
						</li>
					</ul>
				</nav>
			</div>
		</header>
	)
}

export default Header
