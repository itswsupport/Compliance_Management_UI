/**
 * Reading a notice's period.
 *
 * A compliance is filtered on its due date — see complianceRows. A notice has
 * no due date; the only date it has is the day it went out, which is the
 * PUBLISHED ON column. So that is what "period" means for a notice, and why
 * these cannot share the compliance helpers: run a notice through those and it
 * has no readable date, so it drops out of every filter.
 *
 * Used by the Notice Dashboard's own filter bar and by the Notice Dashboard
 * card on every other dashboard, so the number on the card and the list it
 * opens are narrowed the same way.
 */

/**
 * The year and month a notice was published, or null if reg_date cannot be
 * read. reg_date is stored as YYYY-MM-DD. Month is 0-based, matching the
 * compliance filter's values.
 */
export function publishedParts(row) {
  const m = /^(\d{4})-(\d{2})/.exec(String(row?.regDate || ''));
  return m ? { year: Number(m[1]), month: Number(m[2]) - 1 } : null;
}

/**
 * Notices published in a period. '' means "all" on either side, so a month on
 * its own spans every year.
 *
 * A notice whose reg_date cannot be read drops out while a filter is on, since
 * it cannot be shown to satisfy the period — the same rule filterByPeriod
 * applies to a compliance with no readable due date.
 */
export function filterNoticesByPeriod(list, year = '', month = '') {
  if (year === '' && month === '') return list;
  return (list || []).filter((row) => {
    const parts = publishedParts(row);
    if (!parts) return false;
    if (year !== '' && parts.year !== Number(year)) return false;
    if (month !== '' && parts.month !== Number(month)) return false;
    return true;
  });
}

/** Published years present in a list, newest first. */
export function noticeYearsIn(list) {
  const years = new Set();
  (list || []).forEach((row) => {
    const parts = publishedParts(row);
    if (parts) years.add(parts.year);
  });
  return [...years].sort((a, b) => b - a);
}
