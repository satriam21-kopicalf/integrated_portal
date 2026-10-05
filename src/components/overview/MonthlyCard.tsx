'use client';

import { useMemo } from 'react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { formatCurrency } from '@/lib/format';
import { base, categoryAxis, changeHtml, INK, rupiahAxis, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import { compactRupiah, MonthlyResponse, MonthRow, Resource } from '@/lib/overview';
import { Card, Delta } from './Card';
import { to, useDrill } from './drill/DrillContext';
import { bucketRange } from './drill/parts';

export const monthLabel = (m: string, style: 'short' | 'long' = 'short') =>
  new Date(`${m}T00:00:00`).toLocaleDateString('en-GB', { month: style, year: style === 'short' ? '2-digit' : 'numeric' });

export function MonthlyChart({ months, onSelect, height = 240 }: { months: MonthRow[]; onSelect?: (m: MonthRow) => void; height?: number }) {
  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 8, top: 26, bottom: 4, containLabel: true },
    tooltip: tooltip({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } },
      formatter: (items: { dataIndex: number }[]) => {
        const m = months[items[0]?.dataIndex ?? 0];
        return tipTitle(`${monthLabel(m.month, 'long')}${m.partial ? ` (first ${m.days} days)` : ''}`)
          + tipRow(INK.accent, formatCurrency(Math.round(m.avgDaily ?? 0)), 'average per day')
          + tipRow(INK.accent, compactRupiah(m.subtotal), `month total · ${m.branches} branches`)
          + tipFooter(`MoM ${changeHtml(m.momPct)} · YoY ${changeHtml(m.yoyPct)}<br/>Same-store ${changeHtml(m.sameStore.growthPct)} (${m.sameStore.branches} branches)`);
      },
    }),
    xAxis: categoryAxis(months.map(m => monthLabel(m.month))),
    yAxis: valueAxis(rupiahAxis, { splitNumber: 4 }),
    series: [{
      type: 'bar',
      barMaxWidth: 34,
      data: months.map(m => ({
        value: Math.round(m.avgDaily ?? 0),
        itemStyle: { color: m.partial ? '#9ec5f4' : INK.accent, borderRadius: [4, 4, 0, 0] },
      })),
      label: {
        show: true,
        position: 'top',
        fontSize: 10,
        color: INK.secondary,
        formatter: (p: { dataIndex: number; value: number }) => compactRupiah(p.value).replace('Rp ', ''),
      },
    }],
  }), [months]);
  return <EChart option={option} height={height} ariaLabel="Average sales per day for each month" onClick={onSelect ? p => { if (months[p.dataIndex]) onSelect(months[p.dataIndex]); } : undefined} />;
}

export default function MonthlyCard({ resource }: { resource: Resource<MonthlyResponse> }) {
  const drill = useDrill();
  return (
    <Card
      title="Monthly growth"
      subtitle="Average sales per calendar day, so partial and 30/31-day months compare fairly · lighter bar = month in progress"
      resource={resource}
      minHeight={320}
      onOpen={() => drill.open({ kind: 'monthly' })}
    >
      {data => {
        const months = data.months;
        const openMonth = (m: MonthRow) => {
          const [from, until] = bucketRange(m.month, 'month', data.filters.from, data.filters.to);
          drill.open(to.period(from, until, monthLabel(m.month, 'long')));
        };
        return (
          <div className="grid gap-4 xl:grid-cols-5">
            <div className="min-w-0 xl:col-span-3">
              <MonthlyChart months={months} onSelect={openMonth} />
            </div>
            <div className="custom-scrollbar min-w-0 overflow-auto xl:col-span-2" style={{ maxHeight: 260 }}>
              <table className="w-full min-w-[22rem] whitespace-nowrap text-xs">
                <caption className="sr-only">Monthly sales and growth</caption>
                <thead className="sticky top-0 bg-white text-slate-500">
                  <tr>
                    <th scope="col" className="py-1.5 pr-2 text-left font-medium">Month</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium">Sales</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium" title="vs previous month, per day">MoM</th>
                    <th scope="col" className="px-2 py-1.5 text-right font-medium" title="vs same month last year, per day">YoY</th>
                    <th scope="col" className="py-1.5 pl-2 text-right font-medium" title="Branches open ≥90% of the days in both months">Same-store</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {[...months].reverse().map(m => (
                    <tr key={m.month} onClick={() => openMonth(m)} className="cursor-pointer hover:bg-blue-50/50">
                      <td className="py-1.5 pr-2 text-slate-700">
                        {monthLabel(m.month)}
                        {m.partial && <span className="ml-1 text-slate-400">({m.days}d)</span>}
                      </td>
                      <td className="px-2 py-1.5 text-right tabular-nums text-slate-900" title={formatCurrency(m.subtotal)}>{compactRupiah(m.subtotal)}</td>
                      <td className="px-2 py-1.5 text-right"><Delta value={m.momPct} /></td>
                      <td className="px-2 py-1.5 text-right"><Delta value={m.yoyPct} /></td>
                      <td className="py-1.5 pl-2 text-right" title={`${m.sameStore.branches} branches`}><Delta value={m.sameStore.growthPct} /></td>
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
