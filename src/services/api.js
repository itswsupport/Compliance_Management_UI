import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { markActivity, isIdleExpired, hasStoredSession } from '../utils/session';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

/**
 * Per-request override for the list endpoints that fill the data tables. Those
 * queries can run past the global 30s limit on large plants and were being
 * aborted mid-flight; 0 = no timeout, wait for the server. Every other call
 * keeps the 30s default.
 */
export const NO_TIMEOUT = { timeout: 0 };

// Request interceptor — attach any shared headers if needed
api.interceptors.request.use(
  (config) => config,
  (error) => Promise.reject(error)
);

// Response interceptor — unwrap data or handle errors globally
api.interceptors.response.use(
  (response) => {
    // A completed request means the user is still working, even if they haven't
    // touched the mouse — e.g. a long file upload. Keeps the idle clock honest.
    //
    // Guarded, exactly as the activity listeners in useIdleLogout are: stamping
    // unconditionally REVIVES a session that has already run out. A response
    // landing after the idle limit — a poll, a slow request from before the user
    // walked away, or the /logout call itself, whose own response arrives after
    // clearActivity() — would push the clock forward, and the click that was
    // supposed to reveal the expiry would instead find a healthy session and let
    // the user carry on. The user is not here; only the network is.
    if (hasStoredSession() && !isIdleExpired()) markActivity();
    return response;
  },
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

/**
 * In-flight de-duplication for GETs.
 *
 * Two identical GETs issued before the first one answers now share a single
 * network request instead of both hitting the backend. React's StrictMode
 * mounts every component twice in development, so each list was being fetched
 * twice, and the two copies of the same slow query then competed with each
 * other — 1.3s each rather than 1.3s once.
 *
 * This is NOT a cache. The entry is dropped the moment the request settles, so
 * a later call always goes to the server and the table can never show data
 * from an earlier visit. It only collapses requests that overlap in time.
 *
 * GET only: a POST or DELETE is an instruction, and two of them are two
 * instructions even when they look alike.
 */
const inFlight = new Map();
const plainGet = api.get.bind(api);

api.get = (url, config = {}) => {
  const key = `${url}|${JSON.stringify(config.params ?? null)}`;
  const running = inFlight.get(key);
  if (running) return running;

  const request = plainGet(url, config).finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
};

export default api;
