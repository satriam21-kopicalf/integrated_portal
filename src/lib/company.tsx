'use client';

// Brand (ESB company) of the sales views (2026-10-26): the Kopi Calf outlets (CALF) and Wasgee Tea (CALF7) share one
// Dashboard and one Sales Transactions page but are never mixed — the pages read one company at a time
// (integrated_portal_be app/scope.py, `?company=`). The companies the user sees outlets of come from
// /api/branches/companies; the choice is remembered on the device. With one company there is nothing to choose.
// Pages that list the branches of every brand (User Accounts, profile, monitoring) ask `?company=all`.

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { tr } from '@/lib/i18n';
import { AppSkeleton } from '@/components/kc/Skeleton';
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

// Cost Control (2026-11-08): every list, figure and export of a Cost Control page is about the brand chosen on top
// (integrated_portal_be app/scope.py COST_CONTROL_PATHS, the stock opname through the gateway); the Operations forms
// never are, since they are not under /cost-control.
const CC_API = ['/api/cost-control/', '/api/monitoring/', '/api/so/', '/api/waste/monitor', '/api/waste/reviews', '/api/waste/daily',
  '/api/waste/usage', '/api/waste/investigations', '/api/de/monitor', '/api/rating/', '/api/waste/esb-compare'];
// the Operations monitors read one brand too (2026-11-10); Branch Groups is the setting of every brand and stays whole
const BRAND_PAGES = ['/cost-control', '/monitoring', '/rating'];
export const brandPage = (path: string) => BRAND_PAGES.some((p) => path.startsWith(p)) && !path.startsWith('/monitoring/branch-groups')
  && !path.startsWith('/monitoring/pengajuan');  // Fund Request: its own unit tabs (2026-11-24)

/** `url` with the Cost Control brand when a Cost Control page asks one of its endpoints; the branch filters of a
 * brand list that brand's branches only. */
export function ccUrl(url: string): string {
  if (typeof window === 'undefined' || !brandPage(window.location.pathname) || url.includes('company=')
    && !url.startsWith('/api/branches')) return url;
  if (url.startsWith('/api/branches')) return current === MAIN_COMPANY ? url : url.replace('company=all', `company=${current}`);
  return CC_API.some((p) => url.startsWith(p)) ? withCompany(url, current) : url;
}

/** the units of the Fund Request the account reads (Roastery, Warehouse, Central Kitchen, COTR …, 2026-11-25) */
export type UnitTab = { code: string; name: string };
interface CompanyState { companies: Company[]; company: string; setCompany: (code: string) => void; units: UnitTab[] }

const CompanyContext = createContext<CompanyState>({ companies: [], company: MAIN_COMPANY, setCompany: () => {}, units: [] });

export function CompanyProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [company, setState] = useState(MAIN_COMPANY);
  // the pages wait for the brand: a Wasgee-only account never reads the Kopi Calf outlets first
  const [loaded, setLoaded] = useState(false);
  const [units, setUnits] = useState<UnitTab[]>([]);
  useEffect(() => {
    if (!user) return;
    let off = false;
    fetch('/api/pengajuan/units', { cache: 'no-store' }).then(r => (r.ok ? r.json() : { data: [] })).then((r: { data: UnitTab[] }) => { if (!off) setUnits(r.data ?? []); }).catch(() => {});
    return () => { off = true; };
  }, [user]);

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

  if (user && !loaded) return <AppSkeleton />;  // the app in its loading shape (2026-11-10)
  return <CompanyContext.Provider value={{ companies, company, setCompany, units }}>{children}</CompanyContext.Provider>;
}

export const useCompany = () => useContext(CompanyContext);

/** The brand switch of the sales pages (Kopi Calf | Wasgee Tea); nothing when the user sees one brand only. `extra`
 *  adds tabs that are not ESB companies (Calf On The Road on the Dashboard, 2026-11-01): the page handles them through
 *  `value` / `onChange`. */
/** The logo of a brand or unit (public/assets); none for an unknown code. unit-*.png: trimmed, transparent, small copies
 *  of the Logo-Stivo (Roastery), Logo-Warehouse and Logo-CK files (2026-11-25). */
