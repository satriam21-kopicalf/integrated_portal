'use client';

// The top bar of the portal on desktop (Jira-like, 2026-11-18, preview): where you are (group / page), a search that
// jumps to any page the account opens, the guide, the notifications bell and the account menu (avatar). Phones keep the
// app bar and the sidebar drawer.

import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createPortal } from 'react-dom';
import { Bell, ChevronRight, CircleHelp, Search } from 'lucide-react';
import { NotificationsDrawer, UnreadBadge, useNotifications } from '@/components/AlertBell';
import { cx } from '@/components/kc';
import { canAccess, inMenu, useAuth } from '@/lib/auth';
import { PAGES } from '@/lib/pages';
import { tr } from '@/lib/i18n';
import UserMenu from './sidebar/UserMenu';
import { CompanySwitch } from '@/lib/company';
import { brandInTopBar } from '@/components/CostControlBrand';

const iconButton = 'relative flex h-8 w-8 items-center justify-center rounded-full text-[color:var(--j-44546F)] transition-colors hover:bg-[color:var(--j-091E420F)] hover:text-[color:var(--j-172B4D)]';

export default function TopBar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const { enabled: canNotify, unread } = useNotifications();
  const [notes, setNotes] = useState(false);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const page = PAGES.filter((p) => pathname === p.href || pathname.startsWith(`${p.href}/`)).sort((a, b) => b.href.length - a.href.length)[0];
  const pages = useMemo(() => (user ? PAGES.filter((p) => p.state !== 'hidden' && p.state !== 'building' && canAccess(user, p.href) && (p.state === 'header' || inMenu(user, p.href))) : []), [user]);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (s ? pages.filter((p) => `${p.label} ${p.group}`.toLowerCase().includes(s)) : pages).slice(0, 12);
  }, [pages, q]);

  // "/" focuses the search, like Jira
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (e.key === '/' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(t.tagName) && !t.isContentEditable) { e.preventDefault(); input.current?.focus(); }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', down);
    return () => document.removeEventListener('mousedown', down);
  }, [open]);
  useEffect(() => { setHi(0); }, [q]);
  const go = (href: string) => { setOpen(false); setQ(''); input.current?.blur(); router.push(href); };

  if (!user) return null;
  return (
    <header className="sticky top-0 z-30 hidden h-12 flex-shrink-0 items-center gap-3 border-b border-[color:var(--j-DCDFE4)] bg-white px-5 lg:flex">
      <nav aria-label={tr('Breadcrumb')} className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {page && <><span className="truncate text-[color:var(--j-626F86)]">{page.group}</span><ChevronRight size={14} className="flex-shrink-0 text-[color:var(--j-8590A2)]" />
          <span className="truncate font-medium text-[color:var(--j-172B4D)]">{page.label}</span></>}
      </nav>
      {brandInTopBar(pathname) && <CompanySwitch compact className="ml-2 flex-shrink-0" />}
      <div ref={box} className="relative ml-auto w-full max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[color:var(--j-626F86)]" />
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, shown.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            if (e.key === 'Enter' && shown[hi]) go(shown[hi].href);
            if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
          }}
          placeholder={tr('Search pages')} aria-label={tr('Search pages')}
          className="h-8 w-full rounded-[4px] border border-[color:var(--j-8590A2)] bg-white pl-8 pr-8 text-[13px] outline-none transition-colors placeholder:text-[color:var(--j-626F86)] hover:bg-[color:var(--j-F7F8F9)] focus:border-[color:var(--j-0C66E4)] focus:ring-2 focus:ring-[color:var(--j-388BFF)]" />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-[color:var(--j-DCDFE4)] px-1 text-[10px] text-[color:var(--j-626F86)]">/</kbd>
        {open && (
          <div className="absolute right-0 top-full z-40 mt-1 w-full min-w-[22rem] overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white py-1 shadow-xl" role="listbox">
            <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-[color:var(--j-626F86)]">{q ? tr('Pages') : tr('Go to')}</p>
            {shown.length === 0 ? <p className="px-3 py-4 text-center text-xs text-[color:var(--j-626F86)]">{tr('No match')}</p> : shown.map((p, i) => (
              <button key={p.href} type="button" role="option" aria-selected={i === hi} onMouseEnter={() => setHi(i)} onClick={() => go(p.href)}
                className={cx('relative flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]', i === hi ? 'bg-[color:var(--j-E9F2FF)] text-[color:var(--j-0055CC)] before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:bg-[color:var(--j-0C66E4)]' : 'text-[color:var(--j-172B4D)]')}>
                <span className="min-w-0 flex-1 truncate">{p.label}</span><span className="flex-shrink-0 text-[11px] text-[color:var(--j-626F86)]">{p.group}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex flex-shrink-0 items-center gap-1">
        {canAccess(user, '/guide') && <button type="button" onClick={() => router.push('/guide')} className={iconButton} aria-label={tr('Guide')} title={tr('Guide')}><CircleHelp size={18} /></button>}
        {canNotify && (
          <button type="button" onClick={() => setNotes(true)} className={iconButton} aria-label={tr('Notifications')} title={tr('Notifications')}>
            <Bell size={18} />{unread > 0 && <UnreadBadge n={unread} className="absolute -right-0.5 -top-0.5 ring-2 ring-white" />}
          </button>
        )}
        <UserMenu collapsed={false} placement="top" />
      </div>
      {canNotify && notes && createPortal(<NotificationsDrawer open onClose={() => setNotes(false)} />, document.body)}
    </header>
  );
}
