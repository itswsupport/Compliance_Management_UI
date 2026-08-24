/**
 * The year/month filter, shared by every screen that carries one.
 *
 * Lived as a module-level `sharedPeriod` inside ComplianceListPage, which was
 * enough while only the compliance tabs had a filter bar. The Notice Dashboard
 * has one too, and it is a route of its own — so keeping its own useState meant
 * the selection died the moment the user clicked any card, in either direction.
 *
 * Here instead, so both read and write the one value. Only ever one of those
 * screens is mounted at a time, so a plain variable is enough; nothing needs
 * telling when it changes.
 *
 * What resets it is unchanged and stays in ComplianceListPage: arriving at a
 * different dashboard, or a different user. The Notice Dashboard deliberately
 * does NOT reset it and does not record itself as a section — so stepping out
 * to the notices and back is not "arriving somewhere new", and the filter the
 * user set survives the round trip.
 */

let period = { year: '', month: '' };

/** The current selection. '' on either side means "all". */
export function getPeriod() {
  return period;
}

export function setPeriod(next) {
  period = { year: next?.year ?? '', month: next?.month ?? '' };
  return period;
}

/** Back to "all years, all months". */
export function resetPeriod() {
  return setPeriod({ year: '', month: '' });
}
