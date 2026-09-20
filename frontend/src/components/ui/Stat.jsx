// One "label → big value" pair. Put several inside a <dl>, which is what the
// HTML description list is for.
const VALUE_COLORS = {
	red: "text-red-soft",
	blue: "text-blue-soft",
	green: "text-green-soft",
	yellow: "text-yellow",
	white: "text-white",
}

function Stat({ label, value, color = "white", className = "" }) {
	return (
		<div className={`flex items-baseline justify-between gap-4 border-b border-white/10 pb-3.5 ${className}`}>
			<dt className="text-[15px] text-white/70">{label}</dt>
			<dd
				className={`font-mono text-[clamp(20px,4.5vw,26px)] font-bold ${VALUE_COLORS[color] ?? VALUE_COLORS.white}`}
			>
				{value}
			</dd>
		</div>
	)
}

export default Stat
