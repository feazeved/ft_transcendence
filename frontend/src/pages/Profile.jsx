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

// Fallback until the backend sends the real avatar. Files live in
// public/profile, so they're served from the site root (see AvatarPicker).
const DEFAULT_AVATAR = "/profile/default.jpg"

// A preset avatar is just a static path on our own origin — refetch it as a
// Blob so it can go through the same multipart `avatar` field as a real
// upload (the backend's avatar field only accepts an uploaded file, not a
// path string).
async function toUploadableFile(avatar) {
	if (avatar instanceof File) return avatar
	const response = await fetch(avatar)
	const blob = await response.blob()
	return new File([blob], avatar.split("/").pop(), { type: blob.type })
}

function Profile() {
	const { user, login, logout } = useAuth()

	// Read-only for now: dj-rest-auth keeps email out of this endpoint (email
	// changes are meant to go through a verification flow we don't have yet),
	// so it's shown but never sent.
	const [email] = useState(user?.email ?? "")
	const [name, setName] = useState(user?.display_name ?? "")
	const [username, setUsername] = useState(user?.username ?? "")
	// Never sent to us by the backend — a fixed-length placeholder just gives
	// the masked dots below something to render. There's no password-change
	// endpoint yet, so this is display-only and never included in a save.
	const [pass] = useState("& I gt78-1jd25")
	const [avatar, setAvatar] = useState(user?.avatar_url ?? DEFAULT_AVATAR)
	// TODO(backend): no stats endpoint yet — still mock until one exists.
	const wins = 20
	const lose = 30
	const winRate = Math.round((wins / (wins + lose)) * 100)

	// Toggles the name/username/email/password rows between text and inputs.
	// The stats below are computed elsewhere and never editable.
	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState({ name, username, email, pass, avatar })
	// What the avatar <img> actually renders while editing — a plain URL even
	// when draft.avatar is a freshly-picked File (see onSelect below).
	const [avatarPreview, setAvatarPreview] = useState(avatar)
	const objectUrlRef = useRef(null)
	// Set while the save request is in flight; `error` holds the backend's reason.
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState("")
	// The "change picture" popup.
	const [pickerOpen, setPickerOpen] = useState(false)

	const revokePreview = () => {
		if (objectUrlRef.current) {
			URL.revokeObjectURL(objectUrlRef.current)
			objectUrlRef.current = null
		}
	}

	// Only ever cleans up on unmount — revokePreview() itself handles the
	// mid-session case each time a new file is picked.
	useEffect(() => revokePreview, [])

	const navigate = useNavigate()

	const handleLogout = () => {
		logout()
		// Leaves the profile (closing it if it's a modal) and drops the
		// background location, so the navbar flips back to the log-in icon.
		navigate("/")
	}

	const startEdit = () => {
		setDraft({ name, username, email, pass, avatar })
		setAvatarPreview(avatar)
		setError("")
		setEditing(true)
	}

	const cancelEdit = () => {
		revokePreview()
		setEditing(false)
		setError("")
	}

	// Only the fields the user actually touched. Email and password aren't
	// included — dj-rest-auth's /auth/user/ doesn't accept either (see the
	// comments on their state above), so there's nothing to diff there yet.
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

			// 200 -> updated user object, 4xx -> { detail/field: "reason" }
			// (api.js already turns that into a thrown Error with `.message`).
			const updated = await api.patch("/auth/user/", form)

			// Prefer the server's copy of each field when it returns one.
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

	// Text/email rows shown between the avatar and the stats.
	const current = { name, username, email, pass }
	const editableRows = [
		{ key: "name", label: "Name", type: "text" },
		// dj-rest-auth's /auth/user/ treats email as read-only (it's meant to
		// go through a verification flow we don't have yet) — shown, not editable.
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

				{/* Password stays masked on the profile, editable (with eye toggle)
				    only while editing. */}
				<div>
					<p className="text-sm tracking-wide text-white/60">Password</p>
					{editing ? (
						<PasswordInput
							label=""
							value={draft.pass}
							onChange={setField("pass")}
							required={false}
							className="mb-3"
						/>
					) : (
						<p className="text-lg mb-3">{"•".repeat(8)}</p>
					)}
				</div>

				{/* Read-only stats. */}
				{[
					{ label: "Number of Triumphs", value: wins },
					{ label: "Number of Humiliations", value: lose },
					{ label: "Win rate", value: `${winRate} %` },
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
