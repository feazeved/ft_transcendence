import { useRef, useState } from "react"
import Modal from "./Modal.jsx"
const uploadIcon = "/profile/upload_picture.jpeg"

const AVATARS = [
	"daniel.png",
	"alex.png",
	"fifipe.png",
	"wallace.png",
	"girl.jpg",
	"default.jpg",
	"dog.jpg",
	"cat.jpg",
	"alien.jpg",
	"duck.jpg",
	"smiley.jpg",
].map((name) => encodeURI(`/profile/${name}`))

// Mirrors the backend's FileExtensionValidator(['png', 'jpg', 'jpeg']) on User.avatar.
const ACCEPTED_TYPES = ["image/png", "image/jpeg"]
const MAX_FILE_BYTES = 2 * 1024 * 1024


const AvatarPicker = ({ open, current, onClose, onSelect }) => {
	const fileInputRef = useRef(null)
	const [error, setError] = useState("")

	const handleFileChange = (e) => {
		const file = e.target.files?.[0]
		e.target.value = ""
		if (!file) return

		if (!ACCEPTED_TYPES.includes(file.type)) {
			setError("Please choose a PNG or JPEG image.")
			return
		}
		if (file.size > MAX_FILE_BYTES) {
			setError(`Image is too big — please choose one under ${MAX_FILE_BYTES / (1024 * 1024)}MB.`)
			return
		}

		setError("")
		onSelect(file)
	}

	return (
		<Modal open={open} onClose={onClose} title="Choose a picture">
			<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
				{AVATARS.map((src) => {
					const selected = src === current
					return (
						<button
							key={src}
							type="button"
							onClick={() => {
								setError("")
								onSelect(src)
							}}
							aria-pressed={selected}
							aria-label={`Select ${src.split("/").pop()}`}
							className={`rounded-full border-2 p-1 transition-transform hover:scale-105 cursor-pointer ${
								selected ? "border-white" : "border-transparent"
							}`}
						>
							<img src={src} alt="" className="w-24 h-24 rounded-full object-cover" />
						</button>
					)
				})}
				<button
					type="button"
					onClick={() => fileInputRef.current?.click()}
					aria-label="Upload a picture from your device"
					className="rounded-full border-2 border-dashed border-white/40 p-1 transition-transform hover:scale-105 hover:border-white cursor-pointer" >
					<img src={uploadIcon} alt="Upload a picture" className="w-24 h-24 rounded-full object-cover"/>
				</button>
			</div>
			<input
				ref={fileInputRef}
				type="file"
				accept={ACCEPTED_TYPES.join(",")}
				onChange={handleFileChange}
				className="hidden"
			/>
			{error && <p className="mt-3 text-sm text-red-400">{error}</p>}
		</Modal>
	)
}

export default AvatarPicker
