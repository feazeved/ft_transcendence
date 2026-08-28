import { useId } from "react";

function Section({ title, children }) {
	const headingId = useId();
	return (
		<section
			aria-labelledby={headingId}
			className="text-white rounded-xl p-6 border-2 border-transparent flex-1 min-w-[280px] max-w-full
			lg:backdrop-blur-lg shadow-lg shadow-black"
		>
			<h2 id={headingId} className="text-2xl font-bold mb-3 text-white">{title}</h2>
			<div className="space-y-3 leading-relaxed text-white">
				{children}
			</div>
		</section>
	);
}

export default Section;
