'use client';

import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import ChannelLogo from '@/components/ChannelLogo';
import EChart, { ChartOption } from '@/components/charts/EChart';
import HBarChart from '@/components/charts/HBarChart';
import { Legend, SeriesKey } from '@/components/charts/common';
import { formatCurrency, formatNumber } from '@/lib/format';
import { base, categoryAxis, INK, rupiahAxis, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import {
  BasketResponse, BranchesResponse, bucketLabel, channelColor, channelKey, channelLabel, channelOrder, ChannelsResponse,
  compactNumber, compactRupiah, DeductionsResponse, DOW_LABELS, GROUP_COLORS, GROUP_LABELS, Granularity, hourLabel, HourlyResponse, KpisResponse, longDate,
  MenusResponse, MonthlyResponse, paymentLabel, PaymentsResponse, shortDate, TrendResponse, useOverview, withParams,
} from '@/lib/overview';
import { BusyBody } from '../BusyHoursCard';
import { ChannelGroups } from '../DeductionsCard';
import { Delta, Segmented } from '../Card';
import HoursCompare from '../HoursCompare';
import { monthLabel, MonthlyChart } from '../MonthlyCard';
import TrendChart, { ChartTypeSelect, metricOf, pct, TREND_METRICS, TrendChartType, TrendMetric } from '../TrendChart';
import { KpiKey, to, useDrill } from './DrillContext';
import { Block, bucketRange, DetailTable, Loaded, num, pctText, rp, ShareBar, Tiles, delta } from './parts';

const KPI_METRIC: Record<KpiKey, TrendMetric> = { sales: 'subtotal', nettSales: 'nettSales', bills: 'bills', avgTicket: 'avgTicket' };
const KPI_LABEL: Record<KpiKey, string> = { sales: 'Gross sales', nettSales: 'Nett sales', bills: 'Bills', avgTicket: 'Avg ticket' };
const short = (name: string) => name.replace(/^Kopi Calf (To Go )?/, '');

/* ------------------------------------------------------------------ KPI */

export function KpiDrawer({ q, metric: initial }: { q: string; metric: KpiKey }) {
  const [key, setKey] = useState<KpiKey>(initial);
  const [chart, setChart] = useState<TrendChartType>('line');
  const drill = useDrill();
  const kpis = useOverview<KpisResponse>('kpis', q);
  const trend = useOverview<TrendResponse>('trend', withParams(q, { granularity: 'day' }));
  const metric = KPI_METRIC[key];
  const money = key !== 'bills';
  const fmt = (v: number | null) => (v === null ? '-' : money ? formatCurrency(Math.round(v)) : formatNumber(Math.round(v)));

  return (
    <>
      <Block title="Metric" actions={<Segmented label="Metric" value={key} onChange={setKey} options={(Object.keys(KPI_LABEL) as KpiKey[]).map(k => ({ value: k, label: KPI_LABEL[k] }))} />}>
        <Loaded resource={kpis} height={90}>
          {d => {
            const k = d.kpis[key];
            const vals = d.daily.map(x => ({ date: x.date, v: key === 'sales' ? x.subtotal : key === 'nettSales' ? x.nettSales : key === 'bills' ? x.bills : x.avgTicket }));
            const withSales = vals.filter(x => (x.v ?? 0) > 0);
            const best = withSales.reduce<typeof withSales[number] | null>((a, b) => (!a || (b.v ?? 0) > (a.v ?? 0) ? b : a), null);
            const worst = withSales.reduce<typeof withSales[number] | null>((a, b) => (!a || (b.v ?? 0) < (a.v ?? 0) ? b : a), null);
            const perDay = key === 'avgTicket' ? k.value : withSales.length ? k.value / d.filters.days : null;
            return (
              <Tiles columns={5} tiles={[
                { label: KPI_LABEL[key], value: fmt(k.value), delta: k.deltaPct, sub: 'vs previous period' },
                { label: 'Previous period', value: d.filters.previous.complete ? fmt(k.previous) : '-', sub: d.filters.previous.complete ? `${d.filters.previous.from} – ${d.filters.previous.to}` : 'before Aug 2025' },
                { label: key === 'avgTicket' ? 'Period average' : 'Per day', value: fmt(perDay), sub: `${d.filters.days} days · ${withSales.length} with sales` },
                { label: 'Best day', value: best ? fmt(best.v) : '-', sub: best ? longDate(best.date) : '' },
                { label: 'Weakest day', value: worst ? fmt(worst.v) : '-', sub: worst ? longDate(worst.date) : '' },
              ]} />
            );
          }}
        </Loaded>
      </Block>

      <Block title={`${KPI_LABEL[key]} per day`} subtitle="Click a day for everything sold that day" actions={<ChartTypeSelect value={chart} onChange={setChart} />}>
        <Loaded resource={trend} height={320}>
          {d => <TrendChart data={d} metric={metric} chart={chart} height={320} onSelect={p => drill.drill(to.period(p.date, p.date, longDate(p.date)))} />}
        </Loaded>
      </Block>

      <Block title="By weekday" subtitle="Average per weekday over the period (days without sales count as zero)">
        <Loaded resource={trend} height={180}>
          {d => <WeekdayBars data={d} metric={metric} />}
        </Loaded>
      </Block>

      <Block title="Every day">
        <Loaded resource={trend} height={260}>
          {d => (
            <DetailTable
              caption="Per day" csvName={`${key}-per-day`} rows={d.series} rowKey={p => p.date}
              onRowClick={p => drill.drill(to.period(p.date, p.date, longDate(p.date)))}
              initialSort={{ key: 'date', desc: false }}
              columns={[
                { key: 'date', label: 'Date', value: p => p.date, render: p => longDate(p.date) },
                { key: 'sales', label: 'Gross sales', align: 'right', value: p => p.subtotal, render: p => rp(p.subtotal) },
                { key: 'nett', label: 'Nett sales', align: 'right', value: p => p.nettSales, render: p => rp(p.nettSales) },
                { key: 'bills', label: 'Bills', align: 'right', value: p => p.bills },
                { key: 'avg', label: 'Avg ticket', align: 'right', value: p => metricOf(p, 'avgTicket'), render: p => rp(metricOf(p, 'avgTicket')) },
                { key: 'disc', label: 'Discount', align: 'right', value: p => p.discountPct, render: p => pctText(p.discountPct) },
                { key: 'prev', label: `Previous ${KPI_LABEL[key].toLowerCase()}`, align: 'right', value: p => (d.filters.previous.complete ? metricOf(p.previous, metric) : null), render: p => fmt(d.filters.previous.complete ? metricOf(p.previous, metric) : null) },
                { key: 'chg', label: 'Change', align: 'right', value: p => pct(metricOf(p, metric), d.filters.previous.complete ? metricOf(p.previous, metric) : null), render: p => delta(pct(metricOf(p, metric), d.filters.previous.complete ? metricOf(p.previous, metric) : null)) },
              ]}
            />
          )}
        </Loaded>
      </Block>
    </>
  );
}

function WeekdayBars({ data, metric }: { data: TrendResponse; metric: TrendMetric }) {
  const option = useMemo<ChartOption>(() => {
    const acc = DOW_LABELS.map(() => ({ sub: 0, bills: 0, nett: 0, days: 0 }));
    for (const p of data.series) {
      const i = (new Date(`${p.date}T00:00:00`).getDay() + 6) % 7;
      acc[i].sub += p.subtotal;
      acc[i].bills += p.bills;
      acc[i].nett += p.nettSales ?? 0;
      acc[i].days += 1;
    }
    const vals = acc.map(a => (metric === 'avgTicket' ? (a.bills ? a.sub / a.bills : 0)
      : a.days ? (metric === 'bills' ? a.bills : metric === 'nettSales' ? a.nett : a.sub) / a.days : 0));
    const max = Math.max(...vals);
    const money = metric !== 'bills';
    return {
      ...base,
      grid: { left: 4, right: 8, top: 22, bottom: 4, containLabel: true },
      tooltip: tooltip({
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } },
        formatter: (items: { dataIndex: number }[]) => {
          const i = items[0]?.dataIndex ?? 0;
          return tipTitle(`${DOW_LABELS[i]} · ${acc[i].days} days`) + tipRow(INK.accent, money ? formatCurrency(Math.round(vals[i])) : formatNumber(Math.round(vals[i])), metric === 'avgTicket' ? 'avg ticket' : 'average per day');
        },
      }),
      xAxis: categoryAxis(DOW_LABELS),
      yAxis: valueAxis(money ? rupiahAxis : compactNumber, { splitNumber: 3 }),
      series: [{
        type: 'bar', barMaxWidth: 34,
        data: vals.map(v => ({ value: v, itemStyle: { color: v === max ? '#184f95' : INK.accent, borderRadius: [4, 4, 0, 0] } })),
        label: { show: true, position: 'top', fontSize: 10, color: INK.secondary, formatter: (p: { value: number }) => (money ? compactRupiah(p.value) : compactNumber(p.value)) },
      }],
    };
  }, [data, metric]);
  return <EChart option={option} height={200} ariaLabel="Average per weekday" />;
}

