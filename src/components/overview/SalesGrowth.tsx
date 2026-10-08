'use client';

import { useMemo } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { formatCurrency, formatDate, fixed } from '@/lib/format';
import { base, categoryAxis, changeHtml, INK, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import {
  bucketLabel, compactRupiah, DOW_LABELS, GROWTH_DOWN, GROWTH_RAMP, GROWTH_UP, GrowthBasis, GrowthPoint, GrowthResponse,
  hourLabel, HourlyCompareResponse, HoursProfile, shortDate, useOverview, withParams,
} from '@/lib/overview';
import { Delta } from './Card';
import { DetailTable, rp } from './drill/parts';
import { tr } from '@/lib/i18n';

/* Growth building blocks: the bars and per-hour views used by the Sales trend & growth card,
   Busy hours (vs comparison) and the growth drawer. */

export const BASES: { value: GrowthBasis; label: string }[] = [
  { value: 'previous', get label() { return tr('Comparison period'); } },
  { value: 'lastYear', get label() { return tr('Last year'); } },
  { value: 'sequential', get label() { return tr('Sequential'); } },
];

export function basisText(d: GrowthResponse): string {
  const range = `${formatDate(d.compare.from)} – ${formatDate(d.compare.to)}`;
  if (d.compare.basis === 'lastYear') return tr('same weekdays a year earlier ({0})', range);
  if (d.compare.basis === 'sequential') return tr('each {0} vs the {1} before, per day · total vs {2}', tr(d.granularity), tr(d.granularity), range);
  return tr('comparison period ({0})', range);
}

/** "+Rp 12.3M" / "−Rp 4.1M" */
export const signedRp = (v: number | null | undefined) =>
  v === null || v === undefined ? '-' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${compactRupiah(Math.abs(v))}`;

const pctLabel = (v: number | null) => (v === null ? '' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${fixed(Math.abs(v), Math.abs(v) >= 100 ? 0 : 1)}%`);

/* ------------------------------------------------------------------ over time */

/** Growth % per bucket as diverging bars (blue = growth, red = decline), value labels on the bars. */
export function GrowthBars({ data, height = 260, onSelect }: { data: GrowthResponse; height?: number; onSelect?: (p: GrowthPoint) => void }) {
  const s = data.series;
  const seq = data.compare.basis === 'sequential';
  const g = data.granularity;
  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 12, top: 22, bottom: s.length > 62 ? 48 : 4, containLabel: true },
    tooltip: tooltip({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } },
      formatter: (items: { dataIndex: number }[]) => {
        const p = s[items[0]?.dataIndex ?? 0];
        const cmpLabel = seq ? tr('{0} (per day)', bucketLabel(p.compareFrom ?? p.date, g)) : p.compareFrom ? tr('from {0}', formatDate(p.compareFrom)) : '';
        return tipTitle(bucketLabel(p.date, g))
          + tipRow(INK.accent, seq ? tr('{0} / day', compactRupiah(p.avgPerDay)) : formatCurrency(p.subtotal), 'this period')
          + tipRow(INK.previous, p.compareSubtotal === null ? '-' : seq ? tr('{0} / day', compactRupiah(p.compareAvgPerDay)) : formatCurrency(p.compareSubtotal), tr('comparison {0}', cmpLabel))
          + tipFooter(tr('Growth {0} · {1}{2}', changeHtml(p.growthPct), signedRp(p.growthAbs), seq ? tr(' per day') : ''));
      },
    }),
    xAxis: categoryAxis(s.map(p => shortDate(p.date, g))),
    yAxis: valueAxis((v: number) => `${v}%`, { splitNumber: 4 }),
    dataZoom: s.length > 62 ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 6, borderColor: INK.grid }] : [],
    series: [{
      type: 'bar',
      barMaxWidth: 26,
      data: s.map(p => ({
        value: p.growthPct,
        itemStyle: { color: (p.growthPct ?? 0) >= 0 ? GROWTH_UP : GROWTH_DOWN, borderRadius: (p.growthPct ?? 0) >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] },
      })),
      label: {
        show: s.length <= 16,
        position: 'top',
        fontSize: 10,
        color: INK.secondary,
        formatter: (p: { value: number | null }) => pctLabel(p.value),
      },
      markLine: { symbol: 'none', silent: true, lineStyle: { color: INK.axis, type: 'solid' }, label: { show: false }, data: [{ yAxis: 0 }] },
    }],
  }), [s, seq, g]);
  if (!s.some(p => p.growthPct !== null)) {
    return <p className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>{tr('No comparison: the comparison period starts before complete history (Aug 2025).')}</p>;
  }
  return <EChart option={option} height={height} ariaLabel={tr('Sales growth per {0}', tr(g))} onClick={onSelect ? p => { if (s[p.dataIndex]) onSelect(s[p.dataIndex]); } : undefined} />;
}

/* ------------------------------------------------------------------ by hour */

export interface HourGrowthRow {
  hour: number;
  cur: number;
  cmp: number;
  growthPct: number | null;
  growthAbs: number;
}

