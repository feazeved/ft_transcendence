import { Link } from 'react-router'

// Extra props (e.g. `state`, `onClick`) are forwarded straight to <Link> so
// callers can do things like open the target as a modal.
const HoverLink = ({ to = "/", className = "", children, ...rest }) => {
	return (
		<Link
			to={to}
			{...rest}
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
