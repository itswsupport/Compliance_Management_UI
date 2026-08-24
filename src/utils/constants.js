// Comes from the .env files (see .env.example). `npm run dev` reads .env,
// `npm run build` reads .env.production, and a VITE_API_BASE_URL supplied by
// Docker beats both. Vite inlines the value at build time, so switching
// environments means rebuilding — not restarting the container.
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

//   localStorage.setItem('comp_last_activity', String(Date.now() - 31*60*1000))
export const SESSION_IDLE_MS = 30 * 60 * 1000;

// How often the watchdog checks whether the session has disappeared from
// storage, i.e. whether another tab logged out. The idle gap itself is not
// polled — it is measured on the user's next click. See hooks/useIdleLogout.js.
export const SESSION_CHECK_MS = 15 * 1000;

export const PORTAL_URL = 'https://replportal.co.in:8443/portal/dashboard.jsp';

// The router basename (see routes/AppRouter.jsx). Needed wherever a redirect has
// to be a full page load rather than a router navigation, since window.location
// is not basename-aware.
export const APP_BASE_PATH = '/compliance';

// Backend response codes (IResponseCode). The backend answers HTTP 200 for every
// outcome — the real result is `status_code` in the body, so callers branch on
// this and never on the HTTP status. SERVER_ERROR is 501, not 500.
export const API_STATUS = {
  SUCCESS: 200,
  DATA_NOT_FOUND: 204,
  UNAUTHORIZED: 401,
  SERVER_ERROR: 501,
  // A portal hand-off token that was expired, forged, or unreadable.
  INVALID_TOKEN: 1011,
};

// Status codes used across compliance records
export const STATUS = {
  SUBMISSION_PENDING: 0,
  APPROVED: 1,
  REJECTED: 2,
  SUBMITTED: 3,
  APPROVAL_PENDING: 4,
  OVERDUE: 5,
  COMPLIANCE_ASSIGNED: 6,
  LEVEL_APPROVAL_PENDING: 11,
  FINAL_APPROVAL_PENDING: 22,
};

// Human-readable status labels
export const STATUS_LABELS = {
  [STATUS.SUBMISSION_PENDING]:      { label: 'Submission Pending', variant: 'warning' },
  [STATUS.APPROVED]:                { label: 'Approved',           variant: 'success' },
  [STATUS.REJECTED]:                { label: 'Rejected',           variant: 'danger'  },
  [STATUS.SUBMITTED]:               { label: 'Submitted',          variant: 'info'    },
  [STATUS.APPROVAL_PENDING]:        { label: 'Approval Pending',   variant: 'warning' },
  [STATUS.OVERDUE]:                 { label: 'Pending',            variant: 'warning' },
  [STATUS.COMPLIANCE_ASSIGNED]:     { label: 'Compliance Assigned','variant': 'primary' },
  [STATUS.LEVEL_APPROVAL_PENDING]:  { label: 'Approval Pending',   variant: 'warning' },
  [STATUS.FINAL_APPROVAL_PENDING]:  { label: 'Final Approval Pending', variant: 'warning' },
  [-2]:                             { label: 'Rejected',           variant: 'danger'  },
};

// Role IDs used in login access
export const ROLES = {
  COMP_ADMIN: 1,
  COMP_HEAD: 2,
  CORP_HR: 3,
  PLANT_HR: 4,
  HCM_HEAD: 5,
  AUTHORITY: 6,
  CHD: 7,
};

export const ROLE_NAMES = {
  [ROLES.COMP_ADMIN]: 'COMP ADMIN',
  [ROLES.COMP_HEAD]:  'COMP HEAD',
  [ROLES.CORP_HR]:    'CORP HR',
  [ROLES.PLANT_HR]:   'PLANT HR',
  [ROLES.HCM_HEAD]:   'HCM HEAD',
  [ROLES.AUTHORITY]:  'AUTHORITY',
  [ROLES.CHD]:        'CHD',
};

