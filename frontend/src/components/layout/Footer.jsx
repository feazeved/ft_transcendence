import BrandMark from "@/components/ui/BrandMark.jsx"
import ButtonLink from "@/components/ui/ButtonLink.jsx"

// The slim footer, on every page. Home gets a bigger one of its own in area 02.
function Footer() {
	return (
		<footer className="mt-auto border-t border-line">
			<div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-5 px-[clamp(16px,4vw,24px)] py-[clamp(24px,5vw,34px)]">
				<BrandMark size="md" />
				<div className="flex flex-wrap gap-[18px] font-mono text-xs text-muted">
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
		</footer>
	)
}

export default Footer
