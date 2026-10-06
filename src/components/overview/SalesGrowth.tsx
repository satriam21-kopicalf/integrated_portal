'use client';

import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { Legend } from '@/components/charts/common';
import { formatCurrency, formatDate } from '@/lib/format';
import { base, categoryAxis, changeHtml, INK, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import {
  bucketLabel, compactRupiah, DOW_LABELS, Granularity, GROWTH_DOWN, GROWTH_RAMP, GROWTH_UP, GrowthBasis, GrowthPoint, GrowthResponse,
  hourLabel, HourlyCompareResponse, HoursProfile, shortDate, useOverview, withParams,
} from '@/lib/overview';
import { Card, Delta, Segmented } from './Card';
import { to, useDrill } from './drill/DrillContext';
import { bucketRange, DetailTable, rp } from './drill/parts';

export const BASES: { value: GrowthBasis; label: string }[] = [
  { value: 'previous', label: 'Comparison period' },
  { value: 'lastYear', label: 'Last year' },
  { value: 'sequential', label: 'Sequential' },
];

export function basisText(d: GrowthResponse): string {
  const range = `${formatDate(d.compare.from)} – ${formatDate(d.compare.to)}`;
  if (d.compare.basis === 'lastYear') return `same weekdays a year earlier (${range})`;
  if (d.compare.basis === 'sequential') return `each ${d.granularity} vs the ${d.granularity} before, per day · total vs ${range}`;
  return `comparison period (${range})`;
}

/** "+Rp 12.3M" / "−Rp 4.1M" */
export const signedRp = (v: number | null | undefined) =>
  v === null || v === undefined ? '-' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${compactRupiah(Math.abs(v))}`;

const pctLabel = (v: number | null) => (v === null ? '' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(Math.abs(v) >= 100 ? 0 : 1)}%`);

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
        const cmpLabel = seq ? `${bucketLabel(p.compareFrom ?? p.date, g)} (per day)` : p.compareFrom ? `from ${formatDate(p.compareFrom)}` : '';
        return tipTitle(bucketLabel(p.date, g))
          + tipRow(INK.accent, seq ? `${compactRupiah(p.avgPerDay)} / day` : formatCurrency(p.subtotal), 'this period')
          + tipRow(INK.previous, p.compareSubtotal === null ? '-' : seq ? `${compactRupiah(p.compareAvgPerDay)} / day` : formatCurrency(p.compareSubtotal), `comparison ${cmpLabel}`)
          + tipFooter(`Growth ${changeHtml(p.growthPct)} · ${signedRp(p.growthAbs)}${seq ? ' per day' : ''}`);
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
    return <p className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>No comparison: the comparison period starts before complete history (Aug 2025).</p>;
  }
  return <EChart option={option} height={height} ariaLabel={`Sales growth per ${g}`} onClick={onSelect ? p => { if (s[p.dataIndex]) onSelect(s[p.dataIndex]); } : undefined} />;
}

/* ------------------------------------------------------------------ by hour */

export interface HourGrowthRow {
  hour: number;
  cur: number;
  cmp: number;
  growthPct: number | null;
  growthAbs: number;
}

function hourRows(current: HoursProfile, compare: HoursProfile): HourGrowthRow[] {
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
        return tipTitle(`${hourLabel(r.hour)}–${hourLabel(r.hour + 1)} · sales per day`)
          + tipRow(INK.accent, formatCurrency(Math.round(r.cur)), 'this period')
          + tipRow(INK.previous, formatCurrency(Math.round(r.cmp)), 'comparison')
          + tipFooter(`Growth ${changeHtml(r.growthPct)} · ${signedRp(r.growthAbs)} per day`);
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
  if (!rows.length) return <p className="flex items-center justify-center text-sm text-slate-400" style={{ height }}>No sales in these periods</p>;
  return <EChart option={option} height={height} ariaLabel="Sales growth per hour of the day" />;
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
        return tipTitle(`${DOW_LABELS[d]} ${hourLabel(h)}–${hourLabel(h + 1)} · sales per day`)
          + tipRow(INK.accent, formatCurrency(Math.round(model.cell(current, d + 1, h))), 'this period')
          + tipRow(INK.previous, formatCurrency(Math.round(model.cell(compare, d + 1, h))), 'comparison')
          + tipFooter(`Growth ${changeHtml(v)}`);
      },
    }),
    xAxis: categoryAxis(model.hours.map(h => String(h).padStart(2, '0')), { splitArea: { show: false }, axisLine: { show: false } }),
    yAxis: { type: 'category', data: DOW_LABELS, inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: INK.secondary, fontSize: 11 } },
    visualMap: {
      min: -50, max: 50, calculable: false, orient: 'horizontal', left: 'center', bottom: 0, itemWidth: 10, itemHeight: 160,
      text: ['+50% or more', '−50% or less'], textStyle: { color: INK.secondary, fontSize: 11 }, inRange: { color: GROWTH_RAMP },
    },
    series: [{
      type: 'heatmap',
      data: model.points.map(p => (p[2] === null ? [p[0], p[1], '-'] : p)),
      itemStyle: { borderColor: '#ffffff', borderWidth: 2, borderRadius: 3 },
      emphasis: { itemStyle: { borderColor: INK.primary, borderWidth: 1 } },
    }],
  }), [model, current, compare]);
  return <EChart option={option} height={300} ariaLabel="Sales growth by weekday and hour" />;
}

