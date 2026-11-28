'use client';

// The filter drawer of the Monitoring pages (Product, Outlet, PIC Check In; 2026-11-03): one flat list of filters, each
// a row with its icon, its name, what is chosen and a "clear" link; quick periods in one row with the dates folded
// away; small choices as a segmented switch; long lists (outlet, PIC) as a dropdown with a search box. The footer shows
// how many filters are in use: Reset · Show results.

import { CalendarDays, Check, ChevronDown, RotateCcw, Search, SlidersHorizontal, X } from 'lucide-react';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Button, cx, inputClass, searchClass } from '@/so/ui';
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
            className="mr-auto inline-flex h-10 items-center gap-1.5 rounded-[3px] px-2 text-sm font-medium text-[color:var(--j-626F86)] hover:bg-[color:var(--j-091E420F)] hover:text-[color:var(--j-172B4D)] disabled:opacity-40 disabled:hover:bg-transparent">
            <RotateCcw size={14} /> {tr('Reset all')}
          </button>
          <Button onClick={onApply} disabled={applyDisabled} className="min-w-[9rem]">
            {tr('Show results')}{active > 0 && <span className="ml-1 rounded-full bg-white/20 px-1.5 text-xs tabular-nums">{active}</span>}
          </Button>
        </>
      }>
      <div className="-mx-1 divide-y divide-[color:var(--j-F1F2F4)]">{children}</div>
    </Drawer>
  );
}

/** One filter: icon, name, what is chosen (or "All") with a clear link, then its control. */
export function FilterRow({ icon, label, value, onClear, children }: {
  icon: ReactNode; label: string; value?: string | null; onClear?: () => void; children: ReactNode;
}) {
  return (
    <section className="px-1 py-4 first:pt-1">
      <header className="mb-2 flex items-center gap-1.5">
        <span className="flex-shrink-0 text-[color:var(--j-626F86)] [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--j-626F86)]">{label}</h3>
        <span className="ml-auto flex min-w-0 items-center gap-2 text-xs">
          {value ? <span className="truncate font-medium text-[color:var(--j-0C66E4)]">{value}</span> : <span className="text-[color:var(--j-626F86)]">{tr('All')}</span>}
          {value && onClear && <button type="button" onClick={onClear} className="flex-shrink-0 text-[color:var(--j-626F86)] underline-offset-2 hover:text-[color:var(--j-172B4D)] hover:underline">{tr('Clear')}</button>}
        </span>
      </header>
      {children}
    </section>
  );
}

/** A filter of one option only (2026-11-07): nothing to choose, so it is told, not offered. */
function OnlyOne({ label }: { label: string }) {
  return (
    <p className="flex items-center gap-2 rounded-[3px] border border-dashed border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] px-3 py-2 text-xs text-[color:var(--j-626F86)]">
      <Check size={13} className="flex-shrink-0 text-[color:var(--j-626F86)]" />
      <span className="min-w-0 truncate">{tr('Only {0} in the data', label)}</span>
    </p>
  );
}

