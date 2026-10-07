'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import StatusBadge from '@/components/cost/StatusBadge';
import { ReliabilityPill } from '@/components/cost/ReliabilityBanner';
import InfoTip from '@/components/ui/InfoTip';
import {
  Basis, cogsPct, OutletCost, pctText, sales, Status, STATUS, STATUS_ORDER,
} from '@/lib/costControl';
import { OutletReliability, Reliability, RELIABILITY, RELIABILITY_ORDER } from '@/lib/costReliability';
import { formatCurrency, formatDate } from '@/lib/format';
import type { InfoKey } from '@/lib/metricInfo';

export type StatusMetric = 'usage' | 'cogs';
type SortKey = 'name' | 'sales' | 'actual' | 'theoretical' | 'usage' | 'excess' | 'variance' | 'waste' | 'purchases' | 'data';

const COLUMNS: { key: SortKey; label: string; info?: InfoKey }[] = [
  { key: 'name', label: 'Outlet' },
  { key: 'sales', label: 'Sales', info: 'costSales' },
  { key: 'actual', label: 'Actual COGS', info: 'costActual' },
  { key: 'theoretical', label: 'Recipes', info: 'costTheoretical' },
  { key: 'usage', label: 'Usage vs recipes', info: 'costExcess' },
  { key: 'excess', label: 'Excess (Rp)', info: 'costExcess' },
  { key: 'variance', label: 'Stock variance', info: 'costVariance' },
  { key: 'waste', label: 'Other usage', info: 'costOther' },
  { key: 'purchases', label: 'Purchases', info: 'costPurchases' },
  { key: 'data', label: 'Data', info: 'costReliability' },
];

const LEVEL_RANK: Record<Reliability, number> = { final: 0, provisional: 1, check: 2 };

export function outletStatus(o: OutletCost, basis: Basis, metric: StatusMetric): Status | null {
  if (metric === 'usage') return o.status.usage;
  return basis === 'net' ? o.status.cogsNet : o.status.cogsSubtotal;
}

