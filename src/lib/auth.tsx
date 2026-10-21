'use client';

// Signed-in user for the whole app. The session itself is an HttpOnly cookie
// set by the backend (POST /api/auth/login); scripts never see the token.
// src/proxy.ts sends visitors without a session cookie to /login before a page
// renders; this provider confirms the session (/api/auth/me), exposes the user
// and sends the browser back to /login when any /api call answers 401.

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { rememberFarewell } from '@/lib/greetings';
import { tr } from './i18n';
import { CC_PAGES, PageKey, PAGES, pageOf } from './pages';

export type Role = 'superadmin' | 'cost_control' | 'user';
export type Gender = 'male' | 'female';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  /** null until the user fills it in under "My profile" */
  fullName: string | null;
  /** what to show: the full name, or the username until the profile is completed */
  displayName: string;
  role: Role;
  isActive: boolean;
  isLocked: boolean;
  phoneNumber: string | null;
  jobTitle: string | null;
  department: string | null;
  notes: string | null;
  employeeNumber: string | null;
  gender: Gender | null;
  /** YYYY-MM-DD */
  birthDate: string | null;
  address: string | null;
  city: string | null;
  /** outlet / office: master branch code */
  workBranchCode: string | null;
  workBranchName: string | null;
  /** branch codes a "user" may see on Overview and Sales (superadmins: [] = every branch) */
  branches: string[];
  /** full name, phone number, job title and department are filled in */
  profileComplete: boolean;
  /** last change the user made to their own profile */
  profileUpdatedAt: string | null;
  mustChangePassword: boolean;
  /** versioned /api/avatars/{id}?v=... or null */
  avatarUrl: string | null;
  lastLoginAt: string | null;
  lastLoginIp: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  passwordChangedAt: string | null;
  createdAt: string | null;
  createdBy: string | null;
  updatedAt: string | null;
  updatedBy: string | null;
  /** pages the user opens (role pages ± the user's own exceptions; superadmins: every page) */
  pages: PageKey[];
  /** User Accounts only: pages added (true) or removed (false) on top of the role */
  pageOverrides?: Record<string, boolean>;
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

export const PUBLIC_PATHS = ['/login', '/share'];
export const ROLE_LABELS: Record<Role, string> = {
  get superadmin() { return tr('Super Admin'); }, get cost_control() { return tr('Cost Control'); }, get user() { return tr('User'); },
};
export const GENDER_LABELS: Record<Gender, string> = { get male() { return tr('Male'); }, get female() { return tr('Female'); } };

/** May the user open this path? Pages come from the backend (role pages ± exceptions, lib/pages.ts); User Accounts
 * and Activity Logs are superadmin-only. The backend enforces the same. */
export function canAccess(user: Pick<AuthUser, 'role' | 'pages'>, pathname: string): boolean {
  if (user.role === 'superadmin') return true;
  const page = pageOf(pathname);
  return page !== null && page !== 'superadmin' && pagesOf(user).includes(page);
}

export function hasPage(user: Pick<AuthUser, 'role' | 'pages'> | null | undefined, page: PageKey): boolean {
  return !!user && (user.role === 'superadmin' || pagesOf(user).includes(page));
}

/** The user's pages; a backend without page access (before migration 012) answers without them: role defaults. */
function pagesOf(user: Pick<AuthUser, 'role' | 'pages'>): PageKey[] {
  if (user.pages) return user.pages;
  const base: PageKey[] = ['overview', 'sales', 'stock-opname', 'guide'];
  return user.role === 'cost_control' ? [...base, 'waste', ...CC_PAGES] : base;
}

/** Where the user lands: the first page of the menu it may open. */
export function homePath(user: Pick<AuthUser, 'role' | 'pages'>): string {
  return PAGES.find(p => hasPage(user, p.key))?.href ?? '/overview';
}

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
  // signing out: the sign-out itself goes to /login?reason=signed-out, so the
  // redirects below must not race it with a plain /login (losing the farewell)
  const leaving = useRef(false);

  const setUser = useCallback((u: AuthUser | null) => {
    if (u) leaving.current = false;
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
    if (status === 'anonymous' && !isPublicPath(pathname) && !leaving.current) toLogin();
  }, [status, pathname, toLogin]);

  // any API call answered with 401 (session expired / revoked) -> login
  useEffect(() => {
    const original = window.fetch;
    window.fetch = async (...args: Parameters<typeof fetch>) => {
      const res = await original(...args);
      const url = typeof args[0] === 'string' ? args[0] : args[0] instanceof URL ? args[0].pathname : args[0].url;
      if (res.status === 401 && url.startsWith('/api/') && !url.startsWith('/api/auth/') && !isPublicPath(window.location.pathname) && !leaving.current) {
        setUserState(null);
        setStatus('anonymous');
        toLogin('expired');
      }
      return res;
    };
    return () => { window.fetch = original; };
  }, [toLogin]);

  const logout = useCallback(async () => {
    leaving.current = true;
    if (user) rememberFarewell(user.id, user.displayName); // shown on the sign-in page
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } finally {
      setUser(null);
      router.replace('/login?reason=signed-out');
    }
  }, [router, setUser, user]);

  const value = useMemo(() => ({ user, status, setUser, logout }), [user, status, setUser, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  return useContext(AuthContext);
}

/** "Budi Santoso" -> "BS"; words starting with punctuation such as "(temporary)" are skipped. */
export function initials(name: string | null | undefined): string {
  const words = (name || '').trim().split(/\s+/).filter(w => /^[\p{L}\p{N}]/u.test(w));
  if (!words.length) return '?';
  return (words[0][0] + (words.length > 1 ? words[1][0] : '')).toUpperCase();
}
