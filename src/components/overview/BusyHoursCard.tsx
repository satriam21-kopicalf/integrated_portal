'use client';

import { useMemo, useState } from 'react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { formatCurrency, formatNumber } from '@/lib/format';
import { base, categoryAxis, INK, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import LoadingState from '@/components/ui/LoadingState';
import { formatDate } from '@/lib/format';
import { compactNumber, compactRupiah, DOW_LABELS, HourlyCompareResponse, HourlyResponse, Resource, useOverview, withParams } from '@/lib/overview';
import { Card, DataTable, Segmented } from './Card';
import { useDrill } from './drill/DrillContext';
import HoursCompare from './HoursCompare';
import { HourGrowthChart, HourMovers, hourRows } from './SalesGrowth';

/** Sequential single-hue ramp (blue 100 -> 700). */
const SEQUENTIAL = ['#e8f1fd', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

type Mode = 'pattern' | 'growth' | 'branches';

export default function BusyHoursCard({ resource, query }: { resource: Resource<HourlyResponse>; query: string }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [mode, setMode] = useState<Mode>('pattern');
  const drill = useDrill();
  return (
    <Card
      title="Busy hours"
      info="hours"
      subtitle={mode === 'pattern' ? 'Average bills per day, by hour of order (outlet time)'
        : mode === 'growth' ? 'Growth of gross sales per day in each hour against the comparison period'
        : 'Branches side by side, per hour'}
      resource={resource}
      minHeight={420}
      onOpen={() => drill.open({ kind: 'hours' })}
      actions={
        <>
          <Segmented label="Busy hours view" value={mode} onChange={setMode} options={[
            { value: 'pattern', label: 'Pattern' }, { value: 'growth', label: 'vs comparison' }, { value: 'branches', label: 'Compare branches' },
          ]} />
          {mode === 'pattern' && <Segmented label="View" value={view} options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} onChange={setView} />}
        </>
      }
    >
      {data => mode === 'pattern'
        ? <><HoursVs data={data} /><BusyBody data={data} view={view} /></>
        : mode === 'growth' ? <HoursGrowth query={query} />
        : <HoursCompare query={query} mode={mode} period={{ from: data.filters.from, to: data.filters.to }} />}
    </Card>
  );
}

/** Per-hour growth against the comparison period of the filters (formerly Sales growth › By hour). */
function HoursGrowth({ query }: { query: string }) {
  const res = useOverview<HourlyCompareResponse>('hourly-compare', withParams(query, { mode: 'period' }));
  const d = res.data && res.data.mode === 'period' ? res.data : null;
  const rows = useMemo(() => (d ? hourRows(d.current, d.compare) : []), [d]);
  if (res.error) return <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{res.error}</p>;
  if (!d) return <LoadingState height={300} label="hourly growth" />;
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500">
        Gross sales per day in each hour (outlet time) · vs {formatDate(d.compare.from)} – {formatDate(d.compare.to)}
      </p>
      <HourGrowthChart rows={rows} height={280} />
      <HourMovers rows={rows} />
    </div>
  );
}

