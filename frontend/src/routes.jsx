import { lazy, Suspense } from 'react'
import { Navigate, Routes, Route } from 'react-router'
import Layout from '@/components/layout/Layout.jsx'
import RequireAuth from '@/components/layout/RequireAuth.jsx'

// lazy() delays loading a page's code until it's actually needed.
// "/" will not download NotFound's code until you access 404.
const Home = lazy(() => import('@/pages/Home.jsx'))
const Tournaments = lazy(() => import('@/pages/Tournaments.jsx'))
const Profile = lazy(() => import('@/pages/Profile.jsx'))
const UserProfile = lazy(() => import('@/pages/UserProfile.jsx'))
const Room = lazy(() => import('@/pages/Room.jsx'))
const TournamentDetail = lazy(() => import('@/pages/TournamentDetail.jsx'))
const Leaderboard = lazy(() => import('@/pages/Leaderboard.jsx'))
const Login = lazy(() => import('@/pages/Login.jsx'))
const Friends = lazy(() => import('@/pages/Friends.jsx'))
const Register = lazy(() => import('@/pages/Register.jsx'))
const ForgotPassword = lazy(() => import('@/pages/ForgotPassword.jsx'))
const ResetPassword = lazy(() => import('@/pages/ResetPassword.jsx'))
const ConfirmEmail = lazy(() => import('@/pages/ConfirmEmail.jsx'))
const OAuthCallback = lazy(() => import('@/pages/OAuthCallback.jsx'))
const PrivacyPolicy = lazy(() => import('@/pages/PrivacyPolicy.jsx'))
const TermsOfService = lazy(() => import('@/pages/TermsOfService.jsx'))
const NotFound = lazy(() => import('@/pages/NotFound.jsx'))

// Dev-only playgrounds. Vite replaces `import.meta.env.DEV` with `true` under
// `vite` (npm run dev) and `false` under `vite build`, so a production build
// turns these into `null` and drops the imports — the pages and the fake data
// never reach the bundle. Checking only in the <Route> below wouldn't be
// enough: the import would stay.
const TablePlayground = import.meta.env.DEV ? lazy(() => import('@/pages/dev/TablePlayground.jsx')) : null
const UiPlayground = import.meta.env.DEV ? lazy(() => import('@/pages/dev/UiPlayground.jsx')) : null

function AppRoutes() {
	return (
		// Because pages load lazily, there's a brief moment with nothing to show
		// Suspense catches that and render `fallback` until the lazy resolve.
		<Suspense fallback={<div>Loading…</div>}>
			<Routes>
				<Route element={<Layout />}>
					<Route path="/" element={<Home />} />
					<Route path="/tournament" element={<Tournaments />} />
					<Route path="/leaderboard" element={<Leaderboard />} />
					{/* Behind the Login: `PublicProfileView` answers 403 to a guest. */}
					<Route path="/users/:publicId" element={<RequireAuth><UserProfile /></RequireAuth>} />
					{/* Home is the hub now: these two are sections of it. */}
					<Route path="/play" element={<Navigate to="/#rooms" replace />} />
					<Route path="/tournament/:id" element={<TournamentDetail />} />
					<Route path="/rules" element={<Navigate to="/#howtoplay" replace />} />
					<Route path="/login" element={<Login />} />
					<Route path="/register" element={<Register />} />
					{/* Where the e-mails the backend sends actually land. The link is
					    written in game_api/adapters.py and game_api/serializers.py, and
					    a shape that has no route here is a 404 at the end of a mail
					    nobody can do anything about. Reset comes in two shapes, one
					    segment or two, because allauth and dj-rest-auth each write their
					    own — see lib/passwordReset.js. */}
					<Route path="/forgot-password" element={<ForgotPassword />} />
					<Route path="/reset-password/:uid/:token" element={<ResetPassword />} />
					<Route path="/reset-password/:key" element={<ResetPassword />} />
					<Route path="/confirm-email/:key" element={<ConfirmEmail />} />
					{/* Signed out, these bounce to the Login and come back after it. */}
					<Route path="/friends" element={<RequireAuth><Friends /></RequireAuth>} />
					<Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
					<Route path="/oauth/callback" element={<OAuthCallback />} />
					<Route path="/privacy-policy" element={<PrivacyPolicy />} />
					<Route path="/terms-of-service" element={<TermsOfService />} />
					{/* Dev only: null in a production build, so the route doesn't exist there. */}
					{UiPlayground && <Route path="/dev/ui" element={<UiPlayground />} />}
					<Route path="*" element={<NotFound />} />
				</Route>
				{/* Outside Layout on purpose: the room draws its own frame, because the
				    game table has a slim header of its own and no footer at all. The
				    playground does the same so it previews the real thing. */}
				<Route path="/room/:id" element={<Room />} />
				{/* Dev only: null in a production build, so the route doesn't exist there. */}
				{TablePlayground && <Route path="/dev/table" element={<TablePlayground />} />}
			</Routes>
		</Suspense>
	)
}

export default AppRoutes
