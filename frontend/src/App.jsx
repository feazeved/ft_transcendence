// '@/...' is an alias for 'src/...', in vite.config.js and jsconfig.json, so paths don't get to big '../../routes.jsx'.
import AppRoutes from '@/routes.jsx'

// A "component" is just a function that returns JSX (HTML-like syntax in JS).
// App is the root component
function App() {
	return <AppRoutes />
}

export default App
