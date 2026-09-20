// Where to land after signing in with Google or 42.
//
// The router's `state.from` can't survive this: signing in with a provider
// leaves the site entirely, and everything React was holding goes with it.
// sessionStorage does survive the round trip, and is dropped when the tab
// closes, so a destination never outlives the attempt that set it.
const KEY = "oauth_from"

export function rememberDestination(from) {
	try {
		sessionStorage.setItem(KEY, from)
	} catch {
		/* storage blocked — the sign-in still works, it just lands on Home */
	}
}

// Reading it also clears it: a destination is used once, never inherited by
// the next sign-in.
export function takeDestination(fallback = "/") {
	try {
		const saved = sessionStorage.getItem(KEY)
		sessionStorage.removeItem(KEY)
		return saved || fallback
	} catch {
		return fallback
	}
}
