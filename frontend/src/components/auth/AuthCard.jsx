// The card Login and Register share: centred on the page, with the design's
// green top border, a mono eyebrow and the page's one h1.
function AuthCard({ eyebrow, title, children }) {
	return (
		<section className="flex flex-1 items-center justify-center px-6 py-16">
			<div className="flex w-[min(100%,520px)] flex-col gap-[26px] rounded-lg border border-white/10 border-t-4 border-t-green bg-panel p-[clamp(20px,5vw,34px)]">
				<div className="flex flex-col gap-2.5">
					<p className="font-mono text-xs tracking-[0.18em] text-green-soft">{eyebrow}</p>
					<h1 className="font-title text-[clamp(26px,5.5vw,34px)] font-extrabold text-white">{title}</h1>
				</div>
				{children}
			</div>
		</section>
	)
}

export default AuthCard
