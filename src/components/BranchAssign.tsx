'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Search, Store, Warehouse, X } from 'lucide-react';
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
  /** {code: outlet | hub | other} (GET /api/branch-kinds, 2026-11-13): the categories of the list */
  kinds?: Record<string, string>;
}

type Kind = 'all' | 'outlet' | 'hub' | 'other';
const KINDS: { key: Kind; label: () => string }[] = [
  { key: 'all', label: () => tr('All') }, { key: 'outlet', label: () => tr('Outlet') }, { key: 'hub', label: () => tr('Hub') }, { key: 'other', label: () => tr('Others') },
];

/**
 * Branches a "user" may see (User Accounts drawer): a searchable checklist with the
 * selection as removable chips. Branches that sold recently come first; branches
 * without recent sales (closed or new) are marked.
 */
let kindsOnce: Promise<Record<string, string>> | null = null;
/** {code: outlet | hub | other}, read once per page load (account managers only; others get {}). */
function loadKinds(): Promise<Record<string, string>> {
  kindsOnce ??= fetch('/api/branch-kinds').then(r => (r.ok ? r.json() : { kinds: {} })).then((d: { kinds?: Record<string, string> }) => d.kinds ?? {}).catch(() => ({}));
  return kindsOnce;
}

export default function BranchAssign({ branches, loading, value, onChange, invalid, kinds: given }: BranchAssignProps) {
  const [loaded, setLoaded] = useState<Record<string, string> | undefined>(undefined);
  useEffect(() => { if (!given) void loadKinds().then(setLoaded); }, [given]);
  const kinds = given ?? loaded;
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<Kind>('all');
  const selected = useMemo(() => new Set(value), [value]);
  const names = useMemo(() => new Map(branches.map(b => [b.branch_code, b.branch_name])), [branches]);
  // a branch without a kopicalf facility: a hub when its name says so, else an outlet
  const kindOf = (code: string) => (kinds?.[code] ?? (/hub/i.test(names.get(code) ?? '') ? 'hub' : 'outlet')) as Kind;
  const counts: Record<Kind, number> = { all: branches.length, outlet: 0, hub: 0, other: 0 };
  for (const b of branches) counts[kindOf(b.branch_code)] += 1;
  const q = query.trim().toLowerCase();
  const inKind = kind === 'all' ? branches : branches.filter(b => kindOf(b.branch_code) === kind);
  const shown = q ? inKind.filter(b => b.branch_name.toLowerCase().includes(q) || b.branch_code.toLowerCase().includes(q)) : inKind;

  const toggle = (code: string) =>
    onChange(selected.has(code) ? value.filter(c => c !== code) : [...value, code].sort());
  const selectShown = () => onChange([...new Set([...value, ...shown.map(b => b.branch_code)])].sort());
  const clear = () => onChange([]);

  return (
    <div className={`rounded-lg border ${invalid ? 'border-red-300' : 'border-neutral-200'}`}>
      {/* selection */}
      <div className="flex min-h-11 flex-wrap items-center gap-1.5 border-b border-neutral-100 px-2.5 py-2">
        {value.length === 0 ? (
          <span className="text-sm text-neutral-400">{tr('No branch selected — the user would see no data')}</span>
        ) : value.map(code => (
          <span key={code} className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2 pr-1 text-xs font-medium text-brand-800">
            <span className="truncate">{names.get(code) ?? code}</span>
            <button type="button" onClick={() => toggle(code)} className="rounded-full p-0.5 hover:bg-brand-100" aria-label={tr('Remove {0}', names.get(code) ?? code)}>
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      <div role="tablist" aria-label={tr('Branch category')} className="flex gap-1 overflow-x-auto px-2 pt-2">
        {KINDS.filter(k => k.key === 'all' || counts[k.key] > 0).map(k => (
          <button key={k.key} type="button" role="tab" aria-selected={kind === k.key} onClick={() => setKind(k.key)}
            className={`flex flex-shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${kind === k.key ? 'bg-brand-700 text-white' : 'bg-neutral-100 text-neutral-600 hover:bg-neutral-200'}`}>
            {k.label()} <span className="tabular-nums opacity-80">{counts[k.key]}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 p-2">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder={tr('Search outlet name or code')}
            className={`${inputClass} h-9 pl-8 text-sm`} aria-label={tr('Search Branches')} />
        </div>
        <button type="button" onClick={selectShown} disabled={!shown.length} className="rounded-md px-2 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-40">
          {query || kind !== 'all' ? tr('Select shown') : tr('Select all')}
        </button>
        <button type="button" onClick={clear} disabled={!value.length} className="rounded-md px-2 py-1.5 text-xs font-medium text-neutral-500 hover:bg-neutral-100 disabled:opacity-40">
          {tr('Clear')}
        </button>
      </div>

      <ul className="max-h-64 overflow-y-auto border-t border-neutral-100 py-1" role="listbox" aria-multiselectable="true" aria-label={tr('Branches')}>
        {loading ? (
          <li className="px-3 py-6 text-center text-sm text-neutral-400">{tr('Loading branches…')}</li>
        ) : shown.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-neutral-400">{tr('No branch matches “')}{query}”</li>
        ) : shown.map(b => {
          const on = selected.has(b.branch_code);
          return (
            <li key={b.branch_code}>
              <button type="button" role="option" aria-selected={on} onClick={() => toggle(b.branch_code)}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors ${on ? 'bg-brand-50/60' : 'hover:bg-neutral-50'}`}>
                <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${on ? 'border-brand-700 bg-brand-700 text-white' : 'border-neutral-300 bg-white'}`}>
                  {on && <Check size={12} strokeWidth={3} />}
                </span>
                {kindOf(b.branch_code) === 'hub' ? <Warehouse size={14} className="flex-shrink-0 text-neutral-400" /> : <Store size={14} className="flex-shrink-0 text-neutral-400" />}
                <span className="min-w-0 flex-1 truncate text-neutral-800">{b.branch_name}</span>
                {!b.count && <span className="rounded bg-neutral-100 px-1.5 text-[10px] font-medium text-neutral-500">{tr('no recent sales')}</span>}
                <span className="font-mono text-[11px] text-neutral-400">{b.branch_code}</span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="border-t border-neutral-100 px-3 py-1.5 text-[11px] text-neutral-400">{value.length} {tr('of')} {branches.length} {tr('branches selected')}</p>
    </div>
  );
}
