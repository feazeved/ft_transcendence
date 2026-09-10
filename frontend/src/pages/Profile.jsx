// Rendered as a full page on /profile, and as a popup when opened from the
// navbar (see routes.jsx). Keep the markup layout-agnostic so it works in both:
// no min-h-screen, no back link — the page has the navbar, the modal has its
// own close button.

import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import PasswordInput from "../components/PasswordInput.jsx"
import AvatarPicker from "../components/AvatarPicker.jsx"
import api from "../lib/api.js"
import { useAuth } from "../lib/auth.jsx"
import pencil from "../assets/pencil.svg"
import logoutIcon from "../assets/logout.svg"

async function toUploadableFile(avatar) {
	if (avatar instanceof File) return avatar
	const response = await fetch(avatar)
	const blob = await response.blob()
	return new File([blob], avatar.split("/").pop(), { type: blob.type })
}

// Changing a password is its own endpoint with its own validation, so it gets
// its own form. Folding it into the profile save is what made the old field a
// no-op: it looked editable, went nowhere, and reported nothing.
function ChangePassword({ inputClass }) {
	const { logout } = useAuth()
	const navigate = useNavigate()
	const [open, setOpen] = useState(false)
	const [next, setNext] = useState("")
	const [confirm, setConfirm] = useState("")
	const [busy, setBusy] = useState(false)
	const [error, setError] = useState("")
	const [done, setDone] = useState(false)

	const close = () => {
		setOpen(false)
		setNext("")
		setConfirm("")
		setError("")
	}

	const submit = async (e) => {
		e.preventDefault()
		setError("")
		if (next !== confirm) return setError("The two passwords don't match.")

		setBusy(true)
		try {
			await api.post("/auth/password/change/", {
				new_password1: next,
				new_password2: confirm,
			})
			// Changing the password rotates Django's session auth hash, so the
			// cookie we are holding is already dead — every later call would 403.
			// Say so plainly instead of leaving a page that silently stops working.
			close()
			setDone(true)
		} catch (err) {
			// The server rejects weak or too-common passwords — show what it said.
			setError(err.message || "Could not change your password.")
		} finally {
			setBusy(false)
		}
	}

	return (
		<div className="px-3 pb-3">
			<p className="text-sm tracking-wide text-white/60">Password</p>

			{open ? (
				<form onSubmit={submit}>
					<PasswordInput
						label="New password"
						name="new-password"
						value={next}
						onChange={(e) => setNext(e.target.value)}
						className={`${inputClass} mb-2 w-full`}
					/>
					<PasswordInput
						label="Confirm new password"
						name="confirm-password"
						value={confirm}
						onChange={(e) => setConfirm(e.target.value)}
						className={`${inputClass} mb-3 w-full`}
					/>
					{error && (
						<p role="alert" className="mb-3 text-sm text-red-400">
							{error}
						</p>
					)}
					<div className="flex justify-center gap-3">
						<button
							type="submit"
							disabled={busy || !next}
							className="rounded-lg border border-white px-4 py-2 transition-transform hover:scale-105 cursor-pointer disabled:opacity-50 disabled:hover:scale-100"
						>
							{busy ? "Updating…" : "Update password"}
						</button>
						<button
							type="button"
							onClick={close}
							disabled={busy}
							className="rounded-lg px-4 py-2 transition-transform hover:scale-105 cursor-pointer disabled:opacity-50 disabled:hover:scale-100"
						>
							Cancel
						</button>
					</div>
				</form>
			) : (
				<div className="mb-3">
					{done ? (
						<div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
							<p className="text-sm">
								Password updated. Changing it signs you out everywhere, so you
								need to log in again with the new one.
							</p>
							<button
								type="button"
								onClick={() => {
									logout()
									navigate("/login", { state: { from: "/profile" } })
								}}
								className="mt-2 rounded-lg border border-white px-3 py-1 text-sm transition-transform hover:scale-105 cursor-pointer"
							>
								Log in again
							</button>
						</div>
					) : (
						<div className="flex items-center gap-3">
							<p className="text-lg">{"\u2022".repeat(8)}</p>
							<button
								type="button"
								onClick={() => setOpen(true)}
								className="rounded-lg border border-white px-3 py-1 text-sm transition-transform hover:scale-105 cursor-pointer"
							>
								Change
							</button>
						</div>
					)}
				</div>
			)}
		</div>
	)
}

