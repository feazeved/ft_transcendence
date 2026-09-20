import { useState } from "react"
import FormField from "./FormField.jsx"
import eyeClosed from "@/assets/eye-closed.svg"
import eyeOpen from "@/assets/eye-open.svg"

// A password field with the design's show/hide eye inside it. Login, Register
// and the Profile's password panel all use it, which is why it lives in ui/.
//
// The eye only flips `type`, so the value still belongs to whoever renders this.
function PasswordInput({ label = "PASSWORD", name = "password", tone = "soft", ...rest }) {
	const [shown, setShown] = useState(false)

	return (
		<FormField
			label={label}
			name={name}
			tone={tone}
			type={shown ? "text" : "password"}
			trailing={
				<button
					type="button"
					onClick={() => setShown((was) => !was)}
					aria-label={shown ? "Hide password" : "Show password"}
					className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-md"
				>
					<img src={shown ? eyeOpen : eyeClosed} alt="" className="w-5 opacity-70 invert" />
				</button>
			}
			{...rest}
		/>
	)
}

export default PasswordInput
