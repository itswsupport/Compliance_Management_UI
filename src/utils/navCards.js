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
  ],
  'comp-head': [
    { label: 'Approval Pending',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/comp-head/pending'  },
    { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/comp-head/approved' },
    { label: 'Rejected Compliance', icon: 'fas fa-times-circle', color: 'bg-c-reject',  to: '/comp-head/rejected' },
    NOTICE,
  ],
  'corp-hr': [
    { label: 'Approval Pending',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/corp-hr/pending'  },
    { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/corp-hr/approved' },
    { label: 'Rejected Compliance', icon: 'fas fa-times-circle', color: 'bg-c-reject',  to: '/corp-hr/rejected' },
    NOTICE,
  ],
  'hcm-head': [
    { label: 'Approval Pending',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/hcm-head/pending'  },
    { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/hcm-head/approved' },
    { label: 'Rejected Compliance', icon: 'fas fa-times-circle', color: 'bg-c-reject',  to: '/hcm-head/rejected' },
    NOTICE,
  ],
  authority: [
    { label: 'Pending Compliance',  icon: 'fas fa-spinner',      color: 'bg-c-pending', to: '/authority/pending'  },
    { label: 'Approved Compliance', icon: 'fas fa-check-square', color: 'bg-c-green1',  to: '/authority/approved' },
    { label: 'Rejected Compliance', icon: 'fas fa-times-circle', color: 'bg-c-reject',  to: '/authority/rejected' },
    { label: 'Overdue Compliance',  icon: 'far fa-hourglass',    color: 'bg-c-draft',   to: '/authority/overdue'  },
    NOTICE,
  ],
};

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
