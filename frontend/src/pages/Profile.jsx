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

const DEFAULT_AVATAR = "/profile/default.jpg"

async function toUploadableFile(avatar) {
	if (avatar instanceof File) return avatar
	const response = await fetch(avatar)
	const blob = await response.blob()
	return new File([blob], avatar.split("/").pop(), { type: blob.type })
}

function Profile() {
	const { user, login, logout } = useAuth()

	const [email] = useState(user?.email ?? "")
	const [name, setName] = useState(user?.display_name ?? "")
	const [username, setUsername] = useState(user?.username ?? "")
	const [pass] = useState("& I gt78-1jd25")
	const [avatar, setAvatar] = useState(user?.avatar_url ?? DEFAULT_AVATAR)
	// TODO(backend): no stats endpoint yet — still mock until one exists.
	const wins = 20
	const lose = 30
	const winRate = Math.round((wins / (wins + lose)) * 100)

	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState({ name, username, email, pass, avatar })
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

	const navigate = useNavigate()

	const handleLogout = () => {
		logout()
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

	const current = { name, username, email, pass }
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
