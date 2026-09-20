import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router"
import AvatarPicker from "@/components/profile/AvatarPicker.jsx"
import MatchHistoryPanel from "@/components/profile/MatchHistoryPanel.jsx"
import PasswordPanel from "@/components/profile/PasswordPanel.jsx"
import ProfileCard from "@/components/profile/ProfileCard.jsx"
import RecordPanel from "@/components/profile/RecordPanel.jsx"
import PageHeader from "@/components/ui/PageHeader.jsx"
import api from "@/lib/api.js"
import { getMatchHistory } from "@/lib/profiles.js"
import { useAuth } from "@/lib/auth.jsx"

const HISTORY_SIZE = 10

// A preset arrives as a URL and an upload as a File, but the backend takes one
// multipart field either way, so a chosen preset is fetched back as a File.
async function toUploadableFile(avatar) {
	if (avatar instanceof File) return avatar
	const response = await fetch(avatar)
	const blob = await response.blob()
	return new File([blob], avatar.split("/").pop(), { type: blob.type })
}

function Profile() {
	const { user, login, logout } = useAuth()
	const navigate = useNavigate()

	const [email] = useState(user?.email ?? "")
	const [name, setName] = useState(user?.display_name ?? "")
	const [username, setUsername] = useState(user?.username ?? "")
	// The backend always sends an avatar_url, falling back to the site default,
	// so there is nothing to substitute here.
	const [avatar, setAvatar] = useState(user?.avatar_url ?? "")
	const [stats, setStats] = useState(null)
	const [history, setHistory] = useState({ status: "loading", matches: [], error: "" })

	const [editing, setEditing] = useState(false)
	const [draft, setDraft] = useState({ name, username, avatar })
	const [avatarPreview, setAvatarPreview] = useState(avatar)
	const objectUrlRef = useRef(null)
	const [saving, setSaving] = useState(false)
	const [error, setError] = useState("")
	const [pickerOpen, setPickerOpen] = useState(false)

	// An uploaded file is previewed through a blob URL, which the browser keeps
	// alive until it is revoked.
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
		let ignore = false

		api
			.get(`/users/${user.public_id}/stats/`)
			.then((data) => {
				if (!ignore) setStats(data)
			})
			.catch(() => {})

		return () => {
			ignore = true
		}
	}, [user?.public_id])

	// The games behind the numbers, same panel as somebody else's profile.
	useEffect(() => {
		if (!user?.public_id) return undefined
		let ignore = false

		getMatchHistory(user.public_id, { pageSize: HISTORY_SIZE })
			.then((page) => {
				if (!ignore) setHistory({ status: "ready", matches: page.results ?? [], error: "" })
			})
			.catch((err) => {
				if (!ignore) setHistory({ status: "error", matches: [], error: err.message })
			})

		return () => {
			ignore = true
		}
	}, [user?.public_id])

	const startEdit = () => {
		setDraft({ name, username, avatar })
		setAvatarPreview(avatar)
		setError("")
		setEditing(true)
	}

	const cancelEdit = () => {
		revokePreview()
		setAvatarPreview(avatar)
		setEditing(false)
		setError("")
	}

	const setField = (key, value) => setDraft((d) => ({ ...d, [key]: value }))

	const selectAvatar = (value) => {
		setField("avatar", value)
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

	const save = async (e) => {
		e?.preventDefault()

		// Only what actually changed is sent, so saving an untouched profile is
		// not a request at all.
		const form = new FormData()
		let changed = false
		if (draft.name !== name) {
			form.append("display_name", draft.name)
			changed = true
		}
		if (draft.username !== username) {
			form.append("username", draft.username)
			changed = true
		}
		if (draft.avatar !== avatar) {
			form.append("avatar", await toUploadableFile(draft.avatar))
			changed = true
		}
		if (!changed) {
			setEditing(false)
			return
		}

		setSaving(true)
		setError("")
		try {
			const updated = await api.patch("/auth/user/", form)

			setName(updated?.display_name ?? draft.name)
			setUsername(updated?.username ?? draft.username)
			setAvatar(updated?.avatar_url ?? avatar)
			revokePreview()
			login(updated)
			setEditing(false)
		} catch (err) {
			setError(err.message || "Could not save your changes.")
		} finally {
			setSaving(false)
		}
	}

	const handleLogout = () => {
		logout()
		navigate("/")
	}

	return (
		<div className="mx-auto flex w-full max-w-[1240px] flex-col gap-6 px-[clamp(16px,4vw,24px)] pb-[clamp(48px,8vw,88px)] pt-[clamp(28px,6vw,56px)]">
			<PageHeader eyebrow="ACCOUNT" eyebrowColor="yellow" title={editing ? "Edit your profile" : "Your profile"} />

			<div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,340px),1fr))] items-start gap-4">
				<ProfileCard
					editing={editing}
					draft={draft}
					onField={setField}
					user={{ username, name, email }}
					avatarSrc={editing ? avatarPreview : avatar}
					error={error}
					saving={saving}
					onStartEdit={startEdit}
					onCancel={cancelEdit}
					onSave={save}
					onOpenPicker={() => setPickerOpen(true)}
					onLogout={handleLogout}
				/>

				<div className="flex flex-col gap-4">
					<RecordPanel stats={stats} />
					<PasswordPanel />
				</div>
			</div>

			<MatchHistoryPanel
				matches={history.matches}
				publicId={user?.public_id}
				status={history.status}
				error={history.error}
			/>

			{/* Picking an image only updates the draft — it goes to the backend with
			    everything else on Save. */}
			<AvatarPicker
				open={pickerOpen}
				current={draft.avatar}
				onClose={() => setPickerOpen(false)}
				onSelect={selectAvatar}
			/>
		</div>
	)
}

export default Profile
