import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ThemeProvider as MuiThemeProvider, CssBaseline } from '@mui/material';
import { getTheme } from '../theme/themeConfig';

const STORAGE_KEY = 'vastuverse-theme';

const ThemeModeContext = createContext({
  mode: 'light',
  toggleTheme: () => {},
  setMode: () => {},
});

/** Hook to read { mode, toggleTheme, setMode } anywhere in the tree. */
export const useThemeMode = () => useContext(ThemeModeContext);

const getInitialMode = () => {
  if (typeof window === 'undefined') return 'light';
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
  } catch (_) {
    /* localStorage may be unavailable (privacy mode); fall through */
  }
  // Default: follow the OS preference.
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }
  return 'light';
};

/**
 * Wrap the entire app in <ThemeProvider> (typically in main.jsx, above the
 * router). It supplies the MUI theme + CssBaseline and exposes the toggle.
 */
export const ThemeProvider = ({ children }) => {
  const [mode, setMode] = useState(getInitialMode);

  // Persist + reflect on <html data-theme> (handy for non-MUI / CSS hooks).
  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch (_) {
      /* ignore */
    }
    document.documentElement.setAttribute('data-theme', mode);
    document.documentElement.style.colorScheme = mode;
  }, [mode]);

  const toggleTheme = () =>
    setMode((prev) => (prev === 'light' ? 'dark' : 'light'));

  const theme = useMemo(() => getTheme(mode), [mode]);
  const ctxValue = useMemo(() => ({ mode, toggleTheme, setMode }), [mode]);

  return (
    <ThemeModeContext.Provider value={ctxValue}>
      <MuiThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </ThemeModeContext.Provider>
  );
};

export default ThemeModeContext;
