import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  // Serve the app under /compliance. This prefixes every asset URL in the
  // built index.html (/compliance/assets/...), and must stay in step with the
  // BrowserRouter basename in src/routes/AppRouter.jsx — if the two disagree,
  // the page loads but every chunk 404s.
  base: '/compliance/',

  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8099',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/compliancePortal'),
      },
    },
  },
})