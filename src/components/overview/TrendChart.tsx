'use client';

import { useMemo } from 'react';
import EChart, { ChartClick, ChartOption } from '@/components/charts/EChart';
import { Legend } from '@/components/charts/common';
import { formatCurrency, formatNumber } from '@/lib/format';
import { base, categoryAxis, changeHtml, INK, rupiahAxis, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import {
  bucketLabel, compactNumber, compactRupiah, shortDate, TrendPoint, TrendResponse,
} from '@/lib/overview';

export type TrendMetric = 'subtotal' | 'bills' | 'avgTicket' | 'nettSales';
export type TrendChartType = 'line' | 'area' | 'bar' | 'cumulative' | 'average';

export const TREND_METRICS: { value: TrendMetric; label: string }[] = [
  { value: 'subtotal', label: 'Gross sales' },
  { value: 'bills', label: 'Bills' },
  { value: 'avgTicket', label: 'Avg ticket' },
];

export const TREND_CHARTS: { value: TrendChartType; label: string; hint: string }[] = [
  { value: 'line', label: 'Line', hint: 'This period vs the previous period, with high, low and average' },
  { value: 'area', label: 'Area', hint: 'Volume over time from zero, previous period as a dashed line' },
  { value: 'bar', label: 'Bars', hint: 'Side-by-side bars: this period and the previous period per bucket' },
  { value: 'cumulative', label: 'Cumulative', hint: 'Running total: are we ahead of or behind the previous period?' },
  { value: 'average', label: 'Moving average', hint: '7-bucket moving average smooths out weekday swings' },
];

export function metricOf(p: { subtotal: number; bills: number; nettSales?: number | null }, m: TrendMetric): number | null {
  if (m === 'avgTicket') return p.bills ? p.subtotal / p.bills : null;
  if (m === 'nettSales') return p.nettSales ?? null;
  return p[m];
}

export const pct = (cur: number | null, prev: number | null) => (cur !== null && prev ? ((cur - prev) / prev) * 100 : null);

const running = (values: (number | null)[]) => {
  let sum = 0;
  return values.map(v => (sum += v ?? 0));
};

const moving = (values: (number | null)[], n = 7) =>
  values.map((_, i) => {
    const w = values.slice(Math.max(0, i - n + 1), i + 1).filter((v): v is number => v !== null);
    return i + 1 < Math.min(n, values.length) || !w.length ? null : w.reduce((a, b) => a + b, 0) / w.length;
  });

/**
 * Sales trend in the chosen chart type. Previous-period values are shifted onto the
 * current timeline by the API, so every type compares like for like. One y-axis only.
 */
export default function TrendChart({
  data, metric, chart, height = 400, onSelect,
}: {
  data: TrendResponse;
  metric: TrendMetric;
  chart: TrendChartType;
  height?: number;
  /** a bucket was clicked */
  onSelect?: (point: TrendPoint) => void;
}) {
  const g = data.granularity;
  const s = data.series;
  const hasPrev = data.filters.previous.complete;
  const money = metric !== 'bills';
  const label = TREND_METRICS.find(m => m.value === metric)?.label ?? 'Nett sales';
  const fmt = (v: number) => (money ? formatCurrency(Math.round(v)) : formatNumber(Math.round(v)));
  const compact = (v: number) => (money ? compactRupiah(v) : compactNumber(v));

  // average ticket cannot be summed: cumulative = running sales / running bills
  const current = useMemo(() => s.map(p => metricOf(p, metric)), [s, metric]);
  const previous = useMemo(() => s.map(p => (hasPrev ? metricOf(p.previous, metric) : null)), [s, metric, hasPrev]);

  const option = useMemo<ChartOption>(() => {
    const hh = (h?: number) => `${String(h ?? 0).padStart(2, '0')}:00`;
    const xAxis = categoryAxis(s.map(p => (g === 'hour' ? hh(p.hour) : shortDate(p.date, g))), { boundaryGap: chart === 'bar' });
    const zoom = s.length > 62 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8, borderColor: INK.grid }] : [];
    const grid = { left: 4, right: 24, top: 30, bottom: s.length > 62 ? 52 : 8, containLabel: true };
    const prevDate = (i: number) => {
      const d = new Date(`${s[i].date}T00:00:00`);
      // the comparison may be any period: move by its actual offset
      const shift = Math.round((new Date(`${data.filters.from}T00:00:00`).getTime() - new Date(`${data.filters.previous.from}T00:00:00`).getTime()) / 86_400_000);
      d.setDate(d.getDate() - shift);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    const cumulative = chart === 'cumulative';
    const avgTicketCum = (list: TrendPoint[], prev: boolean) => {
      let sub = 0;
      let bills = 0;
      return list.map(p => {
        const x = prev ? p.previous : p;
        sub += x.subtotal;
        bills += x.bills;
        return bills ? sub / bills : null;
      });
    };
    const cur = cumulative ? (metric === 'avgTicket' ? avgTicketCum(s, false) : running(current))
      : chart === 'average' ? moving(current) : current;
    const prev = !hasPrev ? [] : cumulative ? (metric === 'avgTicket' ? avgTicketCum(s, true) : running(previous))
      : chart === 'average' ? moving(previous) : previous;
    const valid = current.filter((v): v is number => v !== null);
    const avg = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
    const asBars = chart === 'bar';
    const area = chart === 'area';
    const titleOf = (i: number) => (g === 'hour'
      ? `${hh(s[i].hour)}–${String(s[i].hour ?? 0).padStart(2, '0')}:59${cumulative ? ' (running total from the first hour)' : ''} · ${bucketLabel(s[i].date, g)}`
      : cumulative ? `${bucketLabel(s[0].date, g)} – ${bucketLabel(s[i].date, g)}` : bucketLabel(s[i].date, g));

    return {
      ...base,
      grid,
      tooltip: tooltip({
        trigger: 'axis',
        axisPointer: asBars ? { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } } : { type: 'line', lineStyle: { color: INK.axis } },
        formatter: (items: { dataIndex: number }[]) => {
          const i = items[0]?.dataIndex ?? 0;
          const what = cumulative ? 'running total' : chart === 'average' ? '7-bucket average' : '';
          let html = tipTitle(titleOf(i));
          html += tipRow(INK.accent, cur[i] === null ? '-' : fmt(cur[i]!), `This period${what ? ` · ${what}` : ''}`, asBars ? 'square' : 'line');
          if (chart === 'average' && current[i] !== null) html += tipRow('#9ec5f4', fmt(current[i]!), 'Actual', 'square');
          if (hasPrev) {
            html += tipRow(INK.previous, prev[i] === null || prev[i] === undefined ? '-' : fmt(prev[i]!),
              g === 'day' && !cumulative ? `Previous (${prevDate(i)})`
                : g === 'hour' ? `Comparison (${new Date(`${data.filters.previous.from}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} ${hh(s[i].hour)})`
                : 'Previous period', asBars ? 'square' : 'line');
            html += tipFooter(`${cumulative ? 'Ahead / behind' : 'Change'} ${changeHtml(pct(cur[i], prev[i] ?? null))}`);
          }
          return html;
        },
      }),
      xAxis,
      // line/average/cumulative: fitted scale so movement is readable (no fill); area & bars start at zero
      yAxis: valueAxis(money ? rupiahAxis : compactNumber, { scale: !(asBars || area), splitNumber: 4 }),
      dataZoom: zoom,
      series: [
        ...(chart === 'average' ? [{
          name: 'Actual', type: 'bar', data: current, barMaxWidth: 14, silent: true, z: 0,
          itemStyle: { color: '#e8f1fd', borderRadius: [3, 3, 0, 0] },
        }] : []),
        ...(hasPrev ? [{
          name: 'Previous period',
          type: asBars ? 'bar' : 'line',
          data: prev,
          symbol: 'none',
          barMaxWidth: 14,
          barGap: '15%',
          lineStyle: { color: INK.previous, width: 2, type: 'dashed' },
          itemStyle: { color: INK.previous, borderRadius: asBars ? [3, 3, 0, 0] : 0 },
          z: 1,
        }] : []),
        {
          name: 'This period',
          type: asBars ? 'bar' : 'line',
          data: cur,
          barMaxWidth: 14,
          symbol: 'circle',
          symbolSize: 7,
          showSymbol: !area && s.length <= 31,
          smooth: chart === 'average',
          lineStyle: { color: INK.accent, width: 2.5 },
          areaStyle: area ? { color: 'rgba(42,120,214,0.12)' } : undefined,
          itemStyle: { color: INK.accent, borderColor: asBars ? INK.accent : '#fff', borderWidth: asBars ? 0 : 2, borderRadius: asBars ? [3, 3, 0, 0] : 0 },
          emphasis: { focus: 'none', scale: 1.4 },
          markLine: chart === 'line' && valid.length > 2 ? {
            symbol: 'none',
            silent: true,
            lineStyle: { color: '#64748b', type: 'dotted', width: 1 },
            label: { formatter: `Avg ${compact(avg)}`, color: INK.secondary, fontSize: 11, position: 'insideStartTop' },
            data: [{ yAxis: avg }],
          } : undefined,
          markPoint: (chart === 'line' || area) && valid.length > 2 ? {
            symbol: 'pin',
            symbolSize: 0,
            label: {
              show: true, color: INK.primary, fontSize: 11, fontWeight: 600, backgroundColor: '#ffffff',
              borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 6, padding: [3, 6], offset: [0, -14],
              formatter: (p: { name: string; value: number }) => `${p.name} ${compact(p.value)}`,
            },
            data: [{ type: 'max', name: 'High' }, { type: 'min', name: 'Low' }],
          } : undefined,
          z: 2,
        },
      ],
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, metric, chart]);

  // channels over time: see Channel mix › Over time
  const legend = [
      ...(chart === 'average' ? [{ key: 'act', label: 'Actual', color: '#cde2fb', shape: 'square' as const }] : []),
      { key: 'cur', label: `${label} · ${chart === 'cumulative' ? 'running total' : chart === 'average' ? '7-bucket average' : 'this period'}`, color: INK.accent, shape: chart === 'bar' ? 'square' as const : 'line' as const },
      ...(hasPrev ? [{ key: 'prev', label: g === 'hour' ? 'Comparison day' : 'Previous period', color: INK.previous, shape: chart === 'bar' ? 'square' as const : 'line' as const }] : []),
    ];

  return (
    <div className="space-y-1">
      <Legend items={legend} />
      <EChart option={option} height={height} ariaLabel={`${label} per ${g}, ${chart} chart`}
        onClick={onSelect ? (p: ChartClick) => { if (s[p.dataIndex]) onSelect(s[p.dataIndex]); } : undefined} />
      {!hasPrev && <p className="text-xs text-slate-400">No comparison: the comparison period starts before complete history (Aug 2025).</p>}
    </div>
  );
}

/** Compact chart-type picker. */
export function ChartTypeSelect({ value, onChange }: { value: TrendChartType; onChange: (v: TrendChartType) => void }) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Chart type</span>
      <select value={value} onChange={e => onChange(e.target.value as TrendChartType)}
        title={TREND_CHARTS.find(c => c.value === value)?.hint}
        className="h-7 rounded-lg border border-slate-200 bg-white pl-2 pr-7 text-xs font-medium text-slate-700 hover:border-slate-300 focus:border-slate-400 focus:outline-none">
        {TREND_CHARTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
      </select>
    </label>
  );
}
