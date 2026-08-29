import { lazy, Suspense } from 'react'
import { Routes, Route, useLocation } from 'react-router'
import Layout from '@/components/Layout.jsx'
import ModalRoute from '@/components/ModalRoute.jsx'

// lazy() delays loading a page's code until it's actually needed.
// "/" will not download NotFound's code until you access 404.
const Home = lazy(() => import('@/pages/Home.jsx'))
const Test = lazy(() => import('@/pages/Test.jsx'))
const Tournaments = lazy(() => import('@/pages/Tournaments.jsx'))
const Profile = lazy(() => import('@/pages/Profile.jsx'))
const Play = lazy(() => import('@/pages/Play.jsx'))
const Room = lazy(() => import('@/pages/Room.jsx'))
const Rules = lazy(() => import('@/pages/Rules.jsx'))
const Leaderboard = lazy(() => import('@/pages/Leaderboard.jsx'))
const Login = lazy(() => import('@/pages/Login.jsx'))
const Friends = lazy(() => import('@/pages/Friends.jsx'))
const Register = lazy(() => import('@/pages/Register.jsx'))
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy.jsx'))
const TermsOfService = lazy(() => import('@/pages/TermsOfService.jsx'))
const NotFound = lazy(() => import('@/pages/NotFound.jsx'))

// Pages that can also be shown as a popup. Reached normally (e.g. typing the URL
// or refreshing) they render full-page; reached from a link that carries a
// `background` location they render as a modal over that background page.
const MODAL_ROUTES = [
	{ path: '/profile', title: 'Profile', element: <Profile /> },
	{ path: '/tournament', title: 'Tournaments', element: <Tournaments /> },
	{ path: '/leaderboard', title: 'Leaderboard', element: <Leaderboard /> },
	{ path: '/play', title: 'Play', element: <Play /> },
	{ path: '/friends', title: 'Friends', element: <Friends /> },
]

function AppRoutes() {
	const location = useLocation()
	// A <Link> can pass `state={{ background: location }}`. When it does, we keep
	// rendering the page at that background location and stack the link's real
	// target on top as a modal.
	const background = location.state && location.state.background

	return (
		// Because pages load lazily, there's a brief moment with nothing to show
		// Suspense catches that and render `fallback` until the lazy resolve.
		<Suspense fallback={<div>Loading…</div>}>
			<Routes location={background || location}>
				<Route element={<Layout />}>
					<Route path="/" element={<Home />} />
					<Route path="/test" element={<Test />} />
					<Route path="/tournament" element={<Tournaments />} />
					<Route path="/profile" element={<Profile />} />
					<Route path="/leaderboard" element={<Leaderboard />} />
					<Route path="/play" element={<Play />} />
					{/* A room is always a full page (has its own id in the URL to
					    share), never a stacked modal — so it's not in MODAL_ROUTES. */}
					<Route path="/room/:id" element={<Room />} />
					{/* Rules is long-form reading — always a full page, never a modal. */}
					<Route path="/rules" element={<Rules />} />
					<Route path="/login" element={<Login />} />
					<Route path="/friends" element={<Friends />} />
					<Route path="/register" element={<Register />} />
					<Route path="/privacy-policy" element={<PrivacyPolicy />} />
					<Route path="/terms-of-service" element={<TermsOfService />} />
					<Route path="*" element={<NotFound />} />
				</Route>
			</Routes>

			{/* Only mounted when we arrived with a background location, so the
			    modal is layered on top of the page instead of replacing it. */}
			{background && (
				<Routes>
					{MODAL_ROUTES.map(({ path, title, element }) => (
						<Route
							key={path}
							path={path}
							element={<ModalRoute title={title}>{element}</ModalRoute>}
						/>
					))}
				</Routes>
			)}
		</Suspense>
	)
}

export default AppRoutes
