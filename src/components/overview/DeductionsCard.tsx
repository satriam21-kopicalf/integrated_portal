'use client';

import { useMemo } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { formatCurrency, formatNumber, fixed } from '@/lib/format';
import { base, categoryAxis, INK, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import { compactRupiah, DeductionsResponse, GROUP_COLORS, GROUP_LABELS, longDate, Resource, shortDate } from '@/lib/overview';
import { Card, Delta } from './Card';
import { to, useDrill } from './drill/DrillContext';
import { tr } from '@/lib/i18n';

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
          + tipRow(INK.accent, `${fixed(d.voidRate, 2)}%`, 'void rate', 'line')
          + tipFooter(tr('{0} of {1} transactions · {2}', formatNumber(d.voidBills), formatNumber(d.bills), compactRupiah(d.voidSubtotal)));
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
        label: { formatter: tr('Period {0}%', fixed(data.voidRate, 2)), color: INK.secondary, fontSize: 11, position: 'insideEndTop' },
        data: [{ yAxis: data.voidRate }],
      },
    }],
  }), [data]);
  return <EChart option={option} height={140} ariaLabel={tr('Void and cancelled transactions as a share of all transactions per day')} />;
}

export default function DeductionsCard({ resource }: { resource: Resource<DeductionsResponse> }) {
  const drill = useDrill();
  return (
    <Card
      title={tr('Deductions')}
      info="deductions"
      subtitle={tr('Void, cancelled and other-cost bills, excluded from sales')}
      resource={resource}
      minHeight={380}
      onOpen={() => drill.open({ kind: 'deductions' })}
    >
      {data => {
        const t = data.totals;
        const flagged = data.branches.filter(b => b.status === 'review');
        const list = (flagged.length ? flagged : data.branches).slice(0, 6);
        return (
          <div className="space-y-4">
            <dl className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Stat label={tr('Void & cancelled')} value={compactRupiah(t.void.subtotal)} detail={tr('{0} bills · {1}%', formatNumber(t.void.bills), fixed(data.voidRate, 2))} title={formatCurrency(t.void.subtotal)} />
              <Stat
                label={tr('Other cost')}
                value={compactRupiah(t.otherCost.subtotal)}
                detail={data.otherCostByMethod.length ? data.otherCostByMethod.map(m => `${m.method} ${formatNumber(m.bills)}`).join(' · ') : 'none'}
                title={formatCurrency(t.otherCost.subtotal)}
              />
              <Stat label={tr('Open bills')} value={compactRupiah(t.open.subtotal)} detail={tr('{0} bills', formatNumber(t.open.bills))} title={formatCurrency(t.open.subtotal)} />
            </dl>

            <ChannelGroups data={data} />

            {data.daily.length > 1 && (
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">{tr('Void rate per day')}</p>
                <VoidRateChart data={data} />
              </div>
            )}

            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-500">
                {flagged.length
                  ? tr('{0} {1} above the P90 void rate ({2}%)', flagged.length, flagged.length === 1 ? tr('branch') : tr('branches'), fixed(data.threshold, 2))
                  : tr('Highest void rates')}
              </p>
              <ul className="divide-y divide-slate-100">
                {list.map(b => (
                  <li key={b.branchCode} onClick={() => drill.open(to.branch(b.branchCode, b.branchName))} className="flex cursor-pointer items-center gap-2 py-1.5 text-xs hover:bg-blue-50/50">
                    {b.status === 'review' ? (
                      <span className="inline-flex w-[4.5rem] flex-shrink-0 items-center gap-1 font-medium text-amber-700">
                        <AlertTriangle size={13} aria-hidden /> {tr('Review')}
                      </span>
                    ) : (
                      <span className="inline-flex w-[4.5rem] flex-shrink-0 items-center gap-1 text-slate-500">
                        <CheckCircle2 size={13} aria-hidden /> {tr('Normal')}
                      </span>
                    )}
                    <span className="min-w-0 flex-1 truncate text-slate-700" title={b.branchName}>{b.branchName}</span>
                    <span className="flex-shrink-0 tabular-nums text-slate-500">{formatNumber(b.voidBills)} {tr('void')}</span>
                    <span className="w-14 flex-shrink-0 text-right font-medium tabular-nums text-slate-900">{fixed(b.voidRate, 2)}%</span>
                  </li>
                ))}
                {!list.length && <li className="py-4 text-center text-slate-400">{tr('No void or other-cost transactions')}</li>}
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

/** Offline (Dine In, Takeaway) next to online (delivery apps, online order). */
export function ChannelGroups({ data }: { data: DeductionsResponse }) {
  const groups = (data.groups ?? []).filter(g => g.group !== 'other');
  if (!groups.length) return null;
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {groups.map(g => {
        const deltaPp = g.previousVoidRate === null || g.previousVoidRate === undefined ? null : g.voidRate - g.previousVoidRate;
        return (
          <div key={g.group} className="min-w-0 rounded-lg border border-slate-200 px-3 py-2.5">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: GROUP_COLORS[g.group] }} />
              {GROUP_LABELS[g.group]}
              <span className="font-normal normal-case tracking-normal text-slate-400">{g.group === 'offline' ? tr('Dine In, Takeaway') : tr('GoFood, GrabFood, ShopeeFood')}</span>
            </p>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-lg font-semibold tabular-nums text-slate-900" title={tr('Void & cancelled bills ÷ all bills')}>{fixed(g.voidRate, 2)}%</span>
              <span className="text-[11px] text-slate-500">{tr('void rate')}</span>
              <Delta value={deltaPp} upIsGood={false} unit=" pp" />
            </div>
            <dl className="mt-1 grid grid-cols-2 gap-x-3 text-[11px] text-slate-500">
              <div><dt className="inline">{tr('Void')} </dt><dd className="inline font-medium tabular-nums text-slate-700">{formatNumber(g.voidBills)} · {compactRupiah(g.voidSubtotal)}</dd></div>
              <div><dt className="inline">{tr('Share of voids')} </dt><dd className="inline font-medium tabular-nums text-slate-700">{fixed((g.voidShare ?? 0), 1)}%</dd></div>
              <div><dt className="inline">{tr('Other cost')} </dt><dd className="inline font-medium tabular-nums text-slate-700">{formatNumber(g.otherCostBills)} · {compactRupiah(g.otherCostSubtotal)}</dd></div>
              <div><dt className="inline">{tr('Open')} </dt><dd className="inline font-medium tabular-nums text-slate-700">{formatNumber(g.openBills)}</dd></div>
            </dl>
          </div>
        );
      })}
    </div>
  );
}
