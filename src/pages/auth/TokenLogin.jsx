import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { PORTAL_URL } from '../../utils/constants';
import { homePathForUser, looksLikePortalToken } from '../../utils/roleRoutes';

/**
 * Portal hand-off: `https://replportal.co.in/compliance/<token>`.
 *
 * The RUCHA portal's dashboard takes the employee code from its own session user,
 * encrypts it server-side and sends the browser here. The token goes to the
 * backend as-is — it holds the AES key and decides whether the token is good
 * (PortalTokenService) — and what comes back is a session. No employee code is
 * read from the URL, from localStorage, or from a form on this path.
 *
 * The form at /login stays for anyone reaching the app directly.
 *
 * This is the app's catch-all single-segment route, so a mistyped URL — /Login
 * rather than /login, matching being case-sensitive — lands here too. Those are
 * sent to the login screen rather than reported as a token failure.
 */

/**
 * Tokens already spent, kept at module level rather than in a ref: React's strict
 * mode runs effects twice, and the provider re-renders the moment the user state
 * flips — either would otherwise redeem the same token a second time.
 */
const processedTokens = new Set();

export default function TokenLogin() {
  const { user, loading, loginWithToken, logoutUser } = useAuth();
  const navigate = useNavigate();
  const params = useParams();

  const [error, setError] = useState('');

  const token = typeof params?.token === 'string' ? params.token : '';

  useEffect(() => {
    if (loading || error) return;

    // Not a token at all — a mistyped path that fell through to this route.
    if (!looksLikePortalToken(token)) {
      navigate(user ? homePathForUser(user) : '/login', { replace: true });
      return;
    }

    if (processedTokens.has(token)) return;
    processedTokens.add(token);

    sessionStorage.removeItem('appEntryPath');

    (async () => {
      try {
        const signedIn = await loginWithToken(token);
        // replace: true drops the token from history, so Back does not land on a
        // URL that will be refused the second time it is redeemed.
        navigate(homePathForUser(signedIn), { replace: true });
      } catch (err) {
        // UNAUTHORISED is an authorisation decision, not a broken link: the
        // employee is real but has no row in comp_login_access. There is nothing
        // to retry, so it goes to the same place the form login sends it.
        if (err.message === 'UNAUTHORISED') {
          logoutUser();
          navigate('/access-denied', { replace: true });
          return;
        }
        setError(err.message || 'Sign-in from the portal failed.');
      }
    })();
  }, [token, user, loading, error, navigate, loginWithToken, logoutUser]);

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

        {error ? (
          <div className="space-y-4">
            <div className="bg-orange-500/20 border border-orange-400/30 rounded-lg p-3 text-white text-xs text-center leading-relaxed">
              <i className="fas fa-exclamation-triangle mr-2 text-orange-300" />
              {error}
            </div>
            <a
              href={PORTAL_URL}
              className="block w-full py-2.5 rounded-lg bg-white text-primary font-bold uppercase tracking-wider text-xs hover:bg-white/90 active:scale-[0.99] transition-all shadow-md"
            >
              Back to RUCHA Portal
            </a>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="w-12 h-12 rounded-full border-4 border-white/20 border-t-white animate-spin" />
            <p className="text-white/80 text-sm">Signing you in…</p>
          </div>
        )}

      </div>
    </div>
  );
}
