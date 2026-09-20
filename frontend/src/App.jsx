// '@/...' is an alias for 'src/...', in vite.config.js and jsconfig.json, so paths don't get to big '../../routes.jsx'.
import AppRoutes from '@/routes.jsx'
import ChatProvider from '@/components/chat/ChatProvider.jsx'
import { AuthProvider } from '@/lib/auth.jsx'

// A "component" is just a function that returns JSX (HTML-like syntax in JS).
// App is the root component. AuthProvider makes the current user (or null)
// available to every page and to the navbar via useAuth().
//
// ChatProvider sits inside it, above the routes, and that position is the whole
// point: it owns the one `ws/chat/` connection, so the connection outlives every
// page change instead of being rebuilt by each one.
function App() {
	return (
		<AuthProvider>
			<ChatProvider>
				<AppRoutes />
			</ChatProvider>
		</AuthProvider>
	)
}

export default App
