// <Link> is the same as <a>. <a href="/"> make a full reload on the browser
// <Link> updates with JS instead, avoiding the full reload.
import { Link } from 'react-router'

function NotFound() {
	return (
		<main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4">
			<h1 className="text-4xl font-bold">404</h1>
			<p className="text-slate-400">Page not found.</p>
			{/* "to" is Link's equivalent of href */}
			<Link to="/" className="underline">Back home</Link>
		</main>
	)
}

export default NotFound
