import axios from 'axios';
import { API_BASE_URL } from '../utils/constants';
import { markActivity, isIdleExpired, hasStoredSession } from '../utils/session';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

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

export default api;
