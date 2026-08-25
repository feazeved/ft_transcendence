import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router'

// lazy() delays loading a page's code until it's actually needed. 
// "/" will not download NotFound's code until you access 404.
const Home = lazy(() => import('@/pages/Home.jsx'))
const NotFound = lazy(() => import('@/pages/NotFound.jsx'))

function AppRoutes() {
	return (
		// Because pages load lazily, there's a brief moment with nothing to show
		// Suspense catches that and render `fallback` until the lazy resolve.
		<Suspense fallback={<div>Loading…</div>}>
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="*" element={<NotFound />} />
			</Routes>
		</Suspense>
	)
}

export default AppRoutes
