import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { LS_KEYS, API_BASE_URL } from '../utils/constants';
import { login as apiLogin, logout as apiLogout } from '../services/authService';
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
   * Perform login
   */
  const loginUser = useCallback(async (empCode, empPass) => {
    const response = await apiLogin(empCode, empPass);
    const data = response.data;

    if (data.status_code !== 200) {
      throw new Error('Login failed');
    }

    const resp = data.response;
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
    localStorage.setItem(LS_KEYS.LIVE_URL_BASE,      API_BASE_URL);
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
    <AuthContext.Provider value={{ user, loading, loginUser, logoutUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
