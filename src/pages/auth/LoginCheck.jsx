//  ═══════════════════════════════════════════════════════════════════════════
//    PRODUCTION-
//    To go live: uncomment this component (lines below), and comment out the
//    DEV component further down the file. Exactly one must be active — both
//    declare LoginCheck as the default export, so leaving both uncommented
//    fails the build rather than shipping the wrong one.
//
//    PORTAL_URL is imported from utils/constants.js and shared with Sidebar,
//    Navbar, AccessDenied and useIdleLogout — neither component redeclares it.
//
//    API_BASE_URL needs no change: it comes from VITE_API_BASE_URL, and
//    `npm run build` reads .env.production automatically.
//
//    Credentials come from localStorage (written by the RUCHA portal).
//    No emp_code -> back to the portal.
//    Renders nothing while authenticating.
//    ═══════════════════════════════════════════════════════════════════════════

// import { useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
// import { useAuth } from '../../context/AuthContext';
// import { LS_KEYS } from '../../utils/constants';

// export default function LoginCheck() {
//   const { loginUser, logoutUser } = useAuth();
//   const navigate = useNavigate();

//   useEffect(() => {
//     sessionStorage.removeItem('appEntryPath');

//     const empCode = localStorage.getItem(LS_KEYS.LOGIN_EMP_CODE);
//     const empPass = localStorage.getItem(LS_KEYS.USER_PASSWORD);

//     if (empCode) {
//       handleAutoLogin(empCode, empPass);      
//     } else {
//       window.location.href = PORTAL_URL;      
//     }
//   }, []); 

//   const handleAutoLogin = async (code, pass) => {
//     try {
//       const user = await loginUser(code, pass);
//       redirectByUserRole(user);
//     } catch {
//       logoutUser();                                   
//       navigate('/access-denied', { replace: true }); 
//     }
//   };

//   const redirectByUserRole = (user) => {
//     if (user.isCompAdmin)              navigate('/comp-admin/pending', { replace: true });
//     else if (user.isChd || user.isPlantHr) navigate('/plant-hr/pending', { replace: true });
//     else if (user.isCompHead)          navigate('/comp-head/pending', { replace: true });
//     else if (user.isCorpHr)            navigate('/corp-hr/pending', { replace: true });
//     else if (user.isHcmHead)           navigate('/hcm-head/pending', { replace: true });
//     else if (user.isAuthority)         navigate('/authority/pending', { replace: true });
//     else                               navigate('/access-denied', { replace: true });
//   };

//   return null;
// }



// ===========================================================================================
// ===========================================================================================



import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LS_KEYS, PORTAL_URL } from '../../utils/constants';
import { homePathForUser } from '../../utils/roleRoutes';

