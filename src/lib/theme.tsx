'use client';

// Light / dark appearance. The class "dark" on <html> switches every Tailwind colour
// (src/app/theme-colors.css); charts are recoloured by darkOption() below. The choice is
// kept in localStorage and applied before the first paint by THEME_SCRIPT (app/layout.tsx).

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

export type ThemeMode = 'light' | 'dark' | 'system';

export const THEME_KEY = 'portal.theme';

/** Runs in <head> before the page paints: no flash of the light theme. */
export const THEME_SCRIPT = `(function(){try{var m=localStorage.getItem('${THEME_KEY}')||'light';`
  + `var d=m==='dark'||(m==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);`
  + `document.documentElement.classList.toggle('dark',d);var l=localStorage.getItem('portal.lang');`
  + `if(l==='id'||l==='en')document.documentElement.lang=l;}catch(e){}})();`;

interface ThemeState {
  mode: ThemeMode;
  dark: boolean;
  setMode: (m: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeState>({ mode: 'light', dark: false, setMode: () => {} });

function readMode(): ThemeMode {
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === 'dark' || v === 'system' ? v : 'light';
  } catch {
    return 'light';
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('light');
  const [systemDark, setSystemDark] = useState(false);

  useEffect(() => {
    setModeState(readMode());
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    setSystemDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const dark = mode === 'dark' || (mode === 'system' && systemDark);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
  }, [dark]);

  const setMode = useCallback((m: ThemeMode) => {
    try {
      window.localStorage.setItem(THEME_KEY, m);
    } catch {
      /* not remembered */
    }
    setModeState(m);
  }, []);

  const value = useMemo(() => ({ mode, dark, setMode }), [mode, dark, setMode]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/* ------------------------------------------------------------------ charts */

/**
 * Light chart colours -> their dark-theme counterpart: ink and chrome flip, the sequential
 * blue ramp runs dark -> light (low values recede on a dark surface), light tints of the
 * diverging ramp become dark tints, and the deep status colours move to readable steps.
 */
const DARK_CHART: Record<string, string> = {
  // ink and chrome (lib/chartTheme.ts)
  '#0f172a': '#f1f5f9',
  '#475569': '#cbd5e1',
  '#64748b': '#94a3b8',
  '#eef2f6': '#1e293b',
  '#cbd5e1': '#475569',
  '#e2e8f0': '#334155',
  '#f1f5f9': '#334155',
  '#ffffff': '#0f172a',
  '#fff': '#0f172a',
  // sequential blue ramp
  '#e8f1fd': '#13253f',
  '#cde2fb': '#17345a',
  '#9ec5f4': '#1f4c84',
  '#6da7ec': '#2a66b0',
  '#256abf': '#6da7ec',
  '#184f95': '#9ec5f4',
  '#0d366b': '#cde2fb',
  // diverging ramp tints and neutral midpoint
  '#b7d3f6': '#1d3a60',
  '#f6c3c2': '#4a2530',
  '#ef8a89': '#8f3f42',
  '#f0efec': '#334155',
  // deep status / text colours
  '#dc2626': '#f87171',
  '#be123c': '#fb7185',
  '#16a34a': '#4ade80',
  '#15803d': '#4ade80',
  '#047857': '#34d399',
  '#d97706': '#fbbf24',
  '#ea580c': '#fb923c',
  '#1d4ed8': '#60a5fa',
};

const HEX = /#(?:[0-9a-fA-F]{6}|fff)\b/g;
/** logos with black ink: a light variant for dark surfaces (public/assets/dark, made with sharp) */
export const DARK_LOGOS: Record<string, string> = {
  '/assets/dinein.png': '/assets/dark/dinein.png',
  '/assets/takeaway.png': '/assets/dark/takeaway.png',
  '/assets/gofood.png': '/assets/dark/gofood.png',
};
const LOGO = /\/assets\/(?:dinein|takeaway|gofood)\.png/g;
const darkStr = (s: string) => s.replace(HEX, h => DARK_CHART[h.toLowerCase()] ?? h)
  .replace(LOGO, m => DARK_LOGOS[m] ?? m)
  .replace(/rgba\(15,\s*23,\s*42,\s*\.25\)/g, 'rgba(0,0,0,.6)');

/** Colour for the current theme (for DOM swatches next to a chart). */
export function themedColor(hex: string, dark: boolean): string {
  return dark ? DARK_CHART[hex.toLowerCase()] ?? hex : hex;
}

/** A chart option recoloured for the dark theme (strings, nested objects and formatter output). */
export function darkOption<T>(value: T): T {
  if (typeof value === 'string') return darkStr(value) as T;
  if (typeof value === 'function') {
    const fn = value as unknown as (...a: unknown[]) => unknown;
    return ((...a: unknown[]) => darkOption(fn(...a))) as unknown as T;
  }
  if (Array.isArray(value)) return value.map(v => darkOption(v)) as T;
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = darkOption(v);
    return out as T;
  }
  return value;
}
