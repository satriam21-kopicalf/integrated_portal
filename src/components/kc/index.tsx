'use client';

// Kopi Calf design system, after kopicalf-hrms (Frappe-HR inspired, 2026-11-02): neutral surfaces, thin lines, the
// navy of Kopi Calf (`brand-*`, scripts/gen-theme.mjs) as the one accent, compact type. Import from '@/components/kc'.
// The redesign moves page by page: Sidebar, Management (User Accounts, Activity Logs) and Aggregator first; the other
// pages keep @/so/ui until their turn. Every class here also works in the dark theme (colours are CSS variables).
//
//   PageShell, PageHeader      the frame and the head of a page (title, subtitle, actions, logo / icon)
//   Card                       a section: title, subtitle, actions, toolbar, body, footer
//   StatGrid, StatCard         number cards (label, value, sub, tone, onClick / active)
//   Tabs                       underline tabs with counts (or logos)
//   Toolbar, SearchInput       search + filters + actions above a table
//   Pill                       a status / role badge
//   EmptyState, ErrorBlock     nothing to show / an error with retry
//   kcTable                    the classes of a list table (thead, rows)

import { tc } from '@/lib/title-case';
import { StatIcon } from './stat-icon';
import { AlertCircle, ArrowUpRight, Search, X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { tr } from '@/lib/i18n';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---------------------------------------------------------------- page */

/** The frame of a redesigned page: neutral background, centred content up to 1400 px. */
export function PageShell({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className="min-h-full bg-neutral-50">
      <div className={cx('mx-auto w-full max-w-[1400px] space-y-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-6', className)}>{children}</div>
    </div>
  );
}

/** Title, subtitle and actions of a page; `media` is a logo or an icon shown before the title. */
export function PageHeader({ title, subtitle, actions, media, eyebrow }: {
  title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; media?: ReactNode; eyebrow?: ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {media && <span className="flex h-10 min-w-10 flex-shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-white px-2 text-brand-700">{media}</span>}
        <div className="min-w-0">
          {eyebrow && <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">{tc(eyebrow)}</p>}
          <h1 className="text-2xl font-bold tracking-tight text-neutral-900">{tc(title)}</h1>
          {subtitle && <p className="mt-1 max-w-3xl text-sm text-neutral-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

/* ---------------------------------------------------------------- buttons */

type BtnTone = 'solid' | 'subtle' | 'outline' | 'ghost' | 'danger';
const BTN: Record<BtnTone, string> = {
  solid: 'bg-brand-700 text-white hover:bg-brand-800 shadow-sm',
  subtle: 'bg-neutral-100 text-neutral-800 hover:bg-neutral-200',
  outline: 'border border-neutral-200 bg-white text-neutral-800 hover:bg-neutral-50 shadow-sm',
  ghost: 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
};
/** Classes of a button (for <button>, <a>, <Link>): tone and size. */
export const btn = (tone: BtnTone = 'outline', size: 'sm' | 'md' = 'md') => cx(
  'inline-flex flex-shrink-0 items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50',
  size === 'sm' ? 'h-8 rounded-lg px-2.5 text-[13px]' : 'h-9 rounded-lg px-3.5 text-[13px]', BTN[tone]);

/** A square icon button with its label as tooltip and for screen readers. */
export function IconButton({ label, onClick, children, active }: { label: string; onClick?: () => void; children: ReactNode; active?: boolean }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label}
      className={cx('inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-colors',
        active ? 'border-brand-200 bg-brand-50 text-brand-700' : 'border-neutral-200 bg-white text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900')}>
      {children}
    </button>
  );
}

/* ---------------------------------------------------------------- card */

export function Card({ title, subtitle, actions, toolbar, footer, children, className, flush }: {
  title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; toolbar?: ReactNode; footer?: ReactNode; children?: ReactNode;
  className?: string; /** the body without padding (tables, lists) */ flush?: boolean;
}) {
  return (
    <section className={cx('overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-3 px-4 pb-2 pt-3.5 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold tracking-tight text-neutral-900">{tc(title)}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-neutral-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-1.5">{actions}</div>}
        </header>
      )}
      {toolbar && <div className={cx('px-4 pb-3 sm:px-5', !(title || actions) && 'pt-3.5')}>{toolbar}</div>}
      <div className={cx(!flush && 'px-4 pb-4 sm:px-5', !flush && !(title || actions || toolbar) && 'pt-4', flush && !!(title || actions || toolbar) && 'border-t border-neutral-100')}>{children}</div>
      {footer && <footer className="flex flex-col items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50/60 px-4 py-2.5 text-xs text-neutral-500 sm:flex-row sm:px-5">{footer}</footer>}
    </section>
  );
}

/* ---------------------------------------------------------------- numbers */

const COLS = { 2: 'lg:grid-cols-2', 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5', 6: 'lg:grid-cols-6' } as const;
export function StatGrid({ children, cols = 4, label }: { children: ReactNode; cols?: keyof typeof COLS; label?: string }) {
  return <div role="group" aria-label={label} className={cx('grid grid-cols-2 gap-3', COLS[cols])}>{children}</div>;
}

// 2026-11-16, as kopicalf-hrms StatCard (calm cards): a neutral icon chip on the left, label / value / note on the right;
// colour only for what needs attention (warn / bad), "good" and "brand" no longer colour the value.
const VALUE_TONE = { default: 'text-neutral-900', good: 'text-neutral-900', warn: 'text-amber-600', bad: 'text-red-600', brand: 'text-neutral-900' } as const;
const CHIP_TONE: Partial<Record<keyof typeof VALUE_TONE, string>> = { warn: 'bg-amber-50 text-amber-700', bad: 'bg-red-50 text-red-700' };
export type StatTone = keyof typeof VALUE_TONE;

/** The body of a number card (StatCard here, Stat in compat.tsx): icon chip, label, value, note. */
export function StatBody({ label, value, sub, icon, tone = 'default', info, title, valueClassName, arrow }: {
  label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: StatTone; info?: ReactNode; title?: string;
  valueClassName?: string; arrow?: boolean;
}) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative brand mark */}
      <img src="/assets/calf-logo.png" alt="" aria-hidden className="kc-mark pointer-events-none absolute -bottom-5 -right-4 h-20 w-20 rotate-[-12deg] select-none object-contain opacity-[0.04] grayscale" />
      {(
        <span className={cx('relative hidden h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg', longValue(value) ? '2xl:flex' : 'sm:flex', ' [&>svg]:h-4 [&>svg]:w-4', CHIP_TONE[tone] ?? 'bg-neutral-100 text-neutral-500')}>{icon ?? <StatIcon label={label} />}</span>)}
      <span className="relative min-w-0 flex-1">
        <span className="flex items-start justify-between gap-2">
          <span className="flex min-w-0 items-center gap-1 truncate text-xs font-medium text-neutral-500">{tc(label)}{info}</span>
          {arrow && <ArrowUpRight size={14} className="flex-shrink-0 text-neutral-300 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand-700" aria-hidden />}
        </span>
        <span title={title ?? (typeof value === 'string' ? value : undefined)}
          className={cx('mt-0.5 block font-bold leading-tight tracking-tight tabular-nums', valueClassName ?? cx('truncate', valueSize(value)), VALUE_TONE[tone])}>{value}</span>
        {sub && <span className="mt-1 block truncate text-xs text-neutral-400 [&_p]:truncate">{sub}</span>}
      </span>
    </>
  );
}

/** Long figures (Rp 13.098.829.000) step down so they fit the card instead of being cut. */
const longValue = (value: ReactNode) => (typeof value === 'string' || typeof value === 'number') && String(value).length > 15;

function valueSize(value: ReactNode): string {
  const n = typeof value === 'string' || typeof value === 'number' ? String(value).length : 0;
  return n > 15 ? 'text-base' : n > 11 ? 'text-lg sm:text-xl' : 'text-[22px]';
}

export const statCardClass = (active?: boolean, clickable?: boolean) => cx(
  'group relative flex h-full min-w-0 items-start gap-3.5 overflow-hidden rounded-2xl border bg-white p-3.5 text-left sm:p-4 shadow-sm transition-all duration-150',
  active ? 'border-brand-300 ring-2 ring-brand-600/15' : 'border-neutral-200',
  clickable && 'cursor-pointer hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-md');

/** A number card; clickable when `onClick` is given (e.g. a quick filter), highlighted when `active`. */
export function StatCard({ label, value, sub, icon, tone = 'default', onClick, active }: {
  label: ReactNode; value: ReactNode; sub?: ReactNode; icon?: ReactNode; tone?: StatTone; onClick?: () => void; active?: boolean;
}) {
  const body = <StatBody label={label} value={value} sub={sub} icon={icon} tone={tone} arrow={!!onClick} />;
  const cls = statCardClass(active, !!onClick);
  return onClick ? <button type="button" onClick={onClick} aria-pressed={active} className={cls}>{body}</button> : <div className={cls}>{body}</div>;
}

/** The shimmer of a value still loading. */
export const ValueSkeleton = () => <span className="skeleton inline-block h-7 w-16 rounded-md align-middle" aria-hidden />;

/* ---------------------------------------------------------------- tabs */

export type TabItem = { key: string; label: ReactNode; count?: ReactNode; title?: string };
/** Underline tabs; a tab may be a logo (label = <img>) with its name as `title`. */
/** `variant="card"`: the page-level tab bar of kopicalf-hrms, in a white card; the default underline bar sits inside cards. */
export function Tabs({ tabs, value, onChange, label, className, variant = 'line' }: { tabs: TabItem[]; value: string; onChange: (k: string) => void; label: string; className?: string; variant?: 'line' | 'card' }) {
  // the chosen tab stays in sight when the bar scrolls sideways (phones, 2026-11-10)
  const bar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = bar.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    const box = bar.current;
    if (!el || !box || box.scrollWidth <= box.clientWidth) return;
    box.scrollTo({ left: el.offsetLeft - (box.clientWidth - el.offsetWidth) / 2, behavior: 'smooth' });
  }, [value]);
  return (
    <div ref={bar} role="tablist" aria-label={label}
      className={cx('flex gap-x-5 overflow-x-auto', variant === 'card' ? 'rounded-2xl border border-neutral-200/70 bg-white px-4 pt-3 shadow-[0_1px_2px_0_rgb(15_23_42/0.04)] sm:px-5' : 'border-b border-neutral-200 px-1 pt-1.5', className)}>
      {tabs.map((t) => {
        const on = t.key === value;
        return (
          <button key={t.key} type="button" role="tab" aria-selected={on} title={t.title} aria-label={t.title} onClick={() => onChange(t.key)}
            className={cx('relative flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap pb-2.5 pt-1 text-sm font-medium transition-colors',
              on ? 'text-brand-700' : 'text-neutral-500 hover:text-neutral-900')}>
            {tc(t.label)}
            {t.count !== undefined && t.count !== null && (
              <span className="rounded-full bg-neutral-100 px-1.5 text-[11px] font-semibold tabular-nums text-neutral-500">{t.count}</span>
            )}
            {on && <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-700" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------- toolbar */

export function SearchInput({ value, onChange, placeholder, label }: { value: string; onChange: (v: string) => void; placeholder: string; label?: string }) {
  return (
    <div className="relative min-w-0 flex-1 basis-56">
      <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={label ?? placeholder}
        className="h-9 w-full rounded-[4px] border border-neutral-300 bg-white pl-9 pr-8 text-[13px] text-neutral-900 placeholder:text-neutral-500 transition-colors hover:bg-neutral-50 focus:border-brand-600 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-100" />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label={tr('Clear Search')} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-neutral-400 hover:text-neutral-700"><X size={14} /></button>
      )}
    </div>
  );
}

/** One row above a table: search (left, grows), filters and actions (right); chips of the filters in use below. */
export function Toolbar({ search, children, chips }: { search?: ReactNode; children?: ReactNode; chips?: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">{search}{children}</div>
      {chips}
    </div>
  );
}

/* ---------------------------------------------------------------- pills */

const PILL = {
  gray: 'bg-neutral-100 text-neutral-600', brand: 'bg-brand-50 text-brand-700', green: 'bg-emerald-50 text-emerald-700',
  amber: 'bg-amber-50 text-amber-700', red: 'bg-red-50 text-red-700', violet: 'bg-violet-50 text-violet-700', teal: 'bg-teal-50 text-teal-700',
} as const;
export type PillTone = keyof typeof PILL;
export function Pill({ tone = 'gray', icon, dot, children, title, className }: {
  tone?: PillTone; icon?: ReactNode; dot?: boolean; children: ReactNode; title?: string; className?: string;
}) {
  return (
    <span title={title} className={cx('inline-flex max-w-full items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', PILL[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-current opacity-70" />}
      {icon}{children}
    </span>
  );
}

/* ---------------------------------------------------------------- states */

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      {icon && <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-neutral-100 text-neutral-400">{icon}</span>}
      <p className="text-sm font-medium text-neutral-800">{tc(title)}</p>
      {children && <div className="mt-1 max-w-md text-[13px] text-neutral-500">{children}</div>}
    </div>
  );
}

export function ErrorBlock({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-14 text-center">
      <AlertCircle className="text-red-500" />
      <p className="text-sm text-neutral-700">{message}</p>
      {onRetry && <button type="button" className={btn('outline', 'sm')} onClick={onRetry}>{tr('Try Again')}</button>}
    </div>
  );
}

/* ---------------------------------------------------------------- tables */

/** The classes of a list table: a quiet head and thin row lines. */
// as the kopicalf-hrms DataTable (2026-11-16): a grey head with rounded ends, sentence-case labels, 12 px text
export const kcTable = {
  table: 'w-full text-xs',
  thead: 'bg-neutral-50/90 text-left text-xs font-semibold capitalize text-neutral-500 [&_th:first-child]:rounded-l-xl [&_th:last-child]:rounded-r-xl',
  th: 'whitespace-nowrap px-4 py-3 font-semibold',
  tbody: 'divide-y divide-neutral-100',
  row: 'group transition-colors hover:bg-neutral-50/70',
  td: 'px-4 py-3.5 align-middle font-medium text-neutral-700',
};
