/**
 * Reading a legal notice: which tab it belongs on, whose turn it is, and how
 * its period is worked out.
 *
 * The whole flow is the master `status` column, so everything here reads from
 * it. Nothing needs the action history to answer "whose turn is it" — that is
 * the point of the two-participant design (see LegalNoticeServiceImpl).
 */

/** The flow, as the server writes it. Same numbers the rest of the app uses. */
export const LEGAL_STATUS = {
  /** Raised, waiting for the Plant HR to take action. */
  PENDING: 0,
  APPROVED: 1,
  /** Comp Admin rejected — back with the Plant HR. */
  REJECTED: 2,
  /** Plant HR submitted — waiting on the Comp Admin. */
  SUBMITTED: 3,
  /** Plant HR submitted again after a rejection — waiting on the Comp Admin. */
  RESUBMITTED: 4,
  /** Only ever written on an action row, never on the notice itself. */
  RAISED: 6,
};

/**
 * How each status reads in the list.
 *
 * Worded from the reader's point of view rather than the record's: "Submission
 * Pending" says what has to happen next, which is what somebody scanning a list
 * of their own work wants to know.
 */
export const LEGAL_STATUS_LABELS = {
  [LEGAL_STATUS.PENDING]:     { label: 'Submission Pending', variant: 'warning' },
  [LEGAL_STATUS.APPROVED]:    { label: 'Approved',           variant: 'success' },
  [LEGAL_STATUS.REJECTED]:    { label: 'Rejected',           variant: 'danger'  },
  // Amber, not teal. Every 'Approval Pending' in the compliance flow is amber
  // (STATUS_LABELS in constants.js, LIST_STATUS in ComplianceListPage), and teal
  // is what 'Submitted' wears there. The two must not swap meanings between the
  // flows: amber says somebody still owes an answer, teal says a step is done.
  [LEGAL_STATUS.SUBMITTED]:   { label: 'Approval Pending',   variant: 'warning' },
  [LEGAL_STATUS.RESUBMITTED]: { label: 'Approval Pending',   variant: 'warning' },
};

/** How each step of the Action History reads — what happened, not what is next. */
export const LEGAL_ACTION_LABELS = {
  [LEGAL_STATUS.RAISED]:      { label: 'Legal Notice Raised', variant: 'primary' },
  [LEGAL_STATUS.SUBMITTED]:   { label: 'Submitted',           variant: 'info'    },
  [LEGAL_STATUS.RESUBMITTED]: { label: 'Re-Submitted',        variant: 'info'    },
  [LEGAL_STATUS.APPROVED]:    { label: 'Approved',            variant: 'success' },
  [LEGAL_STATUS.REJECTED]:    { label: 'Rejected',            variant: 'danger'  },
};

export function legalStatusInfo(status) {
  return LEGAL_STATUS_LABELS[Number(status)] || { label: 'Pending', variant: 'warning' };
}

/**
 * How one row of the Action History reads.
 *
 * Takes the row, not just its status, because a waiting row is status 0 at both
 * levels and only authLevel says which step is waiting — 1 is the Plant HR
 * owing a submission, 2 is the Comp Admin owing a decision.
 */
export function legalActionInfo(row) {
  const status = Number(row?.status);
  if (status === LEGAL_STATUS.PENDING) {
    return Number(row?.authLevel) === 2
      ? { label: 'Approval Pending', variant: 'warning' }
      : { label: 'Submission Pending', variant: 'warning' };
  }
  return LEGAL_ACTION_LABELS[status] || { label: 'Action', variant: 'secondary' };
}

/* ---------------------------- whose turn ---------------------------- */

/** Waiting on the Plant HR: newly raised, or rejected and sent back. */
export function awaitingPlantHr(row) {
  const s = Number(row?.status);
  return s === LEGAL_STATUS.PENDING || s === LEGAL_STATUS.REJECTED;
}

/** Waiting on the Comp Admin to approve or reject. */
export function awaitingCompAdmin(row) {
  const s = Number(row?.status);
  return s === LEGAL_STATUS.SUBMITTED || s === LEGAL_STATUS.RESUBMITTED;
}

export function isApproved(row) {
  return Number(row?.status) === LEGAL_STATUS.APPROVED;
}

/** Sent back by the Comp Admin and not yet acted on again. */
export function isRejected(row) {
  return Number(row?.status) === LEGAL_STATUS.REJECTED;
}

/**
 * Whether this user may act on this notice right now.
 *
 * Only ever narrows what the screen offers. The server decides the same thing
 * again on save and is the one that counts — a form that is merely hidden is
 * not a rule. See LegalNoticeServiceImpl.saveAction.
 *
 * A Plant HR acts on their own plants; the check that it IS one of their plants
 * is the server's, since the browser has no trustworthy list of them.
 */
export function canAct(row, user) {
  if (!row || !user) return false;
  // Plant HR only, not CHD. A CHD reads legal notices and does nothing to them,
  // which is why they are absent from PLANT_HR_ROLE_IDS on the server too.
  if (awaitingPlantHr(row)) return Boolean(user.isPlantHr);
  if (awaitingCompAdmin(row)) return Boolean(user.isCompAdmin);
  return false;
}

