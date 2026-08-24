import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { viewPathForUser } from '../../utils/roleRoutes';
import { sectionOf } from '../../utils/navSection';
import { onNoticesRead } from '../../utils/noticeRead';
import { LS_KEYS } from '../../utils/constants';
import { onRecordOpened } from '../../utils/recordOpened';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/notificationService';


// How often to re-read the list. The server writes a row the moment somebody
// acts, so this is how soon the bell hears about what other people did.
const REFRESH_MS = 60000;

/**
 * How each event reads.
 *
 * Keyed by the `status` the server stamped — the same value that chose the
 * mail — so there is nothing to work out here. The bell no longer reconstructs
 * who should have been told from compliance_action rows: the flow knew at the
 * moment it acted, and now it writes that down.
 */
const LOOK = {
  ASSIGNED:       { icon: 'fas fa-clipboard-list', color: '#3482AE' },
  SUBMITTED:      { icon: 'fas fa-user-check',     color: '#3482AE' },
  RESUBMITTED:    { icon: 'fas fa-user-check',     color: '#3482AE' },
  FINAL_APPROVAL: { icon: 'fas fa-user-check',     color: '#6f42c1' },
  APPROVED:       { icon: 'fas fa-check-circle',   color: '#2ed8b6' },
  REJECTED:       { icon: 'fas fa-undo',           color: '#e74c3c' },
  DUE_SOON:       { icon: 'fas fa-clock',          color: '#FFB64D' },
  OVERDUE:        { icon: 'fas fa-hourglass-half', color: '#FFB64D' },
  PUBLISHED:      { icon: 'fas fa-bullhorn',       color: '#3482AE' },
};
const DEFAULT_LOOK = { icon: 'fas fa-bell', color: '#869099' };

/**
 * The dashboard where this user can act on a record.
 *
 * authLevel rides on the notification, because the server knew which step it
 * raised. A record awaiting the Comp Head opens on the Comp Head dashboard even
 * when the user also holds another role, or the approve form is not there.
 * Null when they hold no role that can act, and the caller falls back to their
 * own view.
 */
