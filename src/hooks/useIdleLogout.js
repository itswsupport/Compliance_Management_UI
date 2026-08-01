import { useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { SESSION_CHECK_MS, PORTAL_URL } from '../utils/constants';
import { markActivity, isIdleExpired, clearActivity, hasStoredSession } from '../utils/session';
import { LS_KEYS } from '../utils/constants';

// Anything here counts as the user being present. Successful API responses also
// count — see the response interceptor in services/api.js — so a long upload
// isn't mistaken for an idle user.
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'];

/**
 * Signs the user out after SESSION_IDLE_MS of inactivity and sends them back to
 * the RUCHA portal. Mounted once from Layout, which only renders for
 * authenticated routes.
 */
export function useIdleLogout() {
  const { user, logoutUser } = useAuth();
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!user) return undefined;
    expiredRef.current = false;

    const onActivity = () => markActivity();

    const detach = () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
    };

    /**
     * @param {boolean} notifyServer - false when another tab already called
     *   /logout for this session; re-calling it would only send a null emp_code.
     */
    const expire = (notifyServer = true) => {
      if (expiredRef.current) return;
      expiredRef.current = true;
      detach();
      clearActivity();
      // Not awaited: the session is already cleared from storage by the time this
      // returns, and the redirect shouldn't wait on the /logout round-trip.
      if (notifyServer) logoutUser();
      // replace() so the back button can't return to a page of a dead session.
      window.location.replace(PORTAL_URL);
    };

    const check = () => {
      // Storage is the source of truth, not React state: another tab may have
      // logged out or expired while this one was hidden, and a bfcache restore
      // brings back a `user` that no longer has a session behind it.
      if (!hasStoredSession()) return expire(false);
      if (isIdleExpired()) expire();
    };

    // Check before stamping. Remounting after a long absence (browser back, or a
    // reopened tab) must not reset the clock and hand out a fresh 30 minutes.
    check();
    if (expiredRef.current) return undefined;
    markActivity(true);

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));

    const timer = setInterval(check, SESSION_CHECK_MS);

    // Background tabs get their timers throttled, and a bfcache restore may not
    // re-run this effect at all — so re-check whenever the page becomes visible.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', check);

    // Fires only in *other* tabs of this origin. Ending the session in one tab
    // must end it in all of them, otherwise a second tab keeps a live session
    // running past the timeout. key === null means localStorage.clear().
    const onStorage = (e) => {
      if (e.key === null || e.key === LS_KEYS.GLOBAL_EMP_CODE || e.key === LS_KEYS.LAST_ACTIVITY) {
        check();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      clearInterval(timer);
      detach();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', check);
      window.removeEventListener('storage', onStorage);
    };
  }, [user, logoutUser]);
}
