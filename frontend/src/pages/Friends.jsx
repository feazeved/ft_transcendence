import { useCallback, useEffect, useMemo, useState } from "react"
import api from "@/lib/api.js"
import { useAuth } from "@/lib/auth.jsx"

const inputClass = "rounded-lg border border-white/10 bg-white/5 px-3 py-2 outline-none focus:border-white/40"
const actionButton = "rounded-lg borderd border-white/30 px-3 py-1 text-sm transition-transform hover:scale-105 cursor-pointer disabled:opacity-40 disabled:hover:scale-100"

function PersonRow({ person, children }) {
	return (
		<li className="flex items-center gap-3 rounded-xl border border-white/15 bg-black px-4 py-2.5">
			<img
			src={person.avatar_url}
			alt=""
			className="h-9 w-9 shrink-0 rounded-full border border-white/20 object-cover"
			/>
			<span className="min-w-0 flex-1">
				<span className="block truncate font-bold leading-tight">
					{person.display_name || person.username}
				</span>
				<span className="flex items-center gap-1.5 text-xs text-white/50">
					<span
						aria-hidden="true"
						className={`inline-block h-2 w-2 rounded-full ${
							person.is_online ? "bg-green" : "bg-white/30"
						}`}
					/>
					{person.is_online ? "Online" : "Offline"}
				</span>
			</span>
			<span className="flex shrink-0 gap-2">{children}</span>
		</li>
	)
}

function Friends() {
	return (
		<>
			<h1>FRIENDS</h1>
		</>
	)
}

export default Friends
