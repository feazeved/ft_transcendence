import { useEffect, useState } from "react"

// The clock, as a hook: the current time in milliseconds, refreshed every second.
//
// It exists so that nothing else has to own a timer. The turn countdown is worked
// out by `secondsLeft(game, now)`, a pure function — this hook is the only part
// that knows what time it is, which is why the arithmetic can be tested without
// waiting for a real second to pass.
//
// The cleanup is the whole point of the effect: without clearInterval the timer
// would keep firing after the table is gone, on a component that no longer exists.
const TICK_MS = 1000

export function useNow(intervalMs = TICK_MS) {
	const [now, setNow] = useState(() => Date.now())

	useEffect(() => {
		const timer = setInterval(() => setNow(Date.now()), intervalMs)
		return () => clearInterval(timer)
	}, [intervalMs])

	return now
}

export default useNow
