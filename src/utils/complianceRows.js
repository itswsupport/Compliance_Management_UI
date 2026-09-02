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
 * Whether the SERVER has already narrowed this path by effective status.
 *
 * getComplianceList, getAuthorityPendingComplianceList and getPhrComplianceList
 * run every row through effectiveStatus before returning it. What comes back is
 * therefore already the tab's contents, and anything filtered on top of it is
 * the same decision taken twice.
 *
 * getUserComplianceList - comp-head, corp-hr, hcm-head - does not, so those
 * paths still need the client-side rule below.
 */
// NOT '/plant-hr/'. getPhrComplianceList narrows its APPROVED and OVERDUE
// branches by effective status, but its outstanding branch only drops what is
// now past due - approved rows still arrive on the pending fetch, because the
// DAO's mstStatus==0 predicate lets master status 1 through. The rule below is
// what removes them, so a compliance is not counted on Pending and Approved
// both.
const SERVER_NARROWS_BY_EFFECTIVE_STATUS = ['/comp-admin/', '/authority/'];

export function serverAppliesEffectiveStatus(path) {
  return SERVER_NARROWS_BY_EFFECTIVE_STATUS.some((p) => String(path || '').includes(p));
}

/**
 * What the user actually sees for a status set. The pending tabs hide records
 * that are already approved unless this user still has a waiting action row, so
 * a card counting a pending route has to apply the same rule or its number will
 * not match the list it opens.
 *
 * Skipped entirely where the server has already answered the question: those
 * rows are chosen by EFFECTIVE status, and judging them again on the STORED one
 * discards exactly the records the server meant to include.
 */
/**
 * The status a record should be READ as, which is not always the status stored
 * on it.
 *
 * The server marks a compliance APPROVED at the second approval and only then
 * opens the HCM Head's level-3 action row at FINAL_APPROVAL_PENDING, so a
 * record can claim to be approved while an approval is still outstanding. Where
 * that is true the open action row is the truth: the record is still waiting.
 *
 * Everything else falls straight through to its own status, including rows from
 * the notice and legal notice flows, which carry no compActionList at all.
 *
 * NOTE: rebuilt from its two call sites (ComplianceListPage, DataTable) after
 * the original was lost. Behaviour matches what those callers document; the
 * wording is not the original.
 */
export function effectiveStatus(row) {
  const status = Number(row?.status);
  if (status !== STATUS.APPROVED) return status;
  const finalApprovalOpen = (row?.compActionList || []).some(
    (a) => Number(a.status) === STATUS.FINAL_APPROVAL_PENDING,
  );
  return finalApprovalOpen ? STATUS.FINAL_APPROVAL_PENDING : status;
}

export function visibleRows(list, isPendingTab, empCode, path) {
  if (serverAppliesEffectiveStatus(path)) return list;
  if (!isPendingTab) return list;
  return list.filter((row) => {
    // 22 is deliberately NOT here. The second approval closes the compliance
    // (master := APPROVED) and only THEN writes the HCM Head's level-3 waiting
    // row at 22 — see CompliancePortalServiceImpl, "Step 4: Send to HCM_HEAD".
    // That row is never cleared, so treating it as "still mine" kept every
    // finished compliance on the HCM Head's pending list for ever: 160 rows of
    // which 159 were already approved and offered him no action to take.
    //
    // Dropping it costs nothing for the one case that IS his: a compliance
    // genuinely awaiting final approval has master status 22, not 1, so the
    // clause below keeps it regardless.
    const iAmStillWaiting = (row.compActionList || []).some(
      (a) => Number(a.authEmpCode) === Number(empCode) &&
        [0, 5, 11].includes(Number(a.status)),
    );
    // effectiveStatus, not row.status. A record the server closed at the second
    // approval still reads 1 while its level-3 row is open, and it is genuinely
    // still in flight - judging it on the stored status dropped it from Pending
    // while the Approved tab had already excluded it, so it appeared nowhere.
    return iAmStillWaiting || effectiveStatus(row) !== STATUS.APPROVED;
  });
}
