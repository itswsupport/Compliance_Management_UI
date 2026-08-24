export function sectionOf(pathname) {
  return String(pathname || '').split('/')[1] || '';
}

/**
 * Sections that are a detour, not a dashboard.
 *
 * The Notice Dashboard belongs to no role — it borrows the card row of whatever
 * dashboard the user came from, and it is reached by a card on that row. So a
 * trip to the notices is a step sideways, not a move to somewhere new, and
 * lastSection must not follow the user there.
 *
 * What that buys, in ComplianceListPage's useLayoutEffect: the year/month
 * filter the user set is still applied when they come back, the dashboard's
 * card counts are not re-fetched for a detour, and the calendar does not
 * re-open as though they had just arrived.
 */
const TRANSIENT_SECTIONS = new Set(['notice']);

let lastSection = null;

/**
 * True when this navigation lands on a different dashboard than the last one.
 *
 * Always false for a transient section, and it leaves lastSection alone — the
 * caller has not gone anywhere as far as its dashboard is concerned.
 */
export function enteredSection(pathname) {
  const section = sectionOf(pathname);
  if (TRANSIENT_SECTIONS.has(section)) return false;
  const arrived = lastSection !== section;
  lastSection = section;
  return arrived;
}

export function recordSection(pathname) {
  const section = sectionOf(pathname);
  if (TRANSIENT_SECTIONS.has(section)) return;
  lastSection = section;
}
