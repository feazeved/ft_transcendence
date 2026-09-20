// Thin wrapper around fetch for talking to the backend.
// Requests are sent to `/api/...` which Vite (dev) / nginx (prod) proxy to the backend.
const BASE_URL = "/api";
const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function getCookie(name) {
	const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
	return match ? decodeURIComponent(match[1]) : null;
}

async function ensureCsrfCookie() {
	if (getCookie("csrftoken")) return;
	await fetch(`${BASE_URL}/auth/csrf/`);
}

export function extractErrorMessage(data, status) {
	if (data && typeof data === "object") {
		if (typeof data.detail === "string") return data.detail;
		if (typeof data.message === "string") return data.message;
		const fieldMessages = Object.values(data)
			.flat()
			.filter((value) => typeof value === "string");
		if (fieldMessages.length > 0) return fieldMessages.join(" ");
	}
	return `Request failed with status ${status}`;
}

async function request(method, path, body) {
	const isFormData = body instanceof FormData;
	const headers = isFormData ? {} : { "Content-Type": "application/json" };

	const token = localStorage.getItem("token");
	if (token) headers["Authorization"] = `Bearer ${token}`;

	if (UNSAFE_METHODS.has(method)) {
		await ensureCsrfCookie();
		const csrfToken = getCookie("csrftoken");
		if (csrfToken) headers["X-CSRFToken"] = csrfToken;
	}

	const res = await fetch(`${BASE_URL}${path}`, {
		method,
		headers,
		body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
	});

	const isJson = res.headers.get("content-type")?.includes("application/json");
	const data = isJson ? await res.json() : await res.text();

	if (!res.ok) {
		// The status rides along so callers can tell "your session ended" (401/403)
		// from "the server is having a bad day".
		const error = new Error(extractErrorMessage(data, res.status));
		error.status = res.status;
		throw error;
	}

	return data;
}

export const api = {
	get: (path) => request("GET", path),
	post: (path, body) => request("POST", path, body),
	put: (path, body) => request("PUT", path, body),
	patch: (path, body) => request("PATCH", path, body),
	delete: (path) => request("DELETE", path),
};

export default api;
