// A titled group of people. The page has the only h1, so these are h2 — the
// design draws them small, but size is a class, not a tag.
const SQUARES = {
	red: "bg-red",
	blue: "bg-blue",
	green: "bg-green",
	yellow: "bg-yellow",
}

function FriendSection({ title, accent = "green", count, empty, children }) {
	return (
		<section className="flex flex-col gap-3">
			<h2 className="flex items-center gap-2.5 font-mono text-xs uppercase tracking-[0.15em] text-muted">
				<span aria-hidden="true" className={`h-2 w-2 rounded-sm ${SQUARES[accent] ?? SQUARES.green}`} />
				{title}
				{count > 0 && <span className="text-white">({count})</span>}
			</h2>

			{count === 0 ? (
				<p className="rounded-md border border-dashed border-[#2b2b2b] px-5 py-3.5 font-mono text-[13px] text-muted">
					{empty}
				</p>
			) : (
				<ul className="flex flex-col gap-2">{children}</ul>
			)}
		</section>
	)
}

export default FriendSection
