import { URGENT_SECONDS } from "@/components/game/arena.js"
import Avatar from "@/components/ui/Avatar.jsx"
import { CARD_BACK } from "@/lib/cards.js"
// Why src/assets/ONE.png is in the repo: the badge below. It marks the player who
// is down to a single card, the one thing everybody at the table has to notice.
// Kept on purpose even if nothing else ever imports it (see the redesign spec).
import oneBadge from "@/assets/ONE.png"

const MAX_BACKS = 5

// A colour per seat, so the same opponent keeps the same colour all game. It is
// the design's list, read from the @theme tokens in index.css rather than typed
// out again — the theme is where this palette is decided. It runs out only past
// nine opponents, where it wraps.
const SEAT_COLORS = [
	"var(--color-red)",
	"var(--color-blue)",
	"var(--color-green)",
	"var(--color-yellow)",
	"var(--color-red-soft)",
	"var(--color-blue-soft)",
	"var(--color-green-soft)",
	"#FFFFFF",
	"var(--color-dim)",
]

// One opponent, as a column of spans: photo, name, cards left and — while it is
// their turn — a bar draining towards zero.
//
// Spans all the way down on purpose: when a Seven swap is being aimed, the whole
// seat sits inside a <button>, and a <div> or a <ul> inside a button is invalid
// HTML. `compact` and `avatarSize` come from the table, which is the only place
// that knows how tall the arena is.
function Seat({ player, index = 0, isTurn = false, compact = false, avatarSize, seconds = null, totalSeconds = null }) {
	const accent = SEAT_COLORS[index % SEAT_COLORS.length]
	const backs = Math.min(player.hand_count ?? 0, MAX_BACKS)
	const urgent = seconds !== null && seconds <= URGENT_SECONDS
	const showTimer = isTurn && seconds !== null && Boolean(totalSeconds)
	const left = showTimer ? Math.max(0, Math.round((seconds / totalSeconds) * 100)) : 0

	return (
		<span className="flex w-full flex-col items-center gap-[clamp(3px,0.6vh,7px)]">
			<span
				className="relative flex flex-none items-center justify-center rounded-full border-2"
				style={{
					width: avatarSize,
					height: avatarSize,
					borderColor: isTurn ? "#FFFFFF" : accent,
					background: `color-mix(in srgb, ${accent} 12%, transparent)`,
					boxShadow: isTurn ? "0 0 24px rgba(255,255,255,0.3)" : undefined,
				}}
			>
				<Avatar src={player.avatar_url} name={player.name} size="fill" />
				{player.hand_count === 1 && (
					<img
						src={oneBadge}
						alt="ONE"
						className="absolute -top-4 left-1/2 w-[clamp(34px,5vw,46px)] -translate-x-1/2 drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)]"
					/>
				)}
			</span>

			<span className="max-w-full truncate font-title text-[clamp(13px,1.5vw,16px)] font-bold text-white">
				{player.name}
			</span>

			<span className="flex items-center gap-1.5">
				{/* The card backs are decoration for the number beside them, and there
				    is no room for them in a short arena. */}
				{!compact && (
					<span className="flex">
						{Array.from({ length: backs }, (_, i) => (
							<img key={i} src={CARD_BACK} alt="" className="w-4 not-first:-ml-2" />
						))}
					</span>
				)}
				<span className="font-mono text-xs font-bold text-white/85">
					{compact ? `${player.hand_count} ${player.hand_count === 1 ? "card" : "cards"}` : player.hand_count}
				</span>
			</span>

			{showTimer && (
				<span className="block h-[5px] w-full overflow-hidden rounded-full bg-white/10">
					<i
						className="block h-full transition-[width] duration-1000 ease-linear"
						style={{ width: `${left}%`, background: urgent ? "var(--color-red)" : "rgba(255,255,255,0.6)" }}
					/>
				</span>
			)}

			{/* Whose turn it is can't be left to a white ring and a moving bar: it is
			    said in words too, for anyone who can't see either. */}
			{isTurn && <span className="sr-only">playing now</span>}

			{!player.is_connected && (
				<span className="font-mono text-[10px] tracking-[0.12em] text-white/60">AWAY</span>
			)}
		</span>
	)
}

export default Seat