export function hourRows(current: HoursProfile, compare: HoursProfile): HourGrowthRow[] {
  const at = (p: HoursProfile, h: number) => p.hours.find(x => x.hour === h)?.avgSubtotal ?? 0;
  const max = Math.max(0, ...current.hours.map(h => h.avgSubtotal), ...compare.hours.map(h => h.avgSubtotal));
  // hours with real trade (>= 0.5% of the busiest hour) in either period, first to last
  const on = [...current.hours, ...compare.hours].filter(h => h.avgSubtotal >= max * 0.005).map(h => h.hour);
  if (!on.length) return [];
  const hours = Array.from({ length: Math.max(...on) - Math.min(...on) + 1 }, (_, i) => Math.min(...on) + i);
  return hours.map(h => {
    const cur = at(current, h);
    const cmp = at(compare, h);
    return { hour: h, cur, cmp, growthAbs: cur - cmp, growthPct: cmp ? ((cur - cmp) / cmp) * 100 : null };
  });
}

/** Hourly growth of sales per day (subtotal), the comparison period from the growth response. */
export function useHourGrowth(query: string, growth: GrowthResponse | null) {
  const q = growth ? withParams(query, { mode: 'period', compareFrom: growth.compare.from, compareTo: growth.compare.to }) : withParams(query, { mode: 'period' });
  const res = useOverview<HourlyCompareResponse>('hourly-compare', q);
  const data = res.data && res.data.mode === 'period' && growth && res.data.compare.from === growth.compare.from ? res.data : null;
  const rows = useMemo(() => (data ? hourRows(data.current, data.compare) : []), [data]);
  return { res, data, rows };
}

export function HourGrowthChart({ rows, height = 240 }: { rows: HourGrowthRow[]; height?: number }) {
  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 8, top: 22, bottom: 4, containLabel: true },
    tooltip: tooltip({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } },
      formatter: (items: { dataIndex: number }[]) => {
        const r = rows[items[0]?.dataIndex ?? 0];
        return tipTitle(tr('{0}–{1} · sales per day', hourLabel(r.hour), hourLabel(r.hour + 1)))
          + tipRow(INK.accent, formatCurrency(Math.round(r.cur)), 'this period')
          + tipRow(INK.previous, formatCurrency(Math.round(r.cmp)), 'comparison')
          + tipFooter(tr('Growth {0} · {1} per day', changeHtml(r.growthPct), signedRp(r.growthAbs)));
      },
    }),
    xAxis: categoryAxis(rows.map(r => String(r.hour).padStart(2, '0'))),
    yAxis: valueAxis((v: number) => `${v}%`, { splitNumber: 4 }),
    series: [{
      type: 'bar',
      barMaxWidth: 20,
      data: rows.map(r => ({
        value: r.growthPct === null ? null : Math.round(r.growthPct * 10) / 10,
        itemStyle: { color: (r.growthPct ?? 0) >= 0 ? GROWTH_UP : GROWTH_DOWN, borderRadius: (r.growthPct ?? 0) >= 0 ? [4, 4, 0, 0] : [0, 0, 4, 4] },
      })),
      label: { show: rows.length <= 18, position: 'top', fontSize: 10, color: INK.secondary, formatter: (p: { value: number | null }) => pctLabel(p.value) },
      markLine: { symbol: 'none', silent: true, lineStyle: { color: INK.axis, type: 'solid' }, label: { show: false }, data: [{ yAxis: 0 }] },
    }],
  }), [rows]);
  if (!rows.length) return <p className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>{tr('No sales in these periods')}</p>;
  return <EChart option={option} height={height} ariaLabel={tr('Gross sales growth per hour of the day')} />;
}

/** Weekday x hour growth of sales per day, diverging red - grey - blue. */
export function HourGrowthHeatmap({ current, compare }: { current: HoursProfile; compare: HoursProfile }) {
  const model = useMemo(() => {
    const rows = hourRows(current, compare);
    const hours = rows.map(r => r.hour);
    const cell = (p: HoursProfile, dow: number, h: number) => p.cells.find(c => c.dow === dow && c.hour === h)?.avgSubtotal ?? 0;
    const points: [number, number, number | null][] = [];
    DOW_LABELS.forEach((_, d) => hours.forEach((h, x) => {
      const a = cell(current, d + 1, h);
      const b = cell(compare, d + 1, h);
      points.push([x, d, b ? Math.max(-100, Math.min(100, ((a - b) / b) * 100)) : null]);
    }));
    return { hours, points, cell };
  }, [current, compare]);

  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 4, top: 4, bottom: 44, containLabel: true },
    tooltip: tooltip({
      trigger: 'item',
      formatter: (p: { data: [number, number, number | null] }) => {
        const [x, d, v] = p.data;
        const h = model.hours[x];
        return tipTitle(tr('{0} {1}–{2} · sales per day', DOW_LABELS[d], hourLabel(h), hourLabel(h + 1)))
          + tipRow(INK.accent, formatCurrency(Math.round(model.cell(current, d + 1, h))), 'this period')
          + tipRow(INK.previous, formatCurrency(Math.round(model.cell(compare, d + 1, h))), 'comparison')
          + tipFooter(tr('Growth {0}', changeHtml(v)));
      },
    }),
    xAxis: categoryAxis(model.hours.map(h => String(h).padStart(2, '0')), { splitArea: { show: false }, axisLine: { show: false } }),
    yAxis: { type: 'category', data: DOW_LABELS, inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: INK.secondary, fontSize: 11 } },
    visualMap: {
      min: -50, max: 50, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 10, itemHeight: 160,
      text: [tr('+50% or more'), tr('−50% or less')], textStyle: { color: INK.secondary, fontSize: 11 }, inRange: { color: GROWTH_RAMP },
    },
    series: [{
      type: 'heatmap',
      data: model.points.map(p => (p[2] === null ? [p[0], p[1], '-'] : p)),
      itemStyle: { borderColor: '#ffffff', borderWidth: 2, borderRadius: 3 },
      emphasis: { itemStyle: { borderColor: INK.primary, borderWidth: 1 } },
    }],
  }), [model, current, compare]);
  return <EChart option={option} height={300} ariaLabel={tr('Gross sales growth by weekday and hour')} />;
}

