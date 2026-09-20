import { Navigate, useLocation } from "react-router"
import { useAuth } from "@/lib/auth.jsx"

// Wraps a page that needs an account. A guest goes to the Login carrying where
// they were, in `state.from`, and Login sends them back there afterwards.
//
// `replace` matters: without it the browser's Back button would return to the
// protected page, which would bounce to Login again, and again.
function RequireAuth({ children }) {
	const { user } = useAuth()
	const location = useLocation()

	if (!user) {
		const from = `${location.pathname}${location.search}${location.hash}`
		return <Navigate to="/login" replace state={{ from }} />
	}

	return children
}

export default RequireAuth
