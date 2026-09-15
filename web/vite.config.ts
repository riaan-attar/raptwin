import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The Flask Digital Twin API (dt/api.py). Override with FABRIC_DT_REMOTE.
const DT_API = process.env.FABRIC_DT_REMOTE ?? 'http://127.0.0.1:8080'

// Proxying keeps the browser same-origin, so dt/api.py needs no CORS config.
const proxy = {
  '/api': {
    target: DT_API,
    changeOrigin: true,
    rewrite: (path: string) => path.replace(/^\/api/, ''),
  },
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, proxy },
  preview: { port: 4173, proxy },
})
