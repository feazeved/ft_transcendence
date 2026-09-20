import { buttonClasses } from "./buttonClasses.js"

// An action. Navigation is ButtonLink instead.
// `type` defaults to "button" so a button inside a <form> doesn't submit it by
// accident; pass type="submit" when that is what you want.
function Button({ variant = "solid", color = "yellow", className = "", type = "button", children, ...rest }) {
	return (
		<button type={type} className={`${buttonClasses({ variant, color })} cursor-pointer ${className}`} {...rest}>
			{children}
		</button>
	)
}

export default Button
