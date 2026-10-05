'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import StatusBadge from '@/components/cost/StatusBadge';
import {
  Basis, cogsPct, cogsStatus, OutletCost, pctText, sales, Status, STATUS, STATUS_ORDER,
} from '@/lib/costControl';
import { formatCurrency, formatDate } from '@/lib/format';

type SortKey = 'name' | 'sales' | 'actual' | 'theoretical' | 'gap' | 'usage' | 'variance' | 'waste' | 'purchases';

const COLUMNS: { key: SortKey; label: string; title?: string }[] = [
  { key: 'name', label: 'Outlet' },
  { key: 'sales', label: 'Sales' },
  { key: 'actual', label: 'Actual COGS', title: 'Theoretical + other usage − stock variance, % of sales' },
  { key: 'theoretical', label: 'Theoretical', title: 'Sold menus x recipes (BOM) at HPP, % of sales' },
  { key: 'gap', label: 'Gap', title: 'Actual minus theoretical, percentage points' },
  { key: 'usage', label: 'Usage ratio', title: 'Actual usage / recipe usage (needs a stock opname in the period)' },
  { key: 'variance', label: 'Stock variance', title: 'Physical minus system stock at opname; negative = loss' },
  { key: 'waste', label: 'Other usage', title: 'Item journal: waste, R&D, marketing, ... (% of sales)' },
  { key: 'purchases', label: 'Purchases' },
];

export default function OutletTable({ outlets, basis, onSelect }: {
  outlets: OutletCost[];
  basis: Basis;
  onSelect: (o: OutletCost) => void;
}) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<Status | ''>('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'actual', desc: true });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const value = (o: OutletCost): number | string => {
      switch (sort.key) {
        case 'name': return o.branchName.toLowerCase();
        case 'sales': return sales(o, basis);
        case 'actual': return cogsPct(o, basis, 'actual') ?? -1;
        case 'theoretical': return cogsPct(o, basis, 'theoretical') ?? -1;
        case 'gap': return (basis === 'net' ? o.gapPpNet : o.gapPpSubtotal) ?? -999;
        case 'usage': return o.hasOpname ? o.usageRatio ?? -1 : -1;
        case 'variance': return o.variance;
        case 'waste': return o.otherUsage;
        case 'purchases': return o.purchases;
      }
    };
    return outlets
      .filter(o => sales(o, basis) > 0 || o.actualCogs > 0)
      .filter(o => !q || o.branchName.toLowerCase().includes(q) || o.branchCode.toLowerCase().includes(q))
      .filter(o => !status || cogsStatus(o, basis) === status)
      .sort((a, b) => {
        const x = value(a), y = value(b);
        const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
        return sort.desc ? -c : c;
      });
  }, [outlets, basis, query, status, sort]);

  const counts = useMemo(() => {
    const c: Partial<Record<Status, number>> = {};
    for (const o of outlets) {
      const s = cogsStatus(o, basis);
      if (s && sales(o, basis) > 0) c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [outlets, basis]);

  const toggleSort = (key: SortKey) => setSort(s => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' }));

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:p-4">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search outlet"
            className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" aria-label="Search outlet" />
        </div>
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Filter by COGS status">
          <FilterChip active={!status} onClick={() => setStatus('')}>All {outlets.filter(o => sales(o, basis) > 0).length}</FilterChip>
          {STATUS_ORDER.map(s => (
            <FilterChip key={s} active={status === s} onClick={() => setStatus(status === s ? '' : s)} dot={STATUS[s].dot}>
              {STATUS[s].label} {counts[s] ?? 0}
            </FilterChip>
          ))}
        </div>
      </div>

      <div className="custom-scrollbar max-h-[640px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {COLUMNS.map(c => (
                <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2.5 ${c.key === 'name' ? 'text-left' : 'text-right'}`} title={c.title}>
                  <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
                    {c.label}
                    {sort.key === c.key && (sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                  </button>
                </th>
              ))}
              <th scope="col" className="whitespace-nowrap px-3 py-2.5 text-right">Opname</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(o => {
              const gap = basis === 'net' ? o.gapPpNet : o.gapPpSubtotal;
              const waste = basis === 'net' ? o.wastePctNet : o.wastePctSubtotal;
              return (
                <tr key={o.branchCode} onClick={() => onSelect(o)} className="cursor-pointer hover:bg-slate-50/80">
                  <td className="max-w-[16rem] px-3 py-2">
                    <span className="block truncate font-medium text-slate-900">{o.branchName}</span>
                    <span className="block text-xs text-slate-400">{o.branchCode}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">{formatCurrency(Math.round(sales(o, basis)))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <StatusBadge status={cogsStatus(o, basis)} value={pctText(cogsPct(o, basis, 'actual'))} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">{pctText(cogsPct(o, basis, 'theoretical'))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <StatusBadge status={o.status.gapNet} value={gap === null ? '–' : `${gap > 0 ? '+' : ''}${gap.toFixed(1)} pp`} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <StatusBadge status={o.status.usage} value={o.hasOpname ? pctText(o.usageRatio) : 'no opname'} />
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${o.variance < -0.5 ? 'text-red-700' : 'text-slate-600'}`}>
                    {formatCurrency(Math.round(o.variance))}
                    {o.pendingVariance !== 0 && <span className="block text-[11px] text-slate-400">incl. {formatCurrency(Math.round(o.pendingVariance))} pending</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <StatusBadge status={o.status.waste} value={pctText(waste)} title={formatCurrency(Math.round(o.otherUsage))} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">{formatCurrency(Math.round(o.purchases))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-slate-500">
                    {o.opnameCount ? <>{o.opnameCount}× · {formatDate(o.lastOpnameDate)}</> : '–'}
                    {o.pendingOpnameCount > 0 && <span className="block text-amber-700">{o.pendingOpnameCount} pending</span>}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={COLUMNS.length + 1} className="px-3 py-10 text-center text-sm text-slate-400">No outlets match</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function FilterChip({ active, onClick, dot, children }: { active: boolean; onClick: () => void; dot?: string; children: React.ReactNode }) {
  return (
    <button type="button" role="radio" aria-checked={active} onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium tabular-nums transition-colors ${
        active ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
      {dot && <span className="h-2 w-2 rounded-full" style={{ background: dot }} aria-hidden />}
      {children}
    </button>
  );
}
