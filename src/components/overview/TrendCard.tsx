'use client';

import { useMemo, useState } from 'react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { Legend } from '@/components/charts/common';
import { formatCurrency, formatNumber } from '@/lib/format';
import { base, categoryAxis, changeHtml, INK, rupiahAxis, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import {
  bucketLabel, compactNumber, compactRupiah, Granularity, shortDate, TrendPoint, TrendResponse, useOverview,
} from '@/lib/overview';
import { Card, DataTable, Delta, Segmented } from './Card';

type Metric = 'subtotal' | 'bills' | 'avgTicket';
const METRICS: { value: Metric; label: string }[] = [
  { value: 'subtotal', label: 'Sales' },
  { value: 'bills', label: 'Bills' },
  { value: 'avgTicket', label: 'Avg ticket' },
];

function metricOf(p: { subtotal: number; bills: number }, m: Metric): number | null {
  if (m === 'avgTicket') return p.bills ? p.subtotal / p.bills : null;
  return p[m];
}

const pct = (cur: number | null, prev: number | null) => (cur !== null && prev ? ((cur - prev) / prev) * 100 : null);

export default function TrendCard({ query }: { query: string }) {
  const [granularity, setGranularity] = useState<Granularity | 'auto'>('auto');
  const [metric, setMetric] = useState<Metric>('subtotal');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const resource = useOverview<TrendResponse>('trend', granularity === 'auto' ? query : `${query}&granularity=${granularity}`);

  return (
    <Card
      title="Sales trend"
      subtitle="This period compared with the previous period of the same length"
      resource={resource}
      minHeight={360}
      actions={
        <>
          <Segmented label="Metric" value={metric} options={METRICS} onChange={setMetric} />
          <Segmented
            label="Granularity"
            value={granularity === 'auto' ? resource.data?.granularity ?? 'day' : granularity}
            options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]}
            onChange={setGranularity}
          />
          <Segmented label="View" value={view} options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} onChange={setView} />
        </>
      }
    >
      {data => <TrendBody data={data} metric={metric} view={view} />}
    </Card>
  );
}

function TrendBody({ data, metric, view }: { data: TrendResponse; metric: Metric; view: 'chart' | 'table' }) {
  const g = data.granularity;
  const s: TrendPoint[] = data.series;
  const hasPrev = data.filters.previous.complete;
  const money = metric !== 'bills';
  const label = METRICS.find(m => m.value === metric)!.label;
  const fmt = (v: number) => (money ? formatCurrency(Math.round(v)) : formatNumber(Math.round(v)));
  const current = s.map(p => metricOf(p, metric));
  const previous = s.map(p => (hasPrev ? metricOf(p.previous, metric) : null));
  const prevDate = (i: number) => {
    const d = new Date(`${s[i].date}T00:00:00`);
    d.setDate(d.getDate() - data.filters.days);
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };

  const option = useMemo<ChartOption>(() => {
    const valid = current.filter((v): v is number => v !== null);
    const avg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
    return {
      ...base,
      grid: { left: 4, right: 24, top: 30, bottom: s.length > 62 ? 52 : 8, containLabel: true },
      tooltip: tooltip({
        trigger: 'axis',
        axisPointer: { type: 'line', lineStyle: { color: INK.axis } },
        formatter: (items: { dataIndex: number }[]) => {
          const i = items[0]?.dataIndex ?? 0;
          let html = tipTitle(bucketLabel(s[i].date, g));
          html += tipRow(INK.accent, current[i] === null ? '-' : fmt(current[i]!), 'This period', 'line');
          if (hasPrev) {
            html += tipRow(INK.previous, previous[i] === null ? '-' : fmt(previous[i]!), g === 'day' ? `Previous (${prevDate(i)})` : 'Previous period', 'line');
            html += tipFooter(`Change ${changeHtml(pct(current[i], previous[i]))}`);
          }
          return html;
        },
      }),
      xAxis: categoryAxis(s.map(p => shortDate(p.date, g)), { boundaryGap: false }),
      // fitted scale (not from zero) so day-to-day movement is readable; hence no area fill
      yAxis: valueAxis(money ? rupiahAxis : compactNumber, { scale: true, splitNumber: 4 }),
      dataZoom: s.length > 62 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8, borderColor: INK.grid }] : [],
      series: [
        ...(hasPrev ? [{
          name: 'Previous period',
          type: 'line',
          data: previous,
          symbol: 'none',
          lineStyle: { color: INK.previous, width: 2, type: 'dashed' },
          itemStyle: { color: INK.previous },
          z: 1,
        }] : []),
        {
          name: 'This period',
          type: 'line',
          data: current,
          symbol: 'circle',
          symbolSize: 7,
          showSymbol: s.length <= 31,
          lineStyle: { color: INK.accent, width: 2.5 },
          itemStyle: { color: INK.accent, borderColor: '#fff', borderWidth: 2 },
          emphasis: { focus: 'none', scale: 1.4 },
          markLine: valid.length > 2 ? {
            symbol: 'none',
            silent: true,
            lineStyle: { color: '#64748b', type: 'dotted', width: 1 },
            label: { formatter: `Avg ${money ? compactRupiah(avg) : compactNumber(avg)}`, color: INK.secondary, fontSize: 11, position: 'insideStartTop' },
            data: [{ yAxis: avg }],
          } : undefined,
          markPoint: valid.length > 2 ? {
            symbol: 'pin',
            symbolSize: 0,
            label: {
              show: true,
              color: INK.primary,
              fontSize: 11,
              fontWeight: 600,
              backgroundColor: '#ffffff',
              borderColor: '#cbd5e1',
              borderWidth: 1,
              borderRadius: 6,
              padding: [3, 6],
              offset: [0, -14],
              formatter: (p: { name: string; value: number }) => `${p.name} ${money ? compactRupiah(p.value) : compactNumber(p.value)}`,
            },
            data: [{ type: 'max', name: 'High' }, { type: 'min', name: 'Low' }],
          } : undefined,
          z: 2,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, metric]);

  if (view === 'table') {
    return (
      <DataTable
        caption={`${label} per ${g}`}
        columns={[
          { key: 'date', label: g === 'day' ? 'Date' : g === 'week' ? 'Week of' : 'Month' },
          { key: 'cur', label: 'This period', align: 'right' },
          { key: 'prev', label: 'Previous', align: 'right' },
          { key: 'delta', label: 'Change', align: 'right' },
          { key: 'disc', label: 'Discount', align: 'right' },
        ]}
        rows={s.map((p, i) => ({
          key: p.date,
          cells: {
            date: bucketLabel(p.date, g),
            cur: current[i] === null ? '-' : fmt(current[i]!),
            prev: previous[i] === null ? '-' : fmt(previous[i]!),
            delta: <Delta value={pct(current[i], previous[i])} />,
            disc: p.discountPct === null ? '-' : `${p.discountPct.toFixed(1)}%`,
          },
        }))}
        maxHeight={340}
      />
    );
  }
  return (
    <div className="space-y-1">
      <Legend
        items={[
          { key: 'cur', label: `${label} · this period`, color: INK.accent, shape: 'line' },
          ...(hasPrev ? [{ key: 'prev', label: 'Previous period (dashed)', color: INK.previous, shape: 'line' as const }] : []),
        ]}
      />
      <EChart option={option} height={400} ariaLabel={`${label} per ${g}, this period compared with the previous period`} />
      {!hasPrev && <p className="text-xs text-slate-400">No comparison: the previous period starts before complete history (Aug 2025).</p>}
    </div>
  );
}
