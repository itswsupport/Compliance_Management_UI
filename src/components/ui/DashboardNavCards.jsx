import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { COUNT_STATUS_BY_PATH } from '../../utils/dashboardCounts';
import { sectionOf } from '../../utils/navSection';
import { getNoticeList } from '../../services/noticeService';
import { filterNoticesByPeriod } from '../../utils/noticeRows';
import { getLegalNoticeList } from '../../services/legalNoticeService';
import { filterLegalByPeriod } from '../../utils/legalNoticeRows';
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

/**
 * When each path's rows were taken.
 *
 * The cache itself has no lifetime - it is emptied by an action or a page load -
 * which left counts standing after somebody else moved a record, and after
 * midnight moved one into Overdue on its own. An entry older than this is
 * re-fetched on the next render rather than trusted.
 */
const fetchedAt = new Map();
const CACHE_TTL_MS = 60000;

function isFresh(path) {
  const at = fetchedAt.get(path);
  return at !== undefined && (Date.now() - at) < CACHE_TTL_MS;
}

/** Mark everything stale without dropping it, so cards keep their number until
 *  the new one arrives instead of blinking to zero. */
function staleAll() {
  fetchedAt.clear();
}

/**
 * The one card that is not a compliance tab.
 *
 * It counts like the rest, but neither half of the machinery behind the others
 * fits it: its rows come from notice/list rather than a compliance status
 * query, and its period is the day a notice was published rather than a due
 * date. Both are branched on this path.
 */
/**
 * The grid class for a row of this many cards.
 *
 * Whole class names, never `md:grid-cols-${n}` — Tailwind generates CSS by
 * scanning source text, so a name assembled at runtime is never emitted and the
 * cards silently stack one per row.
 *
 * One column per card from lg up, so a row always fits on one line however many
 * it holds. Below that they fall back to three, which is as many as a tablet can
 * show without the labels becoming unreadable.
 */
const COLUMNS_BY_COUNT = {
  1: 'md:grid-cols-1',
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
  5: 'md:grid-cols-3 lg:grid-cols-5',
  6: 'md:grid-cols-3 lg:grid-cols-6',
  7: 'md:grid-cols-4 lg:grid-cols-7',
};

export function gridColumnsFor(count) {
  return COLUMNS_BY_COUNT[count] || 'md:grid-cols-4';
}

/** Five or more cards share a line, so they wear the tighter padding. */
export function isCompactRow(count) {
  return count >= 5;
}

const NOTICE_PATH = '/notice/list';

/**
 * The other card that is not a compliance tab.
 *
 * Only the reader roles carry it — Plant HR and Comp Admin reach legal notices
 * from the sidebar instead. Counted like the Notice card and for the same
 * reason: its rows come from legal_notice/list rather than a compliance status
 * query. Its period is the DUE date, though, not the day it was raised, so
 * unlike a notice it narrows through the compliance-shaped filter.
 */
const LEGAL_NOTICE_PATH = '/legal-notice/list';

/**
 * True for any of the legal notice screens.
 *
 * There is one per reader dashboard — /comp-head/legal-notice and friends — plus
 * the workspace the sidebar opens, so a single path comparison no longer
 * answers it.
 */
function isLegalNoticePath(to) {
  const path = String(to || '');
  return path === LEGAL_NOTICE_PATH || path.endsWith('/legal-notice');
}

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
  fetchedAt.clear();
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
    .forEach((path) => { rowsCache.delete(path); fetchedAt.delete(path); });
  publishCache();
}

