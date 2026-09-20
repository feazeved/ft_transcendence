import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
	],
	resolve: {
		alias: {
			'@': fileURLToPath(new URL('./src', import.meta.url)),
		},
	},
	server: {
		host: true,
		port: 5173,
		strictPort: true,
		hmr: {
			clientPort: 443,
		},
		// Native `npm run dev` (no nginx) needs somewhere to send `/api` and `/ws`.
		// Point these at a backend you run yourself, e.g. `python manage.py runserver 8000`.
		// Override the target with VITE_BACKEND_URL when the backend lives elsewhere.
		proxy: {
			'/api': {
				target: process.env.VITE_BACKEND_URL || 'http://localhost:8000',
				changeOrigin: true,
			},
			'/ws': {
				target: process.env.VITE_BACKEND_URL || 'http://localhost:8000',
				changeOrigin: true,
				ws: true,
			},
		},
	},
})
