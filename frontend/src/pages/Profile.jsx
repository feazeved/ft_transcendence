import { Link } from 'react-router'


function Profile() {
	return (
		<div className="min-h-screen text-white flex items-center justify-center">
			<h1 className="text-6xl font-bold">
				PROFILE
			</h1>
			<Link to="/" className="underline">Back home</Link>
		</div>
	)
}

export default Profile
