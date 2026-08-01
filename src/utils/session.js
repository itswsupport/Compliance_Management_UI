import { LS_KEYS, SESSION_IDLE_MS } from './constants';

// localStorage writes are synchronous, so don't do one per mousemove.
const WRITE_THROTTLE_MS = 5000;
let lastWrite = 0;

/**
 * Record that the user is still active.
 * @param {boolean} force - bypass the throttle (used on login and on mount).
 */
export function markActivity(force = false) {
  const now = Date.now();
  if (!force && now - lastWrite < WRITE_THROTTLE_MS) return;
  lastWrite = now;
  try {
    localStorage.setItem(LS_KEYS.LAST_ACTIVITY, String(now));
  } catch {
    // Private mode / quota — fall back to the token expiry on the server.
  }
}
export function getIdleMs() {
  const ts = Number(localStorage.getItem(LS_KEYS.LAST_ACTIVITY));
  // No stamp yet (fresh login) counts as active, not as idle-forever.
  if (!ts || Number.isNaN(ts)) return 0;
  // A clock change or a stamp from the future shouldn't expire the session.
  return Math.max(0, Date.now() - ts);
}

export function isIdleExpired() {
  return getIdleMs() >= SESSION_IDLE_MS;
}

/**
 * Whether a session still exists in storage. False after another tab logged out
 * or timed out — this tab's React state can still say otherwise.
 */
export function hasStoredSession() {
  return Boolean(localStorage.getItem(LS_KEYS.GLOBAL_EMP_CODE));
}

export function clearActivity() {
  lastWrite = 0;
  localStorage.removeItem(LS_KEYS.LAST_ACTIVITY);
}
