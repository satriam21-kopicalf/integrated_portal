'use client';

// Phones & tablets: an app-like floating tab bar — Dashboard, Sales, Stock Opname, Form (a sheet with the forms the user
// fills) and Menu (the full sidebar). The chosen tab floats: a blue bubble rises out of the bar and slides to the tab with
// a small spring (same design as Kopi Calf Operations, 2026-10-25). Hidden while a form is being filled (focus mode), so
// the send bar of the form has the bottom of the screen.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { ChevronRight, ClipboardCheck, ClipboardPen, LayoutDashboard, MapPinCheck, Menu, Package, Receipt, Store, Wallet, Wrench, X, type LucideIcon, UserRoundCheck } from 'lucide-react';
import { canAccess, useAuth } from '@/lib/auth';
import { PAGES } from '@/lib/pages';
import { tr } from '@/lib/i18n';

/** Focus mode: a screen being filled hides the tab bar while it is shown. */
export const FocusContext = createContext<(on: boolean) => void>(() => {});
export function useFocusMode(on = true) {
  const set = useContext(FocusContext);
  useEffect(() => {
    set(on);
    return () => set(false);
  }, [on, set]);
}

type FormLink = { href: string; key: string; icon: LucideIcon; label: () => string; hint: () => string };
const FORM_LINKS: FormLink[] = [
  { href: '/forms/pic-check-in', key: 'form.pic-check-in', icon: MapPinCheck, label: () => tr('PIC Check In'), hint: () => tr('Check in at the outlet you visit') },
  { href: '/forms/surveyor-check-in', key: 'form.surveyor-check-in', icon: UserRoundCheck, label: () => tr('Surveyor Check In'), hint: () => tr('Surveyor visit to the outlet') },
  { href: '/forms/product', key: 'form.product', icon: Package, label: () => 'Product', hint: () => tr('Fill in the product checklist') },
  { href: '/forms/outlet', key: 'form.outlet', icon: Store, label: () => 'Outlet', hint: () => tr('Fill in the outlet checklist') },
  { href: '/forms/damaged-equipment', key: 'form.damaged-equipment', icon: Wrench, label: () => tr('Damaged Equipment'), hint: () => tr('Repair & procurement requests') },
  { href: '/forms/pengajuan', key: 'form.pengajuan', icon: Wallet, label: () => tr('Fund requests'), hint: () => tr('Petty cash with receipts') },
];

type Tab = { key: string; label: string; icon: LucideIcon; href?: string; onClick?: () => void; active: boolean };

