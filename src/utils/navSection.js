export function sectionOf(pathname) {
  return String(pathname || '').split('/')[1] || '';
}

/**
 * Sections that are a detour, not a dashboard.
 *
 * Legal Notice is here for the same reason the notices are, and it matters more:
 * a user holding two roles reaches it from whichever dashboard they were on, and
 * the screen decides what they may do by asking where that was. Recording
 * "legal-notice" as the section would erase the answer the moment they arrived,
 * so a Comp Head who is also an admin would be handed the admin workspace.
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
const TRANSIENT_SECTIONS = new Set(['notice', 'legal-notice']);

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

/**
 * The dashboard the user is working in.
 *
 * Not the current path — a transient screen does not change it, so this still
 * answers "which dashboard did they come here from" while they are standing on
 * one. Null before the first dashboard is visited.
 */
export function currentSection() {
  return lastSection;
}

/**
 * Every section the user passes through, transient ones included.
 *
 * `lastSection` above deliberately does NOT follow them to the notices or the
 * legal notices, so the period filter and the card counts survive a detour. But
 * that also meant coming BACK from one was not "arriving" anywhere, and the
 * Compliance Calendar — which opens when you arrive at the Comp Admin dashboard
 * from elsewhere — stayed shut after a trip to Legal Notice.
 *
 * Kept separate rather than folding the two together: they answer different
 * questions. This one is "did the screen change", `enteredSection` is "did the
 * dashboard change", and only the second should throw away a filter.
 */
let lastScreen = null;

/**
 * True when this navigation comes from a different screen than the last —
 * counting the notices and legal notices as screens of their own.
 *
 * True on the very first call, so a fresh login landing on a dashboard counts
 * as arriving at it.
 *
 * READS ONLY. `recordScreen` does the writing, from Layout, because Layout is
 * mounted for every route — a compliance page cannot notice a trip to Legal
 * Notice, since it is not on screen while the trip happens. That is why putting
 * the write here left the calendar shut: the last screen it knew about was
 * always its own.
 */
export function arrivedFromAnotherScreen(pathname) {
  return lastScreen === null || lastScreen !== sectionOf(pathname);
}

/**
 * Remember the screen just navigated to. Called once per route change, from
 * Layout, AFTER the page's own layout effects have compared against it.
 */
export function recordScreen(pathname) {
  lastScreen = sectionOf(pathname);
}

export function recordSection(pathname) {
  const section = sectionOf(pathname);
  if (TRANSIENT_SECTIONS.has(section)) return;
  lastSection = section;
}
