import { createContext, useCallback, useContext, useState } from "react"

// One place the whole app asks "is someone logged in, and who?".
//
// TODO(JWT): when the backend starts issuing a JWT, `loadUser` should decode the
// token already kept in localStorage ("token" — set by Login.jsx, read by
// lib/api.js) and return { username, avatar, ... } straight from its payload.
// `login` would then only store the token and `logout` only clear it. Until
// then we persist a plain user object next to the token so a page refresh
// doesn't drop the session.

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

	// Call after a successful login. `nextUser` is whatever the backend returned
	// about the account (later: the decoded JWT payload).
	const login = useCallback((nextUser = {}, token) => {
		// The backend's field is `avatar_url` (see UserDetailsSerializer); NavBar
		// and everything else here reads `avatar` — normalize once, at the source.
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

export function useAuth() {
	const ctx = useContext(AuthContext)
	if (!ctx) throw new Error("useAuth must be used within <AuthProvider>")
	return ctx
}
