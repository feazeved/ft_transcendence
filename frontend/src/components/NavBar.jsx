import { Link } from 'react-router'
import logo from "../assets/ONE.png"
import profile from "../assets/profile.svg"
import leaderboard from "../assets/leaderboard.svg"
import trophy from "../assets/tournamen.svg"
import cards from "../assets/cards.svg"
import friends from "../assets/friends.svg"
import HoverLink from "./HoverLink"

const Header = () => {
  return (
	<div className="sticky top-0 z-50">
	<header className="relative pl-4 pr-16 bg-black">
		<nav className="flex justify-between">
			<Link to="/"><img src={logo} alt="logo picture ONE" width={150} className="inline-block transition-transform duration-300 p-5 ease-in-out hover:translate-x-5"/></Link>
			<div className="flex text-white items-center gap-15">

			<HoverLink to="#" className='p-2'>
				<img src={cards} alt="cards avatar svg" width={40} height={40}/>
			</HoverLink>
			<HoverLink to="/tournament" className='p-2'>
				<img src={trophy} alt="trophy avatar svg" width={36} height={36}/>
			</HoverLink>
			<HoverLink to="#" className='p-2'>
				<img src={leaderboard} alt="leaderboard avatar svg" width={36} height={36}/>
			</HoverLink>
			<HoverLink to="#" className='p-1'>
				<img src={friends} alt="friends avatar svg" width={46} height={46}/>
			</HoverLink>
			<HoverLink to="/profile" className="p-2">
				<img src={profile} alt="profile avatar svg" width={26} height={26}/>
			</HoverLink>
			</div>
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