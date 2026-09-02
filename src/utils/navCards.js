/**
 * The dashboard card row, per role.
 *
 * Lived in each page file before, one copy per tab — five copies of the Comp
 * Admin row, three of the Plant HR row, and so on. That was fine while only
 * those pages drew them, but the Notice Dashboard draws a row too and it is one
 * page shared by every role: it has to be able to ask which row belongs to the
 * user in front of it. So the sets live here and the pages read them.
 *
 * The card that opens the Notice Dashboard is last in every row, and is the one
 * card that is not a compliance tab — see NOTICE_PATH in DashboardNavCards for
 * how it is counted and filtered.
 */

const NOTICE = { label: 'Notice',              icon: 'fas fa-bullhorn',     color: 'bg-c-notice',  to: '/notice/list'  };

/**
 * The Legal Notice card, for the roles that only read them.
 *
 * Plant HR and Comp Admin do NOT get this card — they reach legal notices from
 * the sidebar, because for them it is a place of work with its own tabs rather
 * than one list. Everyone else has no sidebar entry and this is their only way
 * in, which is why it sits on their dashboard instead.
 */
/**
 * The Legal Notice card for one reader dashboard.
 *
 * Section-scoped, unlike NOTICE above: "/comp-head/legal-notice" rather than one
 * shared path. Reading legal notices is something you do while standing on your
 * own dashboard, so the URL says which one — and the screen then knows what the
 * reader may do without being told separately.
 */
const legalNoticeCard = (section, show) => ({
  label: 'Legal Notice', icon: 'fas fa-gavel', color: 'bg-c-legal', to: `/${section}/legal-notice`,
  ...(show ? { show } : {}),
});

/**
 * The heading each dashboard wears.
 *
 * The same strings the compliance pages pass to ComplianceListPage as `title`,
 * kept here so a screen that belongs to a dashboard without being one of its
 * compliance tabs can wear the right one — the Legal Notice reader routes, which
 * live at /<dashboard>/legal-notice and must not rename the dashboard the user
 * is standing on.
 *
 * Plant HR is deliberately absent: its heading depends on whether the user is a
 * CHD, so it cannot be a constant. Nothing needs it here.
 */
export const DASHBOARD_TITLES = {
  'comp-admin': 'COMPLIANCE ADMIN DASHBOARD',
  'comp-head':  'COMPLIANCE HEAD DASHBOARD',
  'corp-hr':    'CORP HR COMPLIANCE DASHBOARD',
  'hcm-head':   'HCM HEAD COMPLIANCE DASHBOARD',
  authority:    'AUTHORITY DASHBOARD',
};

export const NAV_CARDS_BY_SECTION = {
  'comp-admin': [
    { label: 'Assign Compliance / Notice', icon: 'fas fa-plus',         color: 'bg-c-info',    to: '/comp-admin/assign' },
    { label: 'Pending Compliance', icon: 'fas fa-spinner',       color: 'bg-c-pending', to: '/comp-admin/pending' },
    { label: 'Approved Compliance',icon: 'fas fa-check-square',  color: 'bg-c-green1',  to: '/comp-admin/approved' },
    { label: 'Overdue Compliance', icon: 'far fa-hourglass',     color: 'bg-c-draft',   to: '/comp-admin/overdue' },
    NOTICE,
  ],
  'plant-hr': [
    { label: 'Pending Compliance',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/plant-hr/pending'  },
    { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/plant-hr/approved' },
    { label: 'Overdue Compliance',  icon: 'far fa-hourglass',    color: 'bg-c-draft',   to: '/plant-hr/overdue'  },
    NOTICE,
    // CHD only. This row is the CHD's dashboard as well as the Plant HR's —
    // both land on /plant-hr/pending — and a CHD has no sidebar entry, so the
    // card is their only way in, exactly as it is for HCM Head and Authority.
    //
    // The Plant HR is excluded because they DO have the sidebar entry: showing
    // them both would be two doors onto the same records, one of them the
    // read-only half of what the other gives.
    legalNoticeCard('plant-hr', (u) => !u.isPlantHr),
  ],
  'comp-head': [
    { label: 'Approval Pending',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/comp-head/pending'  },
    { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/comp-head/approved' },
    { label: 'Rejected Compliance', icon: 'fas fa-times-circle', color: 'bg-c-reject',  to: '/comp-head/rejected' },
    NOTICE,
    legalNoticeCard('comp-head'),
  ],
  'corp-hr': [
    { label: 'Approval Pending',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/corp-hr/pending'  },
    { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/corp-hr/approved' },
    { label: 'Rejected Compliance', icon: 'fas fa-times-circle', color: 'bg-c-reject',  to: '/corp-hr/rejected' },
    NOTICE,
    legalNoticeCard('corp-hr'),
  ],
  'hcm-head': [
    { label: 'Approval Pending',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/hcm-head/pending'  },
    { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/hcm-head/approved' },
    { label: 'Rejected Compliance', icon: 'fas fa-times-circle', color: 'bg-c-reject',  to: '/hcm-head/rejected' },
    NOTICE,
    legalNoticeCard('hcm-head'),
  ],
  authority: [
    { label: 'Pending Compliance',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/authority/pending'  },
    { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/authority/approved' },
    { label: 'Rejected Compliance', icon: 'fas fa-times-circle', color: 'bg-c-reject',  to: '/authority/rejected' },
    { label: 'Overdue Compliance',  icon: 'far fa-hourglass',    color: 'bg-c-draft',   to: '/authority/overdue'  },
    NOTICE,
    legalNoticeCard('authority'),
  ],
};

/**
 * The heading a dashboard wears, for a screen standing on it.
 *
 * A function rather than a plain lookup because Plant HR's depends on the user:
 * the same dashboard is "CHD DASHBOARD" for a CHD and "PLANT HR DASHBOARD" for
 * everyone else, exactly as the compliance pages decide it.
 *
 * '' when the section is unknown, so the caller can fall back to its own name.
 */
export function dashboardTitle(section, user) {
  if (section === 'plant-hr') {
    return user?.isChd ? 'CHD DASHBOARD' : 'PLANT HR DASHBOARD';
  }
  return DASHBOARD_TITLES[section] || '';
}

/**
 * The dashboard this user lands on.
 *
 * Same role order as homePathForUser, and for the same reason: an employee can
 * hold more than one role, and the one that matters is the dashboard they
 * arrive at. '' when no role applies.
 */
export function sectionForUser(user) {
  if (!user) return '';
  if (user.isCompAdmin) return 'comp-admin';
  if (user.isChd || user.isPlantHr) return 'plant-hr';
  if (user.isCompHead) return 'comp-head';
  if (user.isCorpHr) return 'corp-hr';
  if (user.isHcmHead) return 'hcm-head';
  if (user.isAuthority) return 'authority';
  return '';
}

/**
 * The row this user's own dashboard shows.
 *
 * Used by the Notice Dashboard, which belongs to no role and so cannot name a
 * row of its own — and only as a fallback, for a visit that named no dashboard
 * to borrow from.
 *
 * An empty row when no role applies — DashboardNavCards draws nothing at all
 * rather than an empty strip.
 */
export function navCardsForUser(user) {
  return NAV_CARDS_BY_SECTION[sectionForUser(user)] || [];
}
