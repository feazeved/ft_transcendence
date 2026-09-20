// Both legal pages are the same page with different words, so they share this
// one. `sections` is the single source for the sidebar and the body: a link can
// never point at a section that isn't there, because both come from one list.
//
// The body text arrives as JSX and is styled from here, with descendant
// variants, so each page stays a list of words and nothing else.
const BODY_TYPOGRAPHY = [
	"flex flex-col gap-3",
	"[&_p]:text-base [&_p]:leading-relaxed [&_p]:text-white/70",
	"[&_ul]:list-disc [&_ul]:space-y-2.5 [&_ul]:pl-[22px]",
	"[&_li]:text-base [&_li]:leading-relaxed [&_li]:text-white/70",
	"[&_strong]:font-semibold [&_strong]:text-white",
	"[&_a]:text-yellow [&_a]:underline [&_a:hover]:text-white",
].join(" ")

function LegalPage({ title, updated, sections }) {
	return (
		<div className="mx-auto grid w-full max-w-[1240px] gap-10 px-[clamp(16px,4vw,24px)] pb-[clamp(48px,8vw,88px)] pt-[clamp(28px,6vw,56px)]">
			<header className="flex flex-col gap-2.5 border-b border-line pb-5">
				<p className="font-mono text-xs tracking-[0.18em] text-yellow">LEGAL</p>
				<h1 className="font-logo text-[clamp(38px,5vw,56px)] font-extrabold leading-[1.05] text-white">{title}</h1>
				<p className="font-mono text-[13px] text-muted">
					Last updated: <time dateTime={updated.iso}>{updated.label}</time>
				</p>
			</header>

			<div className="flex flex-wrap items-start gap-8">
				{/* Same-page jumps, so plain <a href="#id"> and not a router Link. */}
				<nav
					aria-label="On this page"
					className="flex flex-[0_1_250px] flex-col gap-1.5 self-start rounded-lg border border-white/10 border-t-4 border-t-yellow bg-panel p-[22px] md:sticky md:top-24"
				>
					<p className="pb-2.5 font-mono text-[11px] tracking-[0.16em] text-muted">ON THIS PAGE</p>
					<ul className="flex flex-col gap-1.5">
						{sections.map((section) => (
							<li key={section.id}>
								<a
									href={`#${section.id}`}
									className="block rounded px-3 py-2 text-sm text-dim transition-colors hover:bg-white/5 hover:text-white"
								>
									{section.title}
								</a>
							</li>
						))}
					</ul>
				</nav>

				<div className="flex min-w-0 max-w-[760px] flex-[1_1_520px] flex-col gap-3.5">
					{sections.map((section) => (
						// scroll-mt keeps the heading clear of the sticky header when a
						// sidebar link jumps here.
						<section
							key={section.id}
							id={section.id}
							className="flex scroll-mt-[100px] flex-col gap-3 rounded-lg border border-white/10 bg-panel p-[clamp(18px,4vw,26px)]"
						>
							<h2 className="font-logo text-[21px] font-bold text-white">{section.title}</h2>
							<div className={BODY_TYPOGRAPHY}>{section.body}</div>
						</section>
					))}
				</div>
			</div>
		</div>
	)
}

export default LegalPage
