import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LS_KEYS, API_BASE_URL, API_STATUS } from '../utils/constants';
import {
  login as apiLogin,
  loginWithToken as apiLoginWithToken,
  logout as apiLogout,
} from '../services/authService';
import { markActivity } from '../utils/session';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const empCode = localStorage.getItem(LS_KEYS.GLOBAL_EMP_CODE);
    if (empCode) {
      // Auto-correct any stored levels to match the workflow level format
      const isChd = localStorage.getItem(LS_KEYS.GLOBAL_CHD) === 'true';
      const isPlantHr = localStorage.getItem(LS_KEYS.GLOBAL_PLANT_HR) === 'true';
      const isCompAdmin = localStorage.getItem(LS_KEYS.GLOBAL_COMP_ADMIN) === 'true';
      const isCompHead = localStorage.getItem(LS_KEYS.GLOBAL_COMP_HEAD) === 'true';
      const isCorpHr = localStorage.getItem(LS_KEYS.GLOBAL_CORP_HR) === 'true';
      const isHcmHead = localStorage.getItem(LS_KEYS.GLOBAL_HCM_HEAD) === 'true';
      const isAuthority = localStorage.getItem(LS_KEYS.GLOBAL_AUTHORITY) === 'true';

      let correctWfLevel = 1;
      if (isChd || isPlantHr) {
        correctWfLevel = 1;
      } else if (isCompAdmin || isCompHead || isCorpHr) {
        // CompAdmin is a mid-flow approver in Flow 1 — needs level 2 (Approve/Reject form)
        // Corp HR/Group HR Head is step 3 in Flow 2 — also needs level 2 to receive from Plant HR
        correctWfLevel = 2;
      } else if (isHcmHead || isAuthority) {
        // HCM Head is final approver in both flows — needs level 3
        correctWfLevel = 3;
      }
      localStorage.setItem(LS_KEYS.GLOBEL_LEVEL, String(correctWfLevel));

      setUser(buildUserFromStorage());
    }
    setLoading(false);
  }, []);

  function buildUserFromStorage() {
    return {
      empCode:      localStorage.getItem(LS_KEYS.GLOBAL_EMP_CODE),
      empName:      localStorage.getItem(LS_KEYS.GLOBAL_EMP_NAME),
      designation:  localStorage.getItem(LS_KEYS.GLOBAL_DESIGNATION),
      plantId:      localStorage.getItem(LS_KEYS.GLOBEL_PLANT_ID),
      level:        Number(localStorage.getItem(LS_KEYS.GLOBEL_LEVEL) || 1),
      authority:    localStorage.getItem(LS_KEYS.GLOBEL_AUTHORITIES),
      isCompAdmin:  localStorage.getItem(LS_KEYS.GLOBAL_COMP_ADMIN) === 'true',
      isChd:        localStorage.getItem(LS_KEYS.GLOBAL_CHD) === 'true',
      isCompHead:   localStorage.getItem(LS_KEYS.GLOBAL_COMP_HEAD) === 'true',
      isCorpHr:     localStorage.getItem(LS_KEYS.GLOBAL_CORP_HR) === 'true',
      isHcmHead:    localStorage.getItem(LS_KEYS.GLOBAL_HCM_HEAD) === 'true',
      isAuthority:  localStorage.getItem(LS_KEYS.GLOBAL_AUTHORITY) === 'true',
      isPlantHr:    localStorage.getItem(LS_KEYS.GLOBAL_PLANT_HR) === 'true',
    };
  }

  /**
   * Turns the backend's LoginUser into this app's session and holds on to it.
   *
   * Shared by both ways in — the password login and the portal token hand-off —
   * so a session started from a token is indistinguishable from one started at
   * the form, and neither can drift from the other.
   *
   * The employee code written here is `resp.username`, i.e. the code the *server*
   * resolved the session user to. It is never the code the caller supplied: on
   * the token path the caller supplies none at all, and on the form path the
   * server's answer is the authoritative spelling.
   *
   * @param {object} resp the backend's `response` object (a LoginUser)
   */
  const persistSession = useCallback((resp) => {
    if (resp.authorities[0].authority === 'UNAUTHORISED') {
      throw new Error('UNAUTHORISED');
    }

    const name = `${resp.userFname} ${resp.userLname}`;
    const authorities = resp.authorities.map((a) => a.authority);

    const isCompAdmin = authorities.includes('COMP ADMIN');
    const isChd       = authorities.includes('CHD');
    const isCompHead  = authorities.includes('COMP HEAD');
    const isCorpHr    = authorities.includes('CORP HR');
    const isHcmHead   = authorities.includes('HCM HEAD');
    const isAuthority = authorities.includes('AUTHORITY');
    const isPlantHr   = authorities.includes('PLANT_HR');

    // Map authorityLevel to the correct database workflow level
    let workflowLevel = 1;
    if (isChd || isPlantHr) {
      workflowLevel = 1;
    } else if (isCompAdmin || isCompHead || isCorpHr) {
      // CompAdmin is a mid-flow approver in Flow 1 — needs level 2 (Approve/Reject form)
      // Corp HR/Group HR Head is step 3 in Flow 2 — also needs level 2 to receive from Plant HR
      workflowLevel = 2;
    } else if (isHcmHead || isAuthority) {
      // HCM Head is final approver in both flows — needs level 3
      workflowLevel = 3;
    }

    // Persist the session keys
    //
    // Absolutised on the way out. API_BASE_URL is now the relative path
    // /compliancePortal/, but `live_url_base` is read by the RUCHA portal and
    // the other apps sharing this origin, which expect a full URL. new URL()
    // leaves an already-absolute value untouched, so this is correct either way.
    localStorage.setItem(LS_KEYS.LIVE_URL_BASE,
      new URL(API_BASE_URL, window.location.origin).href);
    localStorage.setItem(LS_KEYS.GLOBAL_EMP_CODE,    resp.username);
    localStorage.setItem(LS_KEYS.GLOBAL_EMP_NAME,    name);
    localStorage.setItem(LS_KEYS.GLOBAL_DESIGNATION, resp.designation?.desigName || '');
    localStorage.setItem(LS_KEYS.GLOBEL_PLANT_ID,    resp.plant?.plantCode || '');
    localStorage.setItem(LS_KEYS.GLOBEL_LEVEL,       String(workflowLevel));
    localStorage.setItem(LS_KEYS.GLOBEL_AUTHORITIES, authorities[0]);
    localStorage.setItem(LS_KEYS.GLOBAL_COMP_ADMIN,  isCompAdmin);
    localStorage.setItem(LS_KEYS.GLOBAL_CHD,         isChd);
    localStorage.setItem(LS_KEYS.GLOBAL_COMP_HEAD,   isCompHead);
    localStorage.setItem(LS_KEYS.GLOBAL_CORP_HR,     isCorpHr);
    localStorage.setItem(LS_KEYS.GLOBAL_HCM_HEAD,    isHcmHead);
    localStorage.setItem(LS_KEYS.GLOBAL_AUTHORITY,   isAuthority);
    localStorage.setItem(LS_KEYS.GLOBAL_PLANT_HR,    isPlantHr);

    authorities.forEach((auth, i) => {
      localStorage.setItem(`global_authority${i}`, auth);
    });

    const userObj = {
      empCode: resp.username, empName: name,
      designation: resp.designation?.desigName || '',
      plantId: resp.plant?.plantCode || '',
      level: workflowLevel,
      authority: authorities[0],
      isCompAdmin, isChd, isCompHead, isCorpHr, isHcmHead, isAuthority, isPlantHr,
    };
    // Start the idle clock now. Without this, a stale timestamp left behind by a
    // browser close (no logout) would expire the new session immediately.
    markActivity(true);
    setUser(userObj);
    return userObj;
  }, []);

  /**
   * Perform login with an employee code and password.
   */
  const loginUser = useCallback(async (empCode, empPass) => {
    const response = await apiLogin(empCode, empPass);
    const data = response.data;

    if (data.status_code !== API_STATUS.SUCCESS) {
      throw new Error('Login failed');
    }
    return persistSession(data.response);
  }, [persistSession]);

  /**
   * Sign in from the portal hand-off token: `/compliance/<token>`.
   *
   * The portal has already authenticated the employee and encrypted the employee
   * code out of its session user into the token, so nothing is asked of the user
   * here. Any session already in storage is replaced rather than merged — the
   * portal may have been switched to a different employee since this browser last
   * signed in, and the token is the newer statement of who is here.
   *
   * @param {string} token base64url token from the URL
   */
  const loginWithToken = useCallback(async (token) => {
    if (!token) throw new Error('No portal token supplied.');

    let data;
    try {
      const response = await apiLoginWithToken(token);
      data = response.data;
    } catch (err) {
      // Worth telling apart. The backend answers HTTP 200 for every outcome it
      // has an opinion about, so an HTTP status arriving here means the request
      // never reached the handler at all — a 404 is a backend running an older
      // build without /login/token, not an unreachable service. Reporting both
      // as "could not reach" sends the next person to look at the network.
      if (err?.response) {
        throw new Error(
          `The compliance service returned HTTP ${err.response.status} for the sign-in link.` +
            (err.response.status === 404
              ? ' The backend may be running a build without the /login/token endpoint.'
              : '')
        );
      }
      throw new Error('Could not reach the compliance service.');
    }

    if (data?.status_code === API_STATUS.INVALID_TOKEN) {
      throw new Error(
        'This sign-in link is no longer valid. Please open the Compliance Portal again from the RUCHA portal.'
      );
    }
    if (data?.status_code !== API_STATUS.SUCCESS || !data.response) {
      throw new Error('No active employee matches this sign-in link.');
    }
    return persistSession(data.response);
  }, [persistSession]);

  /**
   * Perform logout
   */
  const logoutUser = useCallback(async () => {
    const empCode = localStorage.getItem(LS_KEYS.GLOBAL_EMP_CODE);

    // Clear the local session before calling the API, not after. Storage must not
    // depend on a network round-trip, and it lets callers skip the await and
    // redirect immediately — everything up to the first await runs synchronously.
    //
    // Only this app's keys are removed. `login_emp_code`, `user_password`,
    // `logout_url` and `live_url_base` belong to the RUCHA portal and are shared
    // by every app on this origin — clearing them would sign the user out of the
    // portal too, so they are left untouched.
    [
      LS_KEYS.GLOBAL_EMP_CODE, LS_KEYS.GLOBEL_PLANT_ID, LS_KEYS.GLOBEL_LEVEL,
      LS_KEYS.GLOBEL_AUTHORITIES, LS_KEYS.GLOBAL_EMP_NAME,
      // LS_KEYS.LIVE_URL_BASE,  // kept on logout: needed for logout redirect + shared with main portal
      LS_KEYS.GLOBAL_COMP_ADMIN, LS_KEYS.GLOBAL_CHD, LS_KEYS.GLOBAL_COMP_HEAD,
      LS_KEYS.GLOBAL_CORP_HR, LS_KEYS.GLOBAL_HCM_HEAD, LS_KEYS.GLOBAL_AUTHORITY,
      LS_KEYS.GLOBAL_PLANT_HR, LS_KEYS.GLOBAL_DESIGNATION,
      LS_KEYS.ID, LS_KEYS.ID_COMP, LS_KEYS.LAST_ACTIVITY,
    ].forEach((k) => localStorage.removeItem(k));

    // The indexed authority keys written at login are variable in number, so
    // match them by shape rather than listing them.
    Object.keys(localStorage)
      .filter((k) => /^global_authority\d+$/.test(k))
      .forEach((k) => localStorage.removeItem(k));

    setUser(null);

    try { await apiLogout(empCode); } catch (_) { /* ignore */ }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, loginUser, loginWithToken, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