/** A few choices side by side ('' = all). */
export function Segments({ value, onChange, choices }: { value: string; onChange: (v: string) => void; choices: { value: string; label: string }[] }) {
  return (
    <div className="flex flex-wrap gap-1.5" role="radiogroup">
      {choices.map((c) => {
        const on = c.value === value;
        return (
          <button key={c.value || 'all'} type="button" role="radio" aria-checked={on} onClick={() => onChange(c.value)}
            className={cx('min-w-0 truncate rounded-[4px] border px-2.5 py-1 text-xs font-medium transition', on ? 'border-[color:var(--j-0C66E4)] bg-[color:var(--j-0C66E4)] text-white' : 'border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)]')}>
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
    <div className="overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)]" role="radiogroup">
      {choices.map((c) => {
        const on = c.value === value;
        return (
          <button key={c.value || 'all'} type="button" role="radio" aria-checked={on} onClick={() => onChange(c.value)}
            className={cx('flex w-full items-center gap-2.5 border-b border-[color:var(--j-F1F2F4)] px-3 py-2 text-left text-sm last:border-b-0', on ? 'bg-[color:var(--j-E9F2FF)] font-medium text-[color:var(--j-0055CC)]' : 'text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]')}>
            <span className={cx('flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border', on ? 'border-[color:var(--j-0C66E4)]' : 'border-[color:var(--j-8590A2)]')}>
              {on && <span className="h-2 w-2 rounded-full bg-[color:var(--j-0C66E4)]" />}
            </span>
            {c.icon && <span className="flex-shrink-0 text-[color:var(--j-626F86)]">{c.icon}</span>}
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
  const list = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', close);
    // the opened list comes into sight inside the drawer
    requestAnimationFrame(() => list.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }));
    return () => document.removeEventListener('mousedown', close);
  }, [open]);
  const current = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter((o) => o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s) || (o.hint ?? '').toLowerCase().includes(s)) : options;
  }, [options, q]);
  const pick = (v: string) => { onChange(v); setOpen(false); setQ(''); };
  if (options.length <= 1 && !value) return <OnlyOne label={options[0]?.label ?? '—'} />;
  const item = (v: string, label: string, hint?: string) => (
    <li key={v || 'all'}>
      <button type="button" onClick={() => pick(v)} aria-pressed={v === value}
        className={cx('flex min-h-[44px] w-full items-center gap-2.5 border-l-2 px-3 py-2 text-left text-sm sm:min-h-0', v === value ? 'border-[color:var(--j-0C66E4)] bg-[color:var(--j-E9F2FF)] font-medium text-[color:var(--j-0055CC)]' : 'border-transparent text-[color:var(--j-44546F)] hover:bg-[color:var(--j-091E420F)]')}>
        <span className="flex w-4 flex-shrink-0 justify-center">{v === value && <Check size={14} />}</span>
        <span className="min-w-0 flex-1 truncate">{label}</span>{hint && <span className="flex-shrink-0 text-[11px] text-[color:var(--j-626F86)]">{hint}</span>}
      </button>
    </li>
  );
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
        className={cx(inputClass, 'flex h-11 items-center justify-between gap-2 rounded-[4px] bg-[color:var(--j-F7F8F9)] text-left hover:bg-[color:var(--j-091E420F)] sm:h-9', open && 'border-[color:var(--j-0C66E4)] bg-white ring-2 ring-[color:var(--j-388BFF)]')}>
        <span className={cx('truncate text-sm', !current && 'text-[color:var(--j-626F86)]')}>{current ? current.label : allLabel}</span>
        <span className="flex flex-shrink-0 items-center gap-1 text-[color:var(--j-626F86)]">
          {current && <X size={14} className="hover:text-[color:var(--j-172B4D)]" onClick={(e) => { e.stopPropagation(); pick(''); }} aria-label={tr('Clear')} />}
          <ChevronDown size={15} className={cx('transition', open && 'rotate-180')} />
        </span>
      </button>
      {open && (
        // 2026-11-23: the list opens in the flow of the drawer (it pushes the next filters down) instead of floating:
        // a floating list was cut by the scrolling drawer body and hidden under its footer on phones
        <div ref={list} className="mt-1 overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white">
          <div className="relative border-b border-[color:var(--j-F1F2F4)] p-2">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-[color:var(--j-626F86)]" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} aria-label={placeholder} className={cx(searchClass, 'h-10 pl-8 text-base sm:h-9 sm:text-sm')} />
          </div>
          <ul className="max-h-[min(16rem,45dvh)] overflow-y-auto overscroll-contain py-1">
            {!q && item('', allLabel)}
            {shown.map((o) => item(o.value, o.label, o.hint))}
            {shown.length === 0 && <li className="px-3 py-4 text-center text-xs text-[color:var(--j-626F86)]">{tr('No match')}</li>}
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
    { key: 'month', label: tr('This Month'), value: { from: first, to: today } },
    { key: 'last', label: tr('Last Month'), value: { from: prevFirst, to: prevLast } },
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
          <label className="text-[11px] font-medium text-[color:var(--j-626F86)]">{tr('From')}
            <input type="date" value={value.from} max={value.to} className={cx(inputClass, 'mt-1 h-10')}
              onChange={(e) => e.target.value && onChange({ from: e.target.value, to: value.to < e.target.value ? e.target.value : value.to })} />
          </label>
          <label className="text-[11px] font-medium text-[color:var(--j-626F86)]">{tr('To')}
            <input type="date" value={value.to} min={value.from} max={today} className={cx(inputClass, 'mt-1 h-10')}
              onChange={(e) => e.target.value && onChange({ from: value.from > e.target.value ? e.target.value : value.from, to: e.target.value })} />
          </label>
        </div>
      )}
      <p className={cx('flex items-center gap-1.5 text-xs', tooLong ? 'text-[color:var(--j-C9372C)]' : 'text-[color:var(--j-626F86)]')}>
        <CalendarDays size={13} /> {dmy(value.from)} – {dmy(value.to)} · {tr('{0} days', days)}{tooLong ? ` · ${tr('at most {0} days', maxDays)}` : ''}
      </p>
    </div>
  );
}

/** The period shown in a filter row ("Last 30 days" or the dates). */
export function periodLabel(p: Period, def: Period): string | null {
  return p.from === def.from && p.to === def.to ? null : `${dmy(p.from)} – ${dmy(p.to)}`;
}
