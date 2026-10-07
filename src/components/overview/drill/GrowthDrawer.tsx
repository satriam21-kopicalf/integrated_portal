'use client';

import LoadingState from '@/components/ui/LoadingState';
import { useMemo, useState } from 'react';
import ChannelLogo from '@/components/ChannelLogo';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { Legend, SeriesKey } from '@/components/charts/common';
import { formatCurrency, formatDate } from '@/lib/format';
import { base, changeHtml, INK, tipFooter, tipRow, tipTitle, tooltip } from '@/lib/chartTheme';
import {
  bucketLabel, channelColor, Granularity, GROWTH_DOWN, GROWTH_UP, GrowthBasis, GrowthResponse, GrowthSplit, useOverview, withParams,
} from '@/lib/overview';
import { Delta, Segmented } from '../Card';
import {
  BASES, basisText, GrowthBars, GrowthSummary, GrowthText, HourGrowthChart, HourGrowthHeatmap, HourGrowthTable, HourMovers, signedRp, useHourGrowth,
} from '../SalesGrowth';
import { to, useDrill } from './DrillContext';
import { Block, bucketRange, DetailTable, Loaded, num, rp, Tiles } from './parts';

const short = (name: string) => name.replace(/^Kopi Calf (To Go )?/, '');

const STATUS: Record<NonNullable<GrowthSplit['status']>, { label: string; cls: string }> = {
  new: { label: 'New', cls: 'bg-blue-50 text-blue-700' },
  lost: { label: 'No sales now', cls: 'bg-red-50 text-red-700' },
  growing: { label: 'Growing', cls: 'bg-blue-50 text-blue-700' },
  declining: { label: 'Declining', cls: 'bg-red-50 text-red-700' },
  flat: { label: 'Flat', cls: 'bg-slate-100 text-slate-600' },
};

