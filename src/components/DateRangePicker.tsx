'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatDate, toIsoDate } from '@/lib/format';
import { useClickOutside } from '@/lib/useClickOutside';
import { locale, tr, trList } from '@/lib/i18n';

interface DateRangePickerProps {
  dateFrom: string;
  dateTo: string;
  /** Called once per change with the full range ('' = no bound). */
  onChange: (dateFrom: string, dateTo: string) => void;
  /** Shortcut ranges; default: Today .. Last month. */
  presets?: () => DatePreset[];
  /** What an empty range means, e.g. "last 65 days". */
  defaultLabel?: string;
}

export interface DatePreset {
  label: string;
  from: string;
  to: string;
}

const WEEK_DAYS = trList(['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

function defaultPresets(): DatePreset[] {
  const today = new Date();
  const d = (offset: number) => {
    const x = new Date(today);
    x.setDate(x.getDate() + offset);
    return toIsoDate(x);
  };
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const firstOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const lastOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
  return [
    { label: tr('Today'), from: d(0), to: d(0) },
    { label: tr('Yesterday'), from: d(-1), to: d(-1) },
    { label: tr('Last 7 days'), from: d(-6), to: d(0) },
    { label: tr('Last 30 days'), from: d(-29), to: d(0) },
    { label: tr('Month to date'), from: toIsoDate(firstOfMonth), to: d(0) },
    { label: tr('Last month'), from: toIsoDate(firstOfLastMonth), to: toIsoDate(lastOfLastMonth) },
    { label: tr('Year to date'), from: toIsoDate(new Date(today.getFullYear(), 0, 1)), to: d(0) },
  ];
}

export default function DateRangePicker({
  dateFrom, dateTo, onChange, presets = defaultPresets, defaultLabel = 'last 65 days',
}: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [month, setMonth] = useState(() => {
    const base = dateTo || dateFrom ? new Date(`${dateTo || dateFrom}T00:00:00`) : new Date();
    return new Date(base.getFullYear(), base.getMonth(), 1);
  });
  // first click picks the start, second click the end
  const [pendingFrom, setPendingFrom] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setPendingFrom(null);
  }, []);
  useClickOutside(ref, close, isOpen);

  const active = Boolean(dateFrom || dateTo);
  const ranges = useMemo(() => presets(), [presets]);

  const days = useMemo(() => {
    const first = new Date(month.getFullYear(), month.getMonth(), 1);
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const lead = (first.getDay() + 6) % 7; // Monday-first grid
    return [...Array(lead).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)] as (number | null)[];
  }, [month]);

  const iso = (day: number) => toIsoDate(new Date(month.getFullYear(), month.getMonth(), day));
  const today = toIsoDate(new Date());
  const rangeFrom = pendingFrom ?? dateFrom;
  const rangeTo = pendingFrom ? '' : dateTo;

  const pick = (day: number) => {
    const value = iso(day);
    if (!pendingFrom) {
      setPendingFrom(value);
      return;
    }
    const [from, to] = value < pendingFrom ? [value, pendingFrom] : [pendingFrom, value];
    onChange(from, to);
    close();
  };

  const applyPreset = (from: string, to: string) => {
    onChange(from, to);
    setMonth(new Date(`${to}T00:00:00`));
    close();
  };

  const label = active ? `${formatDate(dateFrom) !== '-' ? formatDate(dateFrom) : '…'} – ${formatDate(dateTo) !== '-' ? formatDate(dateTo) : '…'}` : tr('Date range: {0}', defaultLabel);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
          active || isOpen
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
        }`}
        title={label}
        aria-label={label}
        aria-expanded={isOpen}
      >
        <CalendarDays size={18} strokeWidth={1.75} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{tr('Date range')}</p>
              <p className="text-xs text-slate-500">
                {pendingFrom ? tr('From {0} — select end date', formatDate(pendingFrom)) : active ? label : tr('Default: {0}', defaultLabel)}
              </p>
            </div>
            {active && (
              <button
                type="button"
                onClick={() => { onChange('', ''); close(); }}
                className="rounded-md px-2 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                {tr('Clear')}
              </button>
            )}
          </div>

          <div className="flex flex-col sm:flex-row">
            {/* Presets */}
            <div className="flex gap-1 overflow-x-auto border-b border-slate-100 p-2 sm:w-32 sm:flex-col sm:overflow-visible sm:border-b-0 sm:border-r">
              {ranges.map(r => {
                const selected = r.from === dateFrom && r.to === dateTo;
                return (
                  <button
                    key={r.label}
                    type="button"
                    onClick={() => applyPreset(r.from, r.to)}
                    className={`whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                      selected ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>

            {/* Calendar */}
            <div className="flex-1 p-3">
              <div className="mb-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label={tr('Previous month')}
                >
                  <ChevronLeft size={16} />
                </button>
                <span className="text-sm font-semibold text-slate-900">
                  {month.toLocaleDateString(locale(), { month: 'long', year: 'numeric' })}
                </span>
                <button
                  type="button"
                  onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
                  className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  aria-label={tr('Next month')}
                >
                  <ChevronRight size={16} />
                </button>
              </div>

              <div className="grid grid-cols-7 text-center">
                {WEEK_DAYS.map(d => (
                  <div key={d} className="py-1 text-[11px] font-medium text-slate-400">{d}</div>
                ))}
                {days.map((day, i) => {
                  if (day === null) return <div key={`blank-${i}`} />;
                  const value = iso(day);
                  const isEdge = value === rangeFrom || value === rangeTo;
                  const inRange = Boolean(rangeFrom && rangeTo && value > rangeFrom && value < rangeTo);
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => pick(day)}
                      className={`h-9 text-sm transition-colors ${
                        isEdge
                          ? 'rounded-md bg-slate-900 font-semibold text-white'
                          : inRange
                          ? 'bg-slate-100 text-slate-900'
                          : `rounded-md hover:bg-slate-100 ${value === today ? 'font-semibold text-blue-600' : 'text-slate-700'}`
                      }`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
