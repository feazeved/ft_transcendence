// A boxed section of a page, with the design's optional colored top border and
// an optional mono title. Whatever goes inside arrives as children.
const TOP_BORDERS = {
	red: "border-t-4 border-t-red",
	blue: "border-t-4 border-t-blue",
	green: "border-t-4 border-t-green",
	yellow: "border-t-4 border-t-yellow",
}

const TITLE_COLORS = {
	red: "text-red-soft",
	blue: "text-blue-soft",
	green: "text-green-soft",
	yellow: "text-yellow",
}

function Panel({ title, accent, className = "", children, ...rest }) {
	return (
		<section
			className={`flex flex-col gap-4 rounded-lg border border-white/10 bg-panel p-[clamp(16px,3vw,24px)] ${
				accent ? TOP_BORDERS[accent] ?? "" : ""
			} ${className}`}
			{...rest}
		>
			{title && (
				<h2 className={`font-mono text-[11px] tracking-[0.16em] ${TITLE_COLORS[accent] ?? "text-muted"}`}>
					{title}
				</h2>
			)}
			{children}
		</section>
	)
}

export default Panel
