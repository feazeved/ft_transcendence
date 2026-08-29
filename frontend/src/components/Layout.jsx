import { Outlet } from "react-router"
import Header from "./NavBar.jsx"
import Footer from "./Footer.jsx"
import bg from "../assets/bg.jpg"

function Layout() {
	return (
		<div
			className="min-h-screen flex flex-col bg-[#141414] bg-cover bg-center bg-no-repeat"
			style={{ backgroundImage: `url(${bg})` }}
		>
			<Header />
			<main className="flex-1 flex flex-col" aria-label="Main content">
				<Outlet />
			</main>
			<Footer />
		</div>
	)
}

export default Layout
