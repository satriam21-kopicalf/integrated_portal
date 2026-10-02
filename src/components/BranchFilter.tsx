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
  value: string; // branch_code, '' = all
  onChange: (code: string) => void;
}

export default function BranchFilter({ branches, loading, value, onChange }: BranchFilterProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const close = useCallback(() => {
    setIsOpen(false);
    setQuery('');
  }, []);
  useClickOutside(ref, close, isOpen);

  const selected = branches.find(b => b.branch_code === value);
  const label = selected ? `Branch: ${selected.branch_name}` : 'Branch: all branches';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter(b => b.branch_name.toLowerCase().includes(q) || b.branch_code.toLowerCase().includes(q));
  }, [branches, query]);

  const choose = (code: string) => {
    onChange(code);
    close();
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => (isOpen ? close() : setIsOpen(true))}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
          value || isOpen
            ? 'border-slate-900 bg-slate-900 text-white'
            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
        }`}
        title={label}
        aria-label={label}
        aria-expanded={isOpen}
      >
        <Store size={18} strokeWidth={1.75} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[min(20rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
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
          </div>
          <div className="max-h-80 overflow-y-auto p-1">
            {!query && (
              <BranchOption label="All branches" hint={`${formatNumber(branches.length)} branches`} active={!value} onClick={() => choose('')} />
            )}
            {loading && <p className="px-3 py-6 text-center text-sm text-slate-400">Loading branches…</p>}
            {!loading && filtered.length === 0 && (
              <p className="px-3 py-6 text-center text-sm text-slate-400">No branch matches “{query}”</p>
            )}
            {filtered.map(b => (
              <BranchOption
                key={b.branch_code}
                label={b.branch_name}
                hint={`${b.branch_code} · ${formatNumber(b.count)} sales (65 days)`}
                active={b.branch_code === value}
                onClick={() => choose(b.branch_code)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BranchOption({ label, hint, active, onClick }: { label: string; hint: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left transition-colors ${
        active ? 'bg-slate-100' : 'hover:bg-slate-50'
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{label}</p>
        <p className="truncate text-xs text-slate-400">{hint}</p>
      </div>
      {active && <Check size={16} className="flex-shrink-0 text-slate-900" />}
    </button>
  );
}
