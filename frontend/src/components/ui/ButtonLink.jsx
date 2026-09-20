import { Link } from "react-router"
import { buttonClasses } from "./buttonClasses.js"

// Navigation that looks like a Button. Use `external` for an <a> to somewhere
// outside the app, like the GitHub link in the big footer.
function ButtonLink({ variant = "solid", color = "yellow", className = "", external = false, to, children, ...rest }) {
	const classes = `${buttonClasses({ variant, color })} ${className}`

	if (external) {
		return (
			<a href={to} className={classes} {...rest}>
				{children}
			</a>
		)
	}

	return (
		<Link to={to} className={classes} {...rest}>
			{children}
		</Link>
	)
}

export default ButtonLink
