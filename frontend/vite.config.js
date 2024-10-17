import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
server: {
    host: '0.0.0.0',   // Listen on all interfaces to allow Docker to map ports
    port: 3000,        // Inside container port, leave this as 3000
    strictPort: true,   // Ensures it won't switch to a different port if 3000 is in use
    watch: {           // This ensures file changes are watched inside the Docker container
      usePolling: true
    }
  }
})