export function HourGrowthTable({ rows }: { rows: HourGrowthRow[] }) {
  return (
    <DetailTable caption="Growth per hour" csvName="sales-growth-per-hour" rows={rows} rowKey={r => String(r.hour)} initialSort={{ key: 'hour', desc: false }}
      columns={[
        { key: 'hour', label: 'Hour', value: r => r.hour, render: r => `${hourLabel(r.hour)}–${hourLabel(r.hour + 1)}` },
        { key: 'cur', label: 'Sales/day', align: 'right', value: r => r.cur, render: r => rp(r.cur) },
        { key: 'cmp', label: 'Comparison/day', align: 'right', value: r => r.cmp, render: r => rp(r.cmp) },
        { key: 'abs', label: 'Growth/day', align: 'right', value: r => r.growthAbs, render: r => <GrowthText v={r.growthPct} abs={r.growthAbs} absOnly /> },
        { key: 'pct', label: 'Growth', align: 'right', value: r => r.growthPct, render: r => <Delta value={r.growthPct} /> },
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
      {r.growthAbs >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{hourLabel(r.hour)} {signedRp(r.growthAbs)}/day
    </span>
  );
  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
      {up.length > 0 && <>Growing most: {up.map(chip)}</>}
      {down.length > 0 && <span className="ml-1 inline-flex flex-wrap items-center gap-1.5">Declining most: {down.map(chip)}</span>}
    </div>
  );
}

/* ------------------------------------------------------------------ card */

export default function SalesGrowthCard({ query }: { query: string }) {
  const [basis, setBasis] = useState<GrowthBasis>('previous');
  const [granularity, setGranularity] = useState<Granularity | 'auto'>('auto');
  const [view, setView] = useState<'time' | 'hour'>('time');
  const drill = useDrill();
  const resource = useOverview<GrowthResponse>('growth', withParams(query, { basis, granularity: granularity === 'auto' ? null : granularity }));
  const hours = useHourGrowth(query, view === 'hour' ? resource.data : null);

  return (
    <Card
      title="Sales growth"
      subtitle={resource.data ? `Subtotal (gross sales) vs ${basisText(resource.data)}` : 'Subtotal (gross sales) growth'}
      resource={resource}
      minHeight={360}
      onOpen={() => drill.open({ kind: 'growth', basis })}
      actions={
        <>
          <Segmented label="Compare with" value={basis} options={BASES} onChange={setBasis} />
          <Segmented label="Growth view" value={view} options={[{ value: 'time', label: 'Over time' }, { value: 'hour', label: 'By hour' }]} onChange={setView} />
          {view === 'time' && (
            <Segmented label="Granularity" value={granularity === 'auto' ? resource.data?.granularity ?? 'day' : granularity} onChange={setGranularity}
              options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
          )}
        </>
      }
    >
      {d => (
        <div className="space-y-3">
          <GrowthSummary data={d} />
          {view === 'time' ? (
            <>
              <Legend items={[{ key: 'up', label: 'Growth', color: GROWTH_UP }, { key: 'down', label: 'Decline', color: GROWTH_DOWN }]} />
              <GrowthBars data={d} onSelect={p => {
                const [from, until] = bucketRange(p.date, d.granularity, d.filters.from, d.filters.to);
                drill.open(to.period(from, until, bucketLabel(p.date, d.granularity)));
              }} />
            </>
          ) : hours.res.error ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{hours.res.error}</p>
          ) : !hours.data ? (
            <div className="h-60 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <>
              <p className="text-[11px] text-slate-500">
                Sales per day in each hour (outlet time){basis === 'sequential' ? ' · by hour compares with the previous period' : ''}
              </p>
              <HourGrowthChart rows={hours.rows} />
              <HourMovers rows={hours.rows} />
            </>
          )}
        </div>
      )}
    </Card>
  );
}

/** Headline growth figures. */
export function GrowthSummary({ data }: { data: GrowthResponse }) {
  const t = data.totals;
  const up = (t.growthPct ?? 0) >= 0;
  return (
    <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Growth</p>
        <p className={`text-2xl font-semibold tabular-nums ${t.growthPct === null ? 'text-slate-400' : up ? 'text-blue-700' : 'text-red-600'}`}>
          {t.growthPct === null ? 'n/a' : pctLabel(t.growthPct)}
        </p>
      </div>
      <Figure label="Change" value={signedRp(t.growthAbs)} />
      <Figure label="This period" value={compactRupiah(t.subtotal)} title={formatCurrency(t.subtotal)} />
      <Figure label="Comparison" value={t.compareSubtotal === null ? '-' : compactRupiah(t.compareSubtotal)} title={t.compareSubtotal === null ? undefined : formatCurrency(t.compareSubtotal)} />
      <Figure label="Bills" value={pctLabel(t.billsGrowthPct) || '-'} />
      <Figure label="Avg ticket" value={pctLabel(t.avgTicketGrowthPct) || '-'} />
      <Figure label={`${data.granularity}s up / down`} value={`${t.bucketsUp} / ${t.bucketsDown}`} />
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

