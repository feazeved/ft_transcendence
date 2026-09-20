import { pageItems } from "@/lib/leaderboard.js"

// The counting lives in lib/leaderboard.js as a pure function; this only draws.
const PAGE_BUTTON =
	"min-w-11 cursor-pointer rounded-md border-2 px-3 py-[11px] font-logo text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-35"
const STEP_BUTTON = `${PAGE_BUTTON} border-line-strong text-soft hover:border-white hover:text-white`

function Pager({ page, pageSize, count, onPage }) {
	const totalPages = Math.ceil(count / pageSize)
	if (totalPages <= 1) return null

	const first = (page - 1) * pageSize + 1
	const last = Math.min(page * pageSize, count)
	const go = (n) => onPage(Math.min(Math.max(1, n), totalPages))

	return (
		<div className="flex flex-wrap items-center justify-between gap-4 pt-2">
			<p className="font-mono text-xs tracking-[0.12em] text-muted">
				SHOWING {first}–{last} OF {count.toLocaleString("en-US")}
			</p>

			<nav aria-label="Pagination">
				<ul className="flex flex-wrap items-center gap-2">
					<li>
						<button type="button" onClick={() => go(page - 1)} disabled={page === 1} className={STEP_BUTTON}>
							Previous
						</button>
					</li>

					{pageItems(page, totalPages).map((item, i) =>
						item === "gap" ? (
							// Not a button: there is nothing to click on an ellipsis.
							<li key={`gap-${i}`} aria-hidden="true" className="px-1 font-mono text-sm text-muted">
								…
							</li>
						) : (
							<li key={item}>
								<button
									type="button"
									onClick={() => go(item)}
									aria-current={item === page ? "page" : undefined}
									aria-label={`Page ${item}`}
									className={`${PAGE_BUTTON} ${
										item === page
											? "border-yellow bg-yellow text-on-yellow"
											: "border-line-strong text-soft hover:border-white hover:text-white"
									}`}
								>
									{item}
								</button>
							</li>
						),
					)}

					<li>
						<button
							type="button"
							onClick={() => go(page + 1)}
							disabled={page === totalPages}
							className={STEP_BUTTON}
						>
							Next
						</button>
					</li>
				</ul>
			</nav>
		</div>
	)
}

export default Pager
