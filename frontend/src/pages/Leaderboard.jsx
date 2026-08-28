// Rendered as a full page on /leaderboard, and as a popup when opened from the
// navbar (see routes.jsx). Keep the markup layout-agnostic so it looks right in
// both: no min-h-screen, no fixed positioning — just a centered content block.
function Leaderboard() {
	return (
		<div className="flex-1 flex flex-col items-center justify-center text-white text-center gap-4 px-8 py-8">
			<h1 className="text-5xl font-bold">LEADERBOARD</h1>
			<p className="text-white/70">Top players and their win counts will show up here.</p>
		</div>
	)
}

export default Leaderboard
