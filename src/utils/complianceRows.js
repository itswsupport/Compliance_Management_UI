import {
  getComplianceList,
  getPhrComplianceList,
  getUserComplianceList,
  getAuthorityComplianceList,
} from '../services/complianceService';
import { STATUS } from './constants';
import { getDueDate } from './formatters';

/**
 * Fetch a compliance list for the role a given dashboard belongs to.
 *
 * Shared by the list table and by the dashboard card counts, which need the
 * same call with a different status set.
 *
 * @param forPath the dashboard the rows are FOR — a card's `to`, not
 *   necessarily the page being looked at. It used to read
 *   window.location.pathname on the assumption that every card on a screen
 *   belongs to that screen's role, which the Notice Dashboard broke: it belongs
 *   to no role, matches none of the branches below, and so counted a Comp
 *   Admin's cards through the user-level endpoint — 8 pending instead of 392.
 *   Defaults to the current path, which is right for the list table.
 */
export async function fetchComplianceRows(user, statuses, forPath) {
  const path = forPath || window.location.pathname;
  let res;
  if (path.includes('/comp-admin/')) {
    res = await getComplianceList(user.empCode, statuses);
  } else if (path.includes('/plant-hr/')) {
    let mstStatus = 0;
    if (statuses.includes(5)) {
      mstStatus = 5;
    } else if (statuses.includes(1)) {
      mstStatus = 1;
    } else {
      mstStatus = 0;
    }
    res = await getPhrComplianceList(mstStatus, user.empCode, user.level, statuses);
  } else if (path.includes('/authority/')) {
    res = await getAuthorityComplianceList(statuses);
  } else {
    // comp-head, corp-hr, hcm-head
    // Corp HR should see requests from all assigned plants (backend handles plant filtering)
    // Don't pass plantCode - let backend filter based on Corp HR's plant assignments
    res = await getUserComplianceList(user.empCode, user.level, statuses);
  }
  return res.data?.response || [];
}

/**
 * Year and 0-based month of a row's due date, or null when it has none or the
 * date cannot be read. Accepts YYYY-MM-DD (what the assign form posts) and
 * falls back to DD-MM-YYYY, separated by - or /.
 *
 * Which date counts is the same rule the Due Date column uses: the last due
 * date for "AS & WHEN" records, the first due date otherwise.
 */
export function dueDateParts(row) {
  const value = getDueDate(row);
  if (!value || typeof value !== 'string') return null;
  const s = value.trim().split(/[ T]/)[0];
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(s);
  if (m) return { year: +m[1], month: +m[2] - 1 };
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(s);
  if (m) return { year: +m[3], month: +m[2] - 1 };
  return null;
}

/**
 * Narrow a list to a due-date year and/or month. Empty string means "all", so
 * a month on its own spans every year.
 *
 * A row whose due date cannot be read is dropped once any filter is on — it
 * cannot be shown to satisfy the period the user asked for.
 */
export function filterByPeriod(list, year = '', month = '') {
  if (year === '' && month === '') return list;
  return list.filter((row) => {
    const parts = dueDateParts(row);
    if (!parts) return false;
    if (year !== '' && parts.year !== Number(year)) return false;
    if (month !== '' && parts.month !== Number(month)) return false;
    return true;
  });
}

/** Due-date years present in a list, newest first. */
export function yearsIn(list) {
  const years = new Set();
  list.forEach((row) => {
    const parts = dueDateParts(row);
    if (parts) years.add(parts.year);
  });
  return [...years].sort((a, b) => b - a);
}

/**
 * What the user actually sees for a status set. The pending tabs hide records
 * that are already approved unless this user still has a waiting action row, so
 * a card counting a pending route has to apply the same rule or its number will
 * not match the list it opens.
 */
export function visibleRows(list, isPendingTab, empCode) {
  if (!isPendingTab) return list;
  return list.filter((row) => {
    const iAmStillWaiting = (row.compActionList || []).some(
      (a) => Number(a.authEmpCode) === Number(empCode) &&
        [0, 5, 11, 22].includes(Number(a.status)),
    );
    return iAmStillWaiting || Number(row.status) !== STATUS.APPROVED;
  });
}
