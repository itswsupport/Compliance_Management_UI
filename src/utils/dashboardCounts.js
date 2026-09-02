export const COUNT_STATUS_BY_PATH = {
  // Comp Admin
  // 22 (pending final approval) belongs here for the same reason 3 does on the
  // Authority board: it is in flight. This filters compliance_master.status
  // directly, so a status missing from the list is a record on no card at all.
  '/comp-admin/pending':  [0, 3, 4, 11, 2, 22],
  '/comp-admin/approved': [1],
  '/comp-admin/overdue':  [5],

  // Plant HR / User
  '/plant-hr/pending':  [0, 3, 4, 11, 2],
  '/plant-hr/approved': [1, 3],
  '/plant-hr/overdue':  [0, 5],

  // Compliance Head
  '/comp-head/pending':  [0, 4, 11],
  '/comp-head/approved': [1],
  '/comp-head/rejected': [2],

  // Corporate HR
  '/corp-hr/pending':  [0, 11],
  '/corp-hr/approved': [1],
  '/corp-hr/rejected': [2],

  // HCM Head
  '/hcm-head/pending':  [0, 22],
  '/hcm-head/approved': [1],
  '/hcm-head/rejected': [2],

  // Authority
  // 3 (submitted) belongs here: it is in flight, not finished. Without it a
  // submitted compliance was on no Authority card at all — Pending stopped at
  // [0,4] and Approved started at [1,22], so 72 records fell through the gap.
  '/authority/pending':  [0, 3, 4, 22],
  // 22 is PENDING_FOR_FINAL_APPROVAL, not approved: the HCM Head has not
  // signed yet. It used to sit here, which reported an unfinished compliance
  // as finished. Only 1 is approved.
  '/authority/approved': [1],
  '/authority/rejected': [2],
  '/authority/overdue':  [5],
};
