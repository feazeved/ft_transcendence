import { CARD_BACK } from "@/lib/cards";

const DEFAULT_AVATAR = "/profile/default.jpg"
const MAX_BACKS = 5

function Seat({ player, isTurn, isMe}){
    const backs = Math.min(player.hand_count, MAX_BACKS)

    return (
		<div className={`flex w-full flex-col items-center gap-1 text-center ${player.is_connected ? "" : "opacity-50"}`}>
			<span className={`relative flex aspect-square w-[55%] min-w-11 rounded-full ${isTurn ? "rainbow-shadow" : ""}`}>
				<img
					src={player.avatar_url ?? DEFAULT_AVATAR}
					alt=""
					className={`h-full w-full rounded-full border object-cover ${isMe ? "border-blue-700" : "border-white/20"}`}
				/>
				{player.hand_count === 1 && (
					<span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">
						1 card
					</span>
				)}
			</span>
			<span title={player.name} className="w-full truncate text-sm font-bold leading-tight">{player.name}</span>
			<span className="flex items-center">
				{Array.from({ length: backs }, (_, i) => (
					<img key={i} src={CARD_BACK} alt="" className="w-4 not-first:-ml-2" />
				))}
				<span className="ml-1 text-xs text-white/70">{player.hand_count}</span>
			</span>
			{!player.is_connected && <span className="text-[10px] uppercase text-white/60">away</span>}
		</div>
    )
}

export default Seat