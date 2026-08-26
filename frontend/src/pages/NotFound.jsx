import Card from '@/components/Card.jsx'
import cards from '@/assets/cards.svg'

function NotFound() {
	return (
		<section className="flex-1 flex flex-col items-center justify-center text-white text-center px-8 py-16 gap-6">
			<div className="flex select-none">
				<span className="text-8xl sm:text-9xl font-bold" style={{ color: '#ef4444' }}>4</span>
				<span className="text-8xl sm:text-9xl font-bold" style={{ color: '#eab308' }}>0</span>
				<span className="text-8xl sm:text-9xl font-bold" style={{ color: '#3b82f6' }}>4</span>
			</div>
			<h1 className="text-3xl sm:text-4xl font-bold">No such card in this deck</h1>
			<p className="max-w-md text-muted-foreground">
				You tried to play a card that doesn't exist. House rules say that's
				an automatic penalty draw &mdash; lucky for you, the way back is free.
			</p>
			<Card
				title="Back to the table"
				description="Draw yourself back into the game."
				image={cards}
				to="/"
				className="max-w-xs mt-4"
				height="h-48"
				imageSize="w-24 h-24"
			/>
		</section>
	)
}

export default NotFound
