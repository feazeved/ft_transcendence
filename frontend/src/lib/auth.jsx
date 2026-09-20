import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { api } from "./api.js"

const AuthContext = createContext(null)

const USER_KEY = "user"
const TOKEN_KEY = "token"
const DEFAULT_AVATAR = "/profile/default.jpg"

function loadUser() {
	try {
		const raw = localStorage.getItem(USER_KEY)
		return raw ? JSON.parse(raw) : null
	} catch {
		return null
	}
}

export function AuthProvider({ children }) {
	const [user, setUser] = useState(loadUser)

	const login = useCallback((nextUser = {}, token) => {
		const value = {
			username: "player",
			...nextUser,
			avatar: nextUser.avatar_url ?? nextUser.avatar ?? DEFAULT_AVATAR,
		}
		try {
			localStorage.setItem(USER_KEY, JSON.stringify(value))
			if (token) localStorage.setItem(TOKEN_KEY, token)
		} catch {
			/* storage blocked — a session-only login still works */
		}
		setUser(value)
	}, [])

	const logout = useCallback(() => {
		try {
			localStorage.removeItem(USER_KEY)
			localStorage.removeItem(TOKEN_KEY)
		} catch {
			/* ignore */
		}
		setUser(null)
	}, [])

	// Once, when the app opens: if a user is stored, ask the server who they
	// really are. A photo or display name changed elsewhere shows up without a
	// fresh login. `loadUser()` instead of the `user` state keeps this out of the
	// dependency array, so signing in later doesn't re-run it.
	useEffect(() => {
		if (!loadUser()) return

		// StrictMode mounts effects twice in development, so a late answer has to
		// check it still matters. Same `ignore` guard as Leaderboard.jsx.
		let ignore = false
		api
			.get("/auth/user/")
			.then((fresh) => {
				if (!ignore) login(fresh)
			})
			.catch((error) => {
				// 401/403 means the session is over. Anything else (the server being
				// down) must not sign anyone out.
				if (!ignore && (error.status === 401 || error.status === 403)) logout()
			})

		return () => {
			ignore = true
		}
	}, [login, logout])

	return (
		<AuthContext.Provider
			value={{ user, isAuthenticated: Boolean(user), login, logout }}
		>
			{children}
		</AuthContext.Provider>
	)
}

// Provider and hook belong together. Splitting them into three files to satisfy
// Fast Refresh costs more than the full reload it saves on a file we rarely touch.
// oxlint-disable-next-line react/only-export-components
export function useAuth() {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error("useAuth must be used within <AuthProvider>")
	return ctx
}
