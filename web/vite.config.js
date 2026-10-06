import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// QURE Lab web app.
// For local Quest 2 testing you need HTTPS (WebXR requires a secure context).
// Two documented options (see README):
//   1) `npm run dev:host` + `adb reverse tcp:5173 tcp:5173` so the headset
//      reaches http://localhost:5173, which the browser treats as secure.
//   2) Deploy to the Vercel HTTPS URL (god integrates; not done by this temp).
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // allow LAN access for headset testing when using `npm run dev:host`
  },
  build: {
    target: 'es2020',
  },
})
