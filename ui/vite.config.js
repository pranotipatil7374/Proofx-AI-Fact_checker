import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['bottle-living-irritable.ngrok-free.dev'],
    proxy: {
      '/verify': 'http://127.0.0.1:3003',
      '/results': 'http://127.0.0.1:3003',
    },
  },
})
