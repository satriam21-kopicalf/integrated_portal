'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { formatCurrency, formatNumber } from '@/lib/format';
import { base, categoryAxis, INK, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import { compactRupiah, DeductionsResponse, longDate, Resource, shortDate } from '@/lib/overview';
import { Card } from './Card';

function VoidRateChart({ data }: { data: DeductionsResponse }) {
  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 12, top: 18, bottom: 4, containLabel: true },
    tooltip: tooltip({
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: INK.axis } },
      formatter: (items: { dataIndex: number }[]) => {
        const d = data.daily[items[0]?.dataIndex ?? 0];
        return tipTitle(longDate(d.date))
          + tipRow(INK.accent, `${d.voidRate.toFixed(2)}%`, 'void rate', 'line')
          + tipFooter(`${formatNumber(d.voidBills)} of ${formatNumber(d.bills)} transactions · ${compactRupiah(d.voidSubtotal)}`);
      },
    }),
    xAxis: categoryAxis(data.daily.map(d => shortDate(d.date)), { boundaryGap: false }),
    yAxis: valueAxis(v => `${v}%`, { splitNumber: 3 }),
    series: [{
      type: 'line',
      data: data.daily.map(d => d.voidRate),
      symbol: 'none',
      lineStyle: { color: INK.accent, width: 2 },
      areaStyle: { color: 'rgba(42,120,214,0.08)' },
      markLine: {
        symbol: 'none',
        silent: true,
        lineStyle: { color: '#64748b', type: 'dotted' },
        label: { formatter: `Period ${data.voidRate.toFixed(2)}%`, color: INK.secondary, fontSize: 11, position: 'insideEndTop' },
        data: [{ yAxis: data.voidRate }],
      },
    }],
  }), [data]);
  return <EChart option={option} height={140} ariaLabel="Void and cancelled transactions as a share of all transactions per day" />;
}

export default function DeductionsCard({ resource }: { resource: Resource<DeductionsResponse> }) {
  return (
    <Card
      title="Deductions"
      subtitle="Void, cancelled and other-cost bills, excluded from sales"
      resource={resource}
      minHeight={380}
    >
      {data => {
        const t = data.totals;
        const flagged = data.branches.filter(b => b.status === 'review');
        const list = (flagged.length ? flagged : data.branches).slice(0, 6);
        return (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Stat label="Void & cancelled" value={compactRupiah(t.void.subtotal)} detail={`${formatNumber(t.void.bills)} bills · ${data.voidRate.toFixed(2)}%`} title={formatCurrency(t.void.subtotal)} />
              <Stat
                label="Other cost"
                value={compactRupiah(t.otherCost.subtotal)}
                detail={data.otherCostByMethod.length ? data.otherCostByMethod.map(m => `${m.method} ${formatNumber(m.bills)}`).join(' · ') : 'none'}
                title={formatCurrency(t.otherCost.subtotal)}
              />
              <Stat label="Open bills" value={compactRupiah(t.open.subtotal)} detail={`${formatNumber(t.open.bills)} bills`} title={formatCurrency(t.open.subtotal)} />
            </dl>

            {data.daily.length > 1 && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Void rate per day</p>
                <VoidRateChart data={data} />
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                {flagged.length
                  ? `${flagged.length} ${flagged.length === 1 ? 'branch' : 'branches'} above the P90 void rate (${data.threshold?.toFixed(2)}%)`
                  : 'Highest void rates'}
              </p>
              <ul className="divide-y divide-slate-100">
                {list.map(b => (
                  <li key={b.branchCode} className="flex items-center gap-2 py-1.5 text-xs">
                    {b.status === 'review' ? (
                      <span className="inline-flex w-[4.5rem] flex-shrink-0 items-center gap-1 font-medium text-amber-700">
                        <AlertTriangle size={13} aria-hidden /> Review
                      </span>
                    ) : (
                      <span className="inline-flex w-[4.5rem] flex-shrink-0 items-center gap-1 text-slate-500">
                        <CheckCircle2 size={13} aria-hidden /> Normal
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-slate-700" title={b.branchName}>{b.branchName}</span>
                    <span className="flex-shrink-0 tabular-nums text-slate-500">{formatNumber(b.voidBills)} void</span>
                    <span className="w-14 flex-shrink-0 text-right font-medium tabular-nums text-slate-900">{b.voidRate.toFixed(2)}%</span>
                  </li>
                ))}
                {!list.length && <li className="py-4 text-center text-slate-400">No void or other-cost transactions</li>}
              </ul>
            </div>
          </div>
        );
      }}
    </Card>
  );
}

function Stat({ label, value, detail, title }: { label: string; value: string; detail: string; title?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-2.5" title={title}>
      <dt className="truncate text-[11px] text-slate-500">{label}</dt>
      <dd className="mt-0.5 truncate text-sm font-semibold text-slate-900 sm:text-base">{value}</dd>
      <dd className="truncate text-[11px] text-slate-500" title={detail}>{detail}</dd>
    </div>
  );
}
