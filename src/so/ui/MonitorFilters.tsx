'use client';

// The filter drawer of the Monitoring pages (Product, Outlet, PIC Check In; 2026-11-03): one flat list of filters, each
// a row with its icon, its name, what is chosen and a "clear" link; quick periods in one row with the dates folded
// away; small choices as a segmented switch; long lists (outlet, PIC) as a dropdown with a search box. The footer shows
// how many filters are in use: Reset · Show results.

import { CalendarDays, Check, ChevronDown, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Button, cx, inputClass } from '@/so/ui';
import Drawer from '@/so/ui/Drawer';
import { type Period, dmy, wibDay } from '@/so/ui/Filters';
import { tr } from '@/lib/i18n';

export function MonitorFilterSheet({ active, onClose, onReset, onApply, applyDisabled, children }: {
  /** filters in use in the draft (shown in the footer) */ active: number;
  onClose: () => void; onReset: () => void; onApply: () => void; applyDisabled?: boolean; children: ReactNode;
}) {
  return (
    <Drawer open onClose={onClose} size="sm" icon={<SlidersHorizontal size={18} />} title={tr('Filters')}
      description={tr('Narrow the data, then show the results')} focusFirstField={false}
      footer={
        <>
          <button type="button" onClick={onReset} disabled={!active}
            className="mr-auto inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent">
            <RotateCcw size={14} /> {tr('Reset all')}
          </button>
          <Button onClick={onApply} disabled={applyDisabled} className="min-w-[9rem]">
            {tr('Show results')}{active > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs tabular-nums">{active}</span>}
          </Button>
        </>
      }>
      <div className="-mx-1 divide-y divide-slate-100">{children}</div>
    </Drawer>
  );
}

/** One filter: icon, name, what is chosen (or "All") with a clear link, then its control. */
export function FilterRow({ icon, label, value, onClear, children }: {
  icon: ReactNode; label: string; value?: string | null; onClear?: () => void; children: ReactNode;
}) {
  return (
    <section className="px-1 py-4 first:pt-1">
      <header className="mb-2.5 flex items-center gap-2">
        <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">{icon}</span>
        <h3 className="text-sm font-semibold text-slate-900">{label}</h3>
        <span className="ml-auto flex min-w-0 items-center gap-2 text-xs">
          {value ? <span className="truncate font-medium text-blue-700">{value}</span> : <span className="text-slate-400">{tr('All')}</span>}
          {value && onClear && <button type="button" onClick={onClear} className="flex-shrink-0 text-slate-400 underline-offset-2 hover:text-slate-700 hover:underline">{tr('Clear')}</button>}
        </span>
      </header>
      {children}
    </section>
  );
}

/** A few choices side by side ('' = all). */
export function Segments({ value, onChange, choices }: { value: string; onChange: (v: string) => void; choices: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1" role="radiogroup">
      {choices.map((c) => {
        const on = c.value === value;
        return (
          <button key={c.value || 'all'} type="button" role="radio" aria-checked={on} onClick={() => onChange(c.value)}
            className={cx('min-w-0 flex-1 basis-[30%] truncate rounded-lg px-2.5 py-1.5 text-xs font-medium transition', on ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200' : 'text-slate-600 hover:text-slate-900')}>
            {c.label}
          </button>
        );
      })}
    </div>
  );
}

/** Choices with longer names, one per line with a radio dot ('' = all). */
export function OptionList({ value, onChange, choices }: { value: string; onChange: (v: string) => void; choices: { value: string; label: string; icon?: ReactNode }[] }) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200" role="radiogroup">
      {choices.map((c) => {
        const on = c.value === value;
        return (
          <button key={c.value || 'all'} type="button" role="radio" aria-checked={on} onClick={() => onChange(c.value)}
            className={cx('flex w-full items-center gap-2.5 border-b border-slate-100 px-3 py-2 text-left text-sm last:border-b-0', on ? 'bg-blue-50/70 font-medium text-blue-900' : 'text-slate-700 hover:bg-slate-50')}>
            <span className={cx('flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border', on ? 'border-blue-600' : 'border-slate-300')}>
              {on && <span className="h-2 w-2 rounded-full bg-blue-600" />}
            </span>
            {c.icon && <span className="flex-shrink-0 text-slate-400">{c.icon}</span>}
            <span className="min-w-0 flex-1 truncate">{c.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** A long list as a dropdown with a search box; the first entry is "all" (''). */
export function ComboFilter({ value, onChange, options, allLabel, placeholder }: {
  value: string; onChange: (v: string) => void; options: { value: string; label: string; hint?: string }[]; allLabel: string; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const current = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s) || (o.hint ?? '').toLowerCase().includes(s)) : options;
  }, [options, q]);
  const pick = (v: string) => { onChange(v); setOpen(false); setQ(''); };
  const item = (v: string, label: string, hint?: string) => (
    <li key={v || 'all'}>
      <button type="button" onClick={() => pick(v)} aria-pressed={v === value}
        className={cx('flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-slate-50', v === value ? 'font-medium text-blue-800' : 'text-slate-700')}>
        <span className="flex w-4 flex-shrink-0 justify-center">{v === value && <Check size={14} />}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>{hint && <span className="flex-shrink-0 text-[11px] text-slate-400">{hint}</span>}
      </button>
    </li>
  );
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={cx(inputClass, 'flex h-10 items-center justify-between gap-2 text-left', open && 'border-blue-500 ring-2 ring-blue-500/20')}>
        <span className={cx('truncate text-sm', !current && 'text-slate-500')}>{current ? current.label : allLabel}</span>
        <span className="flex flex-shrink-0 items-center gap-1 text-slate-400">
          {current && <X size={14} className="hover:text-slate-700" onClick={(e) => { e.stopPropagation(); pick(''); }} aria-label={tr('Clear')} />}
          <ChevronDown size={15} className={cx('transition', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <div className="relative border-b border-slate-100 p-2">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={cx(inputClass, 'h-9 pl-8 text-sm')} />
          </div>
          <ul className="max-h-60 overflow-y-auto py-1">
            {!q && item('', allLabel)}
            {shown.map((o) => item(o.value, o.label, o.hint))}
            {shown.length === 0 && <li className="px-3 py-4 text-center text-xs text-slate-400">{tr('No match')}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

/** Quick periods in one row; "Custom" unfolds the two dates. */
export function QuickPeriod({ value, onChange, maxDays }: { value: Period; onChange: (v: Period) => void; maxDays?: number }) {
  const today = wibDay(0);
  const [y, m] = today.split('-').map(Number);
  const first = `${y}-${String(m).padStart(2, '0')}-01`;
  const prevFirst = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
  const prevLast = new Date(Date.UTC(y, m - 1, 0)).toISOString().slice(0, 10);
  const presets = [
    { key: 'today', label: tr('Today'), value: { from: today, to: today } },
    { key: '7', label: tr('7 days'), value: { from: wibDay(-6), to: today } },
    { key: '30', label: tr('30 days'), value: { from: wibDay(-29), to: today } },
    { key: 'month', label: tr('This month'), value: { from: first, to: today } },
    { key: 'last', label: tr('Last month'), value: { from: prevFirst, to: prevLast } },
  ];
  const match = presets.find((p) => p.value.from === value.from && p.value.to === value.to);
  const [custom, setCustom] = useState(!match);
  const days = Math.round((Date.parse(value.to) - Date.parse(value.from)) / 864e5) + 1;
  const tooLong = !!maxDays && days > maxDays;
  return (
    <div className="space-y-2.5">
      <Segments value={custom ? 'custom' : match?.key ?? ''} onChange={(k) => {
        if (k === 'custom') { setCustom(true); return; }
        setCustom(false);
        const p = presets.find((x) => x.key === k);
        if (p) onChange(p.value);
      }} choices={[...presets.map((p) => ({ value: p.key, label: p.label })), { value: 'custom', label: tr('Custom') }]} />
      {custom && (
        <div className="grid grid-cols-2 gap-2">
          <label className="text-[11px] font-medium text-slate-500">{tr('From')}
            <input type="date" value={value.from} max={value.to} className={cx(inputClass, 'mt-1 h-10')}
              onChange={(e) => e.target.value && onChange({ from: e.target.value, to: value.to < e.target.value ? e.target.value : value.to })} />
          </label>
          <label className="text-[11px] font-medium text-slate-500">{tr('To')}
            <input type="date" value={value.to} min={value.from} max={today} className={cx(inputClass, 'mt-1 h-10')}
              onChange={(e) => e.target.value && onChange({ from: value.from > e.target.value ? e.target.value : value.from, to: e.target.value })} />
          </label>
        </div>
      )}
      <p className={cx('flex items-center gap-1.5 text-xs', tooLong ? 'text-red-600' : 'text-slate-500')}>
        <CalendarDays size={13} /> {dmy(value.from)} – {dmy(value.to)} · {tr('{0} days', days)}{tooLong ? ` · ${tr('at most {0} days', maxDays)}` : ''}
      </p>
    </div>
  );
}

/** The period shown in a filter row ("Last 30 days" or the dates). */
export function periodLabel(p: Period, def: Period): string | null {
  return p.from === def.from && p.to === def.to ? null : `${dmy(p.from)} – ${dmy(p.to)}`;
}
