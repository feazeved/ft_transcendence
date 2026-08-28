// Rendered as a full page on /tournament, and as a popup when opened from the
// navbar (see routes.jsx). Keep the markup layout-agnostic so it works in both.
function Tournaments() {
	return (
		<div className="flex-1 flex flex-col items-center justify-center text-white text-center gap-4 px-8 py-8">
			<h1 className="text-5xl font-bold">TOURNAMENTS</h1>
			<p className="text-white/70">Create or join a bracket and track your run here.</p>
		</div>
	)
}

export default Tournaments