/* ------------------------------------------------------------------ Sales trend */

export function TrendDrawer({ q }: { q: string }) {
  const [metric, setMetric] = useState<TrendMetric>('subtotal');
  const [chart, setChart] = useState<TrendChartType>('line');
  const [granularity, setGranularity] = useState<Granularity | 'auto'>('auto');
  const drill = useDrill();
  const trend = useOverview<TrendResponse>('trend', granularity === 'auto' ? q : withParams(q, { granularity }));
  const kpis = useOverview<KpisResponse>('kpis', q);

  return (
    <>
      <Loaded resource={kpis} height={90}>
        {d => (
          <Tiles tiles={[
            { label: 'Gross sales', value: rp(d.kpis.sales.value), delta: d.kpis.sales.deltaPct, sub: `prev. ${compactRupiah(d.kpis.sales.previous)}` },
            { label: 'Nett sales', value: rp(d.kpis.nettSales.value), delta: d.kpis.nettSales.deltaPct },
            { label: 'Bills', value: num(d.kpis.bills.value), delta: d.kpis.bills.deltaPct },
            { label: 'Avg ticket', value: rp(d.kpis.avgTicket.value), delta: d.kpis.avgTicket.deltaPct },
          ]} />
        )}
      </Loaded>
      <Block title="Trend" subtitle="Pick the chart that answers your question · click a point to open that day / week / month"
        actions={
          <>
            <Segmented label="Metric" value={metric} options={TREND_METRICS} onChange={setMetric} />
            <Segmented label="Granularity" value={granularity === 'auto' ? trend.data?.granularity ?? 'day' : granularity} onChange={setGranularity}
              options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
            <ChartTypeSelect value={chart} onChange={setChart} />
          </>
        }>
        <Loaded resource={trend} height={420}>
          {d => (
            <TrendChart data={d} metric={metric} chart={chart} height={420} onSelect={p => {
              const [from, until] = bucketRange(p.date, d.granularity, d.filters.from, d.filters.to);
              drill.drill(to.period(from, until, bucketLabel(p.date, d.granularity)));
            }} />
          )}
        </Loaded>
      </Block>
      <Block title="All buckets">
        <Loaded resource={trend} height={260}>
          {d => {
            const prevOk = d.filters.previous.complete;
            const topChannel = (p: TrendResponse['series'][number]) => Object.entries(p.channels ?? {}).sort((a, b) => b[1].subtotal - a[1].subtotal)[0]?.[0] ?? '-';
            return (
              <DetailTable
                caption="Trend per bucket" csvName={`sales-trend-${d.granularity}`} rows={d.series} rowKey={p => p.date}
                initialSort={{ key: 'date', desc: false }}
                onRowClick={p => {
                  const [from, until] = bucketRange(p.date, d.granularity, d.filters.from, d.filters.to);
                  drill.drill(to.period(from, until, bucketLabel(p.date, d.granularity)));
                }}
                columns={[
                  { key: 'date', label: d.granularity === 'day' ? 'Date' : d.granularity === 'week' ? 'Week of' : 'Month', value: p => p.date, render: p => bucketLabel(p.date, d.granularity) },
                  { key: 'sales', label: 'Gross sales', align: 'right', value: p => p.subtotal, render: p => rp(p.subtotal) },
                  { key: 'prev', label: 'Previous', align: 'right', value: p => (prevOk ? p.previous.subtotal : null), render: p => (prevOk ? rp(p.previous.subtotal) : '-') },
                  { key: 'chg', label: 'Change', align: 'right', value: p => (prevOk ? pct(p.subtotal, p.previous.subtotal) : null), render: p => delta(prevOk ? pct(p.subtotal, p.previous.subtotal) : null) },
                  { key: 'nett', label: 'Nett', align: 'right', value: p => p.nettSales, render: p => rp(p.nettSales) },
                  { key: 'bills', label: 'Bills', align: 'right', value: p => p.bills },
                  { key: 'avg', label: 'Avg ticket', align: 'right', value: p => metricOf(p, 'avgTicket'), render: p => rp(metricOf(p, 'avgTicket')) },
                  { key: 'disc', label: 'Discount', align: 'right', value: p => p.discountPct, render: p => pctText(p.discountPct) },
                  { key: 'top', label: 'Top channel', value: p => topChannel(p), render: p => channelLabel(topChannel(p)) },
                ]}
              />
            );
          }}
        </Loaded>
      </Block>
    </>
  );
}

/* ------------------------------------------------------------------ Channels */

