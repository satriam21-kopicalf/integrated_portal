'use client';

import LoadingState from '@/components/ui/LoadingState';
import { useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import BranchFilter, { splitBranches } from '@/components/BranchFilter';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { Legend } from '@/components/charts/common';
import DateRangePicker from '@/components/DateRangePicker';
import { formatCurrency, formatDate, formatNumber, toIsoDate } from '@/lib/format';
import { base, categoryAxis, changeHtml, INK, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import {
  BranchHours, compactNumber, compactRupiah, hourLabel, HourlyCompareResponse, HoursProfile, SERIES_COLORS, useOverview, withParams,
} from '@/lib/overview';
import { Segmented } from './Card';
import { useOptionalDrill } from './drill/DrillContext';
import { DetailTable, pctText } from './drill/parts';

export type CompareMode = 'period' | 'branches';
type Against = 'previous' | 'lastYear' | 'custom';
type Measure = 'avg' | 'share';

const shift = (iso: string, days: number) => {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + days);
  return toIsoDate(d);
};
const change = (cur: number, prev: number) => (prev ? ((cur - prev) / prev) * 100 : null);

/** Hours worth showing: from the first to the last hour with >= 0.5% of the busiest hour. */
function activeHours(lists: { hour: number; bills: number }[][]): number[] {
  const all = lists.flat();
  const max = Math.max(0, ...all.map(h => h.bills));
  const on = all.filter(h => h.bills >= max * 0.005).map(h => h.hour);
  if (!on.length) return [];
  const first = Math.min(...on);
  const last = Math.max(...on);
  return Array.from({ length: last - first + 1 }, (_, i) => first + i);
}

/**
 * Busy hours compared with another period (previous period, same period last year or
 * any range) or across branches (the selected branches, else the five busiest; up to 8).
 * Bills per day keeps periods / branches of different length comparable; "share of the
 * day" compares the shape of the day regardless of size.
 */
export default function HoursCompare({ query, mode, period, size = 'card' }: {
  query: string; mode: CompareMode; period: { from: string; to: string }; size?: 'card' | 'drawer';
}) {
  const drill = useOptionalDrill();
  const [against, setAgainst] = useState<Against>('previous');
  const [custom, setCustom] = useState<{ from: string; to: string }>({ from: '', to: '' });
  const [measure, setMeasure] = useState<Measure>('avg');
  const [picked, setPicked] = useState('');

  // last year = 52 weeks back, so weekdays line up
  const compareParams = mode === 'branches'
    ? { mode: 'branches', compareBranches: picked || null }
    : against === 'lastYear'
      ? { mode: 'period', compareFrom: shift(period.from, -364), compareTo: shift(period.to, -364) }
      : against === 'custom' && custom.from
        ? { mode: 'period', compareFrom: custom.from, compareTo: custom.to || custom.from }
        : { mode: 'period' };
  const res = useOverview<HourlyCompareResponse>('hourly-compare', withParams(query, compareParams));
  const data = res.data && res.data.mode === mode ? res.data : null;

  const controls = (
    <div className="flex flex-wrap items-center gap-2">
      {mode === 'period' ? (
        <>
          <Segmented label="Compare with" value={against} onChange={setAgainst} options={[
            { value: 'previous', label: 'Comparison period' }, { value: 'lastYear', label: 'Last year' }, { value: 'custom', label: 'Custom' },
          ]} />
          {against === 'custom' && (
            <DateRangePicker dateFrom={custom.from} dateTo={custom.to} defaultLabel="pick a period"
              onChange={(from, to) => setCustom({ from, to })} />
          )}
        </>
      ) : (
        <BranchFilter branches={drill?.branches ?? []} loading={false} value={picked} onChange={v => setPicked(splitBranches(v).slice(0, 8).join(','))} />
      )}
      <Segmented label="Measure" value={measure} onChange={setMeasure} options={[
        { value: 'avg', label: 'Bills / day' }, { value: 'share', label: 'Share of day' },
      ]} />
    </div>
  );

  return (
    <div className="space-y-3">
      {controls}
      {res.error && !res.loading ? (
        <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{res.error}</p>
      ) : !data ? (
        <LoadingState height={256} label="busy hours" />
      ) : (
        <div className={`transition-opacity ${res.loading ? 'opacity-50' : ''}`}>
          {data.mode === 'period'
            ? <PeriodCompare current={data.current} compare={data.compare} measure={measure} size={size} />
            : <BranchCompare branches={data.branches} measure={measure} size={size} picked={picked} />}
        </div>
      )}
    </div>
  );
}

function PeriodCompare({ current, compare, measure, size }: { current: HoursProfile; compare: HoursProfile; measure: Measure; size: 'card' | 'drawer' }) {
  const hours = useMemo(() => activeHours([current.hours, compare.hours]), [current, compare]);
  const at = (p: HoursProfile, h: number) => p.hours.find(x => x.hour === h);
  const val = (p: HoursProfile, h: number) => (measure === 'avg' ? at(p, h)?.avgBills ?? 0 : at(p, h)?.share ?? 0);
  const fmt = (v: number) => (measure === 'avg' ? formatNumber(Math.round(v)) : `${v.toFixed(1)}%`);
  const curLabel = `${formatDate(current.from)} – ${formatDate(current.to)}`;
  const cmpLabel = `${formatDate(compare.from)} – ${formatDate(compare.to)}`;

  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 8, top: 14, bottom: 4, containLabel: true },
    tooltip: tooltip({
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } },
      formatter: (items: { dataIndex: number }[]) => {
        const h = hours[items[0]?.dataIndex ?? 0];
        const a = val(current, h);
        const b = val(compare, h);
        return tipTitle(`${hourLabel(h)}–${hourLabel(h + 1)}`)
          + tipRow(INK.accent, fmt(a), measure === 'avg' ? 'bills/day · this period' : 'of the day · this period')
          + tipRow(INK.previous, fmt(b), measure === 'avg' ? 'bills/day · comparison' : 'of the day · comparison')
          + tipFooter(measure === 'avg' ? `Change ${changeHtml(change(a, b))} · ${compactRupiah(at(current, h)?.avgSubtotal ?? 0)}/day`
            : `Difference ${(a - b >= 0 ? '+' : '−') + Math.abs(a - b).toFixed(1)} pp`);
      },
    }),
    xAxis: categoryAxis(hours.map(h => String(h).padStart(2, '0'))),
    yAxis: valueAxis(measure === 'avg' ? compactNumber : (v: number) => `${v}%`, { splitNumber: 4 }),
    series: [
      { name: 'Comparison', type: 'bar', data: hours.map(h => val(compare, h)), barMaxWidth: 12, barGap: '15%', itemStyle: { color: INK.previous, borderRadius: [3, 3, 0, 0] } },
      { name: 'This period', type: 'bar', data: hours.map(h => val(current, h)), barMaxWidth: 12, itemStyle: { color: INK.accent, borderRadius: [3, 3, 0, 0] } },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [hours, current, compare, measure]);

  const diffs = hours.map(h => ({ hour: h, cur: at(current, h), cmp: at(compare, h), d: change(at(current, h)?.avgBills ?? 0, at(compare, h)?.avgBills ?? 0) }))
    .filter(x => (x.cur?.bills ?? 0) + (x.cmp?.bills ?? 0) > 0);
  const movers = [...diffs].filter(x => x.d !== null && (x.cur?.avgBills ?? 0) >= 1).sort((a, b) => Math.abs(b.d!) - Math.abs(a.d!)).slice(0, size === 'card' ? 3 : 5);

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <Summary color={INK.accent} title="This period" range={curLabel} p={current} />
        <Summary color={INK.previous} title="Comparison" range={cmpLabel} p={compare} vs={current} />
      </div>
      {!compare.complete && <p className="text-[11px] text-amber-700">The comparison period starts before complete history (Aug 2025); its days are counted from Aug 2025.</p>}
      <Legend items={[{ key: 'c', label: 'This period', color: INK.accent }, { key: 'p', label: 'Comparison', color: INK.previous }]} />
      <EChart option={option} height={size === 'card' ? 200 : 280} ariaLabel={`Busy hours: ${curLabel} compared with ${cmpLabel}`} />
      {movers.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          <span className="text-[11px] text-slate-500">Biggest changes:</span>
          {movers.map(m => (
            <span key={m.hour} className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${m.d! >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
              {m.d! >= 0 ? <ArrowUpRight size={11} /> : <ArrowDownRight size={11} />}{hourLabel(m.hour)} {m.d! >= 0 ? '+' : '−'}{Math.abs(m.d!).toFixed(0)}%
            </span>
          ))}
        </div>
      )}
      {size === 'drawer' && (
        <DetailTable
          caption="Busy hours compared" csvName="busy-hours-compare" rows={diffs} rowKey={r => String(r.hour)}
          columns={[
            { key: 'hour', label: 'Hour', value: r => r.hour, render: r => `${hourLabel(r.hour)}–${hourLabel(r.hour + 1)}` },
            { key: 'cur', label: 'Bills/day', align: 'right', value: r => r.cur?.avgBills ?? 0, render: r => formatNumber(Math.round(r.cur?.avgBills ?? 0)) },
            { key: 'cmp', label: 'Comparison', align: 'right', value: r => r.cmp?.avgBills ?? 0, render: r => formatNumber(Math.round(r.cmp?.avgBills ?? 0)) },
            { key: 'd', label: 'Change', align: 'right', value: r => r.d, render: r => <ChangeText v={r.d} /> },
            { key: 'share', label: 'Share of day', align: 'right', value: r => r.cur?.share ?? 0, render: r => pctText(r.cur?.share ?? 0) },
            { key: 'shareCmp', label: 'Share (comp.)', align: 'right', value: r => r.cmp?.share ?? 0, render: r => pctText(r.cmp?.share ?? 0) },
            { key: 'sales', label: 'Gross sales/day', align: 'right', value: r => r.cur?.avgSubtotal ?? 0, render: r => compactRupiah(r.cur?.avgSubtotal ?? 0) },
          ]}
          maxHeight={360}
        />
      )}
    </div>
  );
}

