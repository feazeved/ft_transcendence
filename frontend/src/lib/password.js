// What the server will actually accept, worked out in the browser so the form
// can say it before the round trip.
//
// These mirror `AUTH_PASSWORD_VALIDATORS` in backend/core/settings.py, which is
// Django's four defaults with no options set. Keep the two in step: a rule shown
// green here and refused there is worse than no list at all.
//
//   MinimumLengthValidator           -> "length", min_length=8
//   NumericPasswordValidator         -> "numeric"
//   UserAttributeSimilarityValidator -> "similar", max_similarity=0.7
//
// CommonPasswordValidator is deliberately NOT listed. The server still enforces
// it — a password from its 20,000-word list is still refused — but the list
// lives on the server, so the line could never go green while you typed and read
// as a rule you had failed. A rule that cannot be satisfied in front of you is
// worse than one you meet at the point of registering, where the error says so.

export const MIN_LENGTH = 8
export const MAX_SIMILARITY = 0.7

// difflib.SequenceMatcher(a, b).quick_ratio(), which is what Django compares
// against max_similarity: 2·M/T, where M counts the characters the two share
// and T is their combined length. Python walks `a` spending a tally of `b`'s
// characters, so each one can only be matched once.
export function quickRatio(a, b) {
	const total = a.length + b.length
	if (total === 0) return 1

	const available = new Map()
	for (const ch of b) available.set(ch, (available.get(ch) ?? 0) + 1)

	let matches = 0
	for (const ch of a) {
		const left = available.get(ch) ?? 0
		if (left > 0) {
			matches += 1
			available.set(ch, left - 1)
		}
	}
	return (2 * matches) / total
}

// Django skips a comparison when the password is so much longer than the value
// that it could not clear the bar anyway (`exceeds_maximum_length_ratio`).
// Mirrored so a skipped pair here is a skipped pair there.
function tooLongToMatter(password, value) {
	return password.length >= 10 * value.length && value.length < (MAX_SIMILARITY / 2) * password.length
}

// True when the password is too close to one of the user's own details. Django
// checks each attribute whole and also split on non-word characters, so
// "ana.silva@mail.com" is compared as "ana", "silva", "mail", "com" and whole.
export function tooSimilar(password, attributes = []) {
	if (!password) return false
	const lowered = password.toLowerCase()

	for (const attribute of attributes) {
		if (typeof attribute !== "string" || !attribute) continue
		const value = attribute.toLowerCase()
		const parts = [...value.split(/\W+/).filter(Boolean), value]
		for (const part of parts) {
			if (tooLongToMatter(lowered, part)) continue
			if (quickRatio(lowered, part) >= MAX_SIMILARITY) return true
		}
	}
	return false
}

export function passwordRules(password, { username = "", email = "" } = {}) {
	return [
		{
			id: "length",
			label: `At least ${MIN_LENGTH} characters`,
			state: password.length >= MIN_LENGTH ? "met" : "unmet",
		},
		{
			id: "numeric",
			label: "Not only numbers",
			state: password && !/^\d+$/.test(password) ? "met" : "unmet",
		},
		{
			id: "similar",
			label: "Not too close to your username or email",
			state: password && !tooSimilar(password, [username, email]) ? "met" : "unmet",
		},
	]
}

// Every rule shown is satisfied. The submit button does not wait on this — the
// server is still the authority, and a form that refuses to submit cannot show
// the server's reason for saying no.
export function meetsLocalRules(password, user) {
	return passwordRules(password, user).every((rule) => rule.state === "met")
}