function actionPath(user, authLevel) {
  const lvl = Number(authLevel);
  if (lvl === 1 || lvl === 4) return (user.isPlantHr || user.isChd) ? '/plant-hr/view' : null;
  if (lvl === 3) return user.isHcmHead ? '/hcm-head/view' : null;
  if (lvl === 2) {
    if (user.isCompHead) return '/comp-head/view';
    if (user.isCorpHr) return '/corp-hr/view';
  }
  return null;
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const boxRef = useRef(null);
  // What the bell is holding right now, readable from a subscription that must
  // not be torn down and rebuilt every time the list changes.
  const itemsRef = useRef(items);
  itemsRef.current = items;

  const empCode = user?.empCode;

  const load = useCallback(async () => {
    if (!empCode) return;
    try {
      // One source. A notice writes a row in compliance_notifications like any
      // compliance event does, so what the user has read is the server's answer
      // and follows them to whatever browser they sign in from.
      const res = await getNotifications(empCode);
      setItems(res.data?.response || []);
    } catch {
      // Leave what is on screen rather than emptying the bell over one blip.
    }
  }, [empCode]);

  // Read once, then on a timer, then whenever the tab comes back to the front.
  // Somebody else's rejection has to reach this user without them navigating:
  // the mail arrives on its own, and so must this.
  useEffect(() => {
    if (!empCode) return undefined;
    load();
    const id = setInterval(() => { if (!document.hidden) load(); }, REFRESH_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [empCode, load]);

  // Opening a record IS reading its notification, so a record opened from the
  // list or the calendar clears its own the way one opened from the bell does.
  // Anything less means the badge still shows a 1 for the compliance the user
  // is looking at.
  useEffect(() => {
    if (!empCode) return undefined;
    return onRecordOpened(async (referenceId) => {
      // A notice entry points at a notice id, which can collide with a
      // compliance id — different tables. Only compliance rows are meant here,
      // and only they have a server row to mark read.
      const hits = itemsRef.current.filter(
        (n) => n.type !== 'NOTICE' && String(n.referenceId) === referenceId,
      );
      if (hits.length === 0) return;

      // Off the badge at once; the server catches up behind it.
      const ids = new Set(hits.map((n) => n.id));
      setItems((list) => list.filter((n) => !ids.has(n.id)));
      try {
        await Promise.all(hits.map((n) => markNotificationRead(n.id, empCode)));
      } catch {
        // The rows simply come back on the next read.
      }
    });
  }, [empCode]);

  // The Notice Dashboard has just cleared them on the server. Drop them here
  // and now rather than at the next read, which could be a minute away and
  // would leave a badge for the very page the user is standing on.
  useEffect(() => onNoticesRead(() => {
    setItems((list) => list.filter((n) => n.type !== 'NOTICE'));
  }), []);

  // Close on an outside click, the way the Help menu closes on mouse-out.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Cleared on the server, so it stays cleared in every browser this user opens.
  async function clearAll() {
    if (!empCode) return;
    setItems([]);
    try {
      await markAllNotificationsRead(empCode);
    } finally {
      load();
    }
  }

  async function openItem(n) {
    setOpen(false);
    setItems((list) => list.filter((x) => x.id !== n.id));

    // A notice has nowhere of its own to open — the board lists it in full, and
    // opening that board marks every notice read in one call. So this row is
    // not marked read here: getting the user there does it, and does the rest
    // of them at the same time.
    if (n.type === 'NOTICE') {
      navigate('/notice/list');
      return;
    }

    try {
      await markNotificationRead(n.id, empCode);
    } catch {
      // Navigate anyway; the row simply returns on the next read.
    }

    localStorage.setItem(LS_KEYS.ID, n.referenceId);
    // Where they can act on it, else their own view. Back goes to that view's
    // own dashboard rather than wherever the bell happened to be clicked from.
    const target = actionPath(user, n.authLevel) || viewPathForUser(user);
    navigate(target, { state: { backTo: `/${sectionOf(target)}/pending` } });
  }

  if (!user) return null;

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="text-white hover:text-white/80 transition-colors flex items-center bg-transparent border-0 px-2 py-1 cursor-pointer relative select-none"
      >
        <i className="fas fa-bell text-sm" />
        {items.length > 0 && (
          <span className="absolute top-0 right-0 min-w-[15px] h-[15px] px-[3px] rounded-full bg-[#e74c3c] text-white text-[9px] font-bold flex items-center justify-center leading-none">
            {items.length > 99 ? '99+' : items.length}
          </span>
        )}
      </button>

      {open && (
        // Mobile: a sheet pinned under the 44px navbar so it cannot run off the
        // edge. sm and up: the usual dropdown hanging off the bell.
        <div className="fixed left-2 right-2 top-12 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:w-80 bg-white rounded shadow-lg border border-gray-200 z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wide text-gray-600">
              Notifications
            </span>
            <span className="flex items-center gap-2.5">
              {items.length > 0 && (
                <button
                  onClick={clearAll}
                  title="Mark every notification as read"
                  className="text-[10px] font-bold uppercase tracking-wide text-[#3482AE] hover:opacity-70 bg-transparent border-0 p-0 cursor-pointer"
                >
                  Clear All
                </button>
              )}
              <span className="text-[11px] font-semibold text-gray-500">{items.length}</span>
            </span>
          </div>

          <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-[11px] text-gray-400 uppercase tracking-wide">
                Nothing new
              </p>
            ) : (
              items.map((n) => {
                const look = LOOK[n.status] || DEFAULT_LOOK;
                return (
                  <button
                    key={n.id}
                    onClick={() => openItem(n)}
                    className="w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors bg-transparent cursor-pointer flex gap-2.5 items-start"
                  >
                    <i className={`${look.icon} text-sm mt-0.5 flex-shrink-0`} style={{ color: look.color }} />
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold text-gray-700 truncate">
                        {n.compSrNo || n.title}
                      </span>
                      <span className="block text-[11px] text-gray-500">{n.message}</span>
                      <span className="block text-[10px] text-gray-400 truncate">
                        {`${n.regDate || ''} ${n.regTime || ''}`.trim()}
                      </span>
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
