'use client';

import { useState } from 'react';
import { formatCurrency, formatNumber } from '@/lib/format';
import { bucketLabel, Granularity, TrendResponse, useOverview } from '@/lib/overview';
import { Card, DataTable, Delta, Segmented } from './Card';
import { to, useDrill } from './drill/DrillContext';
import { bucketRange } from './drill/parts';
import TrendChart, { ChartTypeSelect, metricOf, pct, TREND_METRICS, TrendChartType, TrendMetric } from './TrendChart';

export default function TrendCard({ query }: { query: string }) {
  const [granularity, setGranularity] = useState<Granularity | 'auto'>('auto');
  const [metric, setMetric] = useState<TrendMetric>('subtotal');
  const [chart, setChart] = useState<TrendChartType>('line');
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const drill = useDrill();
  const resource = useOverview<TrendResponse>('trend', granularity === 'auto' ? query : `${query}&granularity=${granularity}`);

  return (
    <Card
      title="Sales trend"
      subtitle="This period compared with the previous period of the same length · click a point for that day / week / month"
      resource={resource}
      minHeight={360}
      onOpen={() => drill.open({ kind: 'trend' })}
      actions={
        <>
          <Segmented label="Metric" value={metric} options={TREND_METRICS} onChange={setMetric} />
          <Segmented
            label="Granularity"
            value={granularity === 'auto' ? resource.data?.granularity ?? 'day' : granularity}
            options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]}
            onChange={setGranularity}
          />
          {view === 'chart' && <ChartTypeSelect value={chart} onChange={setChart} />}
          <Segmented label="View" value={view} options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} onChange={setView} />
        </>
      }
    >
      {data => view === 'table'
        ? <TrendTable data={data} metric={metric} />
        : (
          <TrendChart data={data} metric={metric} chart={chart} onSelect={p => {
            const [from, until] = bucketRange(p.date, data.granularity, data.filters.from, data.filters.to);
            drill.open(to.period(from, until, bucketLabel(p.date, data.granularity)));
          }} />
        )}
    </Card>
  );
}

export function TrendTable({ data, metric, maxHeight = 340 }: { data: TrendResponse; metric: TrendMetric; maxHeight?: number }) {
  const g = data.granularity;
  const hasPrev = data.filters.previous.complete;
  const money = metric !== 'bills';
  const fmt = (v: number) => (money ? formatCurrency(Math.round(v)) : formatNumber(Math.round(v)));
  const label = TREND_METRICS.find(m => m.value === metric)?.label ?? 'Value';
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
      rows={data.series.map(p => {
        const c = metricOf(p, metric);
        const pr = hasPrev ? metricOf(p.previous, metric) : null;
        return {
          key: p.date,
          cells: {
            date: bucketLabel(p.date, g),
            cur: c === null ? '-' : fmt(c),
            prev: pr === null ? '-' : fmt(pr),
            delta: <Delta value={pct(c, pr)} />,
            disc: p.discountPct === null ? '-' : `${p.discountPct.toFixed(1)}%`,
          },
        };
      })}
      maxHeight={maxHeight}
    />
  );
}
