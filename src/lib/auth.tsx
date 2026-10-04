'use client';

// Signed-in user for the whole app. The session itself is an HttpOnly cookie
// set by the backend (POST /api/auth/login); scripts never see the token.
// src/proxy.ts sends visitors without a session cookie to /login before a page
// renders; this provider confirms the session (/api/auth/me), exposes the user
// and sends the browser back to /login when any /api call answers 401.

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type Role = 'superadmin' | 'user';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: Role;
  isActive: boolean;
  isLocked: boolean;
  phoneNumber: string | null;
  jobTitle: string | null;
  department: string | null;
  notes: string | null;
  mustChangePassword: boolean;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  passwordChangedAt: string | null;
  createdAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
}

type Status = 'loading' | 'authenticated' | 'anonymous';

interface AuthState {
  user: AuthUser | null;
  status: Status;
  setUser: (user: AuthUser | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null, status: 'loading', setUser: () => {}, logout: async () => {},
});

export const PUBLIC_PATHS = ['/login'];
export const ROLE_LABELS: Record<Role, string> = { superadmin: 'Super Admin', user: 'User' };

export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some(p => pathname === p || pathname.startsWith(`${p}/`));
}

/** Only same-site paths are accepted as a post-login destination. */
export function safeNext(value: string | null | undefined): string {
  return value && value.startsWith('/') && !value.startsWith('//') && !isPublicPath(value) ? value : '/overview';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<Status>('loading');

  const setUser = useCallback((u: AuthUser | null) => {
    setUserState(u);
    setStatus(u ? 'authenticated' : 'anonymous');
  }, []);

  const toLogin = useCallback((reason?: string) => {
    const here = `${window.location.pathname}${window.location.search}`;
    const params = new URLSearchParams();
    if (!isPublicPath(window.location.pathname) && window.location.pathname !== '/') params.set('next', here);
    if (reason) params.set('reason', reason);
    const qs = params.toString();
    router.replace(`/login${qs ? `?${qs}` : ''}`);
  }, [router]);

  // confirm the session once per page load
  useEffect(() => {
    let cancelled = false;
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(async res => {
        if (cancelled) return;
        if (res.ok) setUser((await res.json()).user);
        else setUser(null);
      })
      .catch(() => { if (!cancelled) setUser(null); });
    return () => { cancelled = true; };
  }, [setUser]);

  // not signed in on a protected page -> login
  useEffect(() => {
    if (status === 'anonymous' && !isPublicPath(pathname)) toLogin();
  }, [status, pathname, toLogin]);

  // any API call answered with 401 (session expired / revoked) -> login
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await original(...args);
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].pathname : args[0].url;
      if (res.status === 401 && url.startsWith('/api/') && !url.startsWith('/api/auth/') && !isPublicPath(window.location.pathname)) {
        setUserState(null);
        setStatus('anonymous');
        toLogin('expired');
      }
      return res;
    };
    return () => { window.fetch = original; };
  }, [toLogin]);

  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      router.replace('/login?reason=signed-out');
    }
  }, [router, setUser]);

  const value = useMemo(() => ({ user, status, setUser, logout }), [user, status, setUser, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

export function initials(name: string | null | undefined): string {
  const parts = (name || '?').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '?') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