/** Publish rows worked out elsewhere — the page's own list already has them. */
export function setCachedRows(path, rows) {
  rowsCache.set(path, rows);
  fetchedAt.set(path, Date.now());
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
 *   fromSection  — the dashboard this row belongs to, when the host is not that
 *                  dashboard. A screen that BORROWS a row must pass it: without
 *                  it the click reports the borrower's own path, and the next
 *                  screen looks up a card row under a section that has none and
 *                  draws no cards at all.
 */
export default function DashboardNavCards({
  cards: allCards = [],
  currentCount,
  ready = true,
  period,
  onSameRoute,
  fromSection,
}) {
  const { user } = useAuth();
  const navigate = useNavigate();

  /**
   * Cards this user actually gets.
   *
   * A row belongs to a dashboard, but two roles can share one — CHD and Plant HR
   * both land on /plant-hr/pending — and a card can be right for one of them and
   * redundant for the other. `show` lets the card say so, the same way NAV_ITEMS
   * does in the Sidebar. Cards without one are shown to everybody, which is all
   * of them but the Legal Notice card on the Plant HR row.
   */
  const cards = useMemo(
    () => allCards.filter((card) => !card.show || (user && card.show(user))),
    [allCards, user],
  );
  // Router pathname, not window.location — the latter carries the "/compliance"
  // basename, which the card `to` values do not.
  const { pathname } = useLocation();
  // Seeded from whatever earlier pages already worked out, so moving between
  // dashboards costs no requests.
  const [rows, setRows] = useState(() => Object.fromEntries(rowsCache));
  // Bumped when the tab comes back, to re-run the fetch below.
  const [recheck, setRecheck] = useState(0);

  /**
   * Coming back to this tab re-reads the cards.
   *
   * Someone else may have acted while it was hidden - a Plant HR submitting, an
   * approver deciding - and this tab has no way to hear about it. Marking the
   * entries stale rather than deleting them keeps the numbers on screen until
   * the new ones land, instead of blinking through zero.
   *
   * focus as well as visibilitychange: moving between two windows of the same
   * browser does not always hide either tab, which is exactly the two-window
   * case this is for.
   */
  useEffect(() => {
    const onReturn = () => {
      if (document.visibilityState !== 'visible') return;
      staleAll();
      setRecheck((n) => n + 1);
    };
    document.addEventListener('visibilitychange', onReturn);
    window.addEventListener('focus', onReturn);
    return () => {
      document.removeEventListener('visibilitychange', onReturn);
      window.removeEventListener('focus', onReturn);
    };
  }, []);

  useEffect(() => {
    if (!user || !ready) return undefined;
    let cancelled = false;
    // The card for the page we are on is answered by the host, and anything
    // already fetched this session is left alone — so a tab click refreshes
    // that tab's list alone.
    const targets = cards.filter(
      (card) => (COUNT_STATUS_BY_PATH[card.to] || card.to === NOTICE_PATH
        || isLegalNoticePath(card.to)) &&
        card.to !== pathname &&
        (!rowsCache.has(card.to) || !isFresh(card.to)),
    );
    if (targets.length === 0) return undefined;

    (async () => {
      const entries = await Promise.all(
        targets.map(async (card) => {
          try {
            if (isLegalNoticePath(card.to)) {
              // The server decides which legal notices this employee may see,
              // so the count is whatever the screen behind the card would list.
              const res = await getLegalNoticeList(user.empCode);
              return [card.to, res.data?.response || []];
            }
            if (card.to === NOTICE_PATH) {
              // The server decides which notices this employee may see, so the
              // count is whatever the dashboard behind the card would list.
              const res = await getNoticeList(user.empCode);
              return [card.to, res.data?.response || []];
            }
            // card.to, not the page we are standing on — the Notice Dashboard
            // draws another dashboard's cards, and those rows must be fetched
            // the way that dashboard fetches them.
            const list = await fetchComplianceRows(user, COUNT_STATUS_BY_PATH[card.to], card.to);
            // Store what the tab would actually show, so the count and the list
            // behind it agree; the period filter is applied at render.
            return [card.to, visibleRows(list, card.to.includes('/pending'), user.empCode, card.to)];
          } catch {
            // A card that fails stays blank rather than showing a wrong number.
            return null;
          }
        }),
      );
      if (cancelled) return;
      const found = entries.filter(Boolean);
      found.forEach(([to, list]) => { rowsCache.set(to, list); fetchedAt.set(to, Date.now()); });
      publishCache();
      setRows((prev) => ({ ...prev, ...Object.fromEntries(found) }));
    })();

    return () => { cancelled = true; };
  }, [user, pathname, cards, ready, recheck]);

  function handleClick(to) {
    if (to === pathname) {
      onSameRoute?.(to);
      return;
    }
    // Which dashboard the click came from. The Notice Dashboard and the Legal
    // Notice screen both read it, and both have to: they belong to no role, so
    // they borrow a card row — and a user holding two roles would otherwise
    // always get the row of their highest one, whichever dashboard they
    // actually came from.
    //
    // `fromSection` wins over the path when the host is itself a borrower.
    // Legal Notice showing the Comp Head row must hand on "comp-head": passing
    // "legal-notice" names a section with no row of its own, and the Notice
    // Dashboard would draw an empty strip where its cards should be.
    navigate(to, { state: { fromSection: fromSection || sectionOf(pathname) } });
  }

  if (cards.length === 0) return null;

  const columnsCls = gridColumnsFor(cards.length);
  const compact = isCompactRow(cards.length);

  return (
    <div className={`grid grid-cols-1 ${columnsCls} ${compact ? 'gap-3' : 'gap-4'} no-print`}>
      {cards.map((card) => {
        const cached = rows[card.to];
        // The host already applied the filter to its own card's rows; every
        // other card re-applies it here, against rows fetched once.
        const narrow = card.to === NOTICE_PATH
          ? filterNoticesByPeriod
          : isLegalNoticePath(card.to)
          ? filterLegalByPeriod
          : filterByPeriod;
        const count = card.to === pathname
          ? currentCount
          : cached && narrow(cached, period?.year ?? '', period?.month ?? '').length;
        // Cards with a list behind them show the count, never an icon — showing
        // an icon first would flash and swap. Only Assign Compliance keeps one.
        const countable = Boolean(COUNT_STATUS_BY_PATH[card.to]) || card.to === NOTICE_PATH
          || isLegalNoticePath(card.to);
        return (
          <div
            key={card.label}
            onClick={() => handleClick(card.to)}
            className={`stat-card ${compact ? 'stat-card-sm' : ''} ${card.color}`}
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