export function ChannelsDrawer({ q }: { q: string }) {
  const drill = useDrill();
  const res = useOverview<ChannelsResponse>('channels', q);
  return (
    <Loaded resource={res} height={400}>
      {d => {
        const total = d.channels.reduce((s, c) => s + c.subtotal, 0);
        const apps = d.channels.filter(c => /food/i.test(c.channel)).reduce((s, c) => s + c.subtotal, 0);
        const top = d.channels[0];
        return (
          <>
            <Tiles tiles={[
              { label: 'Channels', value: num(d.channels.length), sub: `${compactRupiah(total)} gross sales` },
              { label: 'Largest', value: top ? channelLabel(top.channel) : '-', sub: top ? `${pctText(top.share)} of sales` : '' },
              { label: 'Delivery apps', value: pctText(total ? (apps / total) * 100 : null), sub: 'GoFood, GrabFood, ShopeeFood' },
              { label: 'Bills', value: num(d.channels.reduce((s, c) => s + c.bills, 0)) },
            ]} />
            <Block title="Share over time" subtitle="Each bar = 100% of that bucket's gross sales">
              <ShareOverTime data={d} />
            </Block>
            <Block title="All channels" subtitle="Click a channel for its branches, hours, menus and payments">
              <DetailTable
                caption="Channels" csvName="channels" rows={d.channels} rowKey={c => c.channel}
                onRowClick={c => drill.drill(to.channel(c.channel))}
                initialSort={{ key: 'sales', desc: true }}
                columns={[
                  { key: 'channel', label: 'Channel', value: c => c.channel, render: c => <span className="flex items-center gap-2"><SeriesKey color={channelColor(c.channel)} /><ChannelLogo channel={c.channel} height={14} /></span> },
                  { key: 'sales', label: 'Gross sales', align: 'right', value: c => c.subtotal, render: c => rp(c.subtotal) },
                  { key: 'share', label: 'Share', align: 'right', value: c => c.share, render: c => <ShareBar value={c.share} color={channelColor(c.channel)} /> },
                  { key: 'bills', label: 'Bills', align: 'right', value: c => c.bills },
                  { key: 'avg', label: 'Avg ticket', align: 'right', value: c => c.avgTicket, render: c => rp(c.avgTicket) },
                  { key: 'nett', label: 'Nett', align: 'right', value: c => c.nettSales, render: c => rp(c.nettSales) },
                  { key: 'disc', label: 'Discount', align: 'right', value: c => c.discountPct, render: c => pctText(c.discountPct) },
                  { key: 'prev', label: 'Previous', align: 'right', value: c => c.previousSubtotal, render: c => rp(c.previousSubtotal) },
                  { key: 'chg', label: 'Change', align: 'right', value: c => c.deltaPct, render: c => delta(c.deltaPct) },
                ]}
              />
            </Block>
          </>
        );
      }}
    </Loaded>
  );
}

function ShareOverTime({ data }: { data: ChannelsResponse }) {
  const names = useMemo(() => [...new Set(data.channels.map(c => channelKey(c.channel)))].sort((a, b) => channelOrder(a) - channelOrder(b)), [data]);
  const option = useMemo<ChartOption>(() => {
    const totals = data.series.map(b => Object.values(b.values).reduce((s, v) => s + v.subtotal, 0));
    const share = (name: string) => data.series.map((b, i) => {
      const v = Object.entries(b.values).filter(([c]) => channelKey(c) === name).reduce((s, [, x]) => s + x.subtotal, 0);
      return totals[i] ? (v / totals[i]) * 100 : 0;
    });
    const stacks = names.map(n => ({ n, v: share(n) }));
    return {
      ...base,
      grid: { left: 4, right: 8, top: 8, bottom: 4, containLabel: true },
      tooltip: tooltip({
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } },
        formatter: (items: { dataIndex: number }[]) => {
          const i = items[0]?.dataIndex ?? 0;
          return tipTitle(`${bucketLabel(data.series[i].date, data.granularity)} · ${compactRupiah(totals[i])}`)
            + [...stacks].reverse().map(s => tipRow(channelColor(s.n), `${s.v[i].toFixed(1)}%`, s.n)).join('');
        },
      }),
      xAxis: categoryAxis(data.series.map(b => shortDate(b.date, data.granularity))),
      yAxis: valueAxis((v: number) => `${v}%`, { max: 100, splitNumber: 4 }),
      series: stacks.map(s => ({ name: s.n, type: 'bar', stack: 'share', data: s.v, barMaxWidth: 24, itemStyle: { color: channelColor(s.n), borderColor: '#fff', borderWidth: 1 } })),
    };
  }, [data, names]);
  return (
    <div className="space-y-2">
      <Legend items={names.map(n => ({ key: n, label: n, color: channelColor(n) }))} />
      <EChart option={option} height={260} ariaLabel="Channel share of gross sales per bucket" />
    </div>
  );
}

/* ------------------------------------------------------------------ Branches */

export function BranchesDrawer({ q }: { q: string }) {
  const drill = useDrill();
  const res = useOverview<BranchesResponse>('branches', q);
  return (
    <Loaded resource={res} height={400}>
      {d => {
        const withSales = d.branches.filter(b => b.subtotal > 0);
        const total = withSales.reduce((s, b) => s + b.subtotal, 0);
        const up = d.branches.filter(b => (b.deltaPct ?? 0) > 0).length;
        const down = d.branches.filter(b => (b.deltaPct ?? 0) < 0).length;
        const top20 = withSales.slice(0, 20);
        return (
          <>
            <Tiles columns={5} tiles={[
              { label: 'Branches with sales', value: num(withSales.length), sub: `${d.branches.filter(b => b.isNew).length} new` },
              { label: 'Gross sales', value: compactRupiah(total), title: formatCurrency(total) },
              { label: 'Per branch', value: compactRupiah(withSales.length ? total / withSales.length : null), sub: 'average' },
              { label: 'Growing', value: num(up), sub: 'vs previous period' },
              { label: 'Declining', value: num(down), sub: 'vs previous period' },
            ]} />
            <Block title="Top 20 by gross sales" subtitle="Click a bar for the branch profile">
              <HBarChart ariaLabel="Top 20 branches by gross sales" labelWidth={170} rowHeight={24}
                items={top20.map(b => ({ key: b.branchCode, label: short(b.branchName), value: b.subtotal, display: `${compactRupiah(b.subtotal)}${b.deltaPct === null ? '' : ` · ${b.deltaPct >= 0 ? '+' : '−'}${Math.abs(b.deltaPct).toFixed(1)}%`}`,
                  tip: { rows: [[formatCurrency(b.subtotal), 'sales'], [formatNumber(b.bills), 'bills']], footer: b.branchCode } }))}
                onSelect={code => { const b = d.branches.find(x => x.branchCode === code); if (b) drill.drill(to.branch(b.branchCode, b.branchName)); }} />
            </Block>
            <Block title="All branches" subtitle="Click a branch for channels, hours, menus, payments and deductions">
              <DetailTable
                caption="Branches" csvName="branches" rows={d.branches.map((b, i) => ({ ...b, rank: i + 1 }))} rowKey={b => b.branchCode}
                search={b => `${b.branchName} ${b.branchCode}`}
                onRowClick={b => drill.drill(to.branch(b.branchCode, b.branchName))}
                initialSort={{ key: 'sales', desc: true }}
                columns={[
                  { key: 'rank', label: '#', align: 'right', value: b => b.rank },
                  { key: 'branch', label: 'Branch', value: b => b.branchName, render: b => <span title={b.branchName}>{short(b.branchName)}{b.isNew && <span className="ml-1.5 rounded bg-blue-50 px-1 text-[10px] font-medium text-blue-700">New</span>}</span> },
                  { key: 'code', label: 'Code', value: b => b.branchCode },
                  { key: 'sales', label: 'Gross sales', align: 'right', value: b => b.subtotal, render: b => rp(b.subtotal) },
                  { key: 'chg', label: 'Change', align: 'right', value: b => b.deltaPct, render: b => delta(b.deltaPct) },
                  { key: 'prev', label: 'Previous', align: 'right', value: b => b.previousSubtotal, render: b => rp(b.previousSubtotal) },
                  { key: 'nett', label: 'Nett', align: 'right', value: b => b.nettSales, render: b => rp(b.nettSales) },
                  { key: 'bills', label: 'Bills', align: 'right', value: b => b.bills },
                  { key: 'avg', label: 'Avg ticket', align: 'right', value: b => b.avgTicket, render: b => rp(b.avgTicket) },
                  { key: 'perDay', label: 'Gross sales/day', align: 'right', value: b => b.subtotalPerDay, render: b => rp(b.subtotalPerDay) },
                  { key: 'days', label: 'Days open', align: 'right', value: b => b.activeDays },
                  { key: 'void', label: 'Void bills', align: 'right', value: b => b.voidBills },
                  { key: 'voidRate', label: 'Void rate', align: 'right', value: b => b.voidRate, render: b => pctText(b.voidRate, 2) },
                ]}
                maxHeight={520}
              />
            </Block>
          </>
        );
      }}
    </Loaded>
  );
}

