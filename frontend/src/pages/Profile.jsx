// Rendered as a full page on /profile, and as a popup when opened from the
// navbar (see routes.jsx). Keep the markup layout-agnostic so it works in both:
// no min-h-screen, no back link — the page has the navbar, the modal has its
// own close button.
function Profile() {
	return (
		<div className="flex-1 flex flex-col items-center justify-center text-white text-center gap-4 px-8 py-8">
			<h1 className="text-5xl font-bold">PROFILE</h1>
			<p className="text-white/70">Your stats and match history will live here.</p>
		</div>
	)
}

export default Profile
