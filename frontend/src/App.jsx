// '@/...' is an alias for 'src/...', in vite.config.js and jsconfig.json, so paths don't get to big '../../routes.jsx'.
import AppRoutes from '@/routes.jsx'
import { AuthProvider } from '@/lib/auth.jsx'

// A "component" is just a function that returns JSX (HTML-like syntax in JS).
// App is the root component. AuthProvider makes the current user (or null)
// available to every page and to the navbar via useAuth().
function App() {
	return (
		<AuthProvider>
			<AppRoutes />
		</AuthProvider>
	)
}

export default App
