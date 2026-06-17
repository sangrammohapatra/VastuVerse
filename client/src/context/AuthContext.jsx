import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import {
  api,
  setAccessToken as setAxiosAccessToken,
  registerRefreshHandler,
} from '../utils/axiosInstance';

const SESSION_EXPIRED_KEY = 'vv_session_expired';

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

// Decode a JWT payload without external deps. Assumes ASCII payload, which
// VastuVerse tokens are (ids, role, tier strings).
function decodeJwt(token) {
  if (!token) return null;
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, '+').replace(/_/g, '/');
    const padded = b64 + '==='.slice((b64.length + 3) % 4);
    return JSON.parse(atob(padded));
  } catch (_) {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessTokenState] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  // true once a token has been applied in this page session
  const wasAuthenticatedRef = useRef(false);

  // Keep axios in sync with the in-memory token.
  useEffect(() => {
    setAxiosAccessToken(accessToken);
  }, [accessToken]);

  const applyToken = useCallback((token, userInfo = null) => {
    if (token) {
      wasAuthenticatedRef.current = true;
      setSessionExpired(false);
      sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    }
    setAccessTokenState(token || null);
    const decoded = token ? decodeJwt(token) : null;
    setUser(token ? { ...(decoded || {}), ...(userInfo || {}) } : null);
  }, []);

  // POST /auth/refresh — _skipAuthRetry guards against infinite 401 loops.
  const refreshToken = useCallback(async () => {
    // If a prior session expired and we stored that fact, skip auto-restore
    // so the user isn't silently re-logged-in on page refresh.
    if (sessionStorage.getItem(SESSION_EXPIRED_KEY) === 'true') {
      sessionStorage.removeItem(SESSION_EXPIRED_KEY);
      setSessionExpired(true);
      applyToken(null);
      return null;
    }

    try {
      const { data } = await api.post(
        '/auth/refresh',
        {},
        { _skipAuthRetry: true }
      );
      if (data?.accessToken) {
        applyToken(data.accessToken, data.user || null);
        return data.accessToken;
      }
    } catch (_) {
      /* fall through to clearing state */
    }

    // Refresh failed. If the user was active in this session it means
    // their session expired mid-use; flag it so we can show a message.
    if (wasAuthenticatedRef.current) {
      sessionStorage.setItem(SESSION_EXPIRED_KEY, 'true');
      setSessionExpired(true);
    }
    applyToken(null);
    return null;
  }, [applyToken]);

  // Register the refresh handler with axios so its 401 interceptor can call it.
  useEffect(() => {
    registerRefreshHandler(refreshToken);
  }, [refreshToken]);

  // Bootstrap on mount.
  useEffect(() => {
    let alive = true;

    (async () => {
      // 1) OAuth redirect: pick up token from URL fragment, clean history.
      if (typeof window !== 'undefined' && window.location.hash.includes('token=')) {
        const params = new URLSearchParams(window.location.hash.slice(1));
        const t = params.get('token');
        if (t) {
          applyToken(t);
          window.history.replaceState(
            {},
            document.title,
            window.location.pathname + window.location.search
          );
          if (alive) setLoading(false);
          return;
        }
      }
      // 2) Normal flow: try to restore via refresh cookie.
      await refreshToken();
      if (alive) setLoading(false);
    })();

    return () => {
      alive = false;
    };
  }, [applyToken, refreshToken]);

  /**
   * Called by login flows that already received an accessToken (verify-otp).
   * userInfo is optional extra fields beyond what's in the JWT.
   */
  const login = useCallback(
    (token, userInfo = null) => {
      applyToken(token, userInfo);
    },
    [applyToken]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {}, { _skipAuthRetry: true });
    } catch (_) {
      /* ignore — we clear local state regardless */
    }
    wasAuthenticatedRef.current = false;
    sessionStorage.removeItem(SESSION_EXPIRED_KEY);
    setSessionExpired(false);
    applyToken(null);
  }, [applyToken]);

  const clearSessionExpired = useCallback(() => {
    setSessionExpired(false);
  }, []);

  const value = {
    user,
    accessToken,
    isAuthenticated: !!accessToken,
    loading,
    sessionExpired,
    clearSessionExpired,
    login,
    logout,
    refreshToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
