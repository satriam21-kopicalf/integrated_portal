'use client';

// Phones & tablets: an app-like floating tab bar — Dashboard, Sales, Stock Opname, Form (a sheet with the forms the user
// fills) and Menu (the full sidebar). The chosen tab floats: a blue bubble rises out of the bar and slides to the tab with
// a small spring (same design as Kopi Calf Operations, 2026-10-25). Hidden while a form is being filled (focus mode), so
// the send bar of the form has the bottom of the screen.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { ChevronRight, ClipboardCheck, ClipboardPen, LayoutDashboard, MapPinCheck, Menu, Package, Receipt, Store, Wrench, X, type LucideIcon } from 'lucide-react';
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
  { href: '/forms/product', key: 'form.product', icon: Package, label: () => 'Product', hint: () => tr('Fill in the product checklist') },
  { href: '/forms/outlet', key: 'form.outlet', icon: Store, label: () => 'Outlet', hint: () => tr('Fill in the outlet checklist') },
  { href: '/forms/damaged-equipment', key: 'form.damaged-equipment', icon: Wrench, label: () => tr('Damaged Equipment'), hint: () => tr('Repair & procurement requests') },
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

/** The forms the account may fill, as app tiles. */
function FormSheet({ links, on, onClose }: { links: FormLink[]; on: (href: string) => boolean; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label={tr('Form')}>
      <button type="button" className="drawer-backdrop absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" onClick={onClose} aria-label={tr('Close')} />
      <div className="sheet-panel absolute inset-x-0 bottom-0 mx-auto max-h-[85dvh] max-w-2xl overflow-y-auto rounded-t-[28px] bg-white shadow-2xl"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}>
        <div className="sticky top-0 z-10 bg-white/95 px-5 pb-2 pt-2.5 backdrop-blur">
          <div className="mx-auto h-1 w-10 rounded-full bg-slate-200" aria-hidden />
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-lg font-bold text-slate-900">{tr('Form')}</p>
              <p className="text-xs text-slate-500">{tr('Choose the form to fill in')}</p>
            </div>
            <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 active:bg-slate-200" aria-label={tr('Close')}><X size={18} /></button>
          </div>
        </div>
        <ul className="grid grid-cols-1 gap-2 px-4 pt-2 min-[400px]:grid-cols-2 sm:grid-cols-3">
          {links.map((f) => (
            <li key={f.href}>
              <Link href={f.href} className={`flex h-full items-center gap-3 rounded-2xl border p-3 transition-colors min-[400px]:flex-col min-[400px]:items-start ${
                on(f.href) ? 'border-blue-200 bg-blue-50' : 'border-slate-200/80 bg-white active:bg-slate-50'}`}>
                <span className={`flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl ${on(f.href) ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'}`}><f.icon size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold leading-snug text-slate-900">{f.label()}</span>
                  <span className="mt-0.5 line-clamp-2 block text-xs leading-snug text-slate-500">{f.hint()}</span>
                </span>
                <ChevronRight size={16} className="flex-shrink-0 text-slate-300 min-[400px]:hidden" />
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
