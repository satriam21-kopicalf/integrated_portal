'use client';

// Tax / PB1 of the period (integrated_portal_be /api/overview/tax, migration 074): ESB's VAT plus its other tax on the
// subtotal of dine-in and takeaway bills. The total with its rate on gross sales, the tax per day (bars) with the rate
// (line), per channel and per branch (the branches that charged none in the period listed apart).

import { useMemo, useState } from 'react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { formatCurrency, formatNumber, fixed } from '@/lib/format';
import { base, categoryAxis, INK, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import { channelLabel, compactRupiah, longDate, Resource, shortDate, TaxResponse } from '@/lib/overview';
import { Card, CardTabs, Delta } from './Card';
import { tr } from '@/lib/i18n';

type View = 'trend' | 'channels' | 'branches';

function TaxTrend({ data }: { data: TaxResponse }) {
  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 8, top: 18, bottom: 4, containLabel: true },
    tooltip: tooltip({
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (items: { dataIndex: number }[]) => {
        const d = data.series[items[0]?.dataIndex ?? 0];
        return tipTitle(longDate(d.date)) + tipRow(INK.accent, formatCurrency(d.tax), tr('Tax / PB1'), 'square')
          + tipRow('#f59e0b', `${fixed(d.rate ?? 0, 2)}%`, tr('of gross sales'), 'line')
          + tipFooter(tr('gross sales {0}', compactRupiah(d.subtotal)));
      },
    }),
    xAxis: categoryAxis(data.series.map(d => shortDate(d.date))),
    yAxis: [valueAxis(v => compactRupiah(v), { splitNumber: 3 }), { ...valueAxis(v => `${v}%`, { splitNumber: 3 }), splitLine: { show: false } }],
    series: [
      { type: 'bar', data: data.series.map(d => d.tax), barMaxWidth: 18, itemStyle: { color: INK.accent, borderRadius: [4, 4, 0, 0] } },
      { type: 'line', yAxisIndex: 1, data: data.series.map(d => d.rate), symbol: 'none', lineStyle: { color: '#f59e0b', width: 2 } },
    ],
  }), [data]);
  return <EChart option={option} height={200} ariaLabel={tr('Tax / PB1 per day and its rate on gross sales')} />;
}

function Rows({ rows, label, limit }: { rows: TaxResponse['channels']; label: (k: string) => string; limit?: number }) {
  const shown = limit ? rows.slice(0, limit) : rows;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wide text-neutral-400">
          <tr><th className="py-2 pr-3 font-medium" /><th className="px-2 py-2 text-right font-medium">{tr('Tax / PB1')}</th>
            <th className="px-2 py-2 text-right font-medium">{tr('Rate')}</th><th className="px-2 py-2 text-right font-medium">{tr('Bills Taxed')}</th>
            <th className="py-2 pl-2 text-right font-medium">{tr('Share')}</th></tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {shown.map(r => (
            <tr key={r.key}>
              <td className="max-w-[12rem] truncate py-2 pr-3 text-neutral-800">{label(r.key)}</td>
              <td className={`whitespace-nowrap px-2 py-2 text-right tabular-nums ${r.tax ? 'font-medium text-neutral-900' : 'text-neutral-400'}`}>{formatCurrency(r.tax ?? 0)}</td>
              <td className="px-2 py-2 text-right tabular-nums text-neutral-600">{r.rate != null ? `${fixed(r.rate, 1)}%` : '—'}</td>
              <td className="px-2 py-2 text-right tabular-nums text-neutral-600">{r.taxedPct != null ? `${fixed(r.taxedPct, 0)}%` : '—'}</td>
              <td className="py-2 pl-2">
                <span className="flex items-center justify-end gap-2">
                  <span className="h-1.5 w-14 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, r.share ?? 0)}%` }} /></span>
                  <span className="w-10 text-right text-xs tabular-nums text-neutral-500">{fixed(r.share ?? 0, 1)}%</span>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function TaxCard({ resource }: { resource: Resource<TaxResponse> }) {
  const [view, setView] = useState<View>('trend');
  return (
    <Card title={tr('Tax / PB1')} subtitle={tr('Tax charged on the subtotal of dine-in and takeaway bills (ESB VAT + other tax)')} resource={resource} minHeight={380}
      tabs={<CardTabs label={tr('View')} value={view} onChange={setView} options={[
        { value: 'trend', label: tr('Per Day') }, { value: 'channels', label: tr('Per Channel') }, { value: 'branches', label: tr('Per Branch') }]} />}>
      {data => {
        const t = data.total;
        const untaxed = data.branches.filter(b => !b.tax);
        return (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Figure label={tr('Tax / PB1')} value={formatCurrency(t.tax ?? 0)} sub={<Delta value={t.deltaPct} />} />
              <Figure label={tr('Rate on Gross Sales')} value={t.rate != null ? `${fixed(t.rate, 2)}%` : '—'} sub={tr('gross sales {0}', compactRupiah(t.subtotal ?? 0))} />
              <Figure label={tr('Bills Taxed')} value={t.taxedPct != null ? `${fixed(t.taxedPct, 1)}%` : '—'} sub={tr('{0} of {1}', formatNumber(t.taxedBills), formatNumber(t.bills))} />
              <Figure label={tr('Branches Charging')} value={formatNumber(t.branches)} sub={t.untaxedBranches ? tr('{0} without tax', formatNumber(t.untaxedBranches)) : tr('every branch')} />
            </div>
            {view === 'trend' && <TaxTrend data={data} />}
            {view === 'channels' && <Rows rows={data.channels} label={channelLabel} />}
            {view === 'branches' && (
              <>
                <Rows rows={data.branches.filter(b => b.tax)} label={k => data.branches.find(b => b.key === k)?.name ?? k} limit={15} />
                {untaxed.length > 0 && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {tr('No tax in this period: {0}', untaxed.slice(0, 12).map(b => b.name).join(', '))}{untaxed.length > 12 ? ` ${tr('+{0} more', untaxed.length - 12)}` : ''}
                  </p>
                )}
              </>
            )}
          </div>
        );
      }}
    </Card>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-neutral-50 px-3 py-2">
      <p className="text-[10px] font-medium uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums text-neutral-900">{value}</p>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}
