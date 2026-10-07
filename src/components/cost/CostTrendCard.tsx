'use client';

import { useMemo, useState } from 'react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { Legend } from '@/components/charts/common';
import { Card, DataTable, Segmented } from '@/components/overview/Card';
import { base, categoryAxis, INK, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import { Basis, cogsPct, CostSettings, pctText, periodLabel, sales, TrendResponse, useCostControl } from '@/lib/costControl';
import { formatCurrency } from '@/lib/format';

const ACTUAL = '#2a78d6';
const THEORETICAL = '#a8a29e';

export default function CostTrendCard({ query, basis, settings, branch, defaultGrain = 'month' }: {
  query: string;
  basis: Basis;
  settings: CostSettings | undefined;
  branch?: string;
  /** "period" for short ranges, where months would be one or two points */
  defaultGrain?: 'period' | 'month';
}) {
  const [chosen, setGrain] = useState<'period' | 'month' | null>(null);
  const grain = chosen ?? defaultGrain;
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const q = `${query}&grain=${grain}${branch ? `&branch=${encodeURIComponent(branch)}` : ''}`;
  const resource = useCostControl<TrendResponse>('trend', q);

  return (
    <Card
      title="COGS trend"
      subtitle={`Actual vs recipes, % of ${basis === 'net' ? 'net sales' : 'subtotal'} — the gap between the lines is the excess`}
      info="costTrend"
      resource={resource}
      minHeight={340}
      actions={
        <>
          <Segmented label="Grain" value={grain} options={[{ value: 'month', label: 'Month' }, { value: 'period', label: 'Opname period' }]} onChange={setGrain} />
          <Segmented label="View" value={view} options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} onChange={setView} />
        </>
      }
    >
      {data => <TrendBody data={data} basis={basis} view={view} settings={settings} />}
    </Card>
  );
}

function TrendBody({ data, basis, view, settings }: { data: TrendResponse; basis: Basis; view: 'chart' | 'table'; settings?: CostSettings }) {
  const s = data.series;
  const label = (i: number) => (data.filters.grain === 'month'
    ? new Date(`${s[i].start}T00:00:00`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' })
    : periodLabel(s[i].start, s[i].end));
  const actual = s.map(p => cogsPct(p, basis, 'actual'));
  const theoretical = s.map(p => cogsPct(p, basis, 'theoretical'));
  const target = settings?.cogs_bands.good;

  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 24, top: 24, bottom: 8, containLabel: true },
    tooltip: tooltip({
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: INK.axis } },
      formatter: (items: { dataIndex: number }[]) => {
        const i = items[0]?.dataIndex ?? 0;
        let html = tipTitle(label(i));
        html += tipRow(ACTUAL, pctText(actual[i]), 'Actual COGS', 'line');
        html += tipRow(THEORETICAL, pctText(theoretical[i]), 'Theoretical (recipes)', 'line');
        html += tipFooter(`${basis === 'net' ? 'Net sales' : 'Subtotal'} ${formatCurrency(Math.round(sales(s[i], basis)))}`
          + (s[i].hasOpname ? ` · excess vs recipes ${formatCurrency(Math.round(s[i].actualCogs - s[i].theoreticalCogs))}` : ' · no opname in this period'));
        return html;
      },
    }),
    xAxis: categoryAxis(s.map((_, i) => label(i)), { boundaryGap: false }),
    yAxis: valueAxis((v: number) => `${v}%`, { scale: true, splitNumber: 4 }),
    series: [
      {
        name: 'Theoretical',
        type: 'line',
        data: theoretical,
        symbol: 'none',
        lineStyle: { color: THEORETICAL, width: 2, type: 'dashed' },
        itemStyle: { color: THEORETICAL },
        z: 1,
      },
      {
        name: 'Actual',
        type: 'line',
        data: actual,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { color: ACTUAL, width: 2.5 },
        itemStyle: { color: ACTUAL, borderColor: '#fff', borderWidth: 2 },
        markLine: target ? {
          symbol: 'none',
          silent: true,
          lineStyle: { color: '#16a34a', type: 'dotted', width: 1 },
          label: { formatter: `Target ≤ ${target}%`, color: '#15803d', fontSize: 11, position: 'insideEndTop' },
          data: [{ yAxis: target }],
        } : undefined,
        z: 2,
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data, basis, target]);

  if (!s.length) return <p className="py-16 text-center text-sm text-slate-400">No cost data for this period yet</p>;
  if (view === 'table') {
    return (
      <DataTable
        caption="COGS per period"
        columns={[
          { key: 'p', label: data.filters.grain === 'month' ? 'Month' : 'Period' },
          { key: 's', label: basis === 'net' ? 'Net sales' : 'Subtotal', align: 'right' },
          { key: 't', label: 'Theoretical', align: 'right' },
          { key: 'a', label: 'Actual', align: 'right' },
          { key: 'u', label: 'Usage', align: 'right' },
          { key: 'v', label: 'Stock variance', align: 'right' },
        ]}
        rows={s.map((p, i) => ({
          key: p.start,
          cells: {
            p: label(i),
            s: formatCurrency(Math.round(sales(p, basis))),
            t: pctText(theoretical[i]),
            a: pctText(actual[i]),
            u: p.hasOpname ? pctText(p.usageRatio) : '–',
            v: formatCurrency(Math.round(p.variance)),
          },
        }))}
        maxHeight={320}
      />
    );
  }
  return (
    <div className="space-y-1">
      <Legend items={[
        { key: 'a', label: 'Actual COGS', color: ACTUAL, shape: 'line' },
        { key: 't', label: 'Theoretical (recipes, dashed)', color: THEORETICAL, shape: 'line' },
      ]} />
      <EChart option={option} height={300} ariaLabel="Actual and theoretical COGS percentage per period" />
    </div>
  );
}
