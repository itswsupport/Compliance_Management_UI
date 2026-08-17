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

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { LS_KEYS } from '../../utils/constants';

export default function LoginCheck() {
  const { loginUser, logoutUser } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    sessionStorage.removeItem('appEntryPath');

    const empCode = localStorage.getItem(LS_KEYS.LOGIN_EMP_CODE);
    const empPass = localStorage.getItem(LS_KEYS.USER_PASSWORD);

    if (empCode) {
      handleAutoLogin(empCode, empPass);      
    } else {
      window.location.href = PORTAL_URL;      
    }
  }, []); 

  const handleAutoLogin = async (code, pass) => {
    try {
      const user = await loginUser(code, pass);
      redirectByUserRole(user);
    } catch {
      logoutUser();                                   
      navigate('/access-denied', { replace: true }); 
    }
  };

  const redirectByUserRole = (user) => {
    if (user.isCompAdmin)              navigate('/comp-admin/pending', { replace: true });
    else if (user.isChd || user.isPlantHr) navigate('/plant-hr/pending', { replace: true });
    else if (user.isCompHead)          navigate('/comp-head/pending', { replace: true });
    else if (user.isCorpHr)            navigate('/corp-hr/pending', { replace: true });
    else if (user.isHcmHead)           navigate('/hcm-head/pending', { replace: true });
    else if (user.isAuthority)         navigate('/authority/pending', { replace: true });
    else                               navigate('/access-denied', { replace: true });
  };

  return null;
}



// ===========================================================================================
// ===========================================================================================



// import { useEffect, useState } from 'react';
// import { useNavigate, useSearchParams } from 'react-router-dom';
// import { useAuth } from '../../context/AuthContext';
// import { LS_KEYS, PORTAL_URL } from '../../utils/constants';
// import { homePathForUser } from '../../utils/roleRoutes';

// export default function LoginCheck() {
//   const [searchParams] = useSearchParams();
//   const { loginUser, logoutUser } = useAuth();
//   const navigate = useNavigate();
//   // Only used to stop a double submit — there is no spinner.
//   const [loading, setLoading] = useState(false);
//   const [isManualLogin, setIsManualLogin] = useState(false);

//   // Manual login inputs (dev only)
//   const [empCodeInput, setEmpCodeInput] = useState('');
//   const [passwordInput, setPasswordInput] = useState('');
//   const [errorMessage, setErrorMessage] = useState('');

//   useEffect(() => {
//     sessionStorage.removeItem('appEntryPath');

//     // ─── comment for LIVE ───
//     const empCode = searchParams.get('emp_code');
//     const empPass = 'test';

//     // ─── comment for LOCAL ───
//     // const empCode = localStorage.getItem(LS_KEYS.LOGIN_EMP_CODE);
//     // const empPass = localStorage.getItem(LS_KEYS.USER_PASSWORD);

//     if (empCode) {
//       handleAutoLogin(empCode, empPass);
//     } else {
//       // No credentials — show the form. Not gated on DEV: that is false in any build.
//       setIsManualLogin(true);
//     }
//   }, [searchParams]); 
//   const handleAutoLogin = async (code, pass) => {
//     setLoading(true);
//     try {
//       const user = await loginUser(code, pass);
//       redirectByUserRole(user);
//     } catch (err) {
//       // No access = Access Denied; any other failure falls back to the form in dev.
//       if (err.message === 'UNAUTHORISED' || !import.meta.env.DEV) {
//         logoutUser();
//         navigate('/access-denied', { replace: true });
//       } else {
//         setErrorMessage('Automatic login failed. Please enter credentials below.');
//         setIsManualLogin(true);
//       }
//     } finally {
//       setLoading(false);
//     }
//   };