/* ------------------------------------------------------------------ Busy hours */

export function HoursDrawer({ q }: { q: string }) {
  const [mode, setMode] = useState<'period' | 'branches'>('period');
  const res = useOverview<HourlyResponse>('hourly', q);
  return (
    <Loaded resource={res} height={400}>
      {d => {
        const days = Object.values(d.daysPerDow).reduce((a, b) => a + b, 0) || 1;
        const byHour = new Map<number, { bills: number; subtotal: number }>();
        d.cells.forEach(c => {
          const h = byHour.get(c.hour) ?? { bills: 0, subtotal: 0 };
          h.bills += c.bills;
          h.subtotal += c.subtotal;
          byHour.set(c.hour, h);
        });
        const totalBills = [...byHour.values()].reduce((s, h) => s + h.bills, 0);
        const hours = [...byHour.entries()].sort((a, b) => a[0] - b[0]).map(([hour, h]) => ({ hour, ...h, avgBills: h.bills / days, avgSales: h.subtotal / days, share: totalBills ? (h.bills / totalBills) * 100 : 0 }));
        const weekdays = DOW_LABELS.map((label, i) => {
          const cells = d.cells.filter(c => c.dow === i + 1);
          const n = d.daysPerDow[String(i + 1)] || 0;
          const bills = cells.reduce((s, c) => s + c.bills, 0);
          const sales = cells.reduce((s, c) => s + c.subtotal, 0);
          const peak = cells.reduce<typeof cells[number] | null>((a, c) => (!a || c.bills > a.bills ? c : a), null);
          return { label, dow: i + 1, days: n, bills, avgBills: n ? bills / n : 0, avgSales: n ? sales / n : 0, peak: peak?.hour ?? null };
        });
        const top3 = [...hours].sort((a, b) => b.bills - a.bills).slice(0, 3);
        return (
          <>
            <Tiles tiles={[
              { label: 'Bills per day', value: num(totalBills / days), sub: `${days} days` },
              { label: 'Busiest slot', value: d.peak ? `${DOW_LABELS[d.peak.dow - 1]} ${hourLabel(d.peak.hour)}` : '-', sub: d.peak ? `${num(d.peak.avgBills)} bills/day` : '' },
              { label: 'Top 3 hours', value: top3.map(h => hourLabel(h.hour).slice(0, 2)).join(' · ') || '-', sub: `${pctText(top3.reduce((s, h) => s + h.share, 0))} of bills` },
              { label: 'Busiest weekday', value: [...weekdays].sort((a, b) => b.avgBills - a.avgBills)[0]?.label ?? '-', sub: `${num([...weekdays].sort((a, b) => b.avgBills - a.avgBills)[0]?.avgBills)} bills/day` },
            ]} />
            <Block title="Pattern" subtitle="Average bills per day by hour, and by weekday x hour">
              <BusyBody data={d} view="chart" large />
            </Block>
            <Block title="Compare" subtitle="Against another period, or branch against branch"
              actions={<Segmented label="Compare" value={mode} onChange={setMode} options={[{ value: 'period', label: 'Periods' }, { value: 'branches', label: 'Branches' }]} />}>
              <HoursCompare query={q} mode={mode} period={{ from: d.filters.from, to: d.filters.to }} size="drawer" />
            </Block>
            <Block title="Per hour">
              <DetailTable caption="Per hour" csvName="busy-hours-per-hour" rows={hours} rowKey={h => String(h.hour)} initialSort={{ key: 'hour', desc: false }}
                columns={[
                  { key: 'hour', label: 'Hour', value: h => h.hour, render: h => `${hourLabel(h.hour)}–${hourLabel(h.hour + 1)}` },
                  { key: 'avg', label: 'Bills/day', align: 'right', value: h => h.avgBills, render: h => num(h.avgBills) },
                  { key: 'sales', label: 'Gross sales/day', align: 'right', value: h => h.avgSales, render: h => rp(h.avgSales) },
                  { key: 'share', label: 'Share of bills', align: 'right', value: h => h.share, render: h => <ShareBar value={h.share} /> },
                  { key: 'bills', label: 'Bills (period)', align: 'right', value: h => h.bills },
                  { key: 'total', label: 'Gross sales (period)', align: 'right', value: h => h.subtotal, render: h => rp(h.subtotal) },
                ]} />
            </Block>
            <Block title="Per weekday">
              <DetailTable caption="Per weekday" csvName="busy-hours-per-weekday" rows={weekdays} rowKey={w => w.label} initialSort={{ key: 'dow', desc: false }}
                columns={[
                  { key: 'dow', label: 'Weekday', value: w => w.dow, render: w => w.label },
                  { key: 'days', label: 'Days', align: 'right', value: w => w.days },
                  { key: 'avg', label: 'Bills/day', align: 'right', value: w => w.avgBills, render: w => num(w.avgBills) },
                  { key: 'sales', label: 'Gross sales/day', align: 'right', value: w => w.avgSales, render: w => rp(w.avgSales) },
                  { key: 'peak', label: 'Peak hour', align: 'right', value: w => w.peak, render: w => (w.peak === null ? '-' : hourLabel(w.peak)) },
                ]} />
            </Block>
          </>
        );
      }}
    </Loaded>
  );
}

/* ------------------------------------------------------------------ Menus */

const CATEGORY_COLORS: Record<string, string> = { BEVERAGE: '#2a78d6', FOOD: '#eb6834', OTHER: '#a8a29e' };