export const LOGOS: Record<string, string> = { CALF: '/assets/calf-logo.png', CALF7: '/assets/Logo-Wasgee.png', COTR: '/assets/Logo-COTR.png',
  ROASTERY: '/assets/unit-roastery.png', WAREHOUSE: '/assets/unit-warehouse.png', CK: '/assets/unit-ck.png' };
// too detailed to be read at the size of a tab: the name stays beside the logo
const NAMED = new Set(['ROASTERY', 'WAREHOUSE', 'CK']);

export function CompanySwitch({ className = '', extra = [], value, onChange, compact = false }: {
  className?: string; extra?: { code: string; name: string }[]; value?: string; onChange?: (code: string) => void;
  /** small logo buttons for the top bar (2026-11-18) */ compact?: boolean;
}) {
  const { companies, company, setCompany, units } = useCompany();
  const [missing, setMissing] = useState<UnitTab | null>(null);
  const own = [...companies, ...extra];
  const more = units.filter(u => !own.some(t => t.code === u.code));
  const tabs = [...own, ...more];
  if (tabs.length < 2) return null;
  // a unit this page has no view of: said in a pop up, with the pages that do have one; the brand stays as it was
  const choose = (code: string) => {
    const none = more.find(u => u.code === code);
    if (none) setMissing(none);
    else if (onChange) onChange(code);
    else setCompany(code);
  };
  const alert = missing && <NoView unit={missing} onClose={() => setMissing(null)} />;
  const shown = value ?? company;
  if (compact) return <><BrandMenu tabs={tabs} shown={shown} pick={choose} className={className} />{alert}</>;
  return (
    <>
    <div role="radiogroup" aria-label="Brand" className={`inline-flex max-w-full gap-1 overflow-x-auto [scrollbar-width:none] ${className}`}>
      {tabs.map(c => {
        const on = c.code === shown;
        return (
          <button key={c.code} type="button" role="radio" aria-checked={on} aria-label={c.name} title={c.name} onClick={() => choose(c.code)}
            className={`flex flex-shrink-0 ${LOGOS[c.code] && !NAMED.has(c.code) ? 'h-8 w-20 px-2' : 'h-8 px-3'} min-w-0 items-center gap-2 justify-center rounded-[4px] border transition-colors ${
              on ? 'border-[color:var(--j-0C66E4)] bg-white ring-1 ring-[color:var(--j-388BFF)]' : 'border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] hover:bg-[color:var(--j-091E420F)]'}`}>
            {/* the logo only (2026-11-02); the name is the label */}
            {LOGOS[c.code]
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={LOGOS[c.code]} alt="" aria-hidden className={`object-contain transition ${NAMED.has(c.code) ? 'max-h-6 max-w-14' : 'max-h-5 max-w-full'} ${on ? '' : 'opacity-60 grayscale'}`} />
              : null}
            {(!LOGOS[c.code] || NAMED.has(c.code)) && <span className="truncate text-xs font-semibold text-[color:var(--j-44546F)]">{c.name}</span>}
          </button>
        );
      })}
    </div>
    {alert}
    </>
  );
}