export function HourGrowthTable({ rows }: { rows: HourGrowthRow[] }) {
  return (
    <DetailTable caption={tr('Growth per hour')} csvName="sales-growth-per-hour" rows={rows} rowKey={r => String(r.hour)} initialSort={{ key: 'hour', desc: false }}
      columns={[
        { key: 'hour', label: tr('Hour'), value: r => r.hour, render: r => `${hourLabel(r.hour)}–${hourLabel(r.hour + 1)}` },
        { key: 'cur', label: tr('Gross sales/day'), align: 'right', value: r => r.cur, render: r => rp(r.cur) },
        { key: 'cmp', label: tr('Comparison/day'), align: 'right', value: r => r.cmp, render: r => rp(r.cmp) },
        { key: 'abs', label: tr('Growth/day'), align: 'right', value: r => r.growthAbs, render: r => <GrowthText v={r.growthPct} abs={r.growthAbs} absOnly /> },
        { key: 'pct', label: tr('Growth'), align: 'right', value: r => r.growthPct, render: r => <Delta value={r.growthPct} /> },
      ]} />
  );
}

export function GrowthText({ v, abs, absOnly = false }: { v: number | null; abs?: number | null; absOnly?: boolean }) {
  const up = (absOnly ? abs ?? 0 : v ?? 0) >= 0;
  return <span className={`tabular-nums ${up ? 'text-blue-700' : 'text-red-600'}`}>{absOnly ? signedRp(abs) : pctLabel(v)}</span>;
}

/** Strongest growing and declining hours. */
export function HourMovers({ rows }: { rows: HourGrowthRow[] }) {
  const ranked = rows.filter(r => r.growthPct !== null && r.cmp > 0).sort((a, b) => b.growthAbs - a.growthAbs);
  const up = ranked.filter(r => r.growthAbs > 0).slice(0, 3);
  const down = ranked.filter(r => r.growthAbs < 0).slice(-3).reverse();
  if (!up.length && !down.length) return null;
  const chip = (r: HourGrowthRow) => (
    <span key={r.hour} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${r.growthAbs >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-red-50 text-red-700'}`}>
      {r.growthAbs >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{hourLabel(r.hour)} {signedRp(r.growthAbs)}{tr('/day')}
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
      {up.length > 0 && <>{tr('Growing most:')} {up.map(chip)}</>}
      {down.length > 0 && <span className="ml-1 inline-flex flex-wrap items-center gap-1.5">{tr('Declining most:')} {down.map(chip)}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ card */

/** Headline growth figures. */
export function GrowthSummary({ data }: { data: GrowthResponse }) {
  const t = data.totals;
  const up = (t.growthPct ?? 0) >= 0;
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{tr('Growth')}</p>
        <p className={`text-2xl font-semibold tabular-nums ${t.growthPct === null ? 'text-slate-400' : up ? 'text-blue-700' : 'text-red-600'}`}>
          {t.growthPct === null ? 'n/a' : pctLabel(t.growthPct)}
        </p>
      </div>
      <Figure label={tr('Change')} value={signedRp(t.growthAbs)} />
      <Figure label={tr('This period')} value={compactRupiah(t.subtotal)} title={formatCurrency(t.subtotal)} />
      <Figure label={tr('Comparison')} value={t.compareSubtotal === null ? '-' : compactRupiah(t.compareSubtotal)} title={t.compareSubtotal === null ? undefined : formatCurrency(t.compareSubtotal)} />
      <Figure label={tr('Bills')} value={pctLabel(t.billsGrowthPct) || '-'} />
      <Figure label={tr('Avg ticket')} value={pctLabel(t.avgTicketGrowthPct) || '-'} />
      <Figure label={tr('{0} up / down', tr(`${data.granularity}s`))} value={`${t.bucketsUp} / ${t.bucketsDown}`} />
    </div>
  );
}

function Figure({ label, value, title }: { label: string; value: string; title?: string }) {
  return (
    <div title={title}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-semibold tabular-nums text-slate-800">{value}</p>
    </div>
  );
}

