import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router'

const Home = lazy(() => import('@/pages/Home.jsx'))
const NotFound = lazy(() => import('@/pages/NotFound.jsx'))

function AppRoutes() {
	return (
		<Suspense fallback={<div>Loading…</div>}>
			<Routes>
				<Route path="/" element={<Home />} />
				<Route path="*" element={<NotFound />} />
			</Routes>
		</Suspense>
	)
}

export default AppRoutes
