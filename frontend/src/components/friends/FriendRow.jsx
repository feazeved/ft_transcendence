import FriendMenu from "./FriendMenu.jsx"
import Avatar from "@/components/ui/Avatar.jsx"
import { openChatWith } from "@/components/chat/ChatProvider.jsx"

// One person in a list. The buttons come in as children, so the same row serves
// Requests, Your friends, Sent and Blocked.
//
// The green dot never travels alone: "Online" is written next to it, because a
// colour on its own says nothing to someone who can't tell it apart.
//
// Added with the chat (area 09): `chatWith` puts a Chat button on the row, and
// `menu` tucks the rest behind a ⋮. Only "Your friends" rows use either — the
// design gives live actions only to people you are actually friends with.
//
// Chat does not import the dock. It fires `one:chat-open` on the window and the
// dock, wherever it is on the page, picks it up: the row stays a row and knows
// nothing about conversations.
function FriendRow({ person, accent = "green", busy = false, chatWith, menu, children }) {
	const ACCENTS = {
		red: "border-l-red",
		blue: "border-l-blue",
		green: "border-l-green",
		yellow: "border-l-yellow",
	}
	const name = person.display_name || person.username

	return (
		<li
			className={`flex flex-wrap items-center gap-3.5 rounded-md border border-white/10 border-l-4 bg-panel px-[clamp(12px,3vw,20px)] py-3.5 transition-opacity ${
				ACCENTS[accent] ?? ACCENTS.green
			} ${busy ? "opacity-40" : ""}`}
		>
			<Avatar src={person.avatar_url} name={name} size="sm" ring={accent} />

			<span className="flex min-w-0 flex-[1_1_160px] flex-col gap-0.5">
				<span className="truncate font-title text-[19px] font-bold text-white">{name}</span>
				<span
					className={`flex items-center gap-[7px] font-mono text-[11px] tracking-[0.08em] ${
						person.is_online ? "text-green-soft" : "text-muted"
					}`}
				>
					<i
						aria-hidden="true"
						className={`h-2 w-2 flex-none rounded-full ${person.is_online ? "bg-green" : "bg-white/30"}`}
					/>
					{person.is_online ? "Online" : "Offline"}
				</span>
			</span>

			<span className="flex flex-none flex-wrap items-center gap-2">
				{children}
				{chatWith && (
					<button
						type="button"
						disabled={busy}
						onClick={() => openChatWith(chatWith)}
						className="cursor-pointer rounded-md border-2 border-green bg-transparent px-4 py-2.5 font-logo text-[13px] font-semibold text-green-soft transition-colors hover:bg-green hover:text-on-green disabled:cursor-not-allowed disabled:opacity-50"
					>
						Chat
					</button>
				)}
				{menu && menu.length > 0 && (
					<FriendMenu
						label={`More actions for ${name}`}
						items={menu.map((item) => ({ ...item, disabled: busy }))}
					/>
				)}
			</span>
		</li>
	)
}

export default FriendRow