export default function BottomNav({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [forms, setForms] = useState(false);
  useEffect(() => setForms(false), [pathname]);
  useEffect(() => {
    if (!forms) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setForms(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [forms]);
  if (!user) return null;

  const ready = (key: string) => PAGES.find((p) => p.key === key)?.state !== 'building';
  const formLinks = FORM_LINKS.filter((f) => ready(f.key) && canAccess(user, f.href));
  const on = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const tabs: Tab[] = [
    ...[
      { href: '/overview', label: tr('Dashboard'), icon: LayoutDashboard },
      { href: '/sales', label: tr('Sales'), icon: Receipt },
      { href: '/stock-opname', label: 'Opname', icon: ClipboardCheck },
    ].filter((t) => canAccess(user, t.href)).map((t) => ({ ...t, key: t.href, active: on(t.href) })),
    ...(formLinks.length ? [{ key: 'form', label: tr('Form'), icon: ClipboardPen, onClick: () => setForms(true), active: forms || pathname.startsWith('/forms') }] : []),
    { key: 'menu', label: tr('Menu'), icon: Menu, onClick: onMenu, active: false },
  ];
  const at = tabs.findIndex((t) => t.active);
  const width = 100 / tabs.length;

  return (
    <>
      <nav aria-label={tr('Main menu')} className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3 lg:hidden"
        style={{ paddingBottom: 'max(0.625rem, env(safe-area-inset-bottom))' }}>
        <div className="pointer-events-auto relative mx-auto h-[66px] max-w-md rounded-[26px] bg-white/95 shadow-[0_10px_32px_-6px_rgba(15,23,42,0.22)] ring-1 ring-slate-200/80 backdrop-blur-xl">
          {/* the floating bubble of the chosen tab */}
          <span aria-hidden className={`absolute inset-y-0 transition-[left,opacity] duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] ${at < 0 ? 'opacity-0' : 'opacity-100'}`}
            style={{ width: `${width}%`, left: `${Math.max(at, 0) * width}%` }}>
            <span className="absolute left-1/2 top-0 h-[54px] w-[54px] -translate-x-1/2 -translate-y-[22px] rounded-full bg-gradient-to-br from-blue-500 to-blue-700 shadow-lg shadow-blue-600/35 ring-[5px] ring-slate-50" />
          </span>
          <div className="relative flex h-full items-stretch">
            {tabs.map((t) => {
              const inner = (
                <>
                  <span className={`flex h-6 items-center justify-center transition-all duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)] ${
                    t.active ? '-translate-y-[17px] scale-110 text-white' : 'text-slate-400'}`}>
                    <t.icon size={21} strokeWidth={t.active ? 2.2 : 1.9} />
                  </span>
                  <span className={`max-w-full truncate px-0.5 text-[10.5px] leading-none transition-colors ${t.active ? 'font-semibold text-blue-700' : 'font-medium text-slate-500'}`}>{t.label}</span>
                </>
              );
              const cls = 'flex min-w-0 flex-1 flex-col items-center justify-between pb-2.5 pt-3 outline-none active:opacity-70';
              return t.href ? (
                <Link key={t.key} href={t.href} className={cls} aria-current={t.active ? 'page' : undefined}>{inner}</Link>
              ) : (
                <button key={t.key} type="button" onClick={t.onClick} className={cls} aria-haspopup="dialog" aria-label={t.key === 'menu' ? tr('Open menu') : undefined}>{inner}</button>
              );
            })}
          </div>
        </div>
      </nav>

      {forms && <FormSheet links={formLinks} on={on} onClose={() => setForms(false)} />}
    </>
  );
}

/** The forms the account may fill (2026-10-28: a plain list — one row per form, two columns on tablets). */
function FormSheet({ links, on, onClose }: { links: FormLink[]; on: (href: string) => boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label={tr('Form')}>
      <button type="button" className="drawer-backdrop absolute inset-0 bg-slate-900/40" onClick={onClose} aria-label={tr('Close')} />
      <div className="sheet-panel absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] max-w-3xl flex-col rounded-t-3xl bg-slate-50 shadow-2xl">
        <div className="flex-shrink-0 rounded-t-3xl border-b border-slate-200/70 bg-white px-5 pb-3 pt-2.5">
          <div className="mx-auto h-1 w-9 rounded-full bg-slate-300" aria-hidden />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-slate-900">{tr('Form')} <span className="ml-1 text-sm font-normal text-slate-400">{links.length}</span></p>
            <button type="button" onClick={onClose} className="-mr-1.5 flex h-9 w-9 items-center justify-center rounded-full text-slate-500 active:bg-slate-100" aria-label={tr('Close')}><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-4" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <ul className="grid gap-px overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200/70 sm:grid-cols-2">
            {links.map((f) => {
              const here = on(f.href);
              return (
                <li key={f.href} className="bg-white">
                  <Link href={f.href} aria-current={here ? 'page' : undefined}
                    className={`flex min-h-[60px] items-center gap-3 px-3.5 py-2.5 transition-colors ${here ? 'bg-blue-50/70' : 'active:bg-slate-50'}`}>
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${here ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}><f.icon size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${here ? 'text-blue-700' : 'text-slate-900'}`}>{f.label()}</span>
                      <span className="block truncate text-xs text-slate-500">{f.hint()}</span>
                    </span>
                    <ChevronRight size={16} className="flex-shrink-0 text-slate-300" />
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
