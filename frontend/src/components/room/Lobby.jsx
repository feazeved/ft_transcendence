import LobbyHeader from "@/components/room/LobbyHeader.jsx"
import LobbyTable from "@/components/room/LobbyTable.jsx"
import RoomSettingsPanel from "@/components/room/RoomSettingsPanel.jsx"
import Button from "@/components/ui/Button.jsx"
import { ErrorMessage } from "@/components/ui/Message.jsx"

const LEAVE =
	"cursor-pointer rounded-md border-2 border-line-strong px-[26px] py-4 font-logo text-base font-semibold text-soft transition-colors hover:border-red hover:text-red-soft"

// The room while it is still filling up. Like GameTable, this file only puts the
// sections in order; the markup lives in the sections.
//
// Who may press Start is the server's answer, not one worked out again here:
// `you_may_start` is the same rule `GameViewSet.start` enforces. It is the host
// in an ordinary room and *any participant* at a tournament table, where the
// host is whoever the draw happened to seat first and may not even have arrived
// yet. A game still needs two players in seats — the server would refuse anyway,
// but a button that cannot work should not look like it can.
function Lobby({ lobby, user, connected, error, onSeat, onSpectate, onStart, onLeave }) {
	const seats = Array.isArray(lobby.seats) ? lobby.seats : []
	const seated = seats.filter(Boolean).length
	const mayStart = lobby.you_may_start ?? lobby.host === user?.username

	return (
		<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-[26px] px-[clamp(16px,4vw,24px)] pb-[clamp(48px,8vw,88px)] pt-[clamp(28px,6vw,56px)] text-white">
			<LobbyHeader lobby={lobby} connected={connected} />

			<div className="flex flex-wrap items-start gap-4">
				<section className="flex min-w-0 flex-[1_1_440px] flex-col gap-4">
					<h2 className="font-logo text-[19px] font-bold text-white">
						Players{" "}
						<span className="font-mono text-sm font-normal text-muted">
							{seated}/{seats.length}
						</span>
					</h2>

					{lobby.you_are_spectating && (
						<p className="rounded-md border border-white/10 bg-panel px-[18px] py-4 text-[15px] text-white/70">
							You're spectating. Take a free seat to join the game.
						</p>
					)}

					<LobbyTable seats={seats} mySeat={lobby.your_seat} onSeat={onSeat} />
				</section>

				<RoomSettingsPanel lobby={lobby} user={user} onSpectate={onSpectate} />
			</div>

			{error && <ErrorMessage className="text-center">{error}</ErrorMessage>}

			<div className="flex flex-wrap items-center justify-center gap-3.5 pt-3">
				<button type="button" onClick={onLeave} className={LEAVE}>
					Leave room
				</button>
				{mayStart && (
					<Button color="green" onClick={onStart} disabled={seated < 2}>
						Start game
					</Button>
				)}
			</div>
		</div>
	)
}

export default Lobby
