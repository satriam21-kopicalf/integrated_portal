'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Check, Search, Store } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { useClickOutside } from '@/lib/useClickOutside';

export interface Branch {
  branch_code: string;
  branch_name: string;
  count: number;
}

interface BranchFilterProps {
  branches: Branch[];
  loading: boolean;
  /** branch codes separated by commas, '' = all branches */
  value: string;
  onChange: (codes: string) => void;
}

/** "CCI04,CCI01" -> ['CCI01', 'CCI04'] */
export function splitBranches(value: string | null | undefined): string[] {
  return [...new Set((value ?? '').split(',').map(c => c.trim()).filter(Boolean))].sort();
}

/** Text for the selected branches: "All branches", the name of one, or "3 branches". */
export function branchesLabel(value: string, branches: Branch[]): string {
  const codes = splitBranches(value);
  if (!codes.length) return 'All branches';
  if (codes.length === 1) return branches.find(b => b.branch_code === codes[0])?.branch_name ?? codes[0];
  return `${codes.length} branches`;
}

/**
 * Branch filter with several branches: tick branches, then Apply (one refetch).
 * Search narrows the list; "Select shown" ticks every match.
 */
export default function BranchFilter({ branches, loading, value, onChange }: BranchFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState<Set<string>>(new Set());
  const ref = useRef<HTMLDivElement>(null);
  const current = useMemo(() => splitBranches(value), [value]);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);
  useClickOutside(ref, close, isOpen);

  const open = () => {
    setDraft(new Set(current));
    setIsOpen(true);
  };

  const label = `Branch: ${branchesLabel(value, branches)}`;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? branches.filter(b => b.branch_name.toLowerCase().includes(q) || b.branch_code.toLowerCase().includes(q)) : branches;
    // selected branches first, so they stay visible in a long list
    return [...list].sort((a, b) => Number(draft.has(b.branch_code)) - Number(draft.has(a.branch_code)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branches, query, isOpen]);

  const toggle = (code: string) => setDraft(d => {
    const next = new Set(d);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    return next;
  });

  const apply = (codes: Set<string>) => {
    onChange([...codes].sort().join(','));
    close();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => (isOpen ? close() : open())}
        className={`relative inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
          current.length || isOpen
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
        }`}
        title={label}
        aria-label={label}
        aria-expanded={isOpen}
      >
        <Store size={18} strokeWidth={1.75} />
        {current.length > 1 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-blue-600 px-1 text-center text-[10px] font-semibold leading-[18px] text-white ring-2 ring-white">
            {current.length}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 flex w-[min(22rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search branch or code…"
                className="h-9 w-full rounded-md border border-slate-200 pl-8 pr-2 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
              />
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 px-0.5 text-xs">
              <span className="text-slate-500">{draft.size ? `${draft.size} selected` : 'All branches'}</span>
              <span className="flex gap-3">
                <button type="button" className="font-medium text-blue-700 hover:underline disabled:text-slate-300 disabled:no-underline"
                  disabled={!filtered.length} onClick={() => setDraft(d => new Set([...d, ...filtered.map(b => b.branch_code)]))}>
                  Select {query ? 'shown' : 'all'}
                </button>
                <button type="button" className="font-medium text-slate-600 hover:underline disabled:text-slate-300 disabled:no-underline"
                  disabled={!draft.size} onClick={() => setDraft(new Set())}>
                  Clear
                </button>
              </span>
            </div>
          </div>
          <div className="max-h-80 overflow-y-auto p-1" role="listbox" aria-multiselectable="true" aria-label="Branches">
            {loading && <p className="px-3 py-6 text-center text-sm text-slate-400">Loading branches…</p>}
            {!loading && filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-400">No branch matches “{query}”</p>
            )}
            {filtered.map(b => (
              <BranchOption
                key={b.branch_code}
                label={b.branch_name}
                hint={`${b.branch_code} · ${formatNumber(b.count)} sales (65 days)`}
                checked={draft.has(b.branch_code)}
                onClick={() => toggle(b.branch_code)}
              />
            ))}
          </div>
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/60 p-2">
            <button type="button" onClick={close} className="h-8 rounded-md px-3 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
            <button type="button" onClick={() => apply(draft)}
              className="h-8 rounded-md bg-slate-900 px-3 text-sm font-semibold text-white hover:bg-slate-800">
              {draft.size ? `Apply (${draft.size})` : 'Show all branches'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BranchOption({ label, hint, checked, onClick }: { label: string; hint: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="option"
      aria-selected={checked}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition-colors ${checked ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
    >
      <span className={`flex h-4 w-4 flex-shrink-0 items-center justify-center rounded border ${checked ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-300 bg-white'}`} aria-hidden>
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{label}</p>
        <p className="truncate text-xs text-slate-400">{hint}</p>
      </div>
    </button>
  );
}
