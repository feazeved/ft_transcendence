import Modal from "./Modal.jsx"

// The avatars live in frontend/public/profile, so Vite/nginx serve them from
// the site root. A public/ folder can't be listed from the browser, so every
// choice has to be named here — drop a file in there and add its name below.
// encodeURI keeps the spaces in some filenames valid in the URL.
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

// Small popup that lets the user pick one of the bundled profile pictures.
// It doesn't save anything itself — it just reports the chosen path back up
// through `onSelect`; the parent decides what to do with it.
const AvatarPicker = ({ open, current, onClose, onSelect }) => (
	<Modal open={open} onClose={onClose} title="Choose a picture">
		<div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
			{AVATARS.map((src) => {
				const selected = src === current
				return (
					<button
						key={src}
						type="button"
						onClick={() => onSelect(src)}
						aria-pressed={selected}
						aria-label={`Select ${src.split("/").pop()}`}
						className={`rounded-full border-2 p-1 transition-transform hover:scale-105 cursor-pointer ${
							selected ? "border-white" : "border-transparent"
						}`}
					>
						<img src={src} alt="" className="w-24 rounded-full" />
					</button>
				)
			})}
		</div>
	</Modal>
)

export default AvatarPicker
