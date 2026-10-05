'use client';

import { useMemo } from 'react';
import EChart, { ChartClick, ChartOption } from '@/components/charts/EChart';
import { Legend } from '@/components/charts/common';
import { formatCurrency, formatNumber } from '@/lib/format';
import { base, categoryAxis, changeHtml, INK, rupiahAxis, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import {
  bucketLabel, channelColor, channelKey, channelOrder, compactNumber, compactRupiah, shortDate, TrendPoint, TrendResponse,
} from '@/lib/overview';

export type TrendMetric = 'subtotal' | 'bills' | 'avgTicket' | 'nettSales';
export type TrendChartType = 'line' | 'area' | 'bar' | 'cumulative' | 'average' | 'channels';

export const TREND_METRICS: { value: TrendMetric; label: string }[] = [
  { value: 'subtotal', label: 'Sales' },
  { value: 'bills', label: 'Bills' },
  { value: 'avgTicket', label: 'Avg ticket' },
];

export const TREND_CHARTS: { value: TrendChartType; label: string; hint: string }[] = [
  { value: 'line', label: 'Line', hint: 'This period vs the previous period, with high, low and average' },
  { value: 'area', label: 'Area', hint: 'Volume over time from zero, previous period as a dashed line' },
  { value: 'bar', label: 'Bars', hint: 'Side-by-side bars: this period and the previous period per bucket' },
  { value: 'cumulative', label: 'Cumulative', hint: 'Running total: are we ahead of or behind the previous period?' },
  { value: 'average', label: 'Moving average', hint: '7-bucket moving average smooths out weekday swings' },
  { value: 'channels', label: 'By channel', hint: 'Stacked per channel (avg ticket: one line per channel)' },
];

export function metricOf(p: { subtotal: number; bills: number; nettSales?: number }, m: TrendMetric): number | null {
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

  const channels = useMemo(() => {
    const names = new Set<string>();
    s.forEach(p => Object.keys(p.channels ?? {}).forEach(c => names.add(channelKey(c))));
    return [...names].sort((a, b) => channelOrder(a) - channelOrder(b));
  }, [s]);

  const option = useMemo<ChartOption>(() => {
    const xAxis = categoryAxis(s.map(p => shortDate(p.date, g)), { boundaryGap: chart === 'bar' || chart === 'channels' });
    const zoom = s.length > 62 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8, borderColor: INK.grid }] : [];
    const grid = { left: 4, right: 24, top: 30, bottom: s.length > 62 ? 52 : 8, containLabel: true };
    const prevDate = (i: number) => {
      const d = new Date(`${s[i].date}T00:00:00`);
      d.setDate(d.getDate() - data.filters.days);
      return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
    };

    if (chart === 'channels') {
      const valueOf = (p: TrendPoint, ch: string) => {
        const rows = Object.entries(p.channels ?? {}).filter(([c]) => channelKey(c) === ch).map(([, v]) => v);
        const sub = rows.reduce((a, v) => a + v.subtotal, 0);
        const bills = rows.reduce((a, v) => a + v.bills, 0);
        return metric === 'bills' ? bills : metric === 'avgTicket' ? (bills ? sub / bills : null) : sub;
      };
      const stacked = metric !== 'avgTicket';
      const series = channels.map((ch, k) => ({
        name: ch,
        type: stacked ? 'bar' : 'line',
        stack: stacked ? 'total' : undefined,
        data: s.map(p => valueOf(p, ch)),
        barMaxWidth: 26,
        symbol: 'circle',
        symbolSize: 6,
        showSymbol: s.length <= 31,
        lineStyle: { width: 2, color: channelColor(ch) },
        itemStyle: {
          color: channelColor(ch),
          borderColor: '#fff',
          borderWidth: stacked ? 1 : 2,
          borderRadius: stacked && k === channels.length - 1 ? [4, 4, 0, 0] : 0,
        },
        emphasis: { focus: 'series' },
      }));
      return {
        ...base,
        grid,
        tooltip: tooltip({
          trigger: 'axis',
          axisPointer: { type: stacked ? 'shadow' : 'line', shadowStyle: { color: 'rgba(148,163,184,0.12)' }, lineStyle: { color: INK.axis } },
          formatter: (items: { dataIndex: number }[]) => {
            const i = items[0]?.dataIndex ?? 0;
            const vals = channels.map(ch => ({ ch, v: valueOf(s[i], ch) }));
            const total = stacked ? vals.reduce((a, x) => a + (x.v ?? 0), 0) : null;
            return tipTitle(`${bucketLabel(s[i].date, g)}${total !== null ? ` · ${compact(total)}` : ''}`)
              + [...vals].reverse().map(x => tipRow(channelColor(x.ch), x.v === null ? '-' : fmt(x.v),
                total ? `${x.ch} · ${(((x.v ?? 0) / total) * 100).toFixed(1)}%` : x.ch, stacked ? 'square' : 'line')).join('');
          },
        }),
        xAxis,
        yAxis: valueAxis(money ? rupiahAxis : compactNumber, { splitNumber: 4 }),
        dataZoom: zoom,
        series,
      };
    }

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
    const titleOf = (i: number) => (cumulative ? `${bucketLabel(s[0].date, g)} – ${bucketLabel(s[i].date, g)}` : bucketLabel(s[i].date, g));

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
              g === 'day' && !cumulative ? `Previous (${prevDate(i)})` : 'Previous period', asBars ? 'square' : 'line');
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
  }, [data, metric, chart, channels]);

  const legend = chart === 'channels'
    ? channels.map(c => ({ key: c, label: c, color: channelColor(c), shape: (metric === 'avgTicket' ? 'line' : 'square') as 'line' | 'square' }))
    : [
      ...(chart === 'average' ? [{ key: 'act', label: 'Actual', color: '#cde2fb', shape: 'square' as const }] : []),
      { key: 'cur', label: `${label} · ${chart === 'cumulative' ? 'running total' : chart === 'average' ? '7-bucket average' : 'this period'}`, color: INK.accent, shape: chart === 'bar' ? 'square' as const : 'line' as const },
      ...(hasPrev ? [{ key: 'prev', label: 'Previous period', color: INK.previous, shape: chart === 'bar' ? 'square' as const : 'line' as const }] : []),
    ];

  if (chart === 'channels' && !channels.length) {
    return <p className="flex h-40 items-center justify-center text-sm text-slate-400">No channel breakdown for this period</p>;
  }
  return (
    <div className="space-y-1">
      <Legend items={legend} />
      <EChart option={option} height={height} ariaLabel={`${label} per ${g}, ${chart} chart`}
        onClick={onSelect ? (p: ChartClick) => { if (s[p.dataIndex]) onSelect(s[p.dataIndex]); } : undefined} />
      {!hasPrev && chart !== 'channels' && <p className="text-xs text-slate-400">No comparison: the previous period starts before complete history (Aug 2025).</p>}
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
