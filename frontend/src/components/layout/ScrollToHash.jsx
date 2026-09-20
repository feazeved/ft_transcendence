import { useEffect } from "react"
import { useLocation } from "react-router"

// Arriving at /#rooms from another route doesn't scroll on its own: when the
// browser looked for the element, the page hadn't rendered yet. This waits for
// the render and then scrolls.
//
// It draws nothing — it exists only for the effect.
function ScrollToHash() {
	const { hash } = useLocation()

	useEffect(() => {
		if (!hash) return
		// The hash arrives with its "#" in front.
		document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: "smooth" })
	}, [hash])

	return null
}

export default ScrollToHash
