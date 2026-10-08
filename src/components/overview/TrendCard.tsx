'use client';

import { useState } from 'react';
import { Legend } from '@/components/charts/common';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import {
  bucketLabel, Granularity, GROWTH_DOWN, GROWTH_UP, GrowthResponse, MonthlyResponse, Resource, TrendResponse, useOverview, withParams,
} from '@/lib/overview';
import { Card, CardTabs, DataTable, Delta, Segmented } from './Card';
import { DailySalesChart } from './DailySales';
import { to, useDrill } from './drill/DrillContext';
import { bucketRange } from './drill/parts';
import { MonthlyBody } from './MonthlyCard';
import { GrowthBars } from './SalesGrowth';
import TrendChart, { ChartTypeSelect, metricOf, pct, TREND_METRICS, TrendChartType, TrendMetric } from './TrendChart';

type View = 'trend' | 'daily' | 'growth' | 'monthly';

const VIEWS: { value: View; label: string }[] = [
  { value: 'trend', label: 'Trend' },
  { value: 'daily', label: 'Per day' },
  { value: 'growth', label: 'Growth %' },
  { value: 'monthly', label: 'Monthly' },
];

/**
 * Sales trend & growth in one card (formerly "Sales trend" and "Gross sales growth"). Every
 * view follows the Overview filters and their one comparison period; the period totals and
 * their growth live in the KPI tiles above, so this card shows the shape over time only.
 */
