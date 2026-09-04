import { Link } from 'react-router'

// Extra props (state, onClick) are forwarded straight to <Link> so
// callers can do things like open the target as a modal.
const HoverLink = ({ to = "/", className = "", children, ...rest }) => {
	return (
		<Link
			to={to}
			{...rest}
			className={`inline-block transition-all
				duration-300 ease-in-out hover:scale-110
				rounded-xl
				hover:rainbow-shadow ${className}`}
		>
			{children}
		</Link>
	);
};

export default HoverLink;