/** The chosen unit has no view on this page: where it has one. */
function NoView({ unit, onClose }: { unit: UnitTab; onClose: () => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const fund = user?.role === 'superadmin' || (user?.pages ?? []).includes('mon.pengajuan');
  // a brand (Kopi Calf, Wasgee) does have its figures here: the account has no branch of it (2026-11-25)
  const brand = unit.code === MAIN_COMPANY || unit.code in BRAND_CLASS;
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [onClose]);
  const open = (href: string) => {
    try { window.localStorage.setItem('portal.fund-unit', unit.code); } catch { /* not remembered */ }
    onClose();
    router.push(href);
  };
  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-neutral-900/50 p-0 sm:items-center sm:p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="alertdialog" aria-modal="true" aria-labelledby="no-view-title" className="w-full rounded-t-lg bg-white p-5 shadow-xl sm:max-w-md sm:rounded-[3px]" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {LOGOS[unit.code] && <img src={LOGOS[unit.code]} alt="" aria-hidden className="mb-3 max-h-14 max-w-36 object-contain" />}
        <p id="no-view-title" className="text-base font-semibold text-[color:var(--j-172B4D)]">{brand ? tr('Your account has no {0} branch', unit.name) : tr('No view for {0} here', unit.name)}</p>
        <p className="mt-1.5 text-sm text-[color:var(--j-44546F)]">{brand ? tr('The figures of {0} are here, but the Branch Access of your account holds none of its branches. A Superadmin adds them in User Accounts.', unit.name)
          : tr('This page has no data of {0}. It is available in Fund Request; the page stays on the brand shown now.', unit.name)}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} className="h-9 rounded-[4px] border border-[color:var(--j-8590A2)] bg-white px-3 text-sm font-medium text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]">{tr('Close')}</button>
          {unit.code === 'COTR' && <button type="button" onClick={() => open('/overview')} className="h-9 rounded-[4px] border border-[color:var(--j-8590A2)] bg-white px-3 text-sm font-medium text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]">{tr('Dashboard')}</button>}
          {brand && user?.role === 'superadmin' && <button type="button" autoFocus onClick={() => open('/users')} className="h-9 rounded-[4px] bg-[color:var(--j-0C66E4)] px-3 text-sm font-medium text-white hover:bg-[color:var(--j-0055CC)]">{tr('Open User Accounts')}</button>}
          {!brand && fund && <button type="button" autoFocus onClick={() => open('/monitoring/pengajuan')} className="h-9 rounded-[4px] bg-[color:var(--j-0C66E4)] px-3 text-sm font-medium text-white hover:bg-[color:var(--j-0055CC)]">{tr('Open Fund Request')}</button>}
        </div>
      </div>
    </div>, document.body);
}

/** The brand as one dropdown of the top bar (2026-11-18): the chosen logo and a chevron; the menu lists every brand
 *  with its logo and name, the chosen one marked. */
function BrandMenu({ tabs, shown, pick, className }: { tabs: { code: string; name: string }[]; shown: string; pick: (code: string) => void; className?: string }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  const cur = tabs.find((t) => t.code === shown) ?? tabs[0];
  const logo = (code: string, name: string, cls: string) => (LOGOS[code]
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={LOGOS[code]} alt="" aria-hidden className={`${cls} object-contain`} /> : <span className="truncate text-xs font-semibold text-[color:var(--j-44546F)]">{name}</span>);
  return (
    <div ref={box} className={`relative ${className ?? ''}`}>
      <button type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open} aria-label={`Brand: ${cur.name}`} title={cur.name}
        className={`flex h-8 items-center gap-1.5 rounded-[4px] border px-2 transition-colors ${open ? 'border-[color:var(--j-0C66E4)] bg-white ring-2 ring-[color:var(--j-388BFF)]' : 'border-[color:var(--j-DCDFE4)] bg-white hover:bg-[color:var(--j-F7F8F9)]'}`}>
        <span className="flex h-5 w-12 items-center justify-center">{logo(cur.code, cur.name, 'max-h-4 max-w-full')}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={`text-[color:var(--j-626F86)] transition ${open ? 'rotate-180' : ''}`} aria-hidden><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-56 overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white py-1 shadow-xl lg:left-0 lg:right-auto">
          <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--j-626F86)]">Brand</p>
          {tabs.map((t) => {
            const on = t.code === shown;
            return (
              <button key={t.code} type="button" role="menuitemradio" aria-checked={on} onClick={() => { setOpen(false); if (!on) pick(t.code); }}
                className={`relative flex w-full items-center gap-2.5 px-3 py-2 text-left text-[13px] ${on ? 'bg-[color:var(--j-E9F2FF)] font-medium text-[color:var(--j-0055CC)] before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:bg-[color:var(--j-0C66E4)]' : 'text-[color:var(--j-172B4D)] hover:bg-[color:var(--j-091E420F)]'}`}>
                <span className="flex h-8 w-14 flex-shrink-0 items-center justify-center rounded-[4px] border border-[color:var(--j-DCDFE4)] bg-white px-1">{logo(t.code, t.name, NAMED.has(t.code) ? 'max-h-7 max-w-full' : 'max-h-4 max-w-full')}</span>
                <span className="min-w-0 flex-1 truncate">{t.name}</span>
                {on && <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden><path d="M20 6 9 17l-5-5" /></svg>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