// Frequency options for Assign Compliance form
export const FREQUENCY_OPTIONS = [
  { value: 'YEARLY',      label: 'Yearly' },
  { value: 'HALF-YEARLY', label: 'Half-Yearly' },
  { value: 'QUARTERLY',   label: 'Quarterly' },
  { value: 'MONTHLY',     label: 'Monthly' },
];

// localStorage key names
export const LS_KEYS = {
  LIVE_URL_BASE:      'live_url_base',
  // Written by the RUCHA portal before it redirects here — read only on live login.
  LOGIN_EMP_CODE:     'login_emp_code',
  USER_PASSWORD:      'user_password',
  GLOBAL_EMP_CODE:    'global_emp_code',
  GLOBAL_EMP_NAME:    'global_emp_name',
  GLOBAL_DESIGNATION: 'global_designation',
  GLOBEL_PLANT_ID:    'globelPlantId',
  GLOBEL_LEVEL:       'globelLevel',
  GLOBEL_AUTHORITIES: 'globelAuthorities',
  GLOBAL_COMP_ADMIN:  'global_compAdmin',
  GLOBAL_CHD:         'global_chd',
  GLOBAL_COMP_HEAD:   'global_compHead',
  GLOBAL_CORP_HR:     'global_corpHr',
  GLOBAL_HCM_HEAD:    'global_hcmHead',
  // Prefixed on purpose. The RUCHA portal owns the unprefixed 'global_authority'
  // and stores a role string there (e.g. 'PLANT-HEAD'). Writing our boolean to
  // that name overwrote the portal's value on login and deleted it on logout.
  GLOBAL_AUTHORITY:   'comp_global_authority',
  GLOBAL_PLANT_HR:    'global_plantHr',
  LOGOUT_URL:         'logout_url',
  ID:                 'id',
  ID_COMP:            'idComp',
  // Prefixed on purpose. Every RUCHA portal app shares this origin's localStorage,
  // so an unprefixed name like 'last_activity' could be reset by another app.
  LAST_ACTIVITY:      'comp_last_activity',
};


// Add: endpoint map (was hardcoded per-JS-file as "user/compliance/list", "phr/compliance/list", etc.)
export const ENDPOINTS = {
  USER_LIST:       'user/compliance/list',        // Comp Head, Corp Hr, HCM Head
  PHR_LIST:        'phr/compliance/list',         // Plant Hr (plant-code filtered)
  AUTHORITY_LIST:  'authority/compliance/list',   // Authority
  PENDING_LIST:    'compliance/pending/list',     // Comp Admin (self filtered)
  DETAILS_BY_ID:   'compliance/details/by_id',
  ACTION_LIST:     'compliance_action/list',
  ACTION_SAVE:     'compliance_action/save',
  DELETE:          'compliance/delete',
  DOWNLOAD:        'download/file',
  NOTICE_LIST:     'notice/list',                 // every role, read only
  NOTICE_SAVE:     'notice/save',                 // Comp Admin only
  NOTICE_DETAILS:  'notice/details/by_id',
  NOTICE_DELETE:   'notice/delete',               // Comp Admin only
  NOTICE_DOWNLOAD: 'notice/download/file',        // takes the notice id alone
};

// Add: per-role level info, since every legacy list() call passes a different level/authLevel
export const ROLE_LEVEL = {
  COMP_ADMIN: { level: null, authLevel: 1 },   // no level param sent, but authLevel=1 on save
  COMP_HEAD:  { level: 2,    authLevel: 2 },
  CORP_HR:    { level: 2,    authLevel: 2 },   // same level as Comp Head — different flow branch
  PLANT_HR:   { level: 1,    authLevel: 1 },
  HCM_HEAD:   { level: 3,    authLevel: 3 },
  AUTHORITY:  { level: null, authLevel: null },
};

// Add: per-role pending status arrays (currently these are scattered as literals in each page)
export const PENDING_STATUS = {
  COMP_ADMIN: [0, 3, 4, 11, 2],
  COMP_HEAD:  [0],
  CORP_HR:    [0, 11],
  PLANT_HR:   [0, 2, 4, 3, 11],
  HCM_HEAD:   [0, 22],
  AUTHORITY:  [0, 4],
};