export default function LoginCheck() {
  const [searchParams] = useSearchParams();
  const { loginUser, logoutUser } = useAuth();
  const navigate = useNavigate();
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);
  const [isManualLogin, setIsManualLogin] = useState(false);

  // Manual login inputs (dev only)
  const [empCodeInput, setEmpCodeInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    sessionStorage.removeItem('appEntryPath');

    // ─── comment for LIVE ───
    const empCode = searchParams.get('emp_code');
    const empPass = 'test';

    // ─── comment for LOCAL ───
    // const empCode = localStorage.getItem(LS_KEYS.LOGIN_EMP_CODE);
    // const empPass = localStorage.getItem(LS_KEYS.USER_PASSWORD);

    if (empCode) {
      handleAutoLogin(empCode, empPass);
    } else {
      // No credentials -> show the login form, on the server as well as
      // locally. This branch used to be gated on import.meta.env.DEV, which is
      // false in any `vite build`, so a deployed build always fell through to
      // `window.location.href = PORTAL_URL` and bounced to dashboard.jsp.
      // PORTAL_URL is still used by the "Back to RUCHA Portal" link below.
      setIsManualLogin(true);
    }
  }, [searchParams]); 
  const handleAutoLogin = async (code, pass) => {
    setLoading(true);
    setStatus(`Authenticating (${code})…`);
    try {
      const user = await loginUser(code, pass);
      redirectByUserRole(user);
    } catch (err) {
      // UNAUTHORISED is an authorisation decision, not a typo — the account is
      // real but has no row in comp_login_access. There is nothing useful to
      // retype, so it lands on Access Denied in every build, local included.
      //
      // Anything else (unknown employee code, backend unreachable) still falls
      // back to the manual form in dev, which is the point of that form.
      if (err.message === 'UNAUTHORISED' || !import.meta.env.DEV) {
        logoutUser();
        navigate('/access-denied', { replace: true });
      } else {
        setErrorMessage('Automatic login failed. Please enter credentials below.');
        setIsManualLogin(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    if (!empCodeInput.trim()) {
      setErrorMessage('Please enter employee code.');
      return;
    }
    setErrorMessage('');
    setLoading(true);
    setStatus('Verifying credentials…');
    try {
      const user = await loginUser(empCodeInput.trim(), passwordInput);
      redirectByUserRole(user);
    } catch (err) {
      // Same rule as the automatic path: no permissions means the Access Denied
      // page, not an inline message the user can only stare at. A wrong code or
      // a dead backend stays on the form, where it can be corrected.
      if (err.message === 'UNAUTHORISED') {
        logoutUser();
        navigate('/access-denied', { replace: true });
        return;
      }
      setErrorMessage('User not found or connection failed.');
    } finally {
      setLoading(false);
    }
  };

  // Shared with the portal token hand-off (pages/auth/TokenLogin) so both doors
  // into the app agree on where each role lands.
  const redirectByUserRole = (user) => {
    navigate(homePathForUser(user), { replace: true });
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-600 via-primary to-primary-800">
      <div className="bg-white/10 backdrop-blur-md rounded-2xl p-10 text-center shadow-2xl border border-white/20 max-w-sm w-full mx-4">

        <div className="mb-6">
          <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
            <i className="fas fa-shield-alt text-white text-3xl" />
          </div>
          <h1 className="text-white font-bold text-xl uppercase tracking-wider">
            Compliance Portal
          </h1>
          <p className="text-white/60 text-xs mt-1">RUCHA Industries Ltd.</p>
        </div>

        {loading ? (
          
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="relative">
              <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
              <i className="fas fa-shield-alt text-white/60 text-sm absolute inset-0 flex items-center justify-center" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }} />
            </div>
            <p className="text-white/80 text-sm">{status}</p>
          </div>
        ) : isManualLogin ? (
          <form onSubmit={handleFormSubmit} className="space-y-4 text-left">
            {errorMessage && (
              <div className="bg-orange-500/20 border border-orange-400/30 rounded-lg p-3 text-white text-xs text-center leading-relaxed">
                <i className="fas fa-exclamation-triangle mr-2 text-orange-300" />
                {errorMessage}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1">
                Employee Code
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/40">
                  <i className="fas fa-user-tag text-xs" />
                </div>
                <input
                  type="text"
                  placeholder="Enter Employee Code"
                  value={empCodeInput}
                  onChange={(e) => setEmpCodeInput(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 pl-9 pr-3 py-2.5 text-xs text-white placeholder-white/45 outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1">
                Password
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/40">
                  <i className="fas fa-lock text-xs" />
                </div>
                <input
                  type="password"
                  placeholder="Enter Password"
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  className="w-full rounded-lg border border-white/20 bg-white/10 pl-9 pr-3 py-2.5 text-xs text-white placeholder-white/45 outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-2.5 rounded-lg bg-white text-primary font-bold uppercase tracking-wider text-xs hover:bg-white/90 active:scale-[0.99] transition-all shadow-md mt-2"
            >
              Sign In
            </button>

            <div className="border-t border-white/10 pt-4 mt-2 text-center">
              <a
                href={PORTAL_URL}
                className="text-white/50 hover:text-white text-xs transition-colors flex items-center justify-center gap-1.5"
              >
                <i className="fas fa-arrow-left text-[10px]" /> Back to RUCHA Portal
              </a>
            </div>
          </form>
        ) : null}

      </div>

   </div>
  );
 }