export function BusyBody({ data, view, large = false }: { data: HourlyResponse; view: 'chart' | 'table'; large?: boolean }) {
  const model = useMemo(() => {
    const withBills = data.cells.filter(c => c.bills > 0).map(c => c.hour);
    if (!withBills.length) return null;
    // hide the near-empty night hours at the edges (< 0.5% of the busiest hour)
    const byHour = new Map<number, { bills: number; subtotal: number }>();
    for (const c of data.cells) {
      const h = byHour.get(c.hour) ?? { bills: 0, subtotal: 0 };
      h.bills += c.bills;
      h.subtotal += c.subtotal;
      byHour.set(c.hour, h);
    }
    const peakHour = Math.max(...[...byHour.values()].map(h => h.bills));
    const active = [...byHour.entries()].filter(([, v]) => v.bills >= peakHour * 0.005).map(([h]) => h);
    const first = Math.min(...active);
    const last = Math.max(...active);
    const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
    const totalDays = Object.values(data.daysPerDow).reduce((a, b) => a + b, 0) || 1;
    const perHour = hours.map(h => ({ hour: h, avgBills: (byHour.get(h)?.bills ?? 0) / totalDays, avgSubtotal: (byHour.get(h)?.subtotal ?? 0) / totalDays }));
    const cell = (dow: number, hour: number) => data.cells.find(c => c.dow === dow && c.hour === hour);
    return { hours, perHour, cell };
  }, [data]);

  const barOption = useMemo<ChartOption | null>(() => {
    if (!model) return null;
    const max = Math.max(...model.perHour.map(p => p.avgBills));
    return {
      ...base,
      grid: { left: 4, right: 4, top: 18, bottom: 4, containLabel: true },
      tooltip: tooltip({
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } },
        formatter: (items: { dataIndex: number }[]) => {
          const p = model.perHour[items[0]?.dataIndex ?? 0];
          return tipTitle(`${hourLabel(p.hour)}–${hourLabel(p.hour + 1)}, all days`)
            + tipRow(INK.accent, `${formatNumber(Math.round(p.avgBills))} bills`, 'per day')
            + tipRow(INK.accent, formatCurrency(Math.round(p.avgSubtotal)), 'gross sales per day');
        },
      }),
      xAxis: categoryAxis(model.hours.map(h => String(h).padStart(2, '0'))),
      yAxis: valueAxis(compactNumber, { splitNumber: 3 }),
      series: [{
        type: 'bar',
        data: model.perHour.map(p => ({
          value: Math.round(p.avgBills),
          itemStyle: { color: p.avgBills === max ? '#184f95' : '#6da7ec', borderRadius: [4, 4, 0, 0] },
        })),
        barMaxWidth: 18,
        label: {
          show: true,
          position: 'top',
          fontSize: 10,
          color: INK.secondary,
          formatter: (p: { value: number }) => (p.value === Math.round(max) ? `Peak ${formatNumber(p.value)}` : ''),
        },
      }],
    };
  }, [model]);

  const heatOption = useMemo<ChartOption | null>(() => {
    if (!model) return null;
    const points: [number, number, number][] = [];
    DOW_LABELS.forEach((_, d) => model.hours.forEach((h, x) => points.push([x, d, Math.round(model.cell(d + 1, h)?.avgBills ?? 0)])));
    const max = Math.max(1, ...points.map(p => p[2]));
    return {
      ...base,
      grid: { left: 4, right: 4, top: 4, bottom: 44, containLabel: true },
      tooltip: tooltip({
        trigger: 'item',
        formatter: (p: { data: [number, number, number] }) => {
          const [x, d] = p.data;
          const c = model.cell(d + 1, model.hours[x]);
          return tipTitle(`${DOW_LABELS[d]} ${hourLabel(model.hours[x])}–${hourLabel(model.hours[x] + 1)}`)
            + tipRow(SEQUENTIAL[5], `${formatNumber(Math.round(c?.avgBills ?? 0))} bills`, 'per day')
            + tipRow(SEQUENTIAL[5], compactRupiah(c?.avgSubtotal ?? 0), 'gross sales per day');
        },
      }),
      xAxis: categoryAxis(model.hours.map(h => String(h).padStart(2, '0')), { splitArea: { show: false }, axisLine: { show: false } }),
      yAxis: { type: 'category', data: DOW_LABELS, inverse: true, axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: INK.secondary, fontSize: 11 } },
      visualMap: {
        min: 0,
        max,
        calculable: false,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        itemWidth: 10,
        itemHeight: 140,
        text: [`${formatNumber(max)} bills/day`, '0'],
        textStyle: { color: INK.secondary, fontSize: 11 },
        inRange: { color: SEQUENTIAL },
      },
      series: [{
        type: 'heatmap',
        data: points,
        itemStyle: { borderColor: '#ffffff', borderWidth: 2, borderRadius: 3 },
        emphasis: { itemStyle: { borderColor: INK.primary, borderWidth: 1 } },
      }],
    };
  }, [model]);

  if (!model) return <p className="py-10 text-center text-sm text-slate-400">No sales in this period</p>;
  const peak = data.peak;

  if (view === 'table') {
    return (
      <DataTable
        caption="Average bills per day by hour and weekday"
        columns={[{ key: 'hour', label: 'Hour' }, ...DOW_LABELS.map(d => ({ key: d, label: d, align: 'right' as const })), { key: 'all', label: 'All days', align: 'right' as const }]}
        rows={model.hours.map((h, i) => ({
          key: String(h),
          cells: {
            hour: hourLabel(h),
            ...Object.fromEntries(DOW_LABELS.map((d, k) => [d, formatNumber(Math.round(model.cell(k + 1, h)?.avgBills ?? 0))])),
            all: formatNumber(Math.round(model.perHour[i].avgBills)),
          },
        }))}
        maxHeight={380}
      />
    );
  }
  return (
    <div className="space-y-3">
      {peak && (
        <p className="text-xs text-slate-600">
          Busiest slot: <span className="font-semibold text-slate-900">{DOW_LABELS[peak.dow - 1]} {hourLabel(peak.hour)}</span> ·{' '}
          {formatNumber(Math.round(peak.avgBills))} bills/day · {compactRupiah(peak.avgSubtotal)}
        </p>
      )}
      <EChart option={barOption!} height={large ? 180 : 140} ariaLabel="Average bills per day for each hour" />
      <EChart option={heatOption!} height={large ? 320 : 250} ariaLabel="Heatmap of average bills per day by weekday and hour" />
    </div>
  );
}

/** One line: this period's peak and bills per day against the comparison period's. */
function HoursVs({ data }: { data: HourlyResponse }) {
  const prev = data.previous;
  if (!prev) return null;
  const days = Object.values(data.daysPerDow).reduce((a, b) => a + b, 0) || 1;
  const bills = data.cells.reduce((a, c) => a + c.bills, 0);
  const perDay = bills / days;
  const byHour = new Map<number, number>();
  for (const c of data.cells) byHour.set(c.hour, (byHour.get(c.hour) ?? 0) + c.bills);
  const peak = [...byHour.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const delta = prev.avgBillsPerDay ? ((perDay - prev.avgBillsPerDay) / prev.avgBillsPerDay) * 100 : null;
  return (
    <p className="mb-2 flex flex-wrap gap-x-4 gap-y-1 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
      <span>Peak <b className="text-slate-900">{peak !== undefined ? hourLabel(peak) : '–'}</b> vs {prev.peakHour !== null ? hourLabel(prev.peakHour) : '–'}</span>
      <span>Bills per day <b className="tabular-nums text-slate-900">{formatNumber(Math.round(perDay))}</b> vs {formatNumber(Math.round(prev.avgBillsPerDay))}
        {delta !== null && <b className={delta >= 0 ? ' text-emerald-700' : ' text-red-700'}> {delta >= 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)}%</b>}</span>
      <span className="text-slate-400">comparison {prev.from === prev.to ? prev.from : `${prev.from} – ${prev.to}`}</span>
    </p>
  );
}
