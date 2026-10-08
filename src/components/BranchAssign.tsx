'use client';

import { useMemo, useState } from 'react';
import { Check, Search, Store, X } from 'lucide-react';
import type { Branch } from '@/components/BranchFilter';
import { inputClass } from '@/components/ui/Dialog';
import { tr } from '@/lib/i18n';

interface BranchAssignProps {
  branches: Branch[];
  loading: boolean;
  /** selected branch codes */
  value: string[];
  onChange: (codes: string[]) => void;
  invalid?: boolean;
}

/**
 * Branches a "user" may see (User Accounts drawer): a searchable checklist with the
 * selection as removable chips. Branches that sold recently come first; branches
 * without recent sales (closed or new) are marked.
 */
export default function BranchAssign({ branches, loading, value, onChange, invalid }: BranchAssignProps) {
  const [query, setQuery] = useState('');
  const selected = useMemo(() => new Set(value), [value]);
  const names = useMemo(() => new Map(branches.map(b => [b.branch_code, b.branch_name])), [branches]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? branches.filter(b => b.branch_name.toLowerCase().includes(q) || b.branch_code.toLowerCase().includes(q)) : branches;
  }, [branches, query]);

  const toggle = (code: string) =>
    onChange(selected.has(code) ? value.filter(c => c !== code) : [...value, code].sort());
  const selectShown = () => onChange([...new Set([...value, ...shown.map(b => b.branch_code)])].sort());
  const clear = () => onChange([]);

  return (
    <div className={`rounded-lg border ${invalid ? 'border-red-300' : 'border-slate-200'}`}>
      {/* selection */}
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 border-b border-slate-100 px-2.5 py-2">
        {value.length === 0 ? (
          <span className="text-sm text-slate-400">{tr('No branch selected — the user would see no data')}</span>
        ) : value.map(code => (
          <span key={code} className="inline-flex max-w-full items-center gap-1 rounded-full bg-blue-50 py-0.5 pl-2 pr-1 text-xs font-medium text-blue-800">
            <span className="truncate">{names.get(code) ?? code}</span>
            <button type="button" onClick={() => toggle(code)} className="rounded-full p-0.5 hover:bg-blue-100" aria-label={tr('Remove {0}', names.get(code) ?? code)}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 p-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tr('Search outlet name or code')}
            className={`${inputClass} h-9 pl-8 text-sm`} aria-label={tr('Search branches')} />
        </div>
        <button type="button" onClick={selectShown} disabled={!shown.length} className="rounded-md px-2 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-40">
          {query ? tr('Select shown') : tr('Select all')}
        </button>
        <button type="button" onClick={clear} disabled={!value.length} className="rounded-md px-2 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40">
          {tr('Clear')}
        </button>
      </div>

      <ul className="max-h-64 overflow-y-auto border-t border-slate-100 py-1" role="listbox" aria-multiselectable="true" aria-label={tr('Branches')}>
        {loading ? (
          <li className="px-3 py-6 text-center text-sm text-slate-400">{tr('Loading branches…')}</li>
        ) : shown.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-slate-400">{tr('No branch matches “')}{query}”</li>
        ) : shown.map(b => {
          const on = selected.has(b.branch_code);
          return (
            <li key={b.branch_code}>
              <button type="button" role="option" aria-selected={on} onClick={() => toggle(b.branch_code)}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors ${on ? 'bg-blue-50/60' : 'hover:bg-slate-50'}`}>
                <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${on ? 'border-blue-700 bg-blue-700 text-white' : 'border-slate-300 bg-white'}`}>
                  {on && <Check size={12} strokeWidth={3} />}
                </span>
                <Store size={14} className="flex-shrink-0 text-slate-400" />
                <span className="min-w-0 flex-1 truncate text-slate-800">{b.branch_name}</span>
                {!b.count && <span className="rounded bg-slate-100 px-1.5 text-[10px] font-medium text-slate-500">{tr('no recent sales')}</span>}
                <span className="font-mono text-[11px] text-slate-400">{b.branch_code}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-slate-100 px-3 py-1.5 text-[11px] text-slate-400">{value.length} {tr('of')} {branches.length} {tr('branches selected')}</p>
    </div>
  );
}
