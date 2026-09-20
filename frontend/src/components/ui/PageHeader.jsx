// The top of a page: a small mono eyebrow, the h1, and an optional count line
// ("128 PLAYERS"). The eyebrow is a <p>, not a heading — it labels the page but
// it isn't part of the heading order.
const EYEBROW_COLORS = {
	red: "text-red-soft",
	blue: "text-blue-soft",
	green: "text-green-soft",
	yellow: "text-yellow",
}

function PageHeader({ eyebrow, eyebrowColor = "green", title, count, children, className = "" }) {
	return (
		<header
			className={`flex flex-wrap items-end justify-between gap-5 border-b border-line pb-4 ${className}`}
		>
			<div className="flex flex-col gap-2">
				{eyebrow && (
					<p className={`font-mono text-xs tracking-[0.18em] ${EYEBROW_COLORS[eyebrowColor] ?? EYEBROW_COLORS.green}`}>
						{eyebrow}
					</p>
				)}
				<h1 className="font-title text-[clamp(26px,5.5vw,34px)] font-extrabold text-white">{title}</h1>
				{count && <p className="font-mono text-[13px] text-muted">{count}</p>}
			</div>
			{children}
		</header>
	)
}

export default PageHeader
