import { passwordRules } from "@/lib/password.js"

// The rules the server enforces, shown while the password is being typed: a
// line goes green the moment it is satisfied and stays muted until then.
//
// Drawn markers rather than typed ones, for the same reason as the room code's
// copy icon — a glyph the font happens to lack renders as an empty box.
const MARKERS = {
	met: {
		className: "text-green-soft",
		status: "done",
		path: <path d="M5 12.5 10 17.5 19 7" />,
	},
	unmet: {
		className: "text-muted",
		status: "not done yet",
		path: <circle cx="12" cy="12" r="5.5" />,
	},
}

function PasswordChecklist({ id, password, username, email }) {
	const rules = passwordRules(password, { username, email })

	return (
		<ul id={id} className="flex flex-col gap-1.5">
			{rules.map(({ id: ruleId, label, state }) => {
				const marker = MARKERS[state] ?? MARKERS.unmet
				return (
					<li key={ruleId} className={`flex items-center gap-2 font-mono text-[11px] leading-5 transition-colors ${marker.className}`}>
						<svg
							width="13"
							height="13"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth={2}
							strokeLinecap="round"
							strokeLinejoin="round"
							aria-hidden="true"
							className="flex-none"
						>
							{marker.path}
						</svg>
						<span>{label}</span>
						{/* The colour carries the state for everybody else. */}
						<span className="sr-only">— {marker.status}</span>
					</li>
				)
			})}
		</ul>
	)
}

export default PasswordChecklist
