import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { COUNT_STATUS_BY_PATH } from '../../utils/dashboardCounts';
import { fetchComplianceRows, visibleRows, filterByPeriod } from '../../utils/complianceRows';


function HourglassIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginBottom: 1 }}
    >
      <path d="M5 22h14" />
      <path d="M5 2h14" />
      <path d="M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22" />
      <path d="M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  );
}

// Stroke-based plus for the Assign Compliance card.
function PlusIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="30"
      height="30"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="4.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginBottom: '1px' }}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </svg>
  );
}

/**
 * Rows behind each card, keyed by the route the card links to.
 *
 * Every page is its own mount, so without this each one would re-fetch the
 * other tabs' lists purely to re-count them — several queries competing with
 * the one list the user actually asked for. A tab is fetched once, then reused
 * by every dashboard page, including Assign Compliance.
 *
 * Rows rather than plain counts, so the year/month filter can be re-applied to
 * every card without going back to the server for each change.
 *
 * Cleared whenever a record could have moved (assign, delete, an action saved
 * in the detail view) and by any full page load, so it cannot outlive a login.
 */
const rowsCache = new Map();

// The navbar bell reads these rows too, and nothing else would tell it they changed.
const cacheListeners = new Set();

export function subscribeCardCache(fn) {
  cacheListeners.add(fn);
  return () => cacheListeners.delete(fn);
}

function publishCache() {
  cacheListeners.forEach((fn) => fn());
}

export function clearCardCache() {
  rowsCache.clear();
  publishCache();
}

/**
 * Drop one dashboard's rows so its tabs are fetched again.
 *
 * The cache is fetch-once, so rows taken before someone else acted stayed until
 * a full page load — an admin's Approved list could still be showing the state
 * from before HCM Head approved. Arriving at a dashboard re-reads that
 * dashboard; every other dashboard's rows are left alone, because the navbar
 * bell needs them wherever the user is standing.
 */
export function clearSectionCache(section) {
  [...rowsCache.keys()]
    .filter((path) => String(path).split('/')[1] === section)
    .forEach((path) => rowsCache.delete(path));
  publishCache();
}

/** Publish rows worked out elsewhere — the page's own list already has them. */
export function setCachedRows(path, rows) {
  rowsCache.set(path, rows);
  publishCache();
}

/** Every row any card knows about — used to offer the year filter's options. */
export function cachedRows() {
  return [...rowsCache.values()].flat();
}

/** [path, rows] pairs — the bell needs the path to know which dashboard owns a row. */
export function cachedEntries() {
  return [...rowsCache.entries()];
}

/**
 * The dashboard stat cards, with the record count in place of the icon.
 *
 * Props:
 *   cards        — [{ label, icon, color, to }]
 *   currentCount — count for the card matching the current route, worked out by
 *                  the host page from the rows it already loaded (undefined
 *                  while that list is still loading)
 *   ready        — hold the count requests back until the host page's own list
 *                  is in, so they never compete with it (default true)
 *   period       — { year, month } from the dashboard filter, applied to every
 *                  card so one selection narrows the whole dashboard, not just
 *                  the list. Costs no requests: the rows are already here.
 *   onSameRoute  — clicked card points at the page we are already on; the host
 *                  decides what that means (navigate() cannot do anything)
 */
export default function DashboardNavCards({
  cards = [],
  currentCount,
  ready = true,
  period,
  onSameRoute,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  // Router pathname, not window.location — the latter carries the "/compliance"
  // basename, which the card `to` values do not.
  const { pathname } = useLocation();
  // Seeded from whatever earlier pages already worked out, so moving between
  // dashboards costs no requests.
  const [rows, setRows] = useState(() => Object.fromEntries(rowsCache));

  useEffect(() => {
    if (!user || !ready) return undefined;
    let cancelled = false;
    // The card for the page we are on is answered by the host, and anything
    // already fetched this session is left alone — so a tab click refreshes
    // that tab's list alone.
    const targets = cards.filter(
      (card) => COUNT_STATUS_BY_PATH[card.to] &&
        card.to !== pathname &&
        !rowsCache.has(card.to),
    );
    if (targets.length === 0) return undefined;

    (async () => {
      const entries = await Promise.all(
        targets.map(async (card) => {
          try {
            const list = await fetchComplianceRows(user, COUNT_STATUS_BY_PATH[card.to]);
            // Store what the tab would actually show, so the count and the list
            // behind it agree; the period filter is applied at render.
            return [card.to, visibleRows(list, card.to.includes('/pending'), user.empCode)];
          } catch {
            // A card that fails stays blank rather than showing a wrong number.
            return null;
          }
        }),
      );
      if (cancelled) return;
      const found = entries.filter(Boolean);
      found.forEach(([to, list]) => rowsCache.set(to, list));
      publishCache();
      setRows((prev) => ({ ...prev, ...Object.fromEntries(found) }));
    })();

    return () => { cancelled = true; };
  }, [user, pathname, cards, ready]);

  function handleClick(to) {
    if (to === pathname) {
      onSameRoute?.(to);
      return;
    }
    navigate(to);
  }

  if (cards.length === 0) return null;

  // Whole class names, not `md:grid-cols-${n}` — Tailwind generates CSS by
  // scanning source text, so a name assembled at runtime is never emitted and
  // the cards silently stack one per row.
  const columnsCls = cards.length === 3 ? 'md:grid-cols-3' : 'md:grid-cols-4';

  return (
    <div className={`grid grid-cols-1 ${columnsCls} gap-4 no-print`}>
      {cards.map((card) => {
        const cached = rows[card.to];
        // The host already applied the filter to its own card's rows; every
        // other card re-applies it here, against rows fetched once.
        const count = card.to === pathname
          ? currentCount
          : cached && filterByPeriod(cached, period?.year ?? '', period?.month ?? '').length;
        // Cards with a list behind them show the count, never an icon — showing
        // an icon first would flash and swap. Only Assign Compliance keeps one.
        const countable = Boolean(COUNT_STATUS_BY_PATH[card.to]);
        return (
          <div
            key={card.label}
            onClick={() => handleClick(card.to)}
            className={`stat-card ${card.color}`}
          >
            {countable
              ? (
                // "..." while loading, as in HRMS DashboardCard — a 0 would read as a real answer.
                <span className="text-white text-[20px] font-bold leading-none">
                  {count === undefined ? '...' : count}
                </span>
              )
              : card.icon === 'fas fa-check-square'
              ? <i className="far fa-check-square" style={{ fontSize: '2.3em', marginBottom: '1px', color: 'white' }} />
              : card.icon.includes('fa-hourglass')
              ? <HourglassIcon />
              : card.icon.includes('fa-plus')
              ? <PlusIcon />
              : (card.icon.includes('fa-times-circle') || card.icon.includes('fa-window-close'))
              ? <i className="far fa-window-close fa-2x" style={{ fontSize: '2.2em' ,marginBottom: '1px', color: 'white' }} />
              : card.icon.includes('fa-spinner')
              ? <i className={`${card.icon} icon`} style={{ marginBottom: 1 }} />
              : <i className={`${card.icon} icon`} />}
            <h5>{card.label}</h5>
          </div>
        );
      })}
    </div>
  );
}