function Profile() {
	const { user, login, logout } = useAuth()

	const [email] = useState(user?.email ?? "")
	const [name, setName] = useState(user?.display_name ?? "")
	const [username, setUsername] = useState(user?.username ?? "")
	// The backend always sends an avatar_url, falling back to the site default,
	// so there is nothing to substitute here.
	const [avatar, setAvatar] = useState(user?.avatar_url ?? "")
	const [stats, setStats] = useState(null)

	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState({ name, username, email, avatar })
	const [avatarPreview, setAvatarPreview] = useState(avatar)
	const objectUrlRef = useRef(null)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState("")
	const [pickerOpen, setPickerOpen] = useState(false)

	const revokePreview = () => {
		if (objectUrlRef.current) {
			URL.revokeObjectURL(objectUrlRef.current)
			objectUrlRef.current = null
		}
	}

	useEffect(() => revokePreview, [])

	// Stats are decoration: if they fail to load the page still works, so the
	// error is swallowed and the numbers stay as dashes.
	useEffect(() => {
		if (!user?.public_id) return undefined
		let cancelled = false

		api.get(`/users/${user.public_id}/stats/`)
			.then((data) => {
				if (!cancelled) setStats(data)
			})
			.catch(() => {})

		return () => {
			cancelled = true
		}
	}, [user?.public_id])

	const navigate = useNavigate()

	const handleLogout = () => {
		logout()
		navigate("/")
	}

	const startEdit = () => {
		setDraft({ name, username, email, avatar })
		setAvatarPreview(avatar)
		setError("")
		setEditing(true)
	}

	const cancelEdit = () => {
		revokePreview()
		setEditing(false)
		setError("")
	}

	const buildChanges = () => {
		const changes = {}
		if (draft.name !== name) changes.name = draft.name
		if (draft.username !== username) changes.username = draft.username
		if (draft.avatar !== avatar) changes.avatar = draft.avatar
		return changes
	}

	const save = async (e) => {
		e.preventDefault()
		const changes = buildChanges()
		if (Object.keys(changes).length === 0) {
			setEditing(false)
			return
		}

		setSaving(true)
		setError("")
		try {
			const form = new FormData()
			if ("name" in changes) form.append("display_name", changes.name)
			if ("username" in changes) form.append("username", changes.username)
			if ("avatar" in changes) form.append("avatar", await toUploadableFile(changes.avatar))

			const updated = await api.patch("/auth/user/", form)

			setName(updated?.display_name ?? draft.name)
			setUsername(updated?.username ?? draft.username)
			setAvatar(updated?.avatar_url ?? avatar)
			login(updated)
			setEditing(false)
		} catch (err) {
			setError(err.message || "Could not save your changes.")
		} finally {
			setSaving(false)
		}
	}

	const setField = (key) => (e) =>
		setDraft((d) => ({ ...d, [key]: e.target.value }))

	const selectAvatar = (value) => {
		setDraft((d) => ({ ...d, avatar: value }))
		revokePreview()
		if (value instanceof File) {
			const url = URL.createObjectURL(value)
			objectUrlRef.current = url
			setAvatarPreview(url)
		} else {
			setAvatarPreview(value)
		}
		setPickerOpen(false)
	}

	const current = { name, username, email }
	const editableRows = [
		{ key: "name", label: "Name", type: "text" },
		{ key: "email", label: "Email", type: "email", disabled: true },
	]

	const inputClass =
		"rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-lg outline-none focus:border-white/40"

	return (
		<section className="text-white">
			{/* Picture and username sit side by side at the top. */}
			<div className="flex items-center justify-center gap-4 ">
				{/* While editing, a pencil badge on the bottom-right of the avatar
				    opens the picker popup. */}
				<div className="relative w-28 shrink-0">
					<img
						src={editing ? avatarPreview : avatar}
						alt="Profile image avatar"
						className="w-28 h-28 rounded-full object-cover"
					/>
					{editing && (
						<button
							type="button"
							onClick={() => setPickerOpen(true)}
							aria-label="Change profile picture"
							className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border border-white bg-black shadow shadow-black transition-transform hover:scale-110 cursor-pointer"
						>
							<img src={pencil} alt="" className="w-4" />
						</button>
					)}
				</div>
				<div>
					<p className="text-sm tracking-wide text-white/60">Username</p>
					{editing ? (
						<input
							type="text"
							value={draft.username}
							onChange={setField("username")}
							className={inputClass}
						/>
					) : (
						<p className="text-lg">{username}</p>
					)}
				</div>
			</div>

			<form onSubmit={save} className="p-3">
				{editableRows.map(({ key, label, type, disabled }) => (
					<div key={key}>
						<p className="text-sm tracking-wide text-white/60">
							{label}
							{disabled && editing && " (can't be changed yet)"}
						</p>
						{editing ? (
							<input
								type={type}
								value={draft[key]}
								onChange={setField(key)}
								disabled={disabled}
								className={`${inputClass} mb-3 w-full disabled:opacity-50`}
							/>
						) : (
							<p className="text-lg mb-3">{current[key]}</p>
						)}
					</div>
				))}

				{/* Read-only stats, straight off the server. A dash means they
				    haven't loaded rather than a real zero. */}
				{[
					{ label: "Number of Triumphs", value: stats?.games_won ?? "—" },
					{ label: "Number of Humiliations", value: stats?.games_lost ?? "—" },
					{ label: "Win rate", value: stats ? `${stats.win_rate} %` : "—" },
				].map(({ label, value }) => (
					<div key={label}>
						<p className="text-sm tracking-wide text-white/60">{label}</p>
						<p className="text-lg mb-3">{value}</p>
					</div>
				))}

				{/* Backend validation errors land here. */}
				{error && (
					<p role="alert" className="mb-3 text-sm text-red-400">
						{error}
					</p>
				)}

				{editing ? (
					<div className="flex justify-center gap-3">
						<button
							type="button"
							onClick={save}
							disabled={saving}
							className="rounded-lg border border-white px-4 py-2 transition-transform hover:scale-105 cursor-pointer disabled:opacity-50 disabled:hover:scale-100"
						>
							{saving ? "Saving…" : "Save"}
						</button>
						<button
							type="button"
							onClick={cancelEdit}
							disabled={saving}
							className="rounded-lg px-4 py-2 transition-transform hover:scale-105 cursor-pointer disabled:opacity-50 disabled:hover:scale-100"
						>
							Cancel
						</button>
					</div>
				) : (
					<div className="flex justify-center gap-3">
						<button
							type="button"
							onClick={startEdit}
							aria-label="Edit profile"
							className="cursor-pointer flex items-center justify-center gap-2 rounded-lg border border-white px-4 py-2 transition-transform hover:scale-105"
						>
							Edit
							<img src={pencil} alt="" className="w-4" />
						</button>
						<button
							type="button"
							onClick={handleLogout}
							aria-label="Log out"
							className="cursor-pointer flex items-center justify-center gap-2 rounded-lg border border-white px-4 py-2 transition-transform hover:scale-105"
						>
							Logout
							<img src={logoutIcon} alt="" className="w-4" />
						</button>
					</div>
				)}
			</form>

			<ChangePassword inputClass={inputClass} />

			{/* Picking an image only updates the draft — it's sent to the backend
			    with everything else on Save. */}
			<AvatarPicker
				open={pickerOpen}
				current={draft.avatar}
				onClose={() => setPickerOpen(false)}
				onSelect={selectAvatar}
			/>
		</section>
	)
}

export default Profile
