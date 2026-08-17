import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { cachedEntries, subscribeCardCache } from '../ui/DashboardNavCards';
import { viewPathForUser } from '../../utils/roleRoutes';
import { sectionOf } from '../../utils/navSection';
import { LS_KEYS } from '../../utils/constants';

// Last status the user saw per record: { "<empCode>": { "<id>": status } }.
// Per browser, so Chrome and Edge track separately — there is no server side.
const SEEN_KEY = 'comp_notif_seen';

function readSeen(empCode) {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}')[String(empCode)] || null;
  } catch {
    return null;
  }
}

function writeSeen(empCode, map) {
  try {
    const all = JSON.parse(localStorage.getItem(SEEN_KEY) || '{}');
    all[String(empCode)] = map;
    localStorage.setItem(SEEN_KEY, JSON.stringify(all));
  } catch {
    // Private mode or a full quota — the bell just shows everything as unread.
  }
}

// The bell has to redraw when something outside it marks a record read.
const seenListeners = new Set();
function publishSeen() {
  seenListeners.forEach((fn) => fn());
}

/**
 * Mark one compliance read. Called by ComplianceView whenever a record is
 * opened, so reaching it from the list counts as reading its notification too —
 * not only clicking it in the panel.
 */
export function markComplianceRead(empCode, compId) {
  if (!empCode || compId == null) return;
  const row = uniqueRows().find((r) => String(r.id) === String(compId));
  if (!row) return;
  const state = myState(row, empCode);
  if (!state) return;
  const all = readSeen(empCode) || {};
  if (all[String(compId)] === state.key) return;
  writeSeen(empCode, { ...all, [String(compId)]: state.key });
  publishSeen();
}

// One row per compliance, tagged with the dashboard path it was cached under.
// A record can sit in two cached tabs at once (Plant HR counts status 0 under
// both Pending and Overdue), so the id decides.
function uniqueRows() {
  const byId = new Map();
  cachedEntries().forEach(([path, rows]) => {
    (rows || []).forEach((row) => {
      if (row && row.id != null) byId.set(String(row.id), { ...row, from: path });
    });
  });
  return [...byId.values()];
}

// Statuses that mean an action row is still waiting on its owner.
const WAITING = [0, 5, 11, 22];
// ComplianceConstants.COMP_ASSIGNED — the row written for whoever assigned it.
const ASSIGNED = 6;

/**
 * The dashboard where this user can actually act on a waiting row.
 *
 * A user can hold several roles, so "open the compliance" is not enough — a
 * record awaiting the Comp Head has to open on the Comp Head dashboard, or the
 * approve/reject form is not there. authLevel says which role is required;
 * level 2 is an approval step, which is Comp Head or Corp HR depending on who
 * this user is. Null when they hold no role that can act.
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

/**
 * What this record means to THIS user, or null when it means nothing.
 *
 * The workflow hands a record along — admin assigns, Plant HR submits, Corp HR
 * approves — and only the person it is sitting with should be told to act. That
 * is decided by the action row addressed to them, not by the record's status.
 */
function myState(row, empCode) {
  const mine = (row.compActionList || [])
    .filter((a) => Number(a.authEmpCode) === Number(empCode) && WAITING.includes(Number(a.status)))
    .pop();

  // act = something is required of me. Only these survive a first sighting;
  // everything else is stamped silently, or every record already in the system
  // would arrive as a notification the first time its tab is cached.
  if (mine) {
    // lvl rides along so the click can open the dashboard that can act on it.
    const lvl = Number(mine.authLevel);
    if (Number(row.status) === 5) {
      return { key: 'overdue', act: true, lvl, text: 'Overdue — action required', icon: 'fas fa-hourglass-half', color: '#FFB64D' };
    }
    // authLevel 1/4 = doer submits, 3 = final approval, 2 = approval step.
    if (lvl === 1 || lvl === 4) {
      return { key: 'submit', act: true, lvl, text: 'Assigned to you — submission pending', icon: 'fas fa-clipboard-list', color: '#3482AE' };
    }
    if (lvl === 3) {
      return { key: 'final', act: true, lvl, text: 'Final approval pending with you', icon: 'fas fa-user-check', color: '#6f42c1' };
    }
    return { key: 'approve', act: true, lvl, text: 'Approval pending with you', icon: 'fas fa-user-check', color: '#3482AE' };
  }

  // Outcomes go to whoever RAISED it, and to nobody else. Approvers know what
  // they just clicked, and the doer is told only when something is needed from
  // them — a rejection comes back as a waiting row, so it still reaches them
  // above, as "action required" rather than as news.
  //
  // The assignment writes an action row at status 6 (COMP_ASSIGNED) addressed to
  // the person who assigned it. Reading that works whoever they are: flow 1 is
  // raised by the Comp Admin, flow 2 by the Comp Head, and an earlier check for
  // "cached under /comp-admin/" missed the second one entirely.
  const iAssignedIt = (row.compActionList || []).some(
    (a) => Number(a.authEmpCode) === Number(empCode) && Number(a.status) === ASSIGNED,
  );
  if (!iAssignedIt) return null;

  // Nothing waiting on me — only the outcome. No name is shown: actionByEmpName
  // is whoever the record is WITH, not who acted, so "Approved by X" named the
  // person still holding it for final approval.
  if (Number(row.status) === 1) {
    const awaitingFinal = (row.compActionList || []).some((a) => Number(a.status) === 22);
    return awaitingFinal
      ? { key: 'approved-final', text: 'Approved — final approval pending', icon: 'fas fa-check-circle', color: '#3482AE' }
      : { key: 'approved', text: 'Approved', icon: 'fas fa-check-circle', color: '#2ed8b6' };
  }
  if (Number(row.status) === 2) {
    return { key: 'rejected', text: 'Rejected', icon: 'fas fa-times-circle', color: '#e74c3c' };
  }

  // Still moving through the flow. Reported so the record is TRACKED from the
  // moment it is raised — never as a badge, since act is false and a first
  // sighting is stamped quietly. Without it the raiser's record was unknown
  // until it finished, and "unknown -> approved" reads as a pre-existing record
  // rather than a change, so the approval was swallowed silently.
  return { key: 'progress', text: 'In progress', icon: 'fas fa-clock', color: '#869099' };
}

