'use client';

// Filters of the Cost Control pages (2026-10-17): every filter of a page sits in one drawer opened by one "Filters"
// button; the toolbar keeps the search, the button with the number of filters in use and their removable chips.
// Dates are WIB (the business day of every outlet and hub).

import { ReactNode } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button, cx, inputClass } from '@/so/ui';
import Drawer from '@/so/ui/Drawer';
import { ActiveFilter, ActiveFilters, FilterButton } from '@/so/ui/FilterControls';
import { tr } from '@/lib/i18n';

export type { ActiveFilter } from '@/so/ui/FilterControls';
export { ChoiceGroup, SearchChoice } from '@/so/ui/FilterControls';

/** YYYY-MM-DD in WIB, `offset` days from today. */
export function wibDay(offset = 0): string {
  const d = new Date(Date.now() + offset * 864e5);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** "17/10/2026" */
export const dmy = (iso: string) => (iso ? iso.split('-').reverse().join('/') : '');

/** Search box + one Filters button + the chips of the filters in use. */
export function FilterToolbar({ search, onSearch, placeholder, filters, onOpen, onClear, extra }: {
  search?: string;
  onSearch?: (v: string) => void;
  placeholder?: string;
  filters: ActiveFilter[];
  onOpen: () => void;
  onClear: () => void;
  /** e.g. a view switch, after the Filters button */
  extra?: ReactNode;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {onSearch && (
          <div className="relative min-w-0 flex-1 basis-56">
            <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" />
            </svg>
            <input value={search ?? ''} onChange={(e) => onSearch(e.target.value)} placeholder={placeholder} aria-label={placeholder}
              className={cx(inputClass, 'h-10 pl-9')} />
          </div>
        )}
        <FilterButton count={filters.length} onClick={onOpen} />
        {extra}
      </div>
      <ActiveFilters filters={filters} onClear={onClear} />
    </div>
  );
}

/** The drawer holding every filter of a page: Reset · Cancel · Apply. */
export function FilterSheet({ title, description, onClose, onReset, onApply, children, applyDisabled }: {
  title?: string;
  description?: string;
  onClose: () => void;
  onReset: () => void;
  onApply: () => void;
  children: ReactNode;
  applyDisabled?: boolean;
}) {
  return (
    <Drawer open onClose={onClose} size="sm" title={title ?? tr('Filters')} description={description} focusFirstField={false}
      footer={
        <>
          <button type="button" onClick={onReset}
            className="mr-auto inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900">
            <RotateCcw size={14} /> {tr('Reset')}
          </button>
          <Button variant="secondary" onClick={onClose}>{tr('Cancel')}</Button>
          <Button onClick={onApply} disabled={applyDisabled}>{tr('Apply')}</Button>
        </>
      }>
      <div className="space-y-7">{children}</div>
    </Drawer>
  );
}

/** A titled group inside the filter drawer. */
export function FilterSection({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="space-y-2.5">
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
        {hint && <p className="mt-0.5 text-xs text-slate-400">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

const chip = (on: boolean) => cx('h-9 rounded-lg border px-2 text-xs font-medium transition-colors',
  on ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300');

/** One day with quick picks (today, yesterday …). */
export function DayField({ value, onChange, picks }: { value: string; onChange: (v: string) => void; picks?: { label: string; value: string }[] }) {
  const quick = picks ?? [{ label: tr('Today'), value: wibDay(0) }, { label: tr('Yesterday'), value: wibDay(-1) }, { label: tr('2 days ago'), value: wibDay(-2) }];
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {quick.map((p) => <button key={p.label} type="button" onClick={() => onChange(p.value)} aria-pressed={value === p.value} className={chip(value === p.value)}>{p.label}</button>)}
      </div>
      <input type="date" value={value} max={wibDay(0)} onChange={(e) => e.target.value && onChange(e.target.value)} className={cx(inputClass, 'h-10')} aria-label={tr('Day')} />
    </div>
  );
}

export type Period = { from: string; to: string };

/** A period with WIB presets (today, last 7 days, this month …) and a custom range. */
export function PeriodField({ value, onChange, presets, maxDays }: {
  value: Period; onChange: (v: Period) => void; presets?: { label: string; value: Period }[]; maxDays?: number;
}) {
  const today = wibDay(0);
  const [y, m] = today.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const prevFirst = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
  const prevLast = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
  const list = presets ?? [
    { label: tr('Today'), value: { from: today, to: today } },
    { label: tr('Last 7 days'), value: { from: wibDay(-6), to: today } },
    { label: tr('Last 30 days'), value: { from: wibDay(-29), to: today } },
    { label: tr('This month'), value: { from: first, to: today } },
    { label: tr('Last month'), value: { from: prevFirst, to: prevLast } },
    { label: tr('Last 90 days'), value: { from: wibDay(-89), to: today } },
  ];
  const days = Math.round((Date.parse(value.to) - Date.parse(value.from)) / 864e5) + 1;
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-3 gap-1.5">
        {list.map((p) => {
          const on = p.value.from === value.from && p.value.to === value.to;
          return <button key={p.label} type="button" onClick={() => onChange(p.value)} aria-pressed={on} className={chip(on)}>{p.label}</button>;
        })}
      </div>
      <div className="flex items-center gap-2">
        <input type="date" value={value.from} max={value.to} aria-label={tr('From')} className={cx(inputClass, 'h-10')}
          onChange={(e) => e.target.value && onChange({ from: e.target.value, to: value.to < e.target.value ? e.target.value : value.to })} />
        <span className="text-slate-400">–</span>
        <input type="date" value={value.to} min={value.from} max={today} aria-label={tr('To')} className={cx(inputClass, 'h-10')}
          onChange={(e) => e.target.value && onChange({ from: value.from > e.target.value ? e.target.value : value.from, to: e.target.value })} />
      </div>
      <p className={cx('text-xs', maxDays && days > maxDays ? 'text-red-600' : 'text-slate-500')}>
        {dmy(value.from)} – {dmy(value.to)} · {tr('{0} days', days)}{maxDays && days > maxDays ? ` · ${tr('at most {0} days', maxDays)}` : ''}
      </p>
    </div>
  );
}

/** A stacked bar of parts (status distribution) with a legend; shares of the total. */
export function SegmentBar({ parts, total }: { parts: { label: string; value: number; color: string }[]; total?: number }) {
  const sum = total ?? parts.reduce((a, p) => a + p.value, 0);
  if (!sum) return <div className="h-2 rounded-full bg-slate-100" />;
  return (
    <div className="space-y-2">
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(', ')}>
        {parts.filter((p) => p.value > 0).map((p) => <span key={p.label} className={p.color} style={{ width: `${(p.value / sum) * 100}%` }} />)}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600">
        {parts.map((p) => (
          <span key={p.label} className="inline-flex items-center gap-1.5">
            <span className={cx('h-2 w-2 rounded-full', p.color)} />{p.label} <span className="font-semibold tabular-nums text-slate-900">{p.value}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
