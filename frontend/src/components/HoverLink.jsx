import { Link } from 'react-router'

const HoverLink = ({ to = "/", className = "", children }) => {
	return (
		<Link
			to={to}
			className={`inline-block transition-all 
				duration-300 ease-in-out hover:scale-110 
				rounded-xl
				hover:shadow-[-4px_-4px_10px_0_#ef4444,4px_-4px_10px_0_#facc15,4px_4px_10px_0_#22c55e,-4px_4px_10px_0_#3b82f6] ${className}`}
		>
			{children}
		</Link>
	);
};

export default HoverLink;
