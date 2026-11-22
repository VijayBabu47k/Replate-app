import { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { ThemeProvider } from '@mui/material';
import { buildTheme } from '../theme';

const KEY = 'rts-theme';
const Ctx = createContext({ mode: 'dark', toggle: () => {} });
export const useThemeMode = () => useContext(Ctx);

const systemMode = () => (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
const stored = () => { try { const v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : null; } catch { return null; } };

/** Light/dark mode: saved choice wins, otherwise follows the OS setting (live). Drives MUI + the CSS variables. */
export function ThemeModeProvider({ children }) {
  const [saved, setSaved] = useState(stored);
  const [system, setSystem] = useState(systemMode);
  const mode = saved || system;

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: light)');
    if (!mq) return undefined;
    const on = () => setSystem(mq.matches ? 'light' : 'dark');
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = mode;
    root.style.background = '';
    root.style.colorScheme = mode;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', mode === 'light' ? '#f4f7f5' : '#060907');
  }, [mode]);

  const toggle = useCallback(() => {
    const next = mode === 'light' ? 'dark' : 'light';
    setSaved(next);
    try { localStorage.setItem(KEY, next); } catch { /* ignore */ }
  }, [mode]);

  const theme = useMemo(() => buildTheme(mode), [mode]);
  const value = useMemo(() => ({ mode, toggle }), [mode, toggle]);
  return <Ctx.Provider value={value}><ThemeProvider theme={theme}>{children}</ThemeProvider></Ctx.Provider>;
}
