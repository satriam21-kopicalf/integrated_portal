'use client';

import ColumnChart from '@/components/charts/ColumnChart';
import { formatCurrency } from '@/lib/format';
import { compactRupiah, MonthlyResponse, Resource } from '@/lib/overview';
import { Card, Delta } from './Card';

const monthLabel = (m: string, style: 'short' | 'long' = 'short') =>
  new Date(`${m}T00:00:00`).toLocaleDateString('en-GB', { month: style, year: style === 'short' ? '2-digit' : 'numeric' });

export default function MonthlyCard({ resource }: { resource: Resource<MonthlyResponse> }) {
  return (
    <Card
      title="Monthly growth"
      subtitle="Average sales per calendar day, so partial and 30/31-day months compare fairly"
      resource={resource}
      minHeight={360}
    >
      {data => {
        const months = data.months;
        return (
          <div className="space-y-3">
            <ColumnChart
              ariaLabel="Average sales per day for each month"
              xLabels={months.map(m => monthLabel(m.month))}
              stacks={[{ key: 'avg', label: 'Avg sales / day', color: '#2a78d6', values: months.map(m => m.avgDaily ?? 0) }]}
              tooltipTitle={i => `${monthLabel(months[i].month, 'long')}${months[i].partial ? ` (${months[i].days} days)` : ''}`}
              formatValue={v => formatCurrency(Math.round(v))}
              formatTick={compactRupiah}
              muted={i => months[i].partial}
              tooltipFooter={i => `Month total ${compactRupiah(months[i].subtotal)} · ${months[i].branches} branches`}
              height={180}
            />
            <div className="custom-scrollbar overflow-x-auto">
              <table className="w-full min-w-[26rem] text-xs">
                <caption className="sr-only">Monthly sales and growth</caption>
                <thead className="text-slate-500">
                  <tr>
                    <th scope="col" className="py-1.5 pr-2 text-left font-medium">Month</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium">Sales</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium">Avg / day</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium" title="vs previous month, per day">MoM</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium" title="vs same month last year, per day">YoY</th>
                    <th scope="col" className="py-1.5 pl-2 text-right font-medium" title="Branches open ≥90% of the days in both months">Same-store</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...months].reverse().map(m => (
                    <tr key={m.month}>
                      <td className="py-1.5 pr-2 text-slate-700">
                        {monthLabel(m.month)}
                        {m.partial && <span className="ml-1 text-slate-400">({m.days}d)</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-900" title={formatCurrency(m.subtotal)}>{compactRupiah(m.subtotal)}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-700">{compactRupiah(m.avgDaily)}</td>
                      <td className="px-2 py-1.5 text-right"><Delta value={m.momPct} /></td>
                      <td className="px-2 py-1.5 text-right"><Delta value={m.yoyPct} /></td>
                      <td className="py-1.5 pl-2 text-right" title={`${m.sameStore.branches} branches`}>
                        <Delta value={m.sameStore.growthPct} />
                        <span className="ml-1 text-[10px] text-slate-400">{m.sameStore.branches}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }}
    </Card>
  );
}
