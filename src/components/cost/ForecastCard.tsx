'use client';

import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import { Card, Segmented } from '@/components/overview/Card';
import { ForecastOutlet, ForecastResponse, useCostControl } from '@/lib/costControl';
import { formatCurrency, formatDate } from '@/lib/format';

type Horizon = '7' | '14' | '30';
const HORIZON_LABEL: Record<Horizon, string> = { '7': '1 week', '14': '2 weeks', '30': '1 month' };

/** Estimated purchases per outlet for the next 1 / 2 / 4 weeks vs what the outlet bought so far. */
export default function ForecastCard({ branch = '', onSelect }: { branch?: string; onSelect: (branchCode: string) => void }) {
  const resource = useCostControl<ForecastResponse>('forecast', branch ? `branch=${encodeURIComponent(branch)}` : '');
  const [horizon, setHorizon] = useState<Horizon>('7');
  const [desc, setDesc] = useState(true);

  return (
    <Card
      title="Purchase forecast"
      subtitle="Estimated purchases per outlet from recent usage, sales trend and current stock"
      resource={resource}
      minHeight={300}
      actions={<Segmented label="Horizon" value={horizon} options={(['7', '14', '30'] as Horizon[]).map(h => ({ value: h, label: HORIZON_LABEL[h] }))} onChange={setHorizon} />}
    >
      {data => <Body data={data} horizon={horizon} desc={desc} onSort={() => setDesc(d => !d)} onSelect={onSelect} />}
    </Card>
  );
}

function Body({ data, horizon, desc, onSort, onSelect }: {
  data: ForecastResponse;
  horizon: Horizon;
  desc: boolean;
  onSort: () => void;
  onSelect: (code: string) => void;
}) {
  const key = `spend${horizon}` as const satisfies keyof ForecastOutlet;
  const rows = useMemo(() => [...data.outlets].sort((a, b) => (desc ? b[key] - a[key] : a[key] - b[key])), [data, key, desc]);
  const weeks = Number(horizon) / 7;
  const max = Math.max(1, ...rows.map(r => Math.max(r[key], r.avgWeeklyPurchases * weeks)));
  if (!rows.length) {
    return <p className="py-14 text-center text-sm text-slate-400">No usage in the last {data.settings.lookback_days} days to plan from yet</p>;
  }
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-4">
        <Fig label="Next 1 week" value={data.totals.spend7} />
        <Fig label="Next 2 weeks" value={data.totals.spend14} />
        <Fig label="Next 1 month" value={data.totals.spend30} />
        <Fig label="Bought per week (avg)" value={data.totals.avgWeeklyPurchases} muted />
      </dl>
      <div className="custom-scrollbar max-h-[460px] overflow-auto rounded-lg border border-slate-100">
        <table className="w-full text-xs">
          <thead className="sticky top-0 z-[1] bg-slate-50 text-slate-500">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Outlet</th>
              <th className="px-3 py-2 text-right font-medium">
                <button type="button" onClick={onSort} className="inline-flex items-center gap-1 hover:text-slate-900">
                  Estimate {HORIZON_LABEL[horizon]} {desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />}
                </button>
              </th>
              <th className="hidden px-3 py-2 text-left font-medium sm:table-cell" aria-label="Estimate vs recent purchases" />
              <th className="px-3 py-2 text-right font-medium">Bought ({HORIZON_LABEL[horizon]} avg)</th>
              <th className="px-3 py-2 text-right font-medium" title="Net sales last 14 days vs the 14 before">Sales trend</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(r => {
              const bought = r.avgWeeklyPurchases * weeks;
              return (
                <tr key={r.branchCode} onClick={() => onSelect(r.branchCode)} className="cursor-pointer hover:bg-slate-50/80">
                  <td className="max-w-[14rem] px-3 py-1.5"><span className="block truncate font-medium text-slate-800">{r.branchName}</span></td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right font-medium tabular-nums text-slate-900">{formatCurrency(Math.round(r[key]))}</td>
                  <td className="hidden w-40 px-3 py-1.5 sm:table-cell">
                    <div className="relative h-3" aria-hidden>
                      <div className="absolute inset-y-0 left-0 rounded-sm bg-blue-600" style={{ width: `${(r[key] / max) * 100}%` }} />
                      <div className="absolute inset-y-[-2px] w-0.5 bg-slate-500" style={{ left: `${Math.min(100, (bought / max) * 100)}%` }} title="Recent purchases" />
                    </div>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums text-slate-600">{formatCurrency(Math.round(bought))}</td>
                  <td className={`whitespace-nowrap px-3 py-1.5 text-right tabular-nums ${r.trendFactor > 1.005 ? 'text-emerald-700' : r.trendFactor < 0.995 ? 'text-red-700' : 'text-slate-500'}`}>
                    {r.trendFactor >= 1 ? '+' : '−'}{Math.abs((r.trendFactor - 1) * 100).toFixed(1)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-slate-400">
        As of {formatDate(data.asOf)}: usage of the last {data.settings.lookback_days} days (actual when a stock opname was taken, else recipes),
        scaled by the sales trend (capped ±{data.settings.trend_cap_pct}%), plus {data.settings.safety_days} days safety stock, minus current book stock, at HPP.
        Bar = estimate, line = recent purchases for the same length.
      </p>
    </div>
  );
}

function Fig({ label, value, muted = false }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className="bg-white px-3 py-2.5">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className={`mt-0.5 text-sm font-semibold tabular-nums ${muted ? 'text-slate-500' : 'text-slate-900'}`}>{formatCurrency(Math.round(value))}</dd>
    </div>
  );
}
