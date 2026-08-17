import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { homePathForUser, looksLikePortalToken } from '../../utils/roleRoutes';

// Portal hand-off: /compliance/<token>. The backend holds the AES key and decides
// if the token is good; no employee code is read from the URL or localStorage.
// Also the catch-all single-segment route, so mistyped paths land here too.

// Tokens already spent — module level, so StrictMode's double effect cannot redeem twice.
const processedTokens = new Set();

export default function TokenLogin() {
  const { user, loading, loginWithToken, logoutUser } = useAuth();
  const navigate = useNavigate();
  const params = useParams();

  const token = typeof params?.token === 'string' ? params.token : '';

  useEffect(() => {
    if (loading) return;

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
        // replace: true drops the token from history — Back must not re-redeem it.
        navigate(homePathForUser(signedIn), { replace: true });
      } catch {
        // Only reachable from the portal, so any failure means no access here.
        logoutUser();
        navigate('/access-denied', { replace: true });
      }
    })();
  }, [token, user, loading, navigate, loginWithToken, logoutUser]);

  // Nothing is ever drawn — this route only signs in or redirects.
  return null;
}
