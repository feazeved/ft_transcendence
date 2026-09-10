import { Link } from 'react-router'

const Footer = () => {
  return (
	<footer className="flex flex-wrap justify-between items-center gap-4 pl-4 pr-16 py-3 bg-black text-white">
		<p>Made by: dda-fons wlucas-f feazeved alebarbo</p>
		<nav aria-label="Legal">
			<ul className="flex gap-4 text-sm">
				<li><Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link></li>
				<li><Link to="/terms-of-service" className="hover:underline">Terms of Service</Link></li>
			</ul>
		</nav>
	</footer>
  );
};

export default Footer;