/** Everything about sales growth: per bucket, per hour, weekday x hour, branches and channels behind it. */
export function GrowthDrawer({ q, basis: initial }: { q: string; basis: GrowthBasis }) {
  const [basis, setBasis] = useState<GrowthBasis>(initial);
  const [granularity, setGranularity] = useState<Granularity | 'auto'>('auto');
  const drill = useDrill();
  const res = useOverview<GrowthResponse>('growth', withParams(q, { basis, granularity: granularity === 'auto' ? null : granularity }));
  const hours = useHourGrowth(q, res.data);

  return (
    <>
      <Block title="Comparison" subtitle={res.data ? `Subtotal (gross sales) vs ${basisText(res.data)}` : undefined}
        actions={
          <>
            <Segmented label="Compare with" value={basis} options={BASES} onChange={setBasis} />
            <Segmented label="Granularity" value={granularity === 'auto' ? res.data?.granularity ?? 'day' : granularity} onChange={setGranularity}
              options={[{ value: 'day', label: 'Day' }, { value: 'week', label: 'Week' }, { value: 'month', label: 'Month' }]} />
          </>
        }>
        <Loaded resource={res} height={120}>
          {d => (
            <div className="space-y-4">
              <GrowthSummary data={d} />
              <Tiles tiles={[
                { label: 'This period', value: rp(d.totals.subtotal), sub: `${num(d.totals.bills)} bills` },
                { label: 'Comparison', value: rp(d.totals.compareSubtotal), sub: d.compare.complete ? `${formatDate(d.compare.from)} – ${formatDate(d.compare.to)}` : 'before complete history' },
                { label: 'Growth', value: signedRp(d.totals.growthAbs), delta: d.totals.growthPct },
                { label: 'Avg ticket', value: rp(d.totals.avgTicket), delta: d.totals.avgTicketGrowthPct, sub: `bills ${d.totals.billsGrowthPct === null ? '-' : `${d.totals.billsGrowthPct >= 0 ? '+' : '−'}${Math.abs(d.totals.billsGrowthPct).toFixed(1)}%`}` },
              ]} />
            </div>
          )}
        </Loaded>
      </Block>

      <Block title={`Growth per ${res.data?.granularity ?? 'day'}`} subtitle={basis === 'sequential' ? 'Each bucket against the one before it, per day (partial weeks / months compare fairly) · click a bar for its profile' : 'Click a bar for that day / week / month'}>
        <Loaded resource={res} height={300}>
          {d => (
            <div className="space-y-2">
              <Legend items={[{ key: 'up', label: 'Growth', color: GROWTH_UP }, { key: 'down', label: 'Decline', color: GROWTH_DOWN }]} />
              <GrowthBars data={d} height={300} onSelect={p => {
                const [from, until] = bucketRange(p.date, d.granularity, d.filters.from, d.filters.to);
                drill.drill(to.period(from, until, bucketLabel(p.date, d.granularity)));
              }} />
              <DetailTable caption="Growth per bucket" csvName={`sales-growth-${d.compare.basis}-${d.granularity}`} rows={d.series} rowKey={p => p.date}
                initialSort={{ key: 'date', desc: false }}
                onRowClick={p => {
                  const [from, until] = bucketRange(p.date, d.granularity, d.filters.from, d.filters.to);
                  drill.drill(to.period(from, until, bucketLabel(p.date, d.granularity)));
                }}
                columns={[
                  { key: 'date', label: d.granularity === 'day' ? 'Date' : d.granularity === 'week' ? 'Week of' : 'Month', value: p => p.date, render: p => bucketLabel(p.date, d.granularity) },
                  { key: 'sales', label: 'Sales', align: 'right', value: p => p.subtotal, render: p => rp(p.subtotal) },
                  { key: 'cmpFrom', label: 'Compared with', value: p => p.compareFrom, render: p => (p.compareFrom ? (basis === 'sequential' ? bucketLabel(p.compareFrom, d.granularity) : `from ${formatDate(p.compareFrom)}`) : '-') },
                  { key: 'cmp', label: 'Comparison', align: 'right', value: p => p.compareSubtotal, render: p => rp(p.compareSubtotal) },
                  { key: 'perDay', label: 'Per day', align: 'right', value: p => p.avgPerDay, render: p => rp(p.avgPerDay) },
                  { key: 'cmpPerDay', label: 'Comp. per day', align: 'right', value: p => p.compareAvgPerDay, render: p => rp(p.compareAvgPerDay) },
                  { key: 'abs', label: basis === 'sequential' ? 'Growth/day' : 'Growth', align: 'right', value: p => p.growthAbs, render: p => <GrowthText v={p.growthPct} abs={p.growthAbs} absOnly /> },
                  { key: 'pct', label: 'Growth %', align: 'right', value: p => p.growthPct, render: p => <Delta value={p.growthPct} /> },
                ]} />
            </div>
          )}
        </Loaded>
      </Block>

      <Block title="Growth per hour" subtitle={`Sales per day in each hour (outlet time)${basis === 'sequential' ? ' · compared with the previous period' : ''}`}>
        {hours.res.error ? (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">{hours.res.error}</p>
        ) : !hours.data ? (
          <LoadingState height={240} label="sales growth" />
        ) : (
          <div className="space-y-3">
            <HourGrowthChart rows={hours.rows} height={260} />
            <HourMovers rows={hours.rows} />
            <p className="pt-2 text-xs font-medium text-slate-500">Weekday × hour</p>
            <HourGrowthHeatmap current={hours.data.current} compare={hours.data.compare} />
            <HourGrowthTable rows={hours.rows} />
          </div>
        )}
      </Block>

      <Block title="Branches behind the growth" subtitle="Contribution = percentage points of the total growth; they add up to the total · click a branch for its profile">
        <Loaded resource={res} height={260}>
          {d => (
            <div className="space-y-3">
              <ContributionChart rows={d.branches} label={r => short(r.label)} />
              <SplitTable rows={d.branches} kind="branch" onOpen={r => drill.drill(to.branch(r.key, r.label))} />
            </div>
          )}
        </Loaded>
      </Block>

      <Block title="Channels behind the growth">
        <Loaded resource={res} height={200}>
          {d => <SplitTable rows={d.channels} kind="channel" onOpen={r => drill.drill(to.channel(r.key))} />}
        </Loaded>
      </Block>
    </>
  );
}

