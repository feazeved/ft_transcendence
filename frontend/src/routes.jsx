import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router'
import Layout from '@/components/Layout.jsx'

// lazy() delays loading a page's code until it's actually needed.
// "/" will not download NotFound's code until you access 404.
const Home = lazy(() => import('@/pages/Home.jsx'))
const Test = lazy(() => import('@/pages/Test.jsx'))
const Tournaments = lazy(() => import('@/pages/Tournaments.jsx'))
const Profile = lazy(() => import('@/pages/Profile.jsx'))
const NotFound = lazy(() => import('@/pages/NotFound.jsx'))

function AppRoutes() {
	return (
		// Because pages load lazily, there's a brief moment with nothing to show
		// Suspense catches that and render `fallback` until the lazy resolve.
		<Suspense fallback={<div>Loading…</div>}>
			<Routes>
				<Route element={<Layout />}>
					<Route path="/" element={<Home />} />
					<Route path="/test" element={<Test />} />
					<Route path="/tournament" element={<Tournaments />} />
					<Route path="/profile" element={<Profile />} />
				</Route>
				<Route path="*" element={<NotFound />} />
			</Routes>
		</Suspense>
	)
}

export default AppRoutes
