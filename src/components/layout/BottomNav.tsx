'use client';

// Phones & tablets (2026-10-21): an app-like tab bar at the bottom — Dashboard, Sales, Stock Opname, Forms (a sheet with
// the forms the user fills) and Menu (the full sidebar). Hidden while a form is being filled (focus mode), so the
// send bar of the form has the bottom of the screen.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { ClipboardCheck, ClipboardPen, LayoutDashboard, Menu, Receipt, X } from 'lucide-react';
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

const FORM_LINKS = [
  { href: '/forms/pic-check-in', key: 'form.pic-check-in', label: () => tr('PIC Check In'), hint: () => tr('Check in at the outlet you visit') },
  { href: '/forms/outlet', key: 'form.outlet', label: () => tr('Monitoring Outlet'), hint: () => tr('Fill in the outlet checklist') },
  { href: '/forms/product', key: 'form.product', label: () => tr('Monitoring Product'), hint: () => tr('Fill in the product checklist') },
  { href: '/forms/tools', key: 'form.tools', label: () => tr('Tools & Heavy Tools'), hint: () => tr('Fill in the tools checklist') },
];

export default function BottomNav({ onMenu }: { onMenu: () => void }) {
  const pathname = usePathname();
  const { user } = useAuth();
  const [forms, setForms] = useState(false);
  useEffect(() => setForms(false), [pathname]);
  if (!user) return null;
  const ready = (key: string) => PAGES.find((p) => p.key === key)?.state !== 'building';
  const formLinks = FORM_LINKS.filter((f) => ready(f.key) && canAccess(user, f.href));
  const tabs = [
    { href: '/overview', label: tr('Dashboard'), icon: LayoutDashboard },
    { href: '/sales', label: tr('Sales'), icon: Receipt },
    { href: '/stock-opname', label: tr('Stock Opname'), icon: ClipboardCheck },
  ].filter((t) => canAccess(user, t.href));
  const on = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const item = (active: boolean) => `flex min-w-0 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 pb-1 text-[10px] font-medium transition-colors ${
    active ? 'text-blue-700' : 'text-slate-500 active:text-slate-800'}`;

  return (
    <>
      <nav aria-label={tr('Main menu')} className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto flex h-16 max-w-xl items-stretch">
          {tabs.map((t) => (
            <Link key={t.href} href={t.href} className={item(on(t.href))} aria-current={on(t.href) ? 'page' : undefined}>
              <span className={`flex h-7 w-12 items-center justify-center rounded-full ${on(t.href) ? 'bg-blue-50' : ''}`}><t.icon size={20} strokeWidth={on(t.href) ? 2.2 : 1.8} /></span>
              <span className="truncate">{t.label}</span>
            </Link>
          ))}
          {formLinks.length > 0 && (
            <button type="button" onClick={() => setForms(true)} className={item(pathname.startsWith('/forms'))} aria-haspopup="dialog">
              <span className={`flex h-7 w-12 items-center justify-center rounded-full ${pathname.startsWith('/forms') ? 'bg-blue-50' : ''}`}><ClipboardPen size={20} strokeWidth={pathname.startsWith('/forms') ? 2.2 : 1.8} /></span>
              <span className="truncate">{tr('Form')}</span>
            </button>
          )}
          <button type="button" onClick={onMenu} className={item(false)} aria-label={tr('Open menu')}>
            <span className="flex h-7 w-12 items-center justify-center rounded-full"><Menu size={20} strokeWidth={1.8} /></span>
            <span className="truncate">{tr('Menu')}</span>
          </button>
        </div>
      </nav>

      {forms && (
        <div className="fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label={tr('Form')}>
          <button type="button" className="absolute inset-0 bg-slate-900/40" onClick={() => setForms(false)} aria-label={tr('Close')} />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl bg-white shadow-2xl" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-slate-200" aria-hidden />
            <div className="flex items-center justify-between px-4 pb-1 pt-3">
              <p className="text-base font-semibold text-slate-900">{tr('Form')}</p>
              <button type="button" onClick={() => setForms(false)} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100" aria-label={tr('Close')}><X size={18} /></button>
            </div>
            <ul className="px-2 pb-1">
              {formLinks.map((f) => (
                <li key={f.href}>
                  <Link href={f.href} className={`flex items-center gap-3 rounded-xl px-3 py-3 ${on(f.href) ? 'bg-blue-50' : 'active:bg-slate-50'}`}>
                    <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${on(f.href) ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'}`}><ClipboardPen size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-slate-900">{f.label()}</span>
                      <span className="block truncate text-xs text-slate-500">{f.hint()}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
