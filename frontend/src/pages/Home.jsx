function Home() {
	//className is the convention for the css in tailwind, same as class in css.
	return (
		<section className="min-h-screen text-white px-8 py-16">
			<div className="max-w-2xl mx-auto text-center">
				<h1 className="text-6xl font-bold">
					FT_TRANSCENDENCE
				</h1>
				<p className="mt-4 text-xl">
					ONE is the classic card game where the goal is simple: be the first
					to run out of cards. Match by color or number, play action cards to
					shake things up, and don't forget to say "ONE!" when you're down to one.
				</p>
			</div>

			<div className="mt-12 grid relative grid-cols-1 sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
				<div className="bg-black  rounded-xl border border-white p-6 relative overflow-hidden h-60">
					<h2 className="text-2xl font-bold">Play</h2>
					<p className="mt-2 ">Jump into a match and start playing.</p>
				</div>
				<div className="bg-black rounded-xl border border-white p-6 relative overflow-hidden h-60">
					<h2 className="text-2xl font-bold">Rules</h2>
					<p className="mt-2 ">Know how to play ONE.</p>
				</div>
			</div>
		</section>
	)
}

export default Home
