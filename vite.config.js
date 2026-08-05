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
  // Same-origin API, matching how the app is served in production.
  //
  // VITE_API_BASE_URL is the relative path /compliancePortal/, so the browser
  // sends API calls to whatever origin served the page — here, the dev server.
  // This proxy forwards them to the local Spring backend. In production nginx
  // does the same forwarding, so one bundle works in both places and there is
  // no hardcoded host to get wrong.
  //
  // Dev only: `npm run build` emits static files and this proxy does not exist
  // in them. Production needs the equivalent nginx `location` block.
  //
  // The prefix is /compliancePortal because that is the backend's context path
  // (server.servlet.context-path in application.properties), so no rewrite is
  // needed — the path forwards unchanged.
  server: {
    proxy: {
      '/compliancePortal': {
        target: 'http://localhost:8099',
        changeOrigin: true,
      },
    },
  },
})