export function MenusDrawer({ q }: { q: string }) {
  const [tab, setTab] = useState<'menus' | 'categories' | 'addons'>('menus');
  const drill = useDrill();
  const res = useOverview<MenusResponse>('menus', withParams(q, { limit: '2000', sort: 'subtotal' }));
  return (
    <Loaded resource={res} height={400}>
      {d => {
        const avgPrice = d.totals.qty ? d.totals.subtotal / d.totals.qty : null;
        return (
          <>
            <Tiles columns={5} tiles={[
              { label: 'Menus sold', value: num(d.top.length), sub: 'distinct menus' },
              { label: 'Menu sales', value: compactRupiah(d.totals.subtotal), title: formatCurrency(d.totals.subtotal) },
              { label: 'Items', value: num(d.totals.qty), sub: 'pcs ordered' },
              { label: 'Avg price', value: rp(avgPrice), sub: 'per item' },
              { label: 'Top 10 share', value: pctText(d.top.slice(0, 10).reduce((s, m) => s + (m.share ?? 0), 0)), sub: 'of menu sales' },
            ]} />
            <Block title="Breakdown" actions={<Segmented label="Menus view" value={tab} onChange={setTab} options={[
              { value: 'menus', label: 'All menus' }, { value: 'categories', label: 'Categories' }, { value: 'addons', label: 'Add-ons' },
            ]} />}>
              {tab === 'menus' && (
                <DetailTable
                  caption="Menus" csvName="menus" rows={d.top.map((m, i) => ({ ...m, rank: i + 1 }))} rowKey={m => m.menuId}
                  search={m => `${m.name} ${m.category} ${m.categoryDetail}`}
                  onRowClick={m => drill.drill({ kind: 'menu', menuId: m.menuId, menuKind: 'menu', name: m.name })}
                  initialSort={{ key: 'sales', desc: true }} maxHeight={560}
                  columns={[
                    { key: 'rank', label: '#', align: 'right', value: m => m.rank },
                    { key: 'name', label: 'Menu', value: m => m.name },
                    { key: 'cat', label: 'Category', value: m => m.category },
                    { key: 'sub', label: 'Sub-category', value: m => m.categoryDetail },
                    { key: 'qty', label: 'Qty', align: 'right', value: m => m.qty },
                    { key: 'sales', label: 'Gross sales', align: 'right', value: m => m.subtotal, render: m => rp(m.subtotal) },
                    { key: 'share', label: 'Share', align: 'right', value: m => m.share, render: m => pctText(m.share, 2) },
                    { key: 'bills', label: 'Bills', align: 'right', value: m => m.bills },
                    { key: 'price', label: 'Avg price', align: 'right', value: m => (m.qty ? m.subtotal / m.qty : null), render: m => rp(m.qty ? m.subtotal / m.qty : null) },
                    { key: 'disc', label: 'Discount', align: 'right', value: m => m.discount, render: m => rp(m.discount) },
                  ]}
                />
              )}
              {tab === 'categories' && (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2">
                    {d.categories.map(c => (
                      <div key={c.category} className="min-w-[8rem] flex-1 rounded-lg border border-slate-200 px-3 py-2">
                        <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500"><SeriesKey color={CATEGORY_COLORS[c.category] ?? '#a8a29e'} />{c.category}</p>
                        <p className="text-lg font-semibold text-slate-900">{pctText(c.share)}</p>
                        <p className="text-[11px] text-slate-500">{compactRupiah(c.subtotal)} · {formatNumber(c.qty)} pcs</p>
                      </div>
                    ))}
                  </div>
                  <DetailTable caption="Sub-categories" csvName="menu-sub-categories"
                    rows={d.categories.flatMap(c => c.details.map(x => ({ ...x, category: c.category })))} rowKey={x => `${x.category}-${x.name}`}
                    search={x => `${x.name} ${x.category}`} initialSort={{ key: 'sales', desc: true }}
                    columns={[
                      { key: 'cat', label: 'Category', value: x => x.category, render: x => <span className="flex items-center gap-1.5"><SeriesKey color={CATEGORY_COLORS[x.category] ?? '#a8a29e'} />{x.category}</span> },
                      { key: 'name', label: 'Sub-category', value: x => x.name },
                      { key: 'qty', label: 'Qty', align: 'right', value: x => x.qty },
                      { key: 'sales', label: 'Gross sales', align: 'right', value: x => x.subtotal, render: x => rp(x.subtotal) },
                      { key: 'share', label: 'Share', align: 'right', value: x => (d.totals.subtotal ? (x.subtotal / d.totals.subtotal) * 100 : null), render: x => <ShareBar value={d.totals.subtotal ? (x.subtotal / d.totals.subtotal) * 100 : null} color={CATEGORY_COLORS[x.category] ?? '#a8a29e'} /> },
                    ]} />
                </div>
              )}
              {tab === 'addons' && (
                <DetailTable caption="Add-ons" csvName="menu-add-ons"
                  rows={d.addons.flatMap(g => g.options.map(o => ({ ...o, group: g.group, groupQty: g.qty })))} rowKey={o => `${o.group}-${o.menuId}`}
                  search={o => `${o.group} ${o.name}`} initialSort={{ key: 'qty', desc: true }}
                  columns={[
                    { key: 'group', label: 'Group', value: o => o.group },
                    { key: 'name', label: 'Option', value: o => o.name },
                    { key: 'qty', label: 'Qty', align: 'right', value: o => o.qty },
                    { key: 'share', label: 'Share of group', align: 'right', value: o => o.share, render: o => <ShareBar value={o.share} /> },
                    { key: 'sales', label: 'Gross sales', align: 'right', value: o => o.subtotal, render: o => (o.subtotal ? rp(o.subtotal) : '-') },
                  ]} />
              )}
            </Block>
          </>
        );
      }}
    </Loaded>
  );
}

/* ------------------------------------------------------------------ Payments */

export function PaymentsDrawer({ q }: { q: string }) {
  const drill = useDrill();
  const res = useOverview<PaymentsResponse>('payments', q);
  return (
    <Loaded resource={res} height={400}>
      {d => {
        const total = d.methods.reduce((s, m) => s + m.subtotal, 0);
        const bills = d.methods.reduce((s, m) => s + m.bills, 0);
        const cash = d.types.filter(t => /cash/i.test(t.type)).reduce((s, t) => s + t.subtotal, 0);
        return (
          <>
            <Tiles tiles={[
              { label: 'Methods used', value: num(d.methods.length), sub: `${d.types.length} types` },
              { label: 'Top method', value: d.methods[0] ? paymentLabel(d.methods[0].method) : '-', sub: d.methods[0] ? `${pctText(d.methods[0].share)} of sales` : '' },
              { label: 'Cashless', value: pctText(total ? ((total - cash) / total) * 100 : null), sub: 'of gross sales' },
              { label: 'Bills', value: num(bills), sub: compactRupiah(total) },
            ]} />
            <Block title="Payment types">
              <DetailTable caption="Payment types" csvName="payment-types" rows={d.types} rowKey={t => t.type} initialSort={{ key: 'sales', desc: true }}
                columns={[
                  { key: 'type', label: 'Type', value: t => t.type },
                  { key: 'bills', label: 'Bills', align: 'right', value: t => t.bills },
                  { key: 'sales', label: 'Gross sales', align: 'right', value: t => t.subtotal, render: t => rp(t.subtotal) },
                  { key: 'share', label: 'Share', align: 'right', value: t => t.share, render: t => <ShareBar value={t.share} /> },
                ]} />
            </Block>
            <Block title="All payment methods" subtitle="First payment of each bill · click a method for its branches, channels and days">
              <DetailTable caption="Payment methods" csvName="payment-methods" rows={d.methods} rowKey={m => `${m.type}-${m.method}`}
                search={m => `${m.method} ${paymentLabel(m.method)} ${m.type}`} initialSort={{ key: 'sales', desc: true }}
                onRowClick={m => drill.drill({ kind: 'payment', method: m.method, label: paymentLabel(m.method) })}
                columns={[
                  { key: 'method', label: 'Method', value: m => paymentLabel(m.method) },
                  { key: 'type', label: 'Type', value: m => m.type },
                  { key: 'bills', label: 'Bills', align: 'right', value: m => m.bills },
                  { key: 'billShare', label: 'Bill share', align: 'right', value: m => m.billShare, render: m => pctText(m.billShare) },
                  { key: 'sales', label: 'Gross sales', align: 'right', value: m => m.subtotal, render: m => rp(m.subtotal) },
                  { key: 'share', label: 'Share', align: 'right', value: m => m.share, render: m => <ShareBar value={m.share} /> },
                  { key: 'avg', label: 'Avg ticket', align: 'right', value: m => (m.bills ? m.subtotal / m.bills : null), render: m => rp(m.bills ? m.subtotal / m.bills : null) },
                ]} />
            </Block>
          </>
        );
      }}
    </Loaded>
  );
}

