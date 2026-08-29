import { useId } from "react";

// The card used by the auth forms (Login / Register) and the long-form pages
// (Rules, Privacy, Terms) — same look everywhere: translucent, blur-backed,
// soft shadow, centered title.
//
// `className` sets the width/layout only. Default fills a `flex` row/column
// (the policy pages); the auth forms pass a fixed width so they look unchanged.
function Section({ title, children, className = "flex-1 min-w-70 max-w-full" }) {
	const headingId = useId();
	return (
		<section
			aria-labelledby={headingId}
			className={`text-white p-4 rounded-xl border-2 border-transparent shadow-lg shadow-black lg:backdrop-blur-lg ${className}`}
		>
			<h2 id={headingId} className="mb-3 text-center text-xl tracking-wide">
				{title}
			</h2>
			<div className="space-y-3 leading-relaxed">{children}</div>
		</section>
	);
}

export default Section;
