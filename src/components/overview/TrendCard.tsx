'use client';

import { useState } from 'react';
import LineChart from '@/components/charts/LineChart';
import { CHART, Legend } from '@/components/charts/common';
import { formatCurrency, formatNumber } from '@/lib/format';
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
const PRIMARY = '#2a78d6';

function metricOf(p: { subtotal: number; bills: number }, m: Metric): number | null {
  if (m === 'avgTicket') return p.bills ? p.subtotal / p.bills : null;
  return p[m];
}

export default function TrendCard({ query }: { query: string }) {
  const [granularity, setGranularity] = useState<Granularity | 'auto'>('auto');
  const [metric, setMetric] = useState<Metric>('subtotal');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const resource = useOverview<TrendResponse>('trend', granularity === 'auto' ? query : `${query}&granularity=${granularity}`);
  const money = metric !== 'bills';
  const fmt = (v: number) => (money ? formatCurrency(v) : formatNumber(Math.round(v)));
  const tick = (v: number) => (money ? compactRupiah(v) : compactNumber(v));

  return (
    <Card
      title="Sales trend"
      subtitle="This period vs the previous period of the same length"
      resource={resource}
      minHeight={300}
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
      {data => {
        const g = data.granularity;
        const s: TrendPoint[] = data.series;
        const hasPrev = data.filters.previous.complete;
        const current = s.map(p => metricOf(p, metric));
        const previous = s.map(p => (hasPrev ? metricOf(p.previous, metric) : null));
        const label = METRICS.find(m => m.value === metric)!.label;
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
                  date: `${bucketLabel(p.date, g)}${p.days < (g === 'week' ? 7 : g === 'month' ? 28 : 1) ? ` (${p.days}d)` : ''}`,
                  cur: current[i] === null ? '-' : fmt(current[i]!),
                  prev: previous[i] === null ? '-' : fmt(previous[i]!),
                  delta: <Delta value={current[i] !== null && previous[i] ? ((current[i]! - previous[i]!) / previous[i]!) * 100 : null} />,
                  disc: p.discountPct === null ? '-' : `${p.discountPct.toFixed(1)}%`,
                },
              }))}
            />
          );
        }
        return (
          <div className="space-y-2">
            <Legend
              items={[
                { key: 'cur', label: `${label}, this period`, color: PRIMARY, shape: 'line' },
                ...(hasPrev ? [{ key: 'prev', label: 'Previous period', color: CHART.previous, shape: 'line' as const }] : []),
              ]}
            />
            <LineChart
              ariaLabel={`${label} per ${g}, this period compared with the previous period`}
              xLabels={s.map(p => shortDate(p.date, g))}
              series={[
                { key: 'cur', label: 'This period', color: PRIMARY, values: current, area: true, endLabel: true },
                ...(hasPrev ? [{ key: 'prev', label: 'Previous period', color: CHART.previous, values: previous }] : []),
              ]}
              tooltipTitle={i => bucketLabel(s[i].date, g)}
              formatValue={fmt}
              formatTick={tick}
              tooltipFooter={i =>
                hasPrev && current[i] !== null && previous[i] ? (
                  <span className="flex items-center gap-1">
                    Change <Delta value={((current[i]! - previous[i]!) / previous[i]!) * 100} />
                  </span>
                ) : null
              }
              height={320}
            />
            {!hasPrev && (
              <p className="text-xs text-slate-400">No comparison: the previous period starts before complete history (Aug 2025).</p>
            )}
          </div>
        );
      }}
    </Card>
  );
}