export default function TrendCard({ query }: { query: string }) {
  const [view, setView] = useState<View>('trend');
  const [granularity, setGranularity] = useState<Granularity | 'auto'>('auto');
  const [metric, setMetric] = useState<TrendMetric>('subtotal');
  const [chart, setChart] = useState<TrendChartType>('line');
  const [table, setTable] = useState(false);
  // Growth %: against the comparison period of the filters, or every bucket against the one before it
  const [sequential, setSequential] = useState(false);
  const drill = useDrill();

  const trend = useOverview<TrendResponse>('trend', withParams(query, { granularity: granularity === 'auto' ? null : granularity }));
  const daily = useOverview<GrowthResponse>('growth', withParams(query, { basis: 'previous', granularity: 'day' }));
  const growth = useOverview<GrowthResponse>('growth', withParams(query, {
    basis: sequential ? 'sequential' : 'previous', granularity: granularity === 'auto' || granularity === 'hour' ? null : granularity,
  }));
  const monthly = useOverview<MonthlyResponse>('monthly', query);

  const g = trend.data?.granularity;
  const oneDay = trend.data?.filters.days === 1;
  // nett sales are not kept per hour: the hourly view shows gross sales
  const shownMetric: TrendMetric = g === 'hour' && metric === 'nettSales' ? 'subtotal' : metric;
  const growthGran = growth.data?.granularity ?? 'day';
  const shown = (view === 'trend' ? trend : view === 'daily' ? daily : view === 'growth' ? growth : monthly) as
    Resource<TrendResponse | GrowthResponse | MonthlyResponse>;

  const subtitle = view === 'trend'
    ? g === 'hour'
      ? `Per hour of the day vs the comparison day (dashed)${metric === 'nettSales' ? ' · nett sales are not kept per hour: showing gross sales' : ''}`
      : 'This period vs the comparison period (dashed) · click a point for that day / week / month'
    : view === 'daily' ? 'Gross sales per day; weekends in the darker blue · click a bar for that day'
    : view === 'growth' ? (sequential ? `Growth of every ${growthGran} against the ${growthGran} before it, per day`
      : 'Growth of gross sales against the comparison period · click a bar for its profile')
    : 'Average gross sales per day of each month: month on month, year on year and same-store';

  const open = () => drill.open(view === 'monthly' ? { kind: 'monthly' } : view === 'trend' ? { kind: 'trend' } : { kind: 'growth', basis: sequential ? 'sequential' : 'previous' });

  return (
    <Card
      title="Sales trend & growth"
      info={view === 'trend' ? 'trend' : view === 'monthly' ? 'monthly' : 'growth'}
      subtitle={subtitle}
      resource={shown}
      minHeight={380}
      onOpen={open}
      tabs={<CardTabs label="Sales trend view" value={view} options={VIEWS} onChange={setView} />}
      actions={
        <>
          {view === 'trend' && <Segmented label="Metric" value={metric} options={TREND_METRICS} onChange={setMetric} />}
          {(view === 'trend' || view === 'growth') && (
            <Segmented
              label="Granularity"
              value={view === 'trend' ? (granularity === 'auto' ? g ?? 'day' : granularity) : growthGran}
              options={[...(view === 'trend' && (oneDay || g === 'hour') ? [{ value: 'hour' as const, label: 'Hour' }] : []),
                { value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]}
              onChange={setGranularity}
            />
          )}
          {view === 'trend' && !table && <ChartTypeSelect value={chart} onChange={setChart} />}
          {view === 'trend' && (
            <Segmented label="Show as" value={table ? 'table' : 'chart'} options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]}
              onChange={v => setTable(v === 'table')} />
          )}
          {view === 'growth' && (
            <Segmented label="Growth against" value={sequential ? 'seq' : 'cmp'} onChange={v => setSequential(v === 'seq')}
              options={[{ value: 'cmp', label: 'Comparison period' }, { value: 'seq', label: `Previous ${growthGran}` }]} />
          )}
        </>
      }
    >
      {raw => {
        if (view === 'monthly') return <MonthlyBody data={raw as MonthlyResponse} />;
        if (view === 'daily') {
          return <DailySalesChart data={raw as GrowthResponse} onSelect={d => drill.open(to.period(d, d, formatDate(d)))} />;
        }
        if (view === 'growth') {
          const d = raw as GrowthResponse;
          const t = d.totals;
          return (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Legend items={[{ key: 'up', label: 'Growth', color: GROWTH_UP }, { key: 'down', label: 'Decline', color: GROWTH_DOWN }]} />
                <p className="text-xs text-slate-500">
                  <span className="font-semibold text-slate-900">{t.bucketsUp}</span> {d.granularity}s up ·{' '}
                  <span className="font-semibold text-slate-900">{t.bucketsDown}</span> down
                  {!sequential && d.compare.complete && <> · vs {formatDate(d.compare.from)} – {formatDate(d.compare.to)}</>}
                </p>
              </div>
              <GrowthBars data={d} height={300} onSelect={p => {
                const [from, until] = bucketRange(p.date, d.granularity, d.filters.from, d.filters.to);
                drill.open(to.period(from, until, bucketLabel(p.date, d.granularity)));
              }} />
            </div>
          );
        }
        const data = raw as TrendResponse;
        return table
          ? <TrendTable data={data} metric={shownMetric} />
          : (
            <TrendChart data={data} metric={shownMetric} chart={chart} onSelect={p => {
              const [from, until] = bucketRange(p.date, data.granularity, data.filters.from, data.filters.to);
              drill.open(to.period(from, until, bucketLabel(p.date, data.granularity)));
            }} />
          );
      }}
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
        { key: 'date', label: g === 'hour' ? 'Hour' : g === 'day' ? 'Date' : g === 'week' ? 'Week of' : 'Month' },
        { key: 'cur', label: 'This period', align: 'right' },
        { key: 'prev', label: 'Previous', align: 'right' },
        { key: 'delta', label: 'Change', align: 'right' },
        { key: 'disc', label: 'Discount', align: 'right' },
      ]}
      rows={data.series.map(p => {
        const c = metricOf(p, metric);
        const pr = hasPrev ? metricOf(p.previous, metric) : null;
        return {
          key: `${p.date}-${p.hour ?? ''}`,
          cells: {
            date: g === 'hour' ? `${String(p.hour ?? 0).padStart(2, '0')}:00–${String(p.hour ?? 0).padStart(2, '0')}:59` : bucketLabel(p.date, g),
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
