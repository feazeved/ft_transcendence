import Card from "../components/Card.jsx"
import play from "../assets/play4.svg"
import book from "../assets/book.svg"

function Home() {
	//className is the convention for the css in tailwind, same as class in css.
	return (
		<section className="min-h-screen bg-background text-white px-8 py-16">
			<div className="max-w-2xl mx-auto text-center">
				<h1 className="text-6xl font-bold">
					FT_TRANSCENDENCE
				</h1>
				<p className="mt-4 text-xl text-slate-400">
					ONE is the classic card game where the goal is simple: be the first
					to run out of cards. Match by color or number, play action cards to
					shake things up, and don't forget to say "ONE!" when you're down to one.
				</p>
			</div>

			<div className="mt-12 grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
				<Card title="Play" description="Jump into a match and start playing." image={play} height="h-56" imageSize="w-72 h-72" />
				<Card title="Rules" description="Know how to play ONE." image={book} height="h-56" imageSize="w-72 h-72" />
			</div>
		</section>
	)
}

export default Home
