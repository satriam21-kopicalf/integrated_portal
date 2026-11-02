'use client';

import { ReactNode, useMemo, useState } from 'react';
import { Check, Search, SlidersHorizontal, X } from 'lucide-react';
import { inputClass } from '@/so/ui';
import { tr } from '@/lib/i18n';

/** "Filters" toolbar button with the number of active filters. */
export function FilterButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium shadow-sm transition-colors ${
        count ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'
      }`}
    >
      <SlidersHorizontal size={15} />
      {tr('Filters')}
      {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-700 px-1.5 text-[11px] font-semibold tabular-nums text-white">{count}</span>}
    </button>
  );
}

export interface Choice {
  value: string;
  label: string;
  hint?: string;
}

/** One filter as a group of pills (single choice; '' = any). */
export function ChoiceGroup({ label, choices, value, onChange }: { label: string; choices: Choice[]; value: string; onChange: (v: string) => void }) {
  return (
    <fieldset>
      {label && <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</legend>}
      <div className="flex flex-wrap gap-2">
        {choices.map(c => {
          const on = c.value === value;
          return (
            <button key={c.value || 'any'} type="button" onClick={() => onChange(c.value)} aria-pressed={on} title={c.hint}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                on ? 'border-brand-700 bg-brand-700 text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50'
              }`}>
              {on && <Check size={14} />}{c.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/** One filter as a searchable list (single choice; '' = any). */
export function SearchChoice({ label, anyLabel, options, value, onChange, placeholder, loading }: {
  label: string;
  anyLabel: string;
  options: { value: string; label: string; meta?: ReactNode }[];
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  loading?: boolean;
}) {
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    return s ? options.filter(o => o.label.toLowerCase().includes(s) || o.value.toLowerCase().includes(s)) : options;
  }, [options, q]);
  const row = (v: string, text: ReactNode, meta?: ReactNode) => {
    const on = v === value;
    return (
      <li key={v || 'any'}>
        <button type="button" onClick={() => onChange(v)} aria-pressed={on}
          className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${on ? 'bg-brand-50 font-medium text-brand-800' : 'text-neutral-700 hover:bg-neutral-50'}`}>
          <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-neutral-300'}`}>
            {on && <Check size={10} strokeWidth={3} />}
          </span>
          <span className="min-w-0 flex-1 truncate">{text}</span>
          {meta}
        </button>
      </li>
    );
  };
  return (
    // min-w-0: a fieldset is at least as wide as its content by default, so long labels would overflow the drawer
    <fieldset className="min-w-0">
      {label && <legend className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">{label}</legend>}
      <div className="overflow-hidden rounded-xl border border-neutral-200">
        <div className="relative border-b border-neutral-100 p-2">
          <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={placeholder} className={`${inputClass} h-9 pl-8 text-sm`} aria-label={placeholder} />
        </div>
        <ul className="max-h-72 overflow-y-auto py-1">
          {!q && row('', anyLabel)}
          {loading ? <li className="px-3 py-4 text-center text-sm text-neutral-400">{tr('Loading…')}</li>
            : shown.length === 0 ? <li className="px-3 py-4 text-center text-sm text-neutral-400">{tr('No match for “')}{q}”</li>
            : shown.map(o => row(o.value, o.label, o.meta))}
        </ul>
      </div>
    </fieldset>
  );
}

export interface ActiveFilter {
  key: string;
  label: string;
  onRemove: () => void;
}

/** Removable chips of the filters in use, under the toolbar. */
export function ActiveFilters({ filters, onClear }: { filters: ActiveFilter[]; onClear: () => void }) {
  if (!filters.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {filters.map(f => (
        <span key={f.key} className="inline-flex items-center gap-1 rounded-full border border-brand-200 bg-brand-50 py-1 pl-3 pr-1.5 text-xs font-medium text-brand-800">
          {f.label}
          <button type="button" onClick={f.onRemove} className="rounded-full p-0.5 text-brand-400 hover:bg-brand-100 hover:text-brand-800" aria-label={tr('Remove {0}', f.label)}>
            <X size={12} />
          </button>
        </span>
      ))}
      <button type="button" onClick={onClear} className="text-xs font-medium text-neutral-500 hover:text-neutral-900">{tr('Clear all')}</button>
    </div>
  );
}
