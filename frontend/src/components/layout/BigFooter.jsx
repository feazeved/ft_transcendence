import BrandMark from "@/components/ui/BrandMark.jsx"
import ButtonLink from "@/components/ui/ButtonLink.jsx"

// Home's footer. Every other page keeps the slim one.
//
// The design says "PEGI 3" and points at a `pegi3.jpg`; the repo's image is the
// PEGI 7 badge, as a .png, so the rating here is 7.
const PEGI = [
	{ src: "/pegi/pegi7.png", alt: "PEGI 7" },
	{ src: "/pegi/badlanguage.jpg", alt: "PEGI descriptor: Bad Language" },
	{ src: "/pegi/violence.jpg", alt: "PEGI descriptor: Violence" },
	{ src: "/pegi/fear.jpg", alt: "PEGI descriptor: Fear" },
]

const TEAM = [
	"Alex Barbosa (alebarbo)",
	"Daniel Fonseca (dda-fons)",
	"Felipe Azevedo (feazeved)",
	"Wallace Lucas (wlucas-f)",
]

const GITHUB = "https://github.com/feazeved/ft_transcendence"

function BigFooter() {
	return (
		<footer className="mt-auto border-t border-line">
			<div className="mx-auto flex max-w-[1240px] flex-col gap-[34px] px-[clamp(16px,4vw,24px)] pb-10 pt-[clamp(32px,6vw,56px)]">
				<div className="flex flex-wrap items-start justify-between gap-10">
					<p className="rounded-md border-[3px] border-yellow bg-page px-[26px] py-5 font-mono text-[22px] font-bold leading-snug text-yellow">
						ANOTHER +4?! OH, BUZZ OFF.
					</p>

					<div className="flex flex-wrap items-center gap-x-[18px] gap-y-3.5">
						{PEGI.map((badge) => (
							<img key={badge.src} src={badge.src} alt={badge.alt} className="h-[84px] w-auto rounded-sm" />
						))}
						<p className="max-w-[150px] font-mono text-[11px] leading-relaxed tracking-[0.06em] text-muted">
							RATED PEGI 7
							<br />
							CONTAINS MILD BAD LANGUAGE, VIOLENCE AND FEAR
						</p>
					</div>
				</div>

				<div className="flex flex-wrap items-end justify-between gap-8">
					<div className="flex flex-col gap-3.5">
						<BrandMark size="lg" />
						<p className="max-w-[400px] text-[15px] leading-normal text-[#8c8c8c]">
							Built at night, between badly lost games.
						</p>
					</div>

					<div className="flex min-w-[220px] flex-col gap-2.5">
						<h2 className="font-mono text-xs tracking-[0.16em] text-muted">TEAM</h2>
						<ul className="flex flex-col gap-1.5 font-mono text-sm text-soft">
							{TEAM.map((member) => (
								<li key={member}>{member}</li>
							))}
						</ul>
					</div>

					{/* Leaving the site, so an <a>, and a new tab needs rel="noreferrer". */}
					<ButtonLink
						to={GITHUB}
						external
						target="_blank"
						rel="noopener noreferrer"
						variant="outline"
						color="green"
						className="px-[22px] py-3.5 font-mono text-[15px] font-bold tracking-[0.06em]"
					>
						GITHUB →
					</ButtonLink>
				</div>

				<div className="flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-5.5 font-mono text-xs text-muted">
					<div className="flex flex-wrap gap-[18px]">
						<span>© 2026 ONE</span>
						<span>ACADEMIC PROJECT, NOT AFFILIATED WITH UNO®</span>
					</div>
					<nav aria-label="Legal">
						<ul className="flex flex-wrap gap-2.5">
							<li>
								<ButtonLink to="/privacy-policy" variant="small">PRIVACY POLICY</ButtonLink>
							</li>
							<li>
								<ButtonLink to="/terms-of-service" variant="small">TERMS OF SERVICE</ButtonLink>
							</li>
						</ul>
					</nav>
				</div>
			</div>
		</footer>
	)
}

export default BigFooter