/** Every outlet with its figures; sorted by the money lost against the recipes first. */
export default function OutletTable({ outlets, basis, metric, status, onStatus, reliability, onSelect }: {
  outlets: OutletCost[];
  basis: Basis;
  metric: StatusMetric;
  status: Status | '';
  onStatus: (s: Status | '') => void;
  reliability: Map<string, OutletReliability>;
  onSelect: (o: OutletCost) => void;
}) {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<Reliability | ''>('');
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'excess', desc: true });
  const selling = useMemo(() => outlets.filter(o => sales(o, basis) > 0), [outlets, basis]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const value = (o: OutletCost): number | string => {
      switch (sort.key) {
        case 'name': return o.branchName.toLowerCase();
        case 'sales': return sales(o, basis);
        case 'actual': return cogsPct(o, basis, 'actual') ?? -1;
        case 'theoretical': return cogsPct(o, basis, 'theoretical') ?? -1;
        case 'usage': return o.hasOpname ? o.usageRatio ?? -1 : -1;
        case 'excess': return o.hasOpname ? o.actualCogs - o.theoreticalCogs : -Infinity;
        case 'variance': return o.variance;
        case 'waste': return o.otherUsage;
        case 'purchases': return o.purchases;
        case 'data': return LEVEL_RANK[reliability.get(o.branchCode)?.level ?? 'final'];
      }
    };
    return selling
      .filter(o => !q || o.branchName.toLowerCase().includes(q) || o.branchCode.toLowerCase().includes(q))
      .filter(o => !status || outletStatus(o, basis, metric) === status)
      .filter(o => !data || reliability.get(o.branchCode)?.level === data)
      .sort((a, b) => {
        const x = value(a), y = value(b);
        const c = typeof x === 'string' ? x.localeCompare(y as string) : (x as number) - (y as number);
        return sort.desc ? -c : c;
      });
  }, [selling, basis, metric, query, status, data, reliability, sort]);

  const counts = useMemo(() => {
    const c: Partial<Record<Status, number>> = {};
    for (const o of selling) {
      const s = outletStatus(o, basis, metric);
      if (s) c[s] = (c[s] ?? 0) + 1;
    }
    return c;
  }, [selling, basis, metric]);
  const dataCounts = useMemo(() => {
    const c: Partial<Record<Reliability, number>> = {};
    for (const o of selling) {
      const l = reliability.get(o.branchCode)?.level;
      if (l) c[l] = (c[l] ?? 0) + 1;
    }
    return c;
  }, [selling, reliability]);

  const toggleSort = (key: SortKey) => setSort(s => (s.key === key ? { key, desc: !s.desc } : { key, desc: key !== 'name' }));
  const totalExcess = rows.reduce((a, o) => a + (o.hasOpname ? o.actualCogs - o.theoreticalCogs : 0), 0);

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="space-y-3 border-b border-slate-200 p-3 sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search outlet or code"
              className="h-10 w-full rounded-lg border border-slate-200 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20" aria-label="Search outlet" />
          </div>
          <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label={metric === 'usage' ? 'Filter by usage status' : 'Filter by COGS status'}>
            <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{metric === 'usage' ? 'Usage' : 'COGS'}</span>
            <FilterChip active={!status} onClick={() => onStatus('')}>All {selling.length}</FilterChip>
            {STATUS_ORDER.map(s => (
              <FilterChip key={s} active={status === s} onClick={() => onStatus(status === s ? '' : s)} dot={STATUS[s].dot}>
                {STATUS[s].label} {counts[s] ?? 0}
              </FilterChip>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5" role="radiogroup" aria-label="Filter by data status">
          <span className="mr-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Data</span>
          <FilterChip active={!data} onClick={() => setData('')}>All</FilterChip>
          {RELIABILITY_ORDER.map(l => (
            <FilterChip key={l} active={data === l} onClick={() => setData(data === l ? '' : l)} dot={RELIABILITY[l].dot}>
              {RELIABILITY[l].label} {dataCounts[l] ?? 0}
            </FilterChip>
          ))}
          <span className="ml-auto text-xs text-slate-500">
            {rows.length} outlet(s) · excess vs recipes <b className={`tabular-nums ${totalExcess > 0 ? 'text-red-700' : 'text-slate-800'}`}>{formatCurrency(Math.round(totalExcess))}</b>
          </span>
        </div>
      </div>

      <div className="custom-scrollbar max-h-[640px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-[1] bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              {COLUMNS.map(c => (
                <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2.5 ${c.key === 'name' ? 'sticky left-0 z-[2] bg-slate-50 text-left' : 'text-right'}`}>
                  <span className={`inline-flex items-center gap-0.5 ${c.key === 'name' ? '' : 'justify-end'}`}>
                    <button type="button" onClick={() => toggleSort(c.key)} className="inline-flex items-center gap-1 uppercase hover:text-slate-900">
                      {c.label}
                      {sort.key === c.key && (sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                    </button>
                    {c.info && <InfoTip info={c.info} />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(o => {
              const waste = basis === 'net' ? o.wastePctNet : o.wastePctSubtotal;
              const excess = o.actualCogs - o.theoreticalCogs;
              const rel = reliability.get(o.branchCode);
              const cogsStatusValue = basis === 'net' ? o.status.cogsNet : o.status.cogsSubtotal;
              return (
                <tr key={o.branchCode} onClick={() => onSelect(o)} className="group cursor-pointer hover:bg-slate-50/80">
                  <td className="sticky left-0 max-w-[15rem] bg-white px-3 py-2 group-hover:bg-slate-50">
                    <span className="block truncate font-medium text-slate-900" title={o.branchName}>{o.branchName}</span>
                    <span className="block whitespace-nowrap text-xs text-slate-400" title={o.lastOpnameDate ? `Last opname ${formatDate(o.lastOpnameDate)}` : undefined}>
                      {o.branchCode} · {o.opnameCount ? `${o.opnameCount}× opname` : 'no opname'}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-700">{formatCurrency(Math.round(sales(o, basis)))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {metric === 'cogs'
                      ? <StatusBadge status={cogsStatusValue} value={pctText(cogsPct(o, basis, 'actual'))} />
                      : <span className="tabular-nums text-slate-800">{pctText(cogsPct(o, basis, 'actual'))}</span>}
                    <span className="block text-[11px] tabular-nums text-slate-400">{formatCurrency(Math.round(o.actualCogs))}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">{pctText(cogsPct(o, basis, 'theoretical'))}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    {o.hasOpname
                      ? (metric === 'usage'
                        ? <StatusBadge status={o.status.usage} value={pctText(o.usageRatio)} />
                        : <span className="tabular-nums text-slate-700">{pctText(o.usageRatio)}</span>)
                      : <span className="text-xs text-slate-400">no opname</span>}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right font-medium tabular-nums ${!o.hasOpname ? 'text-slate-300' : excess > 0.5 ? 'text-red-700' : 'text-emerald-700'}`}>
                    {o.hasOpname ? `${excess > 0 ? '+' : ''}${formatCurrency(Math.round(excess))}` : '–'}
                  </td>
                  <td className={`whitespace-nowrap px-3 py-2 text-right tabular-nums ${o.variance < -0.5 ? 'text-red-700' : 'text-slate-600'}`}>
                    {formatCurrency(Math.round(o.variance))}
                    {o.pendingVariance !== 0 && <span className="block text-[11px] text-amber-700">{formatCurrency(Math.round(o.pendingVariance))} pending</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <StatusBadge status={o.status.waste} value={pctText(waste)} title={formatCurrency(Math.round(o.otherUsage))} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-600">
                    {formatCurrency(Math.round(o.purchases))}
                    <span className="block text-[11px] text-slate-400">{pctText(sales(o, basis) ? (o.purchases / sales(o, basis)) * 100 : null)} of sales</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right" title={rel?.reasons.map(r => `• ${r.text}`).join('\n') || 'Final: opnames posted, no data issue'}>
                    {rel && <ReliabilityPill level={rel.level} />}
                  </td>
                </tr>
              );
            })}
            {!rows.length && (
              <tr><td colSpan={COLUMNS.length} className="px-3 py-10 text-center text-sm text-slate-400">No outlets match</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
        Click an outlet for its items, trend and purchase forecast. Excess = actual − recipes (red: used more than the recipes allow). Hover the data status for the reasons.
      </p>
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
