import { Link } from 'react-router'

const HoverLink = ({ to = "/", className = "", children }) => {
	return (
		<Link
			to={to}
			className={`inline-block transition-transform duration-300 ease-in-out hover:scale-110 hover:rotate-6 ${className}`}
		>
			{children}
		</Link>
	);
};

export default HoverLink;
