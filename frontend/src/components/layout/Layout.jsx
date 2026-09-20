import { Outlet, useLocation } from "react-router"
import ChatDock from "@/components/chat/ChatDock.jsx"
import { showsChatDock } from "@/lib/chat.js"
import BigFooter from "./BigFooter.jsx"
import Footer from "./Footer.jsx"
import Header from "./Header.jsx"
import ScrollToHash from "./ScrollToHash.jsx"

// The frame every page but the Game Table sits in. <Outlet /> is the hole the
// routed page drops into. Home gets the big footer; everywhere else the slim one.
//
// The chat dock hangs here rather than inside each page, so eight screens do not
// each have to remember to draw it. `showsChatDock` is the list of which ones do
// — Login, Register, the legal pages and a wrong URL get none.
function Layout() {
	const { pathname } = useLocation()
	const isHome = pathname === "/"

	return (
		<div className="flex min-h-screen flex-col bg-page">
			<ScrollToHash />
			<Header />
			<main className="flex flex-1 flex-col">
				<Outlet />
			</main>
			{isHome ? <BigFooter /> : <Footer />}
			{showsChatDock(pathname) && <ChatDock />}
		</div>
	)
}

export default Layout