export default function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  // Bumped whenever the shared row cache changes, to recompute off the new rows.
  const [tick, setTick] = useState(0);
  const boxRef = useRef(null);

  useEffect(() => subscribeCardCache(() => setTick((t) => t + 1)), []);

  // Redraw when ComplianceView marks a record read from outside this component.
  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    seenListeners.add(bump);
    return () => seenListeners.delete(bump);
  }, []);

  // Close on an outside click, the way the Help menu closes on mouse-out.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const empCode = user?.empCode;
  // Only records that say something to this user, each with what they say.
  const notes = empCode
    ? uniqueRows()
        .map((row) => ({ row, state: myState(row, empCode) }))
        .filter((n) => n.state)
    : [];
  const seen = (empCode ? readSeen(empCode) : null) || {};

  // Records seen for the first time that ask nothing of me are recorded quietly.
  useEffect(() => {
    if (!empCode) return;
    const quiet = notes.filter((n) => seen[String(n.row.id)] === undefined && !n.state.act);
    if (quiet.length === 0) return;
    writeSeen(empCode, {
      ...seen,
      ...Object.fromEntries(quiet.map((n) => [String(n.row.id), n.state.key])),
    });
    setTick((t) => t + 1);
  }, [empCode, notes.length, seen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Unread = it changed since last time, or it is new AND wants something from
  // me. Covers the hand-off: it lands with the next person as it reaches them.
  const items = notes
    .filter((n) => {
      const prev = seen[String(n.row.id)];
      return prev === undefined ? n.state.act : prev !== n.state.key;
    })
    .sort((a, b) => Number(b.row.id) - Number(a.row.id));

  function openCompliance(row, state) {
    setOpen(false);
    // Only the one opened is marked read. Merging, never replacing, so the rest
    // keep their history and stay in the list until they are opened too.
    if (empCode) {
      writeSeen(empCode, { ...seen, [String(row.id)]: state.key });
      setTick((t) => t + 1);
    }
    localStorage.setItem(LS_KEYS.ID, row.id);
    // Something waiting on me opens where I can act on it — a record pending
    // with the Comp Head must open on the Comp Head dashboard even if the user
    // is also an admin, or there is no approve/reject form to use. Anything else
    // opens on the dashboard it was cached under; viewPathForUser is the last
    // resort, and answers by role priority alone.
    const section = sectionOf(row.from);
    const target = (state?.act && actionPath(user, state.lvl))
      || (section ? `/${section}/view` : viewPathForUser(user));
    // Back goes to that view's OWN dashboard. Without it the view falls back to
    // navigate(-1), which lands on whatever page the bell was clicked from.
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
          <span
            className="absolute top-0 right-0 min-w-[15px] h-[15px] px-[3px] rounded-full bg-[#e74c3c] text-white text-[9px] font-bold flex items-center justify-center leading-none"
          >
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
            <span className="text-[11px] font-semibold text-gray-500">{items.length}</span>
          </div>

          <div className="max-h-[60vh] sm:max-h-80 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-3 py-6 text-center text-[11px] text-gray-400 uppercase tracking-wide">
                Nothing new
              </p>
            ) : (
              items.map(({ row, state: d }) => (
                  <button
                    key={row.id}
                    onClick={() => openCompliance(row, d)}
                    className="w-full text-left px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors bg-transparent cursor-pointer flex gap-2.5 items-start"
                  >
                    <i className={`${d.icon} text-sm mt-0.5 flex-shrink-0`} style={{ color: d.color }} />
                    <span className="min-w-0">
                      <span className="block text-[11px] font-bold text-gray-700 truncate">
                        {row.compSrNo}
                      </span>
                      <span className="block text-[11px] text-gray-500 truncate">{d.text}</span>
                      <span className="block text-[10px] text-gray-400 truncate">
                        {row.compActType}
                        {row.firstDueDate ? ` · due ${row.firstDueDate}` : ''}
                      </span>
                    </span>
                  </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
