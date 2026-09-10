import { useId } from "react";

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
