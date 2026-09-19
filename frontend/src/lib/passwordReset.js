// The reset link arrives in two shapes, because two libraries write it.
//
//   dj-rest-auth  ->  /reset-password/<uid>/<token>/     (serializers.py)
//   allauth       ->  /reset-password/<uid>-<token>/     (adapters.py)
//
// `POST /api/auth/password/reset/` — the one the app sends — produces the first.
// The second only appears if allauth's own flow is triggered directly, and it
// packs both halves into one segment. Either way the confirm endpoint wants them
// apart, so the page asks here rather than guessing from the route it matched.
//
// The split is on the FIRST hyphen: the uid never contains one (base36), the
// token always does.
export function splitResetKey(key) {
	const at = key.indexOf("-")
	if (at === -1) return { uid: key, token: "" }
	return { uid: key.slice(0, at), token: key.slice(at + 1) }
}

// What the page has, whichever route matched. `uid`/`token` come from the
// two-segment route; `key` from the one-segment one.
export function resetCredentials({ uid, token, key }) {
	if (uid && token) return { uid, token }
	if (key) return splitResetKey(key)
	return { uid: "", token: "" }
}