/* ------------------------------------------------------------------ Basket */

type BasketMeasure = 'qtyPerBill' | 'linesPerBill' | 'foodSharePct' | 'foodAttachPct';
const BASKET_MEASURES: { value: BasketMeasure; label: string; pct: boolean }[] = [
  { value: 'qtyPerBill', label: 'Items / bill', pct: false },
  { value: 'linesPerBill', label: 'Lines / bill', pct: false },
  { value: 'foodSharePct', label: 'With food', pct: true },
  { value: 'foodAttachPct', label: 'Attach rate', pct: true },
];

export function BasketDrawer({ q }: { q: string }) {
  const [measure, setMeasure] = useState<BasketMeasure>('qtyPerBill');
  const drill = useDrill();
  const res = useOverview<BasketResponse>('basket', q);
  return (
    <Loaded resource={res} height={400}>
      {d => {
        const t = d.totals;
        const p = d.filters.previous.complete ? d.previous : null;
        const ch = (a: number | null, b: number | null | undefined) => (a !== null && b ? ((a - b) / b) * 100 : null);
        const m = BASKET_MEASURES.find(x => x.value === measure)!;
        return (
          <>
            <Tiles tiles={[
              { label: 'Items / bill', value: num(t.qtyPerBill, 2), delta: ch(t.qtyPerBill, p?.qtyPerBill) },
              { label: 'Menu lines / bill', value: num(t.linesPerBill, 2), delta: ch(t.linesPerBill, p?.linesPerBill) },
              { label: 'Bills with food', value: pctText(t.foodSharePct), delta: p && t.foodSharePct !== null && p.foodSharePct !== null ? t.foodSharePct - p.foodSharePct : null, deltaUnit: ' pp', sub: `${num(t.foodBills)} bills` },
              { label: 'Food attach rate', value: pctText(t.foodAttachPct), delta: p && t.foodAttachPct !== null && p.foodAttachPct !== null ? t.foodAttachPct - p.foodAttachPct : null, deltaUnit: ' pp', sub: 'beverage bills with food' },
            ]} />
            <Block title="Over time" actions={<Segmented label="Measure" value={measure} onChange={setMeasure} options={BASKET_MEASURES.map(x => ({ value: x.value, label: x.label }))} />}>
              <BasketChart data={d} measure={measure} isPct={m.pct} />
            </Block>
            <Block title="Per channel" subtitle="Click a channel for its profile">
              <DetailTable caption="Basket per channel" csvName="basket-per-channel" rows={d.channels} rowKey={c => c.channel}
                onRowClick={c => drill.drill(to.channel(c.channel))} initialSort={{ key: 'bills', desc: true }}
                columns={[
                  { key: 'channel', label: 'Channel', value: c => c.channel, render: c => <span className="flex items-center gap-2"><SeriesKey color={channelColor(c.channel)} /><ChannelLogo channel={c.channel} height={14} /></span> },
                  { key: 'bills', label: 'Bills', align: 'right', value: c => c.bills },
                  { key: 'qty', label: 'Items/bill', align: 'right', value: c => c.qtyPerBill, render: c => num(c.qtyPerBill, 2) },
                  { key: 'lines', label: 'Lines/bill', align: 'right', value: c => c.linesPerBill, render: c => num(c.linesPerBill, 2) },
                  { key: 'food', label: 'With food', align: 'right', value: c => c.foodSharePct, render: c => pctText(c.foodSharePct) },
                  { key: 'attach', label: 'Attach', align: 'right', value: c => c.foodAttachPct, render: c => pctText(c.foodAttachPct) },
                ]} />
            </Block>
            <Block title="Per bucket">
              <DetailTable caption="Basket per bucket" csvName="basket-per-bucket" rows={d.series} rowKey={s => s.date} initialSort={{ key: 'date', desc: false }}
                columns={[
                  { key: 'date', label: 'Date', value: s => s.date, render: s => bucketLabel(s.date, d.granularity) },
                  { key: 'bills', label: 'Bills', align: 'right', value: s => s.bills },
                  { key: 'qty', label: 'Items/bill', align: 'right', value: s => s.qtyPerBill, render: s => num(s.qtyPerBill, 2) },
                  { key: 'lines', label: 'Lines/bill', align: 'right', value: s => s.linesPerBill, render: s => num(s.linesPerBill, 2) },
                  { key: 'food', label: 'With food', align: 'right', value: s => s.foodSharePct, render: s => pctText(s.foodSharePct) },
                  { key: 'attach', label: 'Attach', align: 'right', value: s => s.foodAttachPct, render: s => pctText(s.foodAttachPct) },
                ]} />
            </Block>
          </>
        );
      }}
    </Loaded>
  );
}

function BasketChart({ data, measure, isPct }: { data: BasketResponse; measure: BasketMeasure; isPct: boolean }) {
  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 12, top: 14, bottom: 4, containLabel: true },
    tooltip: tooltip({
      trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: INK.axis } },
      formatter: (items: { dataIndex: number }[]) => {
        const s = data.series[items[0]?.dataIndex ?? 0];
        const v = s[measure];
        return tipTitle(bucketLabel(s.date, data.granularity)) + tipRow(INK.accent, v === null ? '-' : isPct ? `${v.toFixed(1)}%` : v.toFixed(2), BASKET_MEASURES.find(m => m.value === measure)!.label, 'line')
          + tipFooter(`${formatNumber(s.bills)} bills`);
      },
    }),
    xAxis: categoryAxis(data.series.map(s => shortDate(s.date, data.granularity)), { boundaryGap: false }),
    yAxis: valueAxis(isPct ? (v: number) => `${v}%` : (v: number) => v.toFixed(1), { scale: true, splitNumber: 4 }),
    series: [{ type: 'line', data: data.series.map(s => s[measure]), symbol: 'circle', symbolSize: 6, showSymbol: data.series.length <= 31, lineStyle: { color: INK.accent, width: 2.5 }, itemStyle: { color: INK.accent, borderColor: '#fff', borderWidth: 2 } }],
  }), [data, measure, isPct]);
  return <EChart option={option} height={240} ariaLabel="Basket measure over time" />;
}

/* ------------------------------------------------------------------ Deductions */

