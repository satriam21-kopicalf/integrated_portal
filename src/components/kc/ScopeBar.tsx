'use client';

// The filters of a page in one place (2026-11-02): what is chosen shown as pills (pool, day, status …) — a tap opens the
// filter drawer (so/ui MonitorFilters) — a Filters button with the number of filters narrowing the data, and an
// optional refresh. The page keeps its own state; this is only the bar. Day / month fields for the drawer below.

import { CalendarDays, ChevronDown, RefreshCw, SlidersHorizontal } from 'lucide-react';
import type { ReactNode } from 'react';
import { inputClass } from '@/so/ui';
import { wibDay } from '@/so/ui/Filters';
import { tr } from '@/lib/i18n';
import { cx } from './index';

export type Scope = { key: string; icon: ReactNode; label: string; value: string; /** narrows the data (counted on the button) */ active?: boolean };

export function ScopeBar({ scopes, onOpen, onRefresh, refreshing, right }: {
  scopes: Scope[]; onOpen: () => void; onRefresh?: () => void; refreshing?: boolean; right?: ReactNode;
}) {
  const count = scopes.filter((s) => s.active).length;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {scopes.map((s) => (
        <button key={s.key} type="button" onClick={onOpen} title={s.label}
          className={cx('inline-flex h-9 max-w-full items-center gap-2 rounded-lg border px-3 text-[13px] transition-colors',
            s.active ? 'border-brand-200 bg-brand-50 text-brand-800' : 'border-neutral-200 bg-white text-neutral-700 shadow-sm hover:bg-neutral-50')}>
          <span className={cx('flex-shrink-0 [&>svg]:h-4 [&>svg]:w-4', s.active ? 'text-brand-600' : 'text-neutral-400')}>{s.icon}</span>
          <span className="hidden text-neutral-500 sm:inline">{s.label}</span>
          <span className="truncate font-medium">{s.value}</span>
          <ChevronDown size={14} className="flex-shrink-0 text-neutral-400" />
        </button>
      ))}
      <button type="button" onClick={onOpen}
        className={cx('inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium shadow-sm transition-colors',
          count ? 'border-brand-700 bg-brand-700 text-white hover:bg-brand-800' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50')}>
        <SlidersHorizontal size={15} /> {tr('Filters')}
        {count > 0 && <span className="rounded-full bg-white/20 px-1.5 text-xs tabular-nums">{count}</span>}
      </button>
      {right}
      {onRefresh && (
        <button type="button" onClick={onRefresh} title={tr('Refresh')} aria-label={tr('Refresh')}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 shadow-sm hover:bg-neutral-50 hover:text-neutral-900">
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : undefined} />
        </button>
      )}
    </div>
  );
}

const quick = (on: boolean) => cx('rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors',
  on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-neutral-200 bg-white text-neutral-600 hover:border-neutral-300');

/** One day with quick picks (yesterday, today, tomorrow when `future`). */
export function DayField({ value, onChange, future, max }: { value: string; onChange: (v: string) => void; future?: boolean; max?: string }) {
  const picks = [{ label: tr('Yesterday'), v: wibDay(-1) }, { label: tr('Today'), v: wibDay(0) }, ...(future ? [{ label: tr('Tomorrow'), v: wibDay(1) }] : [])];
  return (
    <div className="space-y-2">
      <div className={cx('grid gap-1.5', future ? 'grid-cols-3' : 'grid-cols-2')}>
        {picks.map((p) => <button key={p.label} type="button" onClick={() => onChange(p.v)} aria-pressed={value === p.v} className={quick(value === p.v)}>{p.label}</button>)}
      </div>
      <span className="relative block">
        <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
        <input type="date" value={value} max={max} onChange={(e) => e.target.value && onChange(e.target.value)} className={cx(inputClass, 'pl-9')} aria-label={tr('Day')} />
      </span>
    </div>
  );
}

/** One month (YYYY-MM) with this month / last month. */
export function MonthField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const now = wibDay(0).slice(0, 7);
  const [y, m] = now.split('-').map(Number);
  const prev = m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-1.5">
        {[{ label: tr('This Month'), v: now }, { label: tr('Last Month'), v: prev }].map((p) => (
          <button key={p.label} type="button" onClick={() => onChange(p.v)} aria-pressed={value === p.v} className={quick(value === p.v)}>{p.label}</button>
        ))}
      </div>
      <input type="month" value={value} onChange={(e) => e.target.value && onChange(e.target.value)} className={inputClass} aria-label={tr('Month')} />
    </div>
  );
}

export const dmyOf = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');