//   const handleFormSubmit = async (e) => {
//     e.preventDefault();
//     if (!empCodeInput.trim()) {
//       setErrorMessage('Please enter employee code.');
//       return;
//     }
//     setErrorMessage('');
//     setLoading(true);
//     try {
//       const user = await loginUser(empCodeInput.trim(), passwordInput);
//       redirectByUserRole(user);
//     } catch (err) {
//       // No access = Access Denied; a wrong code stays on the form to be corrected.
//       if (err.message === 'UNAUTHORISED') {
//         logoutUser();
//         navigate('/access-denied', { replace: true });
//         return;
//       }
//       setErrorMessage('User not found or connection failed.');
//     } finally {
//       setLoading(false);
//     }
//   };

//   // Shared with TokenLogin so both doors land each role in the same place.
//   const redirectByUserRole = (user) => {
//     // openCalendar marks the post-login landing, so Comp Admin leads with the calendar.
//     navigate(homePathForUser(user), { replace: true, state: { openCalendar: true } });
//   };

//   // Automatic sign-in draws nothing, same as TokenLogin.
//   if (!isManualLogin) return null;

//   return (
//     <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-primary-600 via-primary to-primary-800">
//       <div className="bg-white/10 backdrop-blur-md rounded-2xl p-10 text-center shadow-2xl border border-white/20 max-w-sm w-full mx-4">

//         <div className="mb-6">
//           <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-3">
//             <i className="fas fa-shield-alt text-white text-3xl" />
//           </div>
//           <h1 className="text-white font-bold text-xl uppercase tracking-wider">
//             Compliance Portal
//           </h1>
//           <p className="text-white/60 text-xs mt-1">RUCHA Industries Ltd.</p>
//         </div>

//         <form onSubmit={handleFormSubmit} className="space-y-4 text-left">
//             {errorMessage && (
//               <div className="bg-orange-500/20 border border-orange-400/30 rounded-lg p-3 text-white text-xs text-center leading-relaxed">
//                 <i className="fas fa-exclamation-triangle mr-2 text-orange-300" />
//                 {errorMessage}
//               </div>
//             )}

//             <div>
//               <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1">
//                 Employee Code
//               </label>
//               <div className="relative">
//                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/40">
//                   <i className="fas fa-user-tag text-xs" />
//                 </div>
//                 <input
//                   type="text"
//                   placeholder="Enter Employee Code"
//                   value={empCodeInput}
//                   onChange={(e) => setEmpCodeInput(e.target.value)}
//                   className="w-full rounded-lg border border-white/20 bg-white/10 pl-9 pr-3 py-2.5 text-xs text-white placeholder-white/45 outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
//                   required
//                 />
//               </div>
//             </div>

//             <div>
//               <label className="block text-xs font-semibold text-white/80 uppercase tracking-wider mb-1">
//                 Password
//               </label>
//               <div className="relative">
//                 <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-white/40">
//                   <i className="fas fa-lock text-xs" />
//                 </div>
//                 <input
//                   type="password"
//                   placeholder="Enter Password"
//                   value={passwordInput}
//                   onChange={(e) => setPasswordInput(e.target.value)}
//                   className="w-full rounded-lg border border-white/20 bg-white/10 pl-9 pr-3 py-2.5 text-xs text-white placeholder-white/45 outline-none focus:border-white focus:ring-1 focus:ring-white transition-all"
//                   required
//                 />
//               </div>
//             </div>

//             <button
//               type="submit"
//               disabled={loading}
//               className="w-full py-2.5 rounded-lg bg-white text-primary font-bold uppercase tracking-wider text-xs hover:bg-white/90 active:scale-[0.99] transition-all shadow-md mt-2 disabled:opacity-60 disabled:cursor-not-allowed"
//             >
//               Sign In
//             </button>

//             <div className="border-t border-white/10 pt-4 mt-2 text-center">
//               <a
//                 href={PORTAL_URL}
//                 className="text-white/50 hover:text-white text-xs transition-colors flex items-center justify-center gap-1.5"
//               >
//                 <i className="fas fa-arrow-left text-[10px]" /> Back to RUCHA Portal
//               </a>
//             </div>
//           </form>

//       </div>

//    </div>
//   );
//  }