export function DeductionsDrawer({ q }: { q: string }) {
  const drill = useDrill();
  const res = useOverview<DeductionsResponse>('deductions', q);
  return (
    <Loaded resource={res} height={400}>
      {d => {
        const t = d.totals;
        const flagged = d.branches.filter(b => b.status === 'review');
        return (
          <>
            <Tiles columns={5} tiles={[
              { label: 'All transactions', value: num(t.gross.bills), sub: compactRupiah(t.gross.subtotal) },
              { label: 'Void & cancelled', value: compactRupiah(t.void.subtotal), sub: `${num(t.void.bills)} bills · ${pctText(d.voidRate, 2)}`, title: formatCurrency(t.void.subtotal) },
              { label: 'Other cost', value: compactRupiah(t.otherCost.subtotal), sub: `${num(t.otherCost.bills)} bills`, title: formatCurrency(t.otherCost.subtotal) },
              { label: 'Open bills', value: compactRupiah(t.open.subtotal), sub: `${num(t.open.bills)} bills` },
              { label: 'Branches to review', value: num(flagged.length), sub: d.threshold === null ? 'too few branches for P90' : `void rate above ${pctText(d.threshold, 2)}` },
            ]} />
            <Block title="Offline vs online" subtitle="Offline = Dine In, Takeaway · Online = GoFood, GrabFood, ShopeeFood, Online Order · change in percentage points vs the comparison period">
              <div className="space-y-4">
                <ChannelGroups data={d} />
                {d.dailyGroups.length > 1 && (
                  <>
                    <p className="text-xs font-medium text-slate-500">Void rate per day · click a day for its profile</p>
                    <GroupVoidChart data={d} onSelect={date => drill.drill(to.period(date, date, longDate(date)))} />
                  </>
                )}
                <DetailTable caption="Deductions per channel" csvName="deductions-per-channel" rows={d.channels} rowKey={c => c.channel}
                  initialSort={{ key: 'group', desc: false }} onRowClick={c => drill.drill(to.channel(c.channel))}
                  columns={[
                    { key: 'group', label: 'Group', value: c => c.group, render: c => <span className="flex items-center gap-1.5"><SeriesKey color={GROUP_COLORS[c.group]} />{GROUP_LABELS[c.group]}</span> },
                    { key: 'channel', label: 'Channel', value: c => c.channel, render: c => <ChannelLogo channel={c.channel} height={14} /> },
                    { key: 'bills', label: 'All bills', align: 'right', value: c => c.bills },
                    { key: 'void', label: 'Void bills', align: 'right', value: c => c.voidBills },
                    { key: 'voidRp', label: 'Void value', align: 'right', value: c => c.voidSubtotal, render: c => rp(c.voidSubtotal) },
                    { key: 'rate', label: 'Void rate', align: 'right', value: c => c.voidRate, render: c => pctText(c.voidRate, 2) },
                    { key: 'prev', label: 'Comparison', align: 'right', value: c => c.previousVoidRate ?? null, render: c => pctText(c.previousVoidRate ?? null, 2) },
                    { key: 'chg', label: 'Change', align: 'right', value: c => voidChange(c),
                      render: c => <Delta value={voidChange(c)} upIsGood={false} unit=" pp" /> },
                    { key: 'share', label: 'Share of voids', align: 'right', value: c => c.voidShare ?? null, render: c => pctText(c.voidShare ?? null) },
                    { key: 'oc', label: 'Other cost', align: 'right', value: c => c.otherCostSubtotal, render: c => (c.otherCostBills ? `${num(c.otherCostBills)} · ${compactRupiah(c.otherCostSubtotal)}` : '-') },
                    { key: 'open', label: 'Open bills', align: 'right', value: c => c.openBills },
                  ]} />
                <DetailTable caption="Offline and online deductions per branch" csvName="deductions-offline-online-per-branch" rows={d.branchGroups} rowKey={b => b.branchCode}
                  search={b => `${b.branchName} ${b.branchCode}`} initialSort={{ key: 'offRate', desc: true }}
                  onRowClick={b => drill.drill(to.branch(b.branchCode, b.branchName))}
                  columns={[
                    { key: 'branch', label: 'Branch', value: b => b.branchName, render: b => short(b.branchName) },
                    { key: 'offRate', label: 'Offline void rate', align: 'right', value: b => b.offline.voidRate, render: b => pctText(b.offline.voidRate, 2) },
                    { key: 'offVoid', label: 'Offline voids', align: 'right', value: b => b.offline.voidBills, render: b => `${num(b.offline.voidBills)} / ${num(b.offline.bills)}` },
                    { key: 'onRate', label: 'Online void rate', align: 'right', value: b => b.online.voidRate, render: b => pctText(b.online.voidRate, 2) },
                    { key: 'onVoid', label: 'Online voids', align: 'right', value: b => b.online.voidBills, render: b => `${num(b.online.voidBills)} / ${num(b.online.bills)}` },
                    { key: 'voidRp', label: 'Void value', align: 'right', value: b => b.offline.voidSubtotal + b.online.voidSubtotal, render: b => rp(b.offline.voidSubtotal + b.online.voidSubtotal) },
                    { key: 'offOc', label: 'Offline other cost', align: 'right', value: b => b.offline.otherCostSubtotal, render: b => rp(b.offline.otherCostSubtotal) },
                    { key: 'onOc', label: 'Online other cost', align: 'right', value: b => b.online.otherCostSubtotal, render: b => rp(b.online.otherCostSubtotal) },
                  ]} />
              </div>
            </Block>
            {d.daily.length > 1 && (
              <Block title="Void rate per day" subtitle="Click a day for everything that happened that day">
                <VoidChart data={d} onSelect={date => drill.drill(to.period(date, date, longDate(date)))} />
              </Block>
            )}
            <Block title="Branches" subtitle="Branches with void or other-cost transactions · review = above the P90 void rate (≥ 3 voids)">
              <DetailTable caption="Deductions per branch" csvName="deductions-per-branch" rows={d.branches} rowKey={b => b.branchCode}
                search={b => `${b.branchName} ${b.branchCode}`} initialSort={{ key: 'rate', desc: true }}
                onRowClick={b => drill.drill(to.branch(b.branchCode, b.branchName))}
                columns={[
                  { key: 'status', label: 'Status', value: b => b.status, render: b => (b.status === 'review'
                    ? <span className="inline-flex items-center gap-1 font-medium text-amber-700"><AlertTriangle size={12} /> Review</span>
                    : <span className="inline-flex items-center gap-1 text-slate-500"><CheckCircle2 size={12} /> Normal</span>) },
                  { key: 'branch', label: 'Branch', value: b => b.branchName, render: b => short(b.branchName) },
                  { key: 'bills', label: 'Transactions', align: 'right', value: b => b.bills },
                  { key: 'void', label: 'Void bills', align: 'right', value: b => b.voidBills },
                  { key: 'voidRp', label: 'Void value', align: 'right', value: b => b.voidSubtotal, render: b => rp(b.voidSubtotal) },
                  { key: 'rate', label: 'Void rate', align: 'right', value: b => b.voidRate, render: b => pctText(b.voidRate, 2) },
                  { key: 'oc', label: 'Other cost bills', align: 'right', value: b => b.otherCostBills },
                  { key: 'ocRp', label: 'Other cost', align: 'right', value: b => b.otherCostSubtotal, render: b => rp(b.otherCostSubtotal) },
                ]} />
            </Block>
            <Block title="Other cost by method" subtitle="Finished without a bill number (CUPPING, WASTE, …) — not sales">
              <DetailTable caption="Other cost by method" csvName="other-cost-methods" rows={d.otherCostByMethod} rowKey={m => m.method} initialSort={{ key: 'value', desc: true }}
                columns={[
                  { key: 'method', label: 'Method', value: m => m.method },
                  { key: 'bills', label: 'Bills', align: 'right', value: m => m.bills },
                  { key: 'value', label: 'Value', align: 'right', value: m => m.subtotal, render: m => rp(m.subtotal) },
                ]} />
            </Block>
            <Block title="Per day">
              <DetailTable caption="Deductions per day" csvName="deductions-per-day" rows={d.daily} rowKey={x => x.date} initialSort={{ key: 'date', desc: false }}
                onRowClick={x => drill.drill(to.period(x.date, x.date, longDate(x.date)))}
                columns={[
                  { key: 'date', label: 'Date', value: x => x.date, render: x => longDate(x.date) },
                  { key: 'bills', label: 'Transactions', align: 'right', value: x => x.bills },
                  { key: 'void', label: 'Void bills', align: 'right', value: x => x.voidBills },
                  { key: 'voidRp', label: 'Void value', align: 'right', value: x => x.voidSubtotal, render: x => rp(x.voidSubtotal) },
                  { key: 'rate', label: 'Void rate', align: 'right', value: x => x.voidRate, render: x => pctText(x.voidRate, 2) },
                  { key: 'oc', label: 'Other cost', align: 'right', value: x => x.otherCostSubtotal, render: x => rp(x.otherCostSubtotal) },
                ]} />
            </Block>
          </>
        );
      }}
    </Loaded>
  );
}

