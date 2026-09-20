import ft from "@/assets/42.svg"

// The "OR" rule and the two provider buttons, shared by Login and Register.
//
// `oauth` is the provider the browser is currently leaving for, so the buttons
// can lock and say "Signing in…" until the redirect actually happens. The ids
// are the ones the pages already had, kept for anything that targets them.
function GoogleIcon() {
	return (
		<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
			<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
			<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
			<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05" />
			<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335" />
		</svg>
	)
}

const PROVIDER_BUTTON =
	"inline-flex flex-1 basis-[180px] cursor-pointer items-center justify-center gap-2.5 rounded-md border border-[#747775] bg-white px-4 py-3.5 font-logo text-sm font-semibold text-[#3c4043] transition-colors hover:bg-[#e9e9e9] disabled:cursor-not-allowed disabled:opacity-60"

function OAuthButtons({ page = "login", disabled = false, oauth = null, onStart }) {
	return (
		<>
			<div className="flex items-center gap-3.5">
				<i aria-hidden="true" className="h-px flex-1 bg-white/10" />
				<span className="font-mono text-[11px] tracking-[0.14em] text-muted">OR</span>
				<i aria-hidden="true" className="h-px flex-1 bg-white/10" />
			</div>

			<div className="flex flex-wrap gap-3">
				<button
					id={`google-${page}-btn`}
					type="button"
					disabled={disabled}
					onClick={() => onStart("google", "/accounts/google/login/")}
					className={PROVIDER_BUTTON}
				>
					<GoogleIcon />
					{oauth === "google" ? "Signing in…" : "Continue with Google"}
				</button>
				<button
					id={`fortyTwo-${page}-btn`}
					type="button"
					disabled={disabled}
					onClick={() => onStart("fortytwo", "/accounts/fortytwo/login/")}
					className={PROVIDER_BUTTON}
				>
					<img src={ft} alt="" className="h-[18px] w-[18px]" />
					{oauth === "fortytwo" ? "Signing in…" : "Continue with 42"}
				</button>
			</div>
		</>
	)
}

export default OAuthButtons
