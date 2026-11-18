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

const iconButton = 'relative flex h-8 w-8 items-center justify-center rounded-full text-neutral-600 transition-colors hover:bg-neutral-100 hover:text-neutral-900';

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
    <header className="sticky top-0 z-30 hidden h-12 flex-shrink-0 items-center gap-3 border-b border-neutral-200 bg-white px-5 lg:flex">
      <nav aria-label={tr('Breadcrumb')} className="flex min-w-0 items-center gap-1.5 text-[13px]">
        {page && <><span className="truncate text-neutral-500">{page.group}</span><ChevronRight size={14} className="flex-shrink-0 text-neutral-300" />
          <span className="truncate font-medium text-neutral-900">{page.label}</span></>}
      </nav>
      <div ref={box} className="relative ml-auto w-full max-w-sm">
        <Search size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input ref={input} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, shown.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
            if (e.key === 'Enter' && shown[hi]) go(shown[hi].href);
            if (e.key === 'Escape') { setOpen(false); input.current?.blur(); }
          }}
          placeholder={tr('Search pages')} aria-label={tr('Search pages')}
          className="h-8 w-full rounded-[4px] border border-neutral-300 bg-white pl-8 pr-8 text-[13px] outline-none transition-colors placeholder:text-neutral-500 hover:bg-neutral-50 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20" />
        <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-neutral-200 px-1 text-[10px] text-neutral-400">/</kbd>
        {open && (
          <div className="absolute right-0 top-full z-40 mt-1 w-full min-w-[22rem] overflow-hidden rounded-md border border-neutral-200 bg-white py-1 shadow-xl" role="listbox">
            <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-neutral-500">{q ? tr('Pages') : tr('Go to')}</p>
            {shown.length === 0 ? <p className="px-3 py-4 text-center text-xs text-neutral-400">{tr('No match')}</p> : shown.map((p, i) => (
              <button key={p.href} type="button" role="option" aria-selected={i === hi} onMouseEnter={() => setHi(i)} onClick={() => go(p.href)}
                className={cx('relative flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px]', i === hi ? 'bg-brand-50 text-brand-800 before:absolute before:inset-y-1 before:left-0 before:w-[3px] before:bg-brand-700' : 'text-neutral-800')}>
                <span className="min-w-0 flex-1 truncate">{p.label}</span><span className="flex-shrink-0 text-[11px] text-neutral-400">{p.group}</span>
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
