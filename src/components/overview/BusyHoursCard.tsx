'use client';

import { useMemo, useState } from 'react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { formatCurrency, formatNumber } from '@/lib/format';
import { base, categoryAxis, INK, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import { compactNumber, compactRupiah, DOW_LABELS, HourlyResponse, Resource } from '@/lib/overview';
import { Card, DataTable, Segmented } from './Card';

/** Sequential single-hue ramp (blue 100 -> 700). */
const SEQUENTIAL = ['#e8f1fd', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

export default function BusyHoursCard({ resource }: { resource: Resource<HourlyResponse> }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <Card
      title="Busy hours"
      subtitle="Average bills per day, by hour of order (outlet time)"
      resource={resource}
      minHeight={420}
      actions={<Segmented label="View" value={view} options={[{ value: 'chart', label: 'Chart' }, { value: 'table', label: 'Table' }]} onChange={setView} />}
    >
      {data => <BusyBody data={data} view={view} />}
    </Card>
  );
}

function BusyBody({ data, view }: { data: HourlyResponse; view: 'chart' | 'table' }) {
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
            + tipRow(INK.accent, formatCurrency(Math.round(p.avgSubtotal)), 'sales per day');
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
            + tipRow(SEQUENTIAL[5], compactRupiah(c?.avgSubtotal ?? 0), 'sales per day');
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
      <EChart option={barOption!} height={140} ariaLabel="Average bills per day for each hour" />
      <EChart option={heatOption!} height={250} ariaLabel="Heatmap of average bills per day by weekday and hour" />
    </div>
  );
}
