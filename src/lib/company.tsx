'use client';

// Brand (ESB company) of the sales views (2026-10-26): the Kopi Calf outlets (CALF) and Wasgee Tea (CALF7) share one
// Dashboard and one Sales Transactions page but are never mixed — the pages read one company at a time
// (integrated_portal_be app/scope.py, `?company=`). The companies the user sees outlets of come from
// /api/branches/companies; the choice is remembered on the device. With one company there is nothing to choose.
// Pages that list the branches of every brand (User Accounts, profile, monitoring) ask `?company=all`.

import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '@/lib/auth';

export type Company = { code: string; name: string; branches: number };

export const MAIN_COMPANY = 'CALF';
const KEY = 'portal.company';
// the look of a brand: Wasgee Tea in white + dark orange (app/theme-colors.css html.brand-wasgee); Kopi Calf the default
const BRAND_CLASS: Record<string, string> = { CALF7: 'brand-wasgee' };

/** `url` with `company=` (the chosen brand; "all" = every brand). */
export function withCompany(url: string, company: string): string {
  return `${url}${url.includes('?') ? '&' : '?'}company=${encodeURIComponent(company)}`;
}

// the brand of the page being shown, for helpers outside React (exports)
let current = MAIN_COMPANY;
export const currentCompany = () => current;

interface CompanyState { companies: Company[]; company: string; setCompany: (code: string) => void }

const CompanyContext = createContext<CompanyState>({ companies: [], company: MAIN_COMPANY, setCompany: () => {} });

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setState] = useState(MAIN_COMPANY);
  // the pages wait for the brand: a Wasgee-only account never reads the Kopi Calf outlets first
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch('/api/branches/companies', { cache: 'no-store' })
      .then(res => (res.ok ? res.json() : []))
      .then((list: Company[]) => {
        if (cancelled) return;
        setCompanies(list);
        let stored: string | null = null;
        try { stored = window.localStorage.getItem(KEY); } catch { /* not remembered */ }
        // the remembered brand while the user still sees it, else the first one (Kopi Calf, or the user's only brand)
        const next = list.find(c => c.code === stored)?.code ?? list[0]?.code ?? MAIN_COMPANY;
        current = next;
        setState(next);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [user]);

  const setCompany = useCallback((code: string) => {
    current = code;
    setState(code);
    try { window.localStorage.setItem(KEY, code); } catch { /* not remembered */ }
  }, []);

  // the colours follow the chosen brand (signed out: the default look)
  useEffect(() => {
    const el = document.documentElement;
    Object.values(BRAND_CLASS).forEach(c => el.classList.remove(c));
    const cls = user ? BRAND_CLASS[company] : undefined;
    if (cls) el.classList.add(cls);
  }, [company, user]);

  if (user && !loaded) {
    return (
      <div className="flex h-dvh items-center justify-center bg-slate-50 text-slate-400" aria-busy="true">
        <Loader2 size={22} className="animate-spin" />
      </div>
    );
  }
  return <CompanyContext.Provider value={{ companies, company, setCompany }}>{children}</CompanyContext.Provider>;
}

export const useCompany = () => useContext(CompanyContext);

/** The brand switch of the sales pages (Kopi Calf | Wasgee Tea); nothing when the user sees one brand only. */
export function CompanySwitch({ className = '' }: { className?: string }) {
  const { companies, company, setCompany } = useCompany();
  if (companies.length < 2) return null;
  return (
    <div role="radiogroup" aria-label="Brand" className={`inline-flex rounded-xl bg-slate-100 p-1 ${className}`}>
      {companies.map(c => {
        const on = c.code === company;
        return (
          <button key={c.code} type="button" role="radio" aria-checked={on} onClick={() => setCompany(c.code)}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors sm:text-sm ${
              on ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200' : 'text-slate-500 hover:text-slate-800'}`}>
            {c.name}
          </button>
        );
      })}
    </div>
  );
}