/** Top 8 growth and top 8 decline contributors, horizontal diverging bars. */
function ContributionChart({ rows, label }: { rows: GrowthSplit[]; label: (r: GrowthSplit) => string }) {
  const picked = useMemo(() => {
    const valid = rows.filter(r => r.contributionPp !== null && r.contributionPp !== 0);
    const up = valid.filter(r => r.contributionPp! > 0).sort((a, b) => b.contributionPp! - a.contributionPp!).slice(0, 8);
    const down = valid.filter(r => r.contributionPp! < 0).sort((a, b) => a.contributionPp! - b.contributionPp!).slice(0, 8);
    return [...down.reverse(), ...up.reverse()]; // largest decline at the bottom, largest growth on top
  }, [rows]);
  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 60, top: 4, bottom: 4, containLabel: true },
    tooltip: tooltip({
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => {
        const r = picked[p.dataIndex];
        return tipTitle(r.label) + tipRow(INK.accent, formatCurrency(r.subtotal), 'this period')
          + tipRow(INK.previous, formatCurrency(r.compareSubtotal ?? 0), 'comparison')
          + tipFooter(`${signedRp(r.growthAbs)} · ${changeHtml(r.growthPct)} · ${(r.contributionPp ?? 0) >= 0 ? '+' : '−'}${Math.abs(r.contributionPp ?? 0).toFixed(2)} pp of total growth`);
      },
    }),
    xAxis: { type: 'value', axisLabel: { color: INK.muted, fontSize: 11, formatter: (v: number) => `${v} pp` }, splitLine: { lineStyle: { color: INK.grid } } },
    yAxis: { type: 'category', data: picked.map(label), axisLine: { show: false }, axisTick: { show: false }, axisLabel: { color: INK.primary, fontSize: 11, width: 150, overflow: 'truncate' } },
    series: [{
      type: 'bar', barWidth: 12,
      data: picked.map(r => ({ value: r.contributionPp, itemStyle: { color: r.contributionPp! >= 0 ? GROWTH_UP : GROWTH_DOWN, borderRadius: r.contributionPp! >= 0 ? [0, 4, 4, 0] : [4, 0, 0, 4] } })),
      label: { show: true, position: 'right', fontSize: 10, color: INK.secondary, formatter: (p: { dataIndex: number }) => signedRp(picked[p.dataIndex].growthAbs) },
    }],
  }), [picked, label]);
  if (!picked.length) return <p className="py-6 text-center text-sm text-slate-400">No comparison available</p>;
  return <EChart option={option} height={Math.max(160, picked.length * 24 + 16)} ariaLabel="Branches with the largest growth and decline contribution" />;
}

function SplitTable({ rows, kind, onOpen }: { rows: GrowthSplit[]; kind: 'branch' | 'channel'; onOpen: (r: GrowthSplit) => void }) {
  return (
    <DetailTable caption={kind === 'branch' ? 'Growth per branch' : 'Growth per channel'} csvName={`sales-growth-per-${kind}`} rows={rows} rowKey={r => r.key}
      search={kind === 'branch' ? r => `${r.label} ${r.key}` : undefined} onRowClick={onOpen} initialSort={{ key: 'contribution', desc: true }} maxHeight={kind === 'branch' ? 460 : 300}
      columns={[
        { key: 'name', label: kind === 'branch' ? 'Branch' : 'Channel', value: r => r.label,
          render: r => (kind === 'channel'
            ? <span className="flex items-center gap-2"><SeriesKey color={channelColor(r.key)} /><ChannelLogo channel={r.key} height={14} /></span>
            : <span title={r.label}>{short(r.label)}</span>) },
        { key: 'status', label: 'Status', value: r => r.status, render: r => (r.status ? <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS[r.status].cls}`}>{STATUS[r.status].label}</span> : '-') },
        { key: 'sales', label: 'Sales', align: 'right', value: r => r.subtotal, render: r => rp(r.subtotal) },
        { key: 'cmp', label: 'Comparison', align: 'right', value: r => r.compareSubtotal, render: r => rp(r.compareSubtotal) },
        { key: 'abs', label: 'Growth', align: 'right', value: r => r.growthAbs, render: r => <GrowthText v={r.growthPct} abs={r.growthAbs} absOnly /> },
        { key: 'pct', label: 'Growth %', align: 'right', value: r => r.growthPct, render: r => <Delta value={r.growthPct} /> },
        { key: 'contribution', label: 'Contribution', align: 'right', value: r => r.contributionPp, title: 'Percentage points of the total growth',
          render: r => (r.contributionPp === null ? '-' : <span className={r.contributionPp >= 0 ? 'text-blue-700' : 'text-red-600'}>{r.contributionPp >= 0 ? '+' : '−'}{Math.abs(r.contributionPp).toFixed(2)} pp</span>) },
        { key: 'bills', label: 'Bills', align: 'right', value: r => r.bills },
      ]} />
  );
}

