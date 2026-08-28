const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900]

// Reads straight from the --color-plum-* custom properties
// defined in index.css's @theme block, via inline style — Tailwind's build-time
// class scanner can't see a dynamically built "bg-plum-500" string, but the
// browser can resolve var(--color-plum-500) at runtime just fine.
function Swatch({ name, shade }) {
	return (
		<div className="flex flex-col overflow-hidden rounded-lg border border-border">
			<div className="h-16" style={{ background: `var(--color-${name}-${shade})` }} />
			<div className="bg-card px-2 py-1 text-xs text-foreground">{name}-{shade}</div>
		</div>
	)
}

function Test() {
	return (
		<div className="min-h-screen bg-background text-foreground p-8 space-y-12">
			<header className="space-y-2">
				<h1 className="text-4xl font-bold">Palette test page</h1>
				<p className="text-muted-foreground">
					Every color token from index.css, rendered so you can see contrast and pairing at a glance.
				</p>
			</header>

			{/* Buttons */}
			<section aria-labelledby="test-buttons-heading" className="space-y-4">
				<h2 id="test-buttons-heading" className="text-2xl font-semibold">Buttons</h2>
				<div className="flex flex-wrap gap-4">
					<button className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90">
						Primary
					</button>
					<button className="rounded-md bg-secondary px-4 py-2 text-secondary-foreground hover:opacity-90">
						Secondary
					</button>
					<button className="rounded-md bg-destructive px-4 py-2 text-destructive-foreground hover:opacity-90">
						Destructive
					</button>
					<button className="rounded-md bg-success px-4 py-2 text-white hover:opacity-90">
						Success
					</button>
					<button className="rounded-md border border-border bg-transparent px-4 py-2 text-foreground hover:bg-muted">
						Outline
					</button>
					<button className="rounded-md bg-muted px-4 py-2 text-muted-foreground cursor-not-allowed" disabled>
						Disabled
					</button>
				</div>
			</section>

			{/* Cards */}
			<section aria-labelledby="test-cards-heading" className="space-y-4">
				<h2 id="test-cards-heading" className="text-2xl font-semibold">Cards</h2>
				<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<section aria-labelledby="test-card-basic" className="rounded-xl border border-border bg-card p-5 shadow-sm">
						<h3 id="test-card-basic" className="text-lg font-semibold text-foreground">Basic card</h3>
						<p className="mt-2 text-sm text-muted-foreground">
							Uses bg-card, border-border and text-muted-foreground.
						</p>
					</section>
					<section aria-labelledby="test-card-accent" className="rounded-xl border border-border bg-accent p-5 shadow-sm">
						<h3 id="test-card-accent" className="text-lg font-semibold text-foreground">Accent card</h3>
						<p className="mt-2 text-sm text-foreground/70">
							Uses the flat --color-accent token.
						</p>
					</section>
					<section aria-labelledby="test-card-primary" className="rounded-xl bg-primary p-5 text-primary-foreground shadow-sm">
						<h3 id="test-card-primary" className="text-lg font-semibold">Primary card</h3>
						<p className="mt-2 text-sm text-primary-foreground/80">
							Uses bg-primary with primary-foreground text.
						</p>
						<button className="mt-4 rounded-md bg-primary-foreground px-3 py-1.5 text-sm text-primary">
							Action
						</button>
					</section>
				</div>
			</section>

			{/* Form elements */}
			<section aria-labelledby="test-form-heading" className="space-y-4">
				<h2 id="test-form-heading" className="text-2xl font-semibold">Form elements</h2>
				<div className="flex max-w-sm flex-col gap-3">
					<input
						type="text"
						placeholder="Text input"
						className="rounded-md border border-input bg-card px-3 py-2 text-foreground outline-none focus:ring-2 focus:ring-ring"
					/>
					<div className="flex flex-wrap gap-2">
						<span className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground">Badge</span>
						<span className="rounded-full bg-success px-3 py-1 text-xs text-white">Success</span>
						<span className="rounded-full bg-destructive px-3 py-1 text-xs text-destructive-foreground">Destructive</span>
					</div>
				</div>
			</section>

			{/* Text tokens */}
			<section aria-labelledby="test-text-heading" className="space-y-2">
				<h2 id="test-text-heading" className="text-2xl font-semibold">Text tokens</h2>
				<p className="text-foreground">text-foreground — main body text</p>
				<p className="text-muted-foreground">text-muted-foreground — secondary text</p>
				<p className="text-primary">text-primary — links, highlights</p>
			</section>

			{/* Full plum scale */}
			<section aria-labelledby="test-plum-heading" className="space-y-4">
				<h2 id="test-plum-heading" className="text-2xl font-semibold">plum-* scale</h2>
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
					{shades.map((shade) => (
						<Swatch key={shade} name="plum" shade={shade} />
					))}
				</div>
			</section>
		</div>
	)
}

export default Test
