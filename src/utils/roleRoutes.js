/**
 * Where a signed-in user lands.
 *
 * Both entry points need this — the portal token hand-off (pages/auth/TokenLogin)
 * and the manual/auto form (pages/auth/LoginCheck) — and they must agree, so the
 * decision lives here rather than being copied into each.
 *
 * The order matters: an employee can hold more than one role, and the first
 * match wins. It follows the approval flow, most-specific first.
 *
 * @param {object|null} user the object AuthContext builds at login
 * @returns {string} a router path; '/access-denied' when no role applies
 */
export function homePathForUser(user) {
  if (!user) return '/access-denied';
  if (user.isCompAdmin) return '/comp-admin/pending';
  if (user.isChd || user.isPlantHr) return '/plant-hr/pending';
  if (user.isCompHead) return '/comp-head/pending';
  if (user.isCorpHr) return '/corp-hr/pending';
  if (user.isHcmHead) return '/hcm-head/pending';
  if (user.isAuthority) return '/authority/pending';
  return '/access-denied';
}

/**
 * Whether a single-segment path looks like a portal hand-off token.
 *
 * `/:token` is the app's catch-all single-segment route, so a mistyped URL —
 * `/Login` rather than `/login`, matching being case-sensitive — lands on it
 * too. Those should reach the login screen, not a "sign-in failed" page about a
 * token the user never had.
 *
 * A token is base64url over at least one AES block, so it is long and has no
 * characters outside the base64url alphabet. That is enough to tell the two
 * apart; whether it decrypts is the backend's business.
 *
 * @param {string} segment the path segment, without its leading slash
 */
export function looksLikePortalToken(segment) {
  return /^[A-Za-z0-9_-]{16,}$/.test(String(segment ?? ''));
}
