import { Link } from 'react-router'

const Footer = () => {
  return (
	<footer className="flex flex-wrap justify-between items-center gap-4 pl-4 pr-16 py-3 bg-black text-white">
		<p>Made by: dda-fons wlucas-f feazeved alebarbo</p>
		<div className="flex gap-4 text-sm">
			<Link to="/privacy-policy" className="hover:underline">Privacy Policy</Link>
			<Link to="/terms-of-service" className="hover:underline">Terms of Service</Link>
		</div>
	</footer>
  );
};

export default Footer;