/**
 * Which form to draw for this user: the submission, or approve/reject.
 *
 * Read off the notice, never off the role — a user holding both Plant HR and
 * Comp Admin sees the form the notice is actually waiting for, not the one
 * their highest role would suggest.
 */
export function actionKind(row) {
  if (awaitingPlantHr(row)) return 'submit';
  if (awaitingCompAdmin(row)) return 'approve';
  return null;
}

/* ---------------------------- tabs ---------------------------- */

/**
 * Past its due date and not yet approved.
 *
 * Worked out here rather than stored, so a notice becomes overdue by the day
 * passing rather than by something having to run. The compliance flow keeps an
 * OVERDUE status because a scheduler moves records into it; nothing schedules
 * anything here, and a computed answer cannot go stale.
 *
 * Compared as YYYY-MM-DD strings, which sort correctly as text — the format the
 * server stores and the date input posts.
 *
 * "Today" is the LOCAL date, not toISOString()'s UTC one. The due date was
 * picked in the user's own timezone, so comparing it against a UTC day is
 * comparing two different calendars: in IST, between midnight and 05:30, UTC is
 * still on yesterday and everything due today would have read as overdue.
 *
 * Strictly before, so a notice due today is NOT overdue — the day it is due is
 * a day you still have.
 */
function localToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function isOverdue(row, today = localToday()) {
  if (!row || isApproved(row)) return false;
  const due = String(row.dueDate || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return false;
  return due < today;
}

/**
 * The rows behind one card.
 *
 * The cards are exclusive: a notice belongs to exactly one, so the four counts
 * sum to the number of notices. Approved, Rejected and Overdue take precedence
 * in that order, and Pending is what is left — outstanding and still in time.
 *
 * This is deliberately NOT what the compliance dashboard does, where Pending is
 * [0,3,4,11,2] and Overdue is [0,5] and a status-0 record sits on both. That
 * flow is not ours to change.
 *
 * @param hasRejectedTab whether the caller is also showing a Rejected card. It
 *   decides where a rejected notice belongs — see below.
 */
export function rowsForTab(list, tab, hasRejectedTab = false) {
  const rows = list || [];
  if (tab === 'approved') return rows.filter(isApproved);
  if (tab === 'rejected') return rows.filter(isRejected);

  // Rejected outranks overdue where there is a card for it. Being sent back is
  // the more useful thing to know — it says what to DO — and a rejected notice
  // that is also late would otherwise be counted on both cards.
  if (tab === 'overdue') {
    return rows.filter((row) => isOverdue(row) && !(hasRejectedTab && isRejected(row)));
  }

  if (tab === 'pending') {
    // The four cards partition the notices: every one lands on exactly one, and
    // the counts add up to the total. Two exclusions do that here.
    //
    // Rejected rows leave as soon as there is a Rejected card to hold them — to
    // the Comp Admin who rejected it nothing is pending anyway, it is back with
    // the Plant HR. Without that card they stay, because to the Plant HR a
    // rejection IS pending work and dropping it would lose the notice entirely.
    //
    // Overdue rows leave unconditionally. Pending therefore reads "outstanding
    // and still in time" rather than "outstanding", so anything late is on the
    // Overdue card and nowhere else. The cost is that "everything I still owe"
    // is now Pending + Overdue rather than Pending alone; the counts being
    // honest is worth more than that one card being a superset.
    return rows.filter((row) => (
      !isApproved(row)
      && !(hasRejectedTab && isRejected(row))
      && !isOverdue(row)
    ));
  }
  return rows;
}

/* ---------------------------- period ---------------------------- */

/**
 * Year and 0-based month of a notice's due date, or null when unreadable.
 *
 * The due date, not the day it was raised: a legal notice HAS a due date, so
 * that is the date the period filter means — the same rule the compliance lists
 * follow. (A plain notice has no due date, which is why noticeRows filters on
 * the published date instead.)
 */
export function dueParts(row) {
  const value = String(row?.dueDate || '').trim().split(/[ T]/)[0];
  let m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(value);
  if (m) return { year: +m[1], month: +m[2] - 1 };
  m = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/.exec(value);
  if (m) return { year: +m[3], month: +m[2] - 1 };
  return null;
}

/**
 * Narrow to a due-date year and/or month. '' means "all" on either side, so a
 * month on its own spans every year.
 *
 * A row whose due date cannot be read drops out once any filter is on — it
 * cannot be shown to satisfy the period the user asked for.
 */
export function filterLegalByPeriod(list, year = '', month = '') {
  if (year === '' && month === '') return list || [];
  return (list || []).filter((row) => {
    const parts = dueParts(row);
    if (!parts) return false;
    if (year !== '' && parts.year !== Number(year)) return false;
    if (month !== '' && parts.month !== Number(month)) return false;
    return true;
  });
}

/** Due-date years present in a list, newest first. */
export function legalYearsIn(list) {
  const years = new Set();
  (list || []).forEach((row) => {
    const parts = dueParts(row);
    if (parts) years.add(parts.year);
  });
  return [...years].sort((a, b) => b - a);
}
