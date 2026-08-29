import { Link, useLocation } from "react-router"

function Home() {
	//className is the convention for the css in tailwind, same as class in css.
	// Spread onto a link to make its target open as a popup over this page
	// instead of navigating away to the full page (see routes.jsx / NavBar.jsx).
	const location = useLocation()
	const asModal = { state: { background: location } }

	return (
		<div className="min-h-screen text-white px-8 py-16">
			<header className="max-w-2xl mx-auto text-center">
				<h1 className="text-6xl font-bold rainbow-text">
					FT_TRANSCENDENCE
				</h1>
				<p className="mt-4 text-xl">
					ONE is the classic card game where the goal is simple: be the first
					to run out of cards. Match by color or number, play action cards to
					shake things up, and don't forget to say "ONE!" when you're down to one.
				</p>
			</header>

			<div className="mt-12 grid relative grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
				<Link
					to="/play"
					{...asModal}
					aria-labelledby="home-play-heading"
					className="bg-black rounded-xl border border-white p-6 relative overflow-hidden h-60 block transition-transform hover:scale-105"
				>
					<h2 id="home-play-heading" className="text-2xl font-bold">Play</h2>
					<p className="mt-2 ">Jump into a match and start playing.</p>
				</Link>
				<Link
					to="/rules"
					aria-labelledby="home-rules-heading"
					className="bg-black rounded-xl border border-white p-6 relative overflow-hidden h-60 block transition-transform hover:scale-105"
				>
					<h2 id="home-rules-heading" className="text-2xl font-bold">Rules</h2>
					<p className="mt-2 ">Know how to play ONE.</p>
				</Link>
			</div>
		</div>
	)
}

export default Home

