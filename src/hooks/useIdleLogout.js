import { useEffect, useRef } from 'react';
import Swal from 'sweetalert2';
import { useAuth } from '../context/AuthContext';
import { SESSION_CHECK_MS, PORTAL_URL, LS_KEYS } from '../utils/constants';
import { markActivity, isIdleExpired, clearActivity, hasStoredSession } from '../utils/session';

// Keep the session alive only. None of these ever ends it — a dialog thrown up
// mid-scroll would startle the user and give them nothing to act on.
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'touchstart', 'scroll'];

// A click is the deliberate act, so it is the only thing that reveals expiry.
const EXPIRY_EVENTS = ['click'];

// Signs the user out after SESSION_IDLE_MS of inactivity and returns them to the
// RUCHA portal. Mounted once from Layout, which only renders authenticated routes.
// Expiry is lazy: an unattended tab is left alone, and the idle gap is measured
// on the next click. Mount counts as a click so a refreshed tab cannot resume a
// dead session. Losing the session from storage is the one thing polled.
export function useIdleLogout() {
  const { user, logoutUser } = useAuth();
  const expiredRef = useRef(false);

  useEffect(() => {
    if (!user) return undefined;
    expiredRef.current = false;

    // Does not stamp once past the limit: that would revive a dead session.
    const onActivity = () => {
      if (isIdleExpired()) return;
      markActivity();
    };

    // Check before stamping — stamping first would erase the gap being measured.
    const onClick = () => {
      checkPresence();
      if (expiredRef.current) return;
      markActivity();
    };

    const detach = () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, onActivity));
      EXPIRY_EVENTS.forEach((evt) => window.removeEventListener(evt, onClick, true));
    };

    // notifyServer is false when another tab already called /logout for this
    // session; re-calling it would only send a null emp_code.
    const expire = (notifyServer = true) => {
      if (expiredRef.current) return;
      expiredRef.current = true;
      detach();
      clearActivity();
      // Not awaited: storage is already clear, and the dialog gives it time anyway.
      if (notifyServer) logoutUser();

      // Say why before leaving, otherwise the app just vanishes to an external
      // portal and reads as a crash. The two cases need different wording.
      Swal.fire({
        icon: 'warning',
        title: notifyServer ? 'Session Timed Out' : 'Session Ended',
        text: notifyServer
          ? 'Your session has expired due to inactivity. Please log in again.'
          : 'Your session was ended in another tab. Please log in again.',
        timer: 4000,
        timerProgressBar: true,
        confirmButtonText: 'OK',
        // The 32em default is edge-to-edge on a phone; this keeps a gutter.
        width: 'min(30rem, 92vw)',
        // Nothing live behind the dialog, so it cannot be dismissed by accident.
        allowOutsideClick: false,
        allowEscapeKey: false,
      }).then(() => {
        // Fires on both the timer and OK. replace() so back cannot return here.
        window.location.replace(PORTAL_URL);
      });
    };

    // Polled. Deliberately ignores the idle gap — only catches the session
    // vanishing from storage, meaning another tab ended it.
    const checkStorage = () => {
      if (!hasStoredSession()) expire(false);
    };

    // Runs when the user is demonstrably present. Storage is the source of truth,
    // not React state: a bfcache restore brings back a `user` with no session.
    const checkPresence = () => {
      if (!hasStoredSession()) return expire(false);
      if (isIdleExpired()) expire();
    };

    // Check before stamping: remounting after a long absence must not hand out a
    // fresh 30 minutes — arriving is what reveals the expired session.
    checkPresence();
    if (expiredRef.current) return undefined;
    markActivity(true);

    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, onActivity, { passive: true }));
    // Capture phase, so a component calling stopPropagation cannot hide the click.
    EXPIRY_EVENTS.forEach((evt) => window.addEventListener(evt, onClick, true));

    const timer = setInterval(checkStorage, SESSION_CHECK_MS);

    // Returning to the tab is not a click, so it never ends the session.
    const onVisibility = () => {
      if (document.visibilityState === 'visible') checkStorage();
    };
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', checkStorage);

    // Fires only in other tabs of this origin. key === null means storage.clear().
    const onStorage = (e) => {
      if (e.key === null || e.key === LS_KEYS.GLOBAL_EMP_CODE || e.key === LS_KEYS.LAST_ACTIVITY) {
        checkStorage();
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      clearInterval(timer);
      detach();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', checkStorage);
      window.removeEventListener('storage', onStorage);
    };
  }, [user, logoutUser]);
}
