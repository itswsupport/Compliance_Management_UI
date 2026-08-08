import api from './api';

/**
 * Login
 * GET /login?emp_code=&emp_pass=
 */
export const login = (empCode, empPass) =>
  api.get('login', { params: { emp_code: empCode, emp_pass: empPass } });

/**
 * Portal hand-off login
 * GET /login/token?token=
 *
 * The token carries the employee code the portal took from its own session user,
 * AES-encrypted server-side. It is passed through untouched: the backend holds
 * the key, decrypts the code and enforces the validity window
 * (PortalTokenService). Nothing about the key is known here, which is the point
 * — a key in the browser bundle is a key anyone can mint tokens with.
 *
 * No emp_code and no password is sent, and none would be honoured.
 */
export const loginWithToken = (token) =>
  api.get('login/token', { params: { token } });

/**
 * Logout
 * GET /logout?emp_code=
 */
export const logout = (empCode) =>
  api.get('logout', { params: { emp_code: empCode } });
