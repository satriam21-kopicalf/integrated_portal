'use client';

// One module of the sidebar (Form, Cost Control, Monitoring, Monitoring COTR, Aggregator, Management): an entry that
// opens its pages in a panel beside the sidebar (centred on small screens), the pages as cards in sections (design after
// kopicalf-hrms). Cost Control shows the stock opname waiting for a review.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { BookOpen, ChevronRight, X } from 'lucide-react';
import { cx } from '@/components/kc';
import { canAccess, useAuth } from '@/lib/auth';
import { tr } from '@/lib/i18n';
import { type MenuSection, type PopupConfig, under } from './menu';
import { entryClass, entryIcon } from './parts';

export default function ModulePanel({ config, sections, pathname, collapsed, onNavigate }: {
  config: PopupConfig; sections: MenuSection[]; pathname: string; collapsed: boolean; onNavigate?: () => void;
}) {
  const Icon = config.icon;
  const { user } = useAuth();
  const guide = !!user && canAccess(user, '/guide');
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const current = sections.flatMap((s) => s.items).find((i) => under(pathname, i.href));

  // beside the sidebar on desktop, centred below 1024 px
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const r = button.current?.getBoundingClientRect();
      const h = panel.current?.offsetHeight ?? 420;
      if (!r || window.innerWidth < 1024) { setPos(null); return; }
      const w = panel.current?.offsetWidth ?? 640;
      setPos({ left: Math.max(12, Math.min(r.right + 10, window.innerWidth - w - 12)), top: Math.max(12, Math.min(r.top - 12, window.innerHeight - h - 12)) });
    };
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); button.current?.focus(); } };
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!panel.current?.contains(t) && !button.current?.contains(t)) setOpen(false);
    };
    document.addEventListener('keydown', key);
    document.addEventListener('mousedown', down);
    return () => { document.removeEventListener('keydown', key); document.removeEventListener('mousedown', down); };
  }, [open]);
  useEffect(() => { if (open) panel.current?.querySelector<HTMLElement>('a[aria-current="page"], a')?.focus(); }, [open]);

  // stock opname waiting for a decision, on Review (only for those who open Review)
  const [waiting, setWaiting] = useState<number | null>(null);
  const canReview = !!config.review && sections.some((sec) => sec.items.some((i) => i.badge === 'review'));
  useEffect(() => {
    if (!open || !canReview) return;
    const from = new Date(Date.now() + 7 * 3600e3 - 30 * 864e5).toISOString().slice(0, 10);
    fetch(`/api/so/counts?status=SUBMITTED&date_from=${from}`, { credentials: 'same-origin' })
      .then((r) => (r.ok ? r.json() : null))
      .then((b) => setWaiting(Array.isArray(b?.data) ? b.data.length : null))
      .catch(() => setWaiting(null));
  }, [open, canReview]);

  const go = () => { setOpen(false); onNavigate?.(); };
  const wide = sections.length > 4;
  const menu = (
    <div ref={panel} role="menu" aria-label={config.title}
      className={cx('fixed z-[80] flex max-h-[calc(100vh-1.5rem)] flex-col overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xl',
        wide ? 'w-[min(60rem,calc(100vw-2rem))]' : 'w-[min(40rem,calc(100vw-2rem))]',
        !pos && 'left-1/2 top-1/2 max-h-[85vh] -translate-x-1/2 -translate-y-1/2')}
      style={pos ? { left: pos.left, top: pos.top } : undefined}>
      <div className="flex flex-shrink-0 items-start gap-3 px-5 pb-3 pt-4">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-700"><Icon size={18} /></span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900">{config.title}</p>
          <p className="truncate text-xs text-neutral-500">{config.subtitle}</p>
        </div>
        {waiting !== null && waiting > 0 && (
          <Link href="/cost-control/reviews" onClick={go} className="hidden flex-shrink-0 items-center gap-1.5 rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-100 sm:inline-flex">
            {tr('{0} waiting for review', waiting)}
          </Link>
        )}
        <button type="button" onClick={() => setOpen(false)} className="rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label={tr('Close menu')}><X size={16} /></button>
      </div>
      <div className={cx('min-h-0 flex-1 gap-x-4 overflow-y-auto overscroll-contain px-5 pb-4 sm:columns-2', wide && 'lg:columns-3')}>
        {sections.map((section) => (
          <section key={section.title} className="mb-4 break-inside-avoid last:mb-0">
            <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-neutral-400" title={section.hint}>{section.title}</p>
            <ul className="space-y-1.5">
              {section.items.map((item) => {
                const ItemIcon = item.icon;
                const on = under(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link href={item.href} onClick={go} role="menuitem" aria-current={on ? 'page' : undefined}
                      className={cx('group flex items-center gap-3 rounded-xl border px-3 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-brand-200',
                        on ? 'border-brand-200 bg-brand-50' : 'border-neutral-200 hover:border-neutral-300 hover:bg-neutral-50')}>
                      {item.logo ? (
                        <span className="flex h-8 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-white px-2 ring-1 ring-neutral-200">
                          {/* eslint-disable-next-line @next/next/no-img-element -- small brand logo from public/assets */}
                          <img src={item.logo} alt="" className="max-h-4 max-w-full object-contain" />
                        </span>
                      ) : (
                        <span className={cx('flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg', on ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-500')}>
                          <ItemIcon size={15} strokeWidth={1.9} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className={cx('flex items-center gap-1.5 text-[13px]', on ? 'font-semibold text-brand-800' : 'font-medium text-neutral-900')}>
                          <span className="truncate">{item.name}</span>
                          {item.soon && <span className="rounded bg-neutral-100 px-1.5 py-px text-[10px] font-semibold uppercase text-neutral-500">{tr('Soon')}</span>}
                        </span>
                        <span className="block truncate text-xs text-neutral-500">{item.description}</span>
                      </span>
                      {item.badge === 'review' && waiting !== null && waiting > 0 && (
                        <span className="flex h-5 min-w-5 flex-shrink-0 items-center justify-center rounded-full bg-brand-700 px-1.5 text-[11px] font-semibold tabular-nums text-white">{waiting}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <div className="flex flex-shrink-0 items-center justify-between gap-3 border-t border-neutral-100 bg-neutral-50 px-5 py-2.5 text-xs text-neutral-500">
        <span className="truncate">{config.footer}</span>
        {guide && <Link href="/guide" onClick={go} className="inline-flex flex-shrink-0 items-center gap-1 font-medium text-brand-700 hover:underline"><BookOpen size={13} /> {tr('Guide')}</Link>}
      </div>
    </div>
  );

  return (
    <>
      <button ref={button} type="button" onClick={() => setOpen((o) => !o)} aria-haspopup="menu" aria-expanded={open}
        title={collapsed ? config.label : undefined} className={entryClass(!!current || open, collapsed)}>
        <Icon size={17} strokeWidth={1.9} className={entryIcon(!!current || open)} />
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate">{current ? current.name : config.label}</span>
              {current && <span className="block truncate text-[11px] font-normal text-neutral-400">{config.label}</span>}
            </span>
            <ChevronRight size={14} className="flex-shrink-0 text-neutral-400" />
          </>
        )}
      </button>
      {open && createPortal(
        <>
          {!pos && <div className="fixed inset-0 z-[75] bg-neutral-900/40 dark:bg-black/60" aria-hidden="true" />}
          {menu}
        </>,
        document.body,
      )}
    </>
  );
}
