import { Link } from "react-router"
import { useAuth } from "@/lib/auth.jsx"

// The top of the page. "Play now" and "How to play" move within this page, so
// they are plain <a href="#…">; "Sign in" leaves it, so it is a <Link>.
//
// The design's tagline under ONE is deliberately missing: the team dropped it.
const BAR_COLORS = ["bg-red", "bg-blue", "bg-green", "bg-yellow"]

function Hero() {
	const { user } = useAuth()

	return (
		<section className="mx-auto flex w-full max-w-[1240px] flex-col items-center gap-[26px] px-[clamp(16px,4vw,24px)] pb-[clamp(48px,8vw,80px)] pt-[clamp(40px,8vw,72px)] text-center">
			<div className="flex flex-col items-center gap-4">
				<h1 className="font-logo text-[clamp(68px,12vw,136px)] font-extrabold leading-none tracking-[-0.01em] text-white">
					ONE
				</h1>
				<div aria-hidden="true" className="flex gap-2">
					{BAR_COLORS.map((color) => (
						<i key={color} className={`h-2.5 w-14 ${color}`} />
					))}
				</div>
			</div>

			<div className="mt-1.5 flex flex-wrap items-center justify-center gap-4">
				<a
					href="#rooms"
					className="inline-flex items-center gap-3 rounded-lg bg-green px-[46px] py-5 font-logo text-lg font-bold text-on-green transition-colors hover:bg-green-hover"
				>
					Play now →
				</a>
				{!user && (
					<Link
						to="/login"
						className="inline-flex items-center rounded-md border-2 border-line-strong px-7 py-5 font-mono text-[15px] tracking-[0.08em] text-soft transition-colors hover:border-white hover:text-white"
					>
						SIGN IN
					</Link>
				)}
			</div>

			<a
				href="#howtoplay"
				className="border-b border-[#3a3a3a] pb-[3px] font-mono text-[13px] tracking-[0.1em] text-muted transition-colors hover:border-yellow hover:text-yellow"
			>
				HOW TO PLAY
			</a>
		</section>
	)
}

export default Hero
