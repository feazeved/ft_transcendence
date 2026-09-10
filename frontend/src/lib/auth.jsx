import { createContext, useCallback, useContext, useState } from "react"

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
