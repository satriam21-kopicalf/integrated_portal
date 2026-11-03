'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { Popover, PopoverButton } from '@/components/kc/Popover';
import { SearchInput, btn, cx } from '@/components/kc';
import { Check, Store } from 'lucide-react';
import { formatNumber } from '@/lib/format';
import { useClickOutside } from '@/lib/useClickOutside';
import { tr } from '@/lib/i18n';

export interface Branch {
  branch_code: string;
  branch_name: string;
  company_code?: string;
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
  if (!codes.length) return tr('All Branches');
  if (codes.length === 1) return branches.find(b => b.branch_code === codes[0])?.branch_name ?? codes[0];
  return tr('{0} branches', codes.length);
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

  const label = tr('Branch: {0}', branchesLabel(value, branches));

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
      <PopoverButton icon={<Store />} label={label} value={label} active={current.length > 0} open={isOpen} badge={current.length}
        onClick={() => (isOpen ? close() : open())} />

      <Popover open={isOpen} onClose={close} title={tr('Branches')} subtitle={draft.size ? tr('{0} selected', draft.size) : tr('All Branches')}
        actions={draft.size > 0 && <button type="button" className="rounded-md px-2 py-1 text-xs font-medium text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900" onClick={() => setDraft(new Set())}>{tr('Clear')}</button>}
        footer={
          <>
            <button type="button" onClick={close} className={cx(btn('outline'), 'h-10 flex-1 sm:h-9 sm:flex-none')}>{tr('Cancel')}</button>
            <button type="button" onClick={() => apply(draft)} className={cx(btn('solid'), 'h-10 flex-1 sm:h-9 sm:flex-none')}>
              {draft.size ? tr('Apply ({0})', draft.size) : tr('Show all branches')}
            </button>
          </>
        }>
        <div className="sticky top-0 z-10 space-y-2 border-b border-neutral-100 bg-white p-3">
          <SearchInput value={query} onChange={setQuery} placeholder={tr('Search branch or code…')} />
          <button type="button" className="text-xs font-medium text-brand-700 hover:underline disabled:text-neutral-300 disabled:no-underline"
            disabled={!filtered.length} onClick={() => setDraft(d => new Set([...d, ...filtered.map(b => b.branch_code)]))}>
            {tr('Select')} {query ? tr('shown') : tr('all')}
          </button>
        </div>
        <div className="p-1.5" role="listbox" aria-multiselectable="true" aria-label={tr('Branches')}>
          {loading && <p className="px-3 py-6 text-center text-sm text-neutral-400">{tr('Loading branches…')}</p>}
          {!loading && filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-neutral-400">{tr('No branch matches “')}{query}”</p>
          )}
          {filtered.map(b => (
            <BranchOption
              key={b.branch_code}
              label={b.branch_name}
              hint={tr('{0} · {1} sales (65 days)', b.branch_code, formatNumber(b.count))}
              checked={draft.has(b.branch_code)}
              onClick={() => toggle(b.branch_code)}
            />
          ))}
        </div>
      </Popover>
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
      className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2.5 text-left transition-colors ${checked ? 'bg-brand-50' : 'hover:bg-neutral-50'}`}
    >
      <span className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded border ${checked ? 'border-brand-700 bg-brand-700 text-white' : 'border-neutral-300 bg-white'}`} aria-hidden>
        {checked && <Check size={12} strokeWidth={3} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-neutral-800">{label}</p>
        <p className="truncate text-xs text-neutral-400">{hint}</p>
      </div>
    </button>
  );
}