const voidChange = (c: { voidRate: number; previousVoidRate?: number | null }) =>
  c.previousVoidRate === null || c.previousVoidRate === undefined ? null : c.voidRate - c.previousVoidRate;

const GROUPS = ['offline', 'online'] as const;

function GroupVoidChart({ data, onSelect }: { data: DeductionsResponse; onSelect: (date: string) => void }) {
  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 12, top: 14, bottom: 4, containLabel: true },
    tooltip: tooltip({
      trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: INK.axis } },
      formatter: (items: { dataIndex: number }[]) => {
        const x = data.dailyGroups[items[0]?.dataIndex ?? 0];
        return tipTitle(longDate(x.date)) + GROUPS.map(g => tipRow(GROUP_COLORS[g], `${x[g].voidRate.toFixed(2)}%`,
          `${GROUP_LABELS[g]} · ${formatNumber(x[g].voidBills)} of ${formatNumber(x[g].bills)} · ${compactRupiah(x[g].voidSubtotal)}`, 'line')).join('');
      },
    }),
    xAxis: categoryAxis(data.dailyGroups.map(x => shortDate(x.date)), { boundaryGap: false }),
    yAxis: valueAxis((v: number) => `${v}%`, { splitNumber: 3 }),
    series: GROUPS.map(g => ({
      name: GROUP_LABELS[g], type: 'line', data: data.dailyGroups.map(x => x[g].voidRate), symbol: 'circle', symbolSize: 6,
      showSymbol: data.dailyGroups.length <= 31, lineStyle: { color: GROUP_COLORS[g], width: 2 },
      itemStyle: { color: GROUP_COLORS[g], borderColor: '#fff', borderWidth: 2 },
    })),
  }), [data]);
  return (
    <div className="space-y-1">
      <Legend items={GROUPS.map(g => ({ key: g, label: GROUP_LABELS[g], color: GROUP_COLORS[g], shape: 'line' as const }))} />
      <EChart option={option} height={220} ariaLabel="Void rate per day, offline and online" onClick={p => { const x = data.dailyGroups[p.dataIndex]; if (x) onSelect(x.date); }} />
    </div>
  );
}

function VoidChart({ data, onSelect }: { data: DeductionsResponse; onSelect: (date: string) => void }) {
  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 12, top: 18, bottom: 4, containLabel: true },
    tooltip: tooltip({
      trigger: 'axis', axisPointer: { type: 'line', lineStyle: { color: INK.axis } },
      formatter: (items: { dataIndex: number }[]) => {
        const x = data.daily[items[0]?.dataIndex ?? 0];
        return tipTitle(longDate(x.date)) + tipRow(INK.accent, `${x.voidRate.toFixed(2)}%`, 'void rate', 'line')
          + tipFooter(`${formatNumber(x.voidBills)} of ${formatNumber(x.bills)} · ${compactRupiah(x.voidSubtotal)} · other cost ${compactRupiah(x.otherCostSubtotal)}`);
      },
    }),
    xAxis: categoryAxis(data.daily.map(x => shortDate(x.date)), { boundaryGap: false }),
    yAxis: valueAxis((v: number) => `${v}%`, { splitNumber: 3 }),
    series: [{
      type: 'line', data: data.daily.map(x => x.voidRate), symbol: 'circle', symbolSize: 6, showSymbol: data.daily.length <= 31,
      lineStyle: { color: INK.accent, width: 2 }, itemStyle: { color: INK.accent, borderColor: '#fff', borderWidth: 2 }, areaStyle: { color: 'rgba(42,120,214,0.08)' },
      markLine: { symbol: 'none', silent: true, lineStyle: { color: '#64748b', type: 'dotted' }, label: { formatter: `Period ${data.voidRate.toFixed(2)}%`, color: INK.secondary, fontSize: 11, position: 'insideEndTop' }, data: [{ yAxis: data.voidRate }] },
    }],
  }), [data]);
  return <EChart option={option} height={200} ariaLabel="Void rate per day" onClick={p => { const x = data.daily[p.dataIndex]; if (x) onSelect(x.date); }} />;
}

/* ------------------------------------------------------------------ Monthly */

export function MonthlyDrawer({ q }: { q: string }) {
  const drill = useDrill();
  const res = useOverview<MonthlyResponse>('monthly', q);
  return (
    <Loaded resource={res} height={400}>
      {d => {
        const open = (m: MonthlyResponse['months'][number]) => {
          const [from, until] = bucketRange(m.month, 'month', d.filters.from, d.filters.to);
          drill.drill(to.period(from, until, monthLabel(m.month, 'long')));
        };
        const last = d.months[d.months.length - 1];
        return (
          <>
            <Tiles tiles={[
              { label: 'Months', value: num(d.months.length), sub: d.months.some(m => m.partial) ? 'incl. partial months' : 'complete months' },
              { label: 'Latest per day', value: rp(last?.avgDaily ?? null), sub: last ? monthLabel(last.month, 'long') : '' },
              { label: 'MoM (latest)', value: pctText(last?.momPct ?? null), delta: last?.momPct ?? null },
              { label: 'Same-store (latest)', value: pctText(last?.sameStore.growthPct ?? null), sub: last ? `${last.sameStore.branches} branches` : '' },
            ]} />
            <Block title="Average gross sales per day" subtitle="Click a month for its profile">
              <MonthlyChart months={d.months} onSelect={open} height={300} />
            </Block>
            <Block title="All months">
              <DetailTable caption="Months" csvName="monthly-growth" rows={d.months} rowKey={m => m.month} initialSort={{ key: 'month', desc: true }} onRowClick={open}
                columns={[
                  { key: 'month', label: 'Month', value: m => m.month, render: m => <>{monthLabel(m.month, 'long')}{m.partial && <span className="ml-1 text-slate-400">({m.days} d)</span>}</> },
                  { key: 'sales', label: 'Gross sales', align: 'right', value: m => m.subtotal, render: m => rp(m.subtotal) },
                  { key: 'nett', label: 'Nett', align: 'right', value: m => m.nettSales, render: m => rp(m.nettSales) },
                  { key: 'bills', label: 'Bills', align: 'right', value: m => m.bills },
                  { key: 'branches', label: 'Branches', align: 'right', value: m => m.branches },
                  { key: 'avg', label: 'Per day', align: 'right', value: m => m.avgDaily, render: m => rp(m.avgDaily) },
                  { key: 'mom', label: 'MoM', align: 'right', value: m => m.momPct, render: m => delta(m.momPct) },
                  { key: 'yoy', label: 'YoY', align: 'right', value: m => m.yoyPct, render: m => delta(m.yoyPct) },
                  { key: 'ss', label: 'Same-store', align: 'right', value: m => m.sameStore.growthPct, render: m => <span title={`${m.sameStore.branches} branches`}>{delta(m.sameStore.growthPct)}</span> },
                ]} />
            </Block>
          </>
        );
      }}
    </Loaded>
  );
}
