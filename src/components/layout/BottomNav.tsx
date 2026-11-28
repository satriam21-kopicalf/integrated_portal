'use client';

// Phones & tablets: the tab bar at the foot of the screen (2026-11-28: a flat Jira bar; it floated before) — Dashboard, Sales, Stock Opname, Form (a sheet with the forms the user
// fills) and Menu (the full sidebar). The chosen tab floats: a blue bubble rises out of the bar and slides to the tab with
// a small spring (same design as Kopi Calf Operations, 2026-10-25). Hidden while a form is being filled (focus mode), so
// the send bar of the form has the bottom of the screen.

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useState } from 'react';
import { ChevronRight, ClipboardCheck, ClipboardPen, LayoutDashboard, MapPinCheck, Menu, Package, Receipt, ShieldCheck, Store, Wallet, Wrench, X, type LucideIcon, UserRoundCheck } from 'lucide-react';
import { inMenu, useAuth } from '@/lib/auth';
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
  { href: '/forms/surveyor-check-in', key: 'form.surveyor-check-in', icon: UserRoundCheck, label: () => tr('Cost Control Clock In'), hint: () => tr('Cost Control visit to the outlet') },
  { href: '/forms/product', key: 'form.product', icon: Package, label: () => 'Product', hint: () => tr('Fill in the product checklist') },
  { href: '/forms/outlet', key: 'form.outlet', icon: Store, label: () => 'Outlet', hint: () => tr('Fill in the outlet checklist') },
  { href: '/forms/damaged-equipment', key: 'form.damaged-equipment', icon: Wrench, label: () => 'Maintenance', hint: () => tr('Repair & procurement requests') },
  { href: '/forms/pengajuan', key: 'form.pengajuan', icon: Wallet, label: () => tr('Fund Request'), hint: () => tr('Petty cash with receipts') },
  { href: '/forms/wwwr', key: 'form.wwwr', icon: ShieldCheck, label: () => 'WW-WR', hint: () => tr('SWAT audit of the outlet') },
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
  const formLinks = FORM_LINKS.filter((f) => ready(f.key) && inMenu(user, f.href));
  const on = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const tabs: Tab[] = [
    ...[
      { href: '/overview', label: tr('Dashboard'), icon: LayoutDashboard },
      { href: '/sales', label: tr('Sales'), icon: Receipt },
      { href: '/stock-opname', label: 'Opname', icon: ClipboardCheck },
    ].filter((t) => inMenu(user, t.href)).map((t) => ({ ...t, key: t.href, active: on(t.href) })),
    ...(formLinks.length ? [{ key: 'form', label: tr('Form'), icon: ClipboardPen, onClick: () => setForms(true), active: forms || pathname.startsWith('/forms') }] : []),
    { key: 'menu', label: tr('Menu'), icon: Menu, onClick: onMenu, active: false },
  ];

  return (
    <>
      {/* 2026-11-28 the Jira look: a flat bar over the whole width, the chosen tab in the brand colour with a bar on top */}
      <nav aria-label={tr('Main menu')} className="fixed inset-x-0 bottom-0 z-40 border-t border-[color:var(--j-DCDFE4)] bg-white/95 backdrop-blur lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="mx-auto flex h-14 max-w-xl items-stretch">
          {tabs.map((t) => {
            const inner = (
              <>
                {t.active && <span aria-hidden className="absolute inset-x-3 top-0 h-[3px] rounded-b-[3px] bg-[color:var(--j-0C66E4)]" />}
                <t.icon size={21} strokeWidth={t.active ? 2.2 : 1.8} className={t.active ? 'text-[color:var(--j-0C66E4)]' : 'text-[color:var(--j-626F86)]'} />
                <span className={`max-w-full truncate px-0.5 text-[11px] leading-none ${t.active ? 'font-semibold text-[color:var(--j-0C66E4)]' : 'font-medium text-[color:var(--j-626F86)]'}`}>{t.label}</span>
              </>
            );
            const cls = 'relative flex min-w-0 flex-1 flex-col items-center justify-center gap-1 outline-none transition-colors active:bg-[color:var(--j-091E420F)] focus-visible:bg-[color:var(--j-091E420F)]';
            return t.href ? (
              <Link key={t.key} href={t.href} className={cls} aria-current={t.active ? 'page' : undefined}>{inner}</Link>
            ) : (
              <button key={t.key} type="button" onClick={t.onClick} className={cls} aria-haspopup="dialog" aria-label={t.key === 'menu' ? tr('Open Menu') : undefined}>{inner}</button>
            );
          })}
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
      <button type="button" className="drawer-backdrop absolute inset-0 bg-neutral-900/40" onClick={onClose} aria-label={tr('Close')} />
      <div className="sheet-panel absolute inset-x-0 bottom-0 mx-auto flex max-h-[85dvh] max-w-3xl flex-col rounded-t-[8px] bg-white shadow-2xl">
        <div className="flex-shrink-0 rounded-t-[8px] border-b border-[color:var(--j-DCDFE4)] bg-white px-5 pb-3 pt-2.5">
          <div className="mx-auto h-1 w-9 rounded-full bg-[color:var(--j-8590A2)]" aria-hidden />
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <p className="text-base font-semibold text-[color:var(--j-172B4D)]">{tr('Form')} <span className="ml-1 text-sm font-normal text-[color:var(--j-626F86)]">{links.length}</span></p>
            <button type="button" onClick={onClose} className="-mr-1.5 flex h-9 w-9 items-center justify-center rounded-full text-[color:var(--j-626F86)] active:bg-[color:var(--j-091E420F)]" aria-label={tr('Close')}><X size={18} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 pt-4" style={{ paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom))' }}>
          <ul className="grid gap-px overflow-hidden rounded-[3px] bg-[color:var(--j-091E420F)] ring-1 ring-[color:var(--j-DCDFE4)]/70 sm:grid-cols-2">
            {links.map((f) => {
              const here = on(f.href);
              return (
                <li key={f.href} className="bg-white">
                  <Link href={f.href} aria-current={here ? 'page' : undefined}
                    className={`flex min-h-[60px] items-center gap-3 px-3.5 py-2.5 transition-colors ${here ? 'bg-[color:var(--j-E9F2FF)]' : 'active:bg-[color:var(--j-F7F8F9)]'}`}>
                    <span className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[3px] ${here ? 'bg-[color:var(--j-0C66E4)] text-white' : 'bg-[color:var(--j-091E420F)] text-[color:var(--j-44546F)]'}`}><f.icon size={18} /></span>
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-semibold ${here ? 'text-[color:var(--j-0C66E4)]' : 'text-[color:var(--j-172B4D)]'}`}>{f.label()}</span>
                      <span className="block truncate text-xs text-[color:var(--j-626F86)]">{f.hint()}</span>
                    </span>
                    <ChevronRight size={16} className="flex-shrink-0 text-[color:var(--j-8590A2)]" />
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
