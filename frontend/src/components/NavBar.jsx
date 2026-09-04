import { Link, useLocation } from 'react-router'
import logo from "../assets/ONE.png"
import profile from "../assets/profile.svg"
import leaderboard from "../assets/leaderboard.svg"
import trophy from "../assets/tournamen.svg"
import cards from "../assets/cards.svg"
import friends from "../assets/friends.svg"
import HoverLink from "./HoverLink"
import { useAuth } from "../lib/auth.jsx"

const Header = () => {
  const location = useLocation()
  // null when logged out. When set, we show the avatar instead of the icon
  // (later populated from the JWT — username, avatar, …).
  const { user } = useAuth()
  // Spread onto a link to make its target open as a popup over the current
  // page instead of navigating away to the full page (see routes.jsx).
  const asModal = { state: { background: location } }

  return (
	<div className="sticky top-0 z-50">
	<header className="relative pl-4 pr-16 bg-black">
		<nav className="flex justify-between" aria-label="Primary">
			<Link to="/"><img src={logo} alt="logo picture ONE" width={150} className="inline-block transition-transform duration-300 p-5 ease-in-out hover:translate-x-5"/></Link>
			<ul className="flex text-white items-center gap-15">

			<li><HoverLink to="/play" {...asModal} className='p-2'>
				<img src={cards} alt="cards avatar svg" width={40} height={40}/>
			</HoverLink></li>
			<li><HoverLink to="/tournament" {...asModal} className='p-2'>
				<img src={trophy} alt="trophy avatar svg" width={36} height={36}/>
			</HoverLink></li>
			<li><HoverLink to="/leaderboard" {...asModal} className='p-2'>
				<img src={leaderboard} alt="leaderboard avatar svg" width={36} height={36}/>
			</HoverLink></li>
			<li><HoverLink to="/friends" {...asModal} className='p-1'>
				<img src={friends} alt="friends avatar svg" width={46} height={46}/>
			</HoverLink></li>
			<li>
				{user ? (
					<HoverLink to="/profile" {...asModal} className="p-2">
						<img
							src={user.avatar}
							alt={`${user.username} profile`}
							className="rounded-full object-cover w-11 h-11"
						/>
					</HoverLink>
				) : (
					<HoverLink to="/login" className="p-2">
						<img src={profile} alt="log in" width={26} height={26}/>
					</HoverLink>
				)}
			</li>
			</ul>
		</nav>
		<div
			aria-hidden="true"
			className="pointer-events-none absolute
			inset-x-0 top-full h-[1px] navbar-rainbow-line"
		/>
	</header>
	</div>
  );
};

export default Header;
