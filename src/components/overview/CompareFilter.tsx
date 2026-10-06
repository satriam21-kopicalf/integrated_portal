'use client';

import { useCallback, useRef, useState } from 'react';
import { Check, GitCompareArrows } from 'lucide-react';
import DateRangePicker from '@/components/DateRangePicker';
import { formatDate, toIsoDate } from '@/lib/format';
import { useClickOutside } from '@/lib/useClickOutside';

export type CompareMode = 'auto' | 'month' | 'year' | 'custom';

export interface CompareValue {
  mode: CompareMode;
  /** custom only */
  from: string;
  to: string;
}

export const NO_COMPARE: CompareValue = { mode: 'auto', from: '', to: '' };

/** Same calendar dates `months` earlier; days past the end of a shorter month land on its last day. */
function shiftMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00`);
  const target = new Date(d.getFullYear(), d.getMonth() + months, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d.getDate(), last));
  return toIsoDate(target);
}

/** The comparison period to send (null = the API default: the period of the same length just before). */
export function compareRange(value: CompareValue, period: { from: string; to: string } | null): { from: string; to: string } | null {
  if (value.mode === 'custom' && value.from) return { from: value.from, to: value.to || value.from };
  if (!period || (value.mode !== 'month' && value.mode !== 'year')) return null;
  const n = value.mode === 'month' ? -1 : -12;
  return { from: shiftMonths(period.from, n), to: shiftMonths(period.to, n) };
}

const OPTIONS: { mode: CompareMode; label: string; hint: string }[] = [
  { mode: 'auto', label: 'Previous period', hint: 'The same number of days just before the selected period' },
  { mode: 'month', label: 'Same dates last month', hint: 'e.g. 1–10 Sep vs 1–10 Aug · month to date vs last month to date' },
  { mode: 'year', label: 'Same dates last year', hint: 'e.g. 1–10 Sep 2026 vs 1–10 Sep 2025' },
  { mode: 'custom', label: 'Custom period', hint: 'Any period, also of another length' },
];

/**
 * Comparison filter of the Overview: every "vs previous" figure (KPIs, trend, growth,
 * channels, branches, basket, busy hours, deductions…) uses the chosen period.
 */
export default function CompareFilter({ value, period, onChange }: {
  value: CompareValue;
  /** the selected (or default) period, for "last month / last year" */
  period: { from: string; to: string } | null;
  onChange: (v: CompareValue) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  const range = compareRange(value, period);
  const label = value.mode === 'auto' || !range ? 'vs previous period' : `vs ${formatDate(range.from)} – ${formatDate(range.to)}`;
  const active = value.mode !== 'auto';

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} title={`Compare with: ${label.replace('vs ', '')}`}
        className={`inline-flex h-10 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition-colors ${
          active ? 'border-slate-900 bg-slate-900 text-white hover:bg-slate-800' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
        }`}>
        <GitCompareArrows size={16} />
        <span className="hidden max-w-[14rem] truncate xl:inline">{label}</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Compare with</p>
          {OPTIONS.map(o => {
            const on = value.mode === o.mode;
            const r = o.mode === 'month' || o.mode === 'year' ? compareRange({ mode: o.mode, from: '', to: '' }, period) : null;
            return (
              <button key={o.mode} type="button" onClick={() => {
                if (o.mode === 'custom') onChange({ mode: 'custom', from: value.from, to: value.to });
                else { onChange({ mode: o.mode, from: '', to: '' }); close(); }
              }}
                className={`flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors ${on ? 'bg-slate-900/[0.04]' : 'hover:bg-slate-50'}`}>
                <span className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${on ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300'}`}>
                  {on && <Check size={10} strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-slate-800">{o.label}</span>
                  <span className="block text-xs text-slate-500">{r ? `${formatDate(r.from)} – ${formatDate(r.to)}` : o.hint}</span>
                </span>
              </button>
            );
          })}
          {value.mode === 'custom' && (
            <div className="mt-1 border-t border-slate-100 px-2.5 pb-1 pt-2.5">
              <p className="mb-1.5 text-xs text-slate-500">Comparison period</p>
              <DateRangePicker dateFrom={value.from} dateTo={value.to} defaultLabel="pick a period"
                onChange={(from, to) => onChange({ mode: 'custom', from, to: to || from })} />
              {!value.from && <p className="mt-1.5 text-[11px] text-amber-700">Until a period is picked, the previous period is used.</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
