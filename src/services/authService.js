import api from './api';

/**
 * Login
 * GET /login?emp_code=&emp_pass=
 */
export const login = (empCode, empPass) =>
  api.get('login', { params: { emp_code: empCode, emp_pass: empPass } });

/**
 * Logout
 * GET /logout?emp_code=
 */
export const logout = (empCode) =>
  api.get('logout', { params: { emp_code: empCode } });
