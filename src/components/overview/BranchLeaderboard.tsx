'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Search } from 'lucide-react';
import Sparkline from '@/components/charts/Sparkline';
import { formatCurrency, formatNumber } from '@/lib/format';
import { BranchesResponse, BranchRow, compactRupiah, Resource } from '@/lib/overview';
import { Card, Delta } from './Card';

type SortKey = 'subtotal' | 'deltaPct' | 'bills' | 'avgTicket' | 'subtotalPerDay' | 'voidRate';
const COLUMNS: { key: SortKey; label: string; title: string }[] = [
  { key: 'subtotal', label: 'Sales', title: 'Sales subtotal in the period' },
  { key: 'deltaPct', label: 'Change', title: 'vs the previous period' },
  { key: 'bills', label: 'Bills', title: 'Sales transactions' },
  { key: 'avgTicket', label: 'Avg ticket', title: 'Sales ÷ bills' },
  { key: 'subtotalPerDay', label: 'Sales / day', title: 'Sales per day with sales' },
  { key: 'voidRate', label: 'Void rate', title: 'Void & cancelled ÷ all transactions' },
];
const PAGE = 10;

export default function BranchLeaderboard({ resource }: { resource: Resource<BranchesResponse> }) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'subtotal', desc: true });
  const [query, setQuery] = useState('');
  const [showAll, setShowAll] = useState(false);

  return (
    <Card
      title="Branch leaderboard"
      subtitle="Sales per branch with change vs the previous period"
      resource={resource}
      minHeight={360}
      actions={
        <label className="relative">
          <span className="sr-only">Search branch</span>
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search branch"
            className="h-8 w-40 rounded-lg border border-slate-200 pl-8 pr-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none sm:w-48"
          />
        </label>
      }
    >
      {data => <Board data={data} sort={sort} setSort={setSort} query={query} showAll={showAll} setShowAll={setShowAll} />}
    </Card>
  );
}

function Board({
  data, sort, setSort, query, showAll, setShowAll,
}: {
  data: BranchesResponse;
  sort: { key: SortKey; desc: boolean };
  setSort: (s: { key: SortKey; desc: boolean }) => void;
  query: string;
  showAll: boolean;
  setShowAll: (v: boolean) => void;
}) {
  const ranked = useMemo(() => {
    const byRank = new Map(data.branches.map((b, i) => [b.branchCode, i + 1]));
    const q = query.trim().toLowerCase();
    const rows = data.branches.filter(b => !q || b.branchName.toLowerCase().includes(q) || b.branchCode.toLowerCase().includes(q));
    const val = (b: BranchRow) => (b[sort.key] ?? Number.NEGATIVE_INFINITY) as number;
    rows.sort((a, b) => (sort.desc ? val(b) - val(a) : val(a) - val(b)));
    return rows.map(b => ({ ...b, rank: byRank.get(b.branchCode) ?? 0 }));
  }, [data.branches, query, sort]);

  const visible = showAll || query ? ranked : ranked.slice(0, PAGE);
  const total = data.branches.reduce((s, b) => s + b.subtotal, 0);
  const toggle = (key: SortKey) => setSort({ key, desc: sort.key === key ? !sort.desc : true });

  return (
    <div className="space-y-2">
      <p className="text-xs text-slate-500">
        {formatNumber(data.branches.filter(b => b.subtotal > 0).length)} branches with sales · {compactRupiah(total)} total
      </p>

      {/* Desktop table */}
      <div className="custom-scrollbar hidden overflow-x-auto md:block">
        <table className="w-full whitespace-nowrap text-xs">
          <caption className="sr-only">Branch leaderboard</caption>
          <thead className="border-b border-slate-200 text-slate-500">
            <tr>
              <th scope="col" className="w-8 py-2 pr-2 text-left font-medium">#</th>
              <th scope="col" className="py-2 pr-2 text-left font-medium">Branch</th>
              {COLUMNS.map(c => (
                <th key={c.key} scope="col" className="py-2 pl-2 text-right font-medium" aria-sort={sort.key === c.key ? (sort.desc ? 'descending' : 'ascending') : 'none'}>
                  <button type="button" onClick={() => toggle(c.key)} title={c.title} className={`inline-flex items-center gap-0.5 hover:text-slate-900 ${sort.key === c.key ? 'text-slate-900' : ''}`}>
                    {c.label}
                    {sort.key === c.key && (sort.desc ? <ArrowDown size={12} /> : <ArrowUp size={12} />)}
                  </button>
                </th>
              ))}
              <th scope="col" className="w-28 py-2 pl-3 text-left font-medium">Trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map(b => (
              <tr key={b.branchCode} className="hover:bg-slate-50/60">
                <td className="py-2 pr-2 tabular-nums text-slate-400">{b.rank}</td>
                <td className="max-w-[16rem] py-2 pr-2">
                  <p className="truncate font-medium text-slate-800" title={b.branchName}>{b.branchName}</p>
                  <p className="text-[11px] text-slate-400">
                    {b.branchCode}
                    {b.isNew && <span className="ml-1.5 rounded bg-blue-50 px-1 py-px font-medium text-blue-700">New</span>}
                  </p>
                </td>
                <td className="py-2 pl-2 text-right tabular-nums font-medium text-slate-900" title={formatCurrency(b.subtotal)}>{compactRupiah(b.subtotal)}</td>
                <td className="py-2 pl-2 text-right"><Delta value={b.deltaPct} /></td>
                <td className="py-2 pl-2 text-right tabular-nums text-slate-700">{formatNumber(b.bills)}</td>
                <td className="py-2 pl-2 text-right tabular-nums text-slate-700">{formatNumber(Math.round(b.avgTicket))}</td>
                <td className="py-2 pl-2 text-right tabular-nums text-slate-700">{compactRupiah(b.subtotalPerDay)}</td>
                <td className="py-2 pl-2 text-right tabular-nums text-slate-700">{b.voidRate === null ? '-' : `${b.voidRate.toFixed(2)}%`}</td>
                <td className="py-2 pl-3"><Sparkline values={b.spark} height={22} label={`${b.branchName} sales trend`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile cards */}
      <ol className="space-y-2 md:hidden">
        {visible.map(b => (
          <li key={b.branchCode} className="rounded-lg border border-slate-100 p-3">
            <div className="flex items-start gap-2">
              <span className="w-6 flex-shrink-0 text-xs tabular-nums text-slate-400">{b.rank}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-slate-800">{b.branchName}</p>
                <p className="text-[11px] text-slate-400">{b.branchCode} · {formatNumber(b.bills)} bills · void {b.voidRate === null ? '-' : `${b.voidRate.toFixed(2)}%`}</p>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums text-slate-900">{compactRupiah(b.subtotal)}</p>
                <Delta value={b.deltaPct} />
              </div>
            </div>
            <Sparkline className="mt-2" values={b.spark} height={20} />
          </li>
        ))}
      </ol>

      {!query && ranked.length > PAGE && (
        <button type="button" onClick={() => setShowAll(!showAll)} className="w-full rounded-lg py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900">
          {showAll ? 'Show top 10' : `Show all ${ranked.length} branches`}
        </button>
      )}
      {!visible.length && <p className="py-6 text-center text-sm text-slate-400">No branch matches “{query}”</p>}
    </div>
  );
}
