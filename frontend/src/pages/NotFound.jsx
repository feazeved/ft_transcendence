import { Link } from 'react-router'

function NotFound() {
	return (
		<main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center gap-4">
			<h1 className="text-4xl font-bold">404</h1>
			<p className="text-slate-400">Page not found.</p>
			<Link to="/" className="underline">Back home</Link>
		</main>
	)
}

export default NotFound
