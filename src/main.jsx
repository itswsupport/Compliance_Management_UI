import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Font Awesome, bundled rather than pulled from cdnjs.
//
// The CDN <link> that used to sit in index.html is a third-party request, and
// Edge's Tracking Prevention blocks storage for it and says so in the console
// on every page — four times over. Bundling it also means the icons still
// render on a machine with no route to cdnjs, which a plant floor may well be.
//
// Pinned to 6.4.0, the version the CDN served, so no icon changes shape.
import '@fortawesome/fontawesome-free/css/all.min.css'
import './index.css'
import App from './App.jsx'

// Left behind by an older build.
//
// Notice notifications were kept in the browser for a while — one
// notice_seen_id_<empCode> key per employee, holding the highest notice they
// had read. They are rows in compliance_notifications now, so nothing writes or
// reads these any more; but localStorage keeps what it was given, so every
// browser that ran that build still carries them, one key per person who signed
// in on it. Swept once at start-up rather than left as clutter nobody can
// explain. Safe to delete this block once the builds that wrote them are gone.
Object.keys(localStorage)
  .filter((k) => k.startsWith('notice_seen_id_'))
  .forEach((k) => localStorage.removeItem(k))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
