import axios from 'axios';

/**
 * Shared axios instance for the VastuVerse client.
 *
 *   - baseURL              from VITE_API_BASE_URL
 *   - withCredentials      true (refresh token cookie travels here)
 *   - Authorization header injected from an in-memory access token
 *   - On 401, calls a refresh handler (registered by AuthContext) once,
 *     queues concurrent failed requests behind that single refresh, and
 *     retries them with the new token.
 *
 * Per-request opt-outs:
 *   { _skipAuthRetry: true }   -> don't try to refresh on 401 (used by the
 *                                 refresh + logout calls themselves to avoid
 *                                 infinite loops)
 */

export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api/v1';

let accessToken = null;
let refreshHandler = null;
let refreshing = null; // single-flight promise

/* ---- public API ----------------------------------------------------- */

export function setAccessToken(token) {
  accessToken = token || null;
}
export function getAccessToken() {
  return accessToken;
}
export function clearAccessToken() {
  accessToken = null;
}
export function registerRefreshHandler(fn) {
  refreshHandler = fn;
}

/* ---- axios setup ---------------------------------------------------- */

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken && !config.headers?.Authorization) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;

    const shouldRetry =
      status === 401 &&
      !original._retry &&
      !original._skipAuthRetry &&
      typeof refreshHandler === 'function';

    if (!shouldRetry) return Promise.reject(error);

    original._retry = true;

    // Coalesce concurrent 401s onto one refresh call.
    if (!refreshing) {
      refreshing = (async () => {
        try {
          return await refreshHandler();
        } finally {
          refreshing = null;
        }
      })();
    }

    const newToken = await refreshing;
    if (!newToken) return Promise.reject(error);

    original.headers = original.headers || {};
    original.headers.Authorization = `Bearer ${newToken}`;
    return api.request(original);
  }
);

export default api;
