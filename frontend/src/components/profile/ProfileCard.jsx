import Avatar from "@/components/ui/Avatar.jsx"
import Button from "@/components/ui/Button.jsx"
import FormField from "@/components/ui/FormField.jsx"
import { ErrorMessage } from "@/components/ui/Message.jsx"
import { LogoutIcon, PencilIcon } from "@/components/profile/ProfileIcons.jsx"

// The account card: photo, the three fields, and whichever pair of buttons the
// current mode needs. It holds no state — the page owns the draft and passes it
// down, so Cancel is just the page throwing the draft away.
function ProfileCard({
	editing,
	draft,
	onField,
	user,
	avatarSrc,
	error,
	saving,
	onStartEdit,
	onCancel,
	onSave,
	onOpenPicker,
	onLogout,
}) {
	return (
		<section className="flex flex-col gap-[22px] rounded-lg border border-white/10 border-t-4 border-t-yellow bg-panel p-[clamp(18px,4vw,26px)]">
			<h2 className="sr-only">Account</h2>

			<div className="flex items-center gap-5">
				<div className="relative flex-none">
					<Avatar src={avatarSrc} name={user.username} size="xl" ring="yellow" />
					{editing && (
						<button
							type="button"
							onClick={onOpenPicker}
							aria-label="Change profile picture"
							className="absolute bottom-0 right-0 flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-full border-2 border-yellow bg-page transition-transform hover:scale-110"
						>
							<PencilIcon className="h-[18px] w-[18px]" />
						</button>
					)}
				</div>

				<div className="flex min-w-0 flex-col gap-1.5">
					{editing ? (
						<FormField
							label="USERNAME"
							tone="soft"
							type="text"
							value={draft.username}
							onChange={(e) => onField("username", e.target.value)}
						/>
					) : (
						<>
							<p className="font-mono text-[11px] tracking-[0.16em] text-muted">USERNAME</p>
							<p className="truncate font-title text-[28px] font-bold text-white">{user.username}</p>
						</>
					)}
				</div>
			</div>

			<div className="flex flex-col gap-[18px]">
				{editing ? (
					<>
						<FormField
							label="NAME"
							tone="soft"
							type="text"
							value={draft.name}
							onChange={(e) => onField("name", e.target.value)}
						/>
						<FormField
							label="EMAIL (CAN'T BE CHANGED YET)"
							tone="soft"
							type="email"
							value={user.email}
							readOnly
						/>
					</>
				) : (
					<>
						<div className="flex flex-col gap-1.5">
							<p className="font-mono text-[11px] tracking-[0.16em] text-muted">NAME</p>
							<p className="text-[19px] text-white">{user.name}</p>
						</div>
						<div className="flex flex-col gap-1.5">
							<p className="font-mono text-[11px] tracking-[0.16em] text-muted">EMAIL</p>
							<p className="break-all text-[19px] text-white">{user.email}</p>
						</div>
					</>
				)}
			</div>

			{error && <ErrorMessage>{error}</ErrorMessage>}

			<div className="flex flex-wrap gap-3">
				{editing ? (
					<>
						<Button
							color="green"
							onClick={onSave}
							disabled={saving}
							className="px-6 py-3.5 font-mono text-sm tracking-[0.06em]"
						>
							{saving ? "Saving…" : "Save"}
						</Button>
						<Button variant="small" onClick={onCancel} disabled={saving} className="px-6 py-3.5 text-sm">
							Cancel
						</Button>
					</>
				) : (
					<>
						<Button
							variant="outline"
							color="yellow"
							onClick={onStartEdit}
							className="gap-2.5 px-6 py-3.5 font-mono text-sm tracking-[0.06em]"
						>
							Edit
							<PencilIcon className="h-[18px] w-[18px]" />
						</Button>
						<Button variant="small" onClick={onLogout} className="gap-2.5 px-6 py-3.5 text-sm">
							Logout
							<LogoutIcon className="h-[18px] w-[18px]" />
						</Button>
					</>
				)}
			</div>
		</section>
	)
}

export default ProfileCard
