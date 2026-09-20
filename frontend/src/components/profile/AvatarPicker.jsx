import { useRef, useState } from "react"
import Dialog from "@/components/ui/Dialog.jsx"
import { ErrorMessage } from "@/components/ui/Message.jsx"

const PRESETS = [
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
].map((file) => ({ file, src: encodeURI(`/profile/${file}`) }))

// Mirrors the backend's FileExtensionValidator(['png', 'jpg', 'jpeg']) on User.avatar.
const ACCEPTED_TYPES = ["image/png", "image/jpeg"]
const MAX_FILE_BYTES = 2 * 1024 * 1024

function UploadIcon() {
	return (
		<svg
			width="22"
			height="22"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="1.6"
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
		>
			<path d="M12 17V5" />
			<path d="M6.5 10.5L12 5l5.5 5.5" />
			<path d="M4.5 19.5h15" />
		</svg>
	)
}

// Picking only hands the choice back through onSelect — the profile keeps it in
// its draft and sends it on Save, so closing this without saving changes nothing.
function AvatarPicker({ open, current, onClose, onSelect }) {
	const fileInputRef = useRef(null)
	const [error, setError] = useState("")

	const handleFileChange = (e) => {
		const file = e.target.files?.[0]
		// Clearing the input means picking the same file twice still fires onChange.
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
		<Dialog open={open} onClose={onClose} title="Choose a picture" accent="yellow">
			<ul className="grid grid-cols-[repeat(auto-fit,minmax(86px,1fr))] gap-[clamp(10px,3vw,14px)]">
				{PRESETS.map(({ file, src }) => {
					const selected = src === current
					return (
						<li key={src}>
							<button
								type="button"
								onClick={() => {
									setError("")
									onSelect(src)
								}}
								aria-pressed={selected}
								aria-label={selected ? `${file}, current picture` : file}
								className={`relative flex aspect-square w-full cursor-pointer items-center justify-center rounded-full border-2 p-0 transition-colors ${
									selected ? "border-yellow" : "border-transparent hover:border-white/40"
								}`}
							>
								<img src={src} alt="" className="h-full w-full rounded-full object-cover" />
								{selected && (
									<span
										aria-hidden="true"
										className="absolute -bottom-1 -right-1 flex h-[26px] w-[26px] items-center justify-center rounded-full border-2 border-panel bg-yellow font-logo text-sm font-bold text-on-yellow"
									>
										✓
									</span>
								)}
							</button>
						</li>
					)
				})}
				<li>
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="flex aspect-square w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-full border-[3px] border-dashed border-white/25 bg-page text-dim transition-colors hover:border-yellow hover:text-yellow"
					>
						<UploadIcon />
						<span className="font-mono text-[11px] tracking-[0.12em]">Upload</span>
					</button>
				</li>
			</ul>

			<input
				ref={fileInputRef}
				type="file"
				accept={ACCEPTED_TYPES.join(",")}
				onChange={handleFileChange}
				className="hidden"
			/>

			{error && <ErrorMessage boxed>{error}</ErrorMessage>}

			<p className="font-mono text-xs leading-relaxed text-muted">
				PICKING AN IMAGE ONLY UPDATES THE DRAFT — IT IS SENT WITH EVERYTHING ELSE ON SAVE.
			</p>
		</Dialog>
	)
}

export default AvatarPicker
