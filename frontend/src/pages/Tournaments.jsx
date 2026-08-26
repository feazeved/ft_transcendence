import { Link } from 'react-router'

function Tournaments() {
	return (
		<div className="min-h-screen text-white flex items-center justify-center">
			<h1 className="text-6xl font-bold">
				TOURNAMENTS
			</h1>
			<Link to="/" className="underline">Back home</Link>
		</div>
	)
}

export default Tournaments