function Summary({ color, title, range, p, vs }: { color: string; title: string; range: string; p: HoursProfile; vs?: HoursProfile }) {
  return (
    <div className="rounded-lg border border-slate-200 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        <span className="h-2.5 w-2.5 rounded-[3px]" style={{ background: color }} />{title}
      </p>
      <p className="text-[11px] text-slate-500">{range} · {p.days} days</p>
      <p className="mt-1 text-sm text-slate-800">
        <span className="font-semibold tabular-nums">{formatNumber(Math.round(p.avgBillsPerDay))}</span> bills/day
        {p.peakHour !== null && <> · peak <span className="font-semibold">{hourLabel(p.peakHour)}</span></>}
        {vs && <span className="ml-1 text-xs text-slate-500">(this period {formatNumber(Math.round(vs.avgBillsPerDay))}, <ChangeText v={change(vs.avgBillsPerDay, p.avgBillsPerDay)} />)</span>}
      </p>
    </div>
  );
}

function ChangeText({ v }: { v: number | null }) {
  if (v === null) return <span className="text-slate-400">-</span>;
  return <span className={v >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{v >= 0 ? '+' : '−'}{Math.abs(v).toFixed(1)}%</span>;
}

function BranchCompare({ branches, measure, size, picked }: { branches: BranchHours[]; measure: Measure; size: 'card' | 'drawer'; picked: string }) {
  const hours = useMemo(() => activeHours(branches.map(b => b.hours)), [branches]);
  const val = (b: BranchHours, h: number) => {
    const x = b.hours.find(y => y.hour === h);
    return measure === 'avg' ? x?.avgBills ?? 0 : x?.share ?? 0;
  };
  const fmt = (v: number) => (measure === 'avg' ? formatNumber(Math.round(v)) : `${v.toFixed(1)}%`);
  const short = (n: string) => n.replace(/^Kopi Calf (To Go )?/, '');

  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 12, top: 14, bottom: 4, containLabel: true },
    tooltip: tooltip({
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: INK.axis } },
      formatter: (items: { dataIndex: number }[]) => {
        const h = hours[items[0]?.dataIndex ?? 0];
        return tipTitle(`${hourLabel(h)}–${hourLabel(h + 1)}`)
          + [...branches].sort((a, b) => val(b, h) - val(a, h)).map(b => tipRow(SERIES_COLORS[branches.indexOf(b)], fmt(val(b, h)), short(b.branchName), 'line')).join('');
      },
    }),
    xAxis: categoryAxis(hours.map(h => String(h).padStart(2, '0')), { boundaryGap: false }),
    yAxis: valueAxis(measure === 'avg' ? compactNumber : (v: number) => `${v}%`, { splitNumber: 4 }),
    series: branches.map((b, i) => ({
      name: b.branchName, type: 'line', data: hours.map(h => val(b, h)), symbol: 'circle', symbolSize: 6, showSymbol: false,
      lineStyle: { width: 2, color: SERIES_COLORS[i] }, itemStyle: { color: SERIES_COLORS[i], borderColor: '#fff', borderWidth: 2 },
      emphasis: { focus: 'series' },
    })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [hours, branches, measure]);

  if (!branches.length) return <p className="py-8 text-center text-sm text-slate-400">No branches with sales in this period</p>;
  return (
    <div className="space-y-3">
      <p className="text-[11px] text-slate-500">
        {picked ? 'Your branch selection' : 'The selected branches, or the 5 busiest of the period'} · averages per day the branch had sales
      </p>
      <Legend items={branches.map((b, i) => ({ key: b.branchCode, label: short(b.branchName), color: SERIES_COLORS[i], shape: 'line' as const }))} />
      <EChart option={option} height={size === 'card' ? 220 : 300} ariaLabel="Busy hours per branch" />
      <DetailTable
        caption="Busy hours per branch" csvName={size === 'drawer' ? 'busy-hours-branches' : undefined} rows={branches} rowKey={b => b.branchCode}
        columns={[
          { key: 'branch', label: 'Branch', value: b => b.branchName, render: b => (
            <span className="flex items-center gap-2"><span className="h-0.5 w-3 rounded-full" style={{ background: SERIES_COLORS[branches.indexOf(b)] }} />{short(b.branchName)}</span>) },
          { key: 'days', label: 'Days', align: 'right', value: b => b.activeDays },
          { key: 'avg', label: 'Bills/day', align: 'right', value: b => b.avgBillsPerDay, render: b => formatNumber(Math.round(b.avgBillsPerDay)) },
          { key: 'peak', label: 'Peak hour', align: 'right', value: b => b.peakHour, render: b => (b.peakHour === null ? '-' : hourLabel(b.peakHour)) },
          { key: 'peakShare', label: 'Peak share', align: 'right', value: b => b.hours.find(h => h.hour === b.peakHour)?.share ?? null,
            render: b => pctText(b.hours.find(h => h.hour === b.peakHour)?.share ?? null) },
          { key: 'sales', label: 'Gross sales/day', align: 'right', value: b => (b.activeDays ? b.subtotal / b.activeDays : 0),
            render: b => <span title={formatCurrency(b.subtotal)}>{compactRupiah(b.activeDays ? b.subtotal / b.activeDays : 0)}</span> },
        ]}
        maxHeight={size === 'card' ? 220 : 320}
      />
    </div>
  );
}
