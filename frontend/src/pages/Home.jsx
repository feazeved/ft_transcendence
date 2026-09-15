import { Link, useLocation } from "react-router"
import { useAuth } from "@/lib/auth.jsx"

const buttonBase = "inline-block rounded-xl px-6 py-3 font-bold transition-transform duration-300 hover:scale-105 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
const primaryButton = `${buttonBase} bg-white text-black hover:rainbow-shadow`
const secondaryButton = `${buttonBase} border border-border text-white hover:bg-white/10`

function Hero() {
	//className is the convention for the css in tailwind, same as class in css.
	// Spread onto a link to make its target open as a popup over this page
	// instead of navigating away to the full page (see routes.jsx / NavBar.jsx).
	const location = useLocation()
	const asModal = { state: { background: location } }

	const { user } = useAuth()

	return (
		<section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-6 py-16 text-center sm:py-24">
			{user && (
			<p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">
				Welcome back, {user.username}
			</p>
			)}

			<h1 className="rainbow-text text-6xl font-bold tracking-tight sm:text-8xl">
				ONE
			</h1>

			<p className="max-w-xl text-lg text-muted-foreground">
				{user
					? "A table is always open. Jump in and dump your hand!"
					: "The classic card game. Match a color or number, discard your hand and don't forget to call ONE!"}
			</p>

			<div className="flex flex-wrap items-center justify-center gap-3">
				{user ? (
					<>
						<Link to="/play" {...asModal} className={primaryButton}>
							Play now!
						</Link>
						<Link to="/tournament" {...asModal} className={secondaryButton}>
							Tournaments
						</Link>
					</>
				) : (
					<>
						<Link to="/register" className={primaryButton}>
							Create account
						</Link>
						<Link to="/login" className={secondaryButton}>
							Sign in
						</Link>
					</>
				)}
			</div>
			<Link
				to="/rules"
				className="text-sm text-muted-foreground underline underline-offset-4 transition-colors hover:text-white"
			>
				How to play
			</Link>
		</section>
	)
}

const HOW_IT_WORKS = [
	{
		id: "match",
		image: "/cards/red/7.png",
		title: "Match the pile",
		text: "Play a card sharing a color or a number with the one face up.",
	},
	{
		id: "actions",
		image: "/cards/blue/reverse.png",
		title: "Bend the rules",
		text: "Skips, reverses and draw cards turn a losing hand around fast.",
	},
	{
		id: "call",
		image: "/cards/wild.png",
		title: "Call ONE",
		text: "Down to your last card? Say it or risk the penalty",
	},
]

function FeatureCard({ image, title, text }) {
	return (
		<li className="flex flex-col items-center gap-3 rounded-xl border border-border bg-card p-6 text-center">
			<img src={image} alt="" aria-hidden="true" className="h-28 w-auto drop-shadow-lg" />
			<h3 className="text-lg font-bold text-card-foreground">{title}</h3>
			<p className="text-sm text-muted-foreground">{text}</p>
		</li>
	)
}

function HowItWorks() {
	return (
		<section aria-labelledby="how-heading" className="mx-auto w-full max-w-5xl px-6 pb-20">
			<h2 id="how-heading" className="mb-8 text-center text-2xl font-bold">
				How it works
			</h2>
			<ul className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				{HOW_IT_WORKS.map((step) => (
					<FeatureCard
						key={step.id}
						image={step.image}
						title={step.title}
						text={step.text}
					/>
				))}
			</ul>
		</section>
	)
}

function Home() {
	const { user } = useAuth

	return (
		<div className="flex-1 text-white">
			<Hero />
			{!user && <HowItWorks />}
		</div>
	)
}

export default Home
