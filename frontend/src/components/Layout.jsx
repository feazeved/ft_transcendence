import { Outlet } from "react-router"
import Header from "./NavBar.jsx"
import Footer from "./Footer.jsx"

function Layout() {
	return (
		<>
			<Header />
			<Outlet />
			<Footer />
		</>
	)
}

export default Layout
