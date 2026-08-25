import { Link } from 'react-router'
import logo from "../assets/logo.jpeg"
import profile from "../assets/profile.svg"
import leaderboard from "../assets/leaderboard.svg"
import trophy from "../assets/trophy.svg"
import play4 from "../assets/play4.svg"
import friends from "../assets/friends.svg"
import HoverLink from "./HoverLink"

const Header = () => {
  return (
	<div className="sticky top-0 z-50">
	<header className=" pl-4 pr-16 bg-[#401d35]">
		<nav className="flex justify-between">
			<Link to="/"><img src={logo} alt="logo picture ONE" width={200} className="inline-block transition-transform duration-300 ease-in-out hover:translate-x-5"/></Link>
			<div className="flex text-white items-center gap-15">

			<HoverLink to="#">
				<img src={play4} alt="play4 avatar svg" width={32} height={32}/>
			</HoverLink>
			<HoverLink to="/tournament">
				<img src={trophy} alt="trophy avatar svg" width={36} height={36}/>
			</HoverLink>
			<HoverLink to="#">
				<img src={leaderboard} alt="leaderboard avatar svg" width={36} height={36}/>
			</HoverLink>
			<HoverLink to="#">
				<img src={friends} alt="play4 avatar svg" width={36} height={36}/>
			</HoverLink>
			<HoverLink to="/profile" className="rounded-full">
				<img src={profile} alt="profile avatar svg" width={36} height={36}/>
			</HoverLink>
			</div>
		</nav>
	</header>
	</div>
  );
};

export default Header;