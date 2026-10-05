'use client';

import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import ChannelLogo from '@/components/ChannelLogo';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { SeriesKey } from '@/components/charts/common';
import { formatCurrency, formatNumber } from '@/lib/format';
import { base, categoryAxis, INK, rupiahAxis, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import {
  BasketResponse, BranchesResponse, BreakdownResponse, bucketLabel, channelColor, ChannelsResponse, compactNumber, compactRupiah,
  DeductionsResponse, hourLabel, HourlyResponse, KpisResponse, longDate, MenuDetailResponse, MenusResponse, paymentLabel,
  PaymentsResponse, shortDate, TrendResponse, useOverview, withParams,
} from '@/lib/overview';
import { Segmented } from '../Card';
import TrendChart, { ChartTypeSelect, TREND_METRICS, TrendChartType, TrendMetric } from '../TrendChart';
import { to, useDrill } from './DrillContext';
import { Block, bucketRange, DetailTable, Loaded, num, pctText, rp, ShareBar, Tiles, delta } from './parts';

const short = (name: string) => name.replace(/^Kopi Calf (To Go )?/, '');

function MoreButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-0.5 text-xs font-medium text-blue-700 hover:underline">
      {label} <ChevronRight size={13} />
    </button>
  );
}

/* ------------------------------------------------------------------ profile: branch, channel or period */

/**
 * Everything about one branch, one channel or one day / week / month, with the page
 * filters (and any parent drill-down) still applied: KPIs, trend, channels, branches,
 * busy hours, menus, payments, basket and deductions. Every list drills further.
 */
export function ProfileDrawer({ q, focus }: { q: string; focus: 'branch' | 'channel' | 'period' }) {
  const drill = useDrill();
  const [metric, setMetric] = useState<TrendMetric>('subtotal');
  const [chart, setChart] = useState<TrendChartType>('line');
  const params = new URLSearchParams(q);
  const singleDay = params.get('dateFrom') !== null && params.get('dateFrom') === params.get('dateTo');
  const oneBranch = (params.get('branch') ?? '').split(',').filter(Boolean).length === 1;
  const oneChannel = (params.get('channel') ?? '').split(',').filter(Boolean).length === 1;

  const kpis = useOverview<KpisResponse>('kpis', q);
  const trend = useOverview<TrendResponse>('trend', q);
  const channels = useOverview<ChannelsResponse>('channels', q);
  const branches = useOverview<BranchesResponse>('branches', q);
  const hourly = useOverview<HourlyResponse>('hourly', q);
  const menus = useOverview<MenusResponse>('menus', withParams(q, { limit: '10', sort: 'subtotal' }));
  const payments = useOverview<PaymentsResponse>('payments', q);
  const basket = useOverview<BasketResponse>('basket', q);
  const deductions = useOverview<DeductionsResponse>('deductions', q);

  return (
    <>
      <Loaded resource={kpis} height={90}>
        {d => (
          <Tiles tiles={[
            { label: 'Sales', value: rp(d.kpis.sales.value), delta: d.kpis.sales.deltaPct, sub: d.filters.previous.complete ? `prev. ${compactRupiah(d.kpis.sales.previous)}` : 'no comparison' },
            { label: 'Nett sales', value: rp(d.kpis.nettSales.value), delta: d.kpis.nettSales.deltaPct },
            { label: 'Bills', value: num(d.kpis.bills.value), delta: d.kpis.bills.deltaPct },
            { label: 'Avg ticket', value: rp(d.kpis.avgTicket.value), delta: d.kpis.avgTicket.deltaPct },
          ]} />
        )}
      </Loaded>

      {singleDay ? (
        <Block title="Hour by hour" subtitle="Bills and sales per hour of that day">
          <Loaded resource={hourly} height={220}>{d => <DayHours data={d} />}</Loaded>
        </Block>
      ) : (
        <Block title="Trend" subtitle={focus === 'period' ? 'Within this period · click a point to zoom in' : 'Click a point for that day / week / month'}
          actions={<><Segmented label="Metric" value={metric} options={TREND_METRICS} onChange={setMetric} /><ChartTypeSelect value={chart} onChange={setChart} /></>}>
          <Loaded resource={trend} height={300}>
            {d => (
              <TrendChart data={d} metric={metric} chart={chart} height={300} onSelect={p => {
                const [from, until] = bucketRange(p.date, d.granularity, d.filters.from, d.filters.to);
                drill.drill(to.period(from, until, bucketLabel(p.date, d.granularity)));
              }} />
            )}
          </Loaded>
        </Block>
      )}

      {!oneChannel && (
        <Block title="Channels" actions={<MoreButton label="All channel details" onClick={() => drill.drill({ kind: 'channels' })} />}>
          <Loaded resource={channels} height={160}>
            {d => (
              <DetailTable caption="Channels" rows={d.channels} rowKey={c => c.channel} initialSort={{ key: 'sales', desc: true }} maxHeight={260}
                onRowClick={c => drill.drill(to.channel(c.channel))}
                columns={[
                  { key: 'channel', label: 'Channel', value: c => c.channel, render: c => <span className="flex items-center gap-2"><SeriesKey color={channelColor(c.channel)} /><ChannelLogo channel={c.channel} height={14} /></span> },
                  { key: 'sales', label: 'Sales', align: 'right', value: c => c.subtotal, render: c => rp(c.subtotal) },
                  { key: 'share', label: 'Share', align: 'right', value: c => c.share, render: c => <ShareBar value={c.share} color={channelColor(c.channel)} /> },
                  { key: 'bills', label: 'Bills', align: 'right', value: c => c.bills },
                  { key: 'avg', label: 'Avg ticket', align: 'right', value: c => c.avgTicket, render: c => rp(c.avgTicket) },
                  { key: 'chg', label: 'Change', align: 'right', value: c => c.deltaPct, render: c => delta(c.deltaPct) },
                ]} />
            )}
          </Loaded>
        </Block>
      )}

      {!oneBranch && (
        <Block title="Branches" actions={<MoreButton label="All branch details" onClick={() => drill.drill({ kind: 'branches' })} />}>
          <Loaded resource={branches} height={200}>
            {d => (
              <DetailTable caption="Branches" rows={d.branches.filter(b => b.subtotal > 0)} rowKey={b => b.branchCode} initialSort={{ key: 'sales', desc: true }} maxHeight={300}
                search={b => `${b.branchName} ${b.branchCode}`} onRowClick={b => drill.drill(to.branch(b.branchCode, b.branchName))}
                columns={[
                  { key: 'branch', label: 'Branch', value: b => b.branchName, render: b => short(b.branchName) },
                  { key: 'sales', label: 'Sales', align: 'right', value: b => b.subtotal, render: b => rp(b.subtotal) },
                  { key: 'chg', label: 'Change', align: 'right', value: b => b.deltaPct, render: b => delta(b.deltaPct) },
                  { key: 'bills', label: 'Bills', align: 'right', value: b => b.bills },
                  { key: 'avg', label: 'Avg ticket', align: 'right', value: b => b.avgTicket, render: b => rp(b.avgTicket) },
                  { key: 'void', label: 'Void rate', align: 'right', value: b => b.voidRate, render: b => pctText(b.voidRate, 2) },
                ]} />
            )}
          </Loaded>
        </Block>
      )}

      {!singleDay && (
        <Block title="Busy hours" actions={<MoreButton label="Heatmap & compare" onClick={() => drill.drill({ kind: 'hours' })} />}>
          <Loaded resource={hourly} height={180}>{d => <DayHours data={d} perDay />}</Loaded>
        </Block>
      )}

      <Block title="Top menus" actions={<MoreButton label="All menus" onClick={() => drill.drill({ kind: 'menus' })} />}>
        <Loaded resource={menus} height={200}>
          {d => (
            <DetailTable caption="Top menus" rows={d.top} rowKey={m => m.menuId} initialSort={{ key: 'sales', desc: true }} maxHeight={320}
              onRowClick={m => drill.drill({ kind: 'menu', menuId: m.menuId, menuKind: 'menu', name: m.name })}
              columns={[
                { key: 'name', label: 'Menu', value: m => m.name },
                { key: 'cat', label: 'Sub-category', value: m => m.categoryDetail },
                { key: 'qty', label: 'Qty', align: 'right', value: m => m.qty },
                { key: 'sales', label: 'Sales', align: 'right', value: m => m.subtotal, render: m => rp(m.subtotal) },
                { key: 'share', label: 'Share', align: 'right', value: m => m.share, render: m => pctText(m.share) },
              ]} />
          )}
        </Loaded>
      </Block>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <Block title="Payments" actions={<MoreButton label="All methods" onClick={() => drill.drill({ kind: 'payments' })} />}>
          <Loaded resource={payments} height={160}>
            {d => (
              <DetailTable caption="Payment methods" rows={d.methods.slice(0, 8)} rowKey={m => `${m.type}-${m.method}`} maxHeight={260}
                onRowClick={m => drill.drill({ kind: 'payment', method: m.method, label: paymentLabel(m.method) })}
                columns={[
                  { key: 'method', label: 'Method', value: m => paymentLabel(m.method) },
                  { key: 'share', label: 'Share', align: 'right', value: m => m.share, render: m => pctText(m.share) },
                  { key: 'sales', label: 'Sales', align: 'right', value: m => m.subtotal, render: m => compactRupiah(m.subtotal) },
                ]} />
            )}
          </Loaded>
        </Block>
        <Block title="Basket & deductions" actions={<MoreButton label="Deductions" onClick={() => drill.drill({ kind: 'deductions' })} />}>
          <div className="space-y-3">
            <Loaded resource={basket} height={70}>
              {d => (
                <Tiles columns={2} tiles={[
                  { label: 'Items / bill', value: num(d.totals.qtyPerBill, 2), sub: `${num(d.totals.linesPerBill, 2)} lines` },
                  { label: 'Food attach', value: pctText(d.totals.foodAttachPct), sub: `${pctText(d.totals.foodSharePct)} bills with food` },
                ]} />
              )}
            </Loaded>
            <Loaded resource={deductions} height={70}>
              {d => (
                <Tiles columns={2} tiles={[
                  { label: 'Void rate', value: pctText(d.voidRate, 2), sub: `${num(d.totals.void.bills)} bills · ${compactRupiah(d.totals.void.subtotal)}`, upIsGood: false },
                  { label: 'Other cost', value: compactRupiah(d.totals.otherCost.subtotal), sub: `${num(d.totals.otherCost.bills)} bills` },
                ]} />
              )}
            </Loaded>
          </div>
        </Block>
      </div>
    </>
  );
}

/** Bills per hour: of one day, or the average per day of a longer period. */
function DayHours({ data, perDay = false }: { data: HourlyResponse; perDay?: boolean }) {
  const option = useMemo<ChartOption>(() => {
    const days = perDay ? Object.values(data.daysPerDow).reduce((a, b) => a + b, 0) || 1 : 1;
    const byHour = new Map<number, { bills: number; subtotal: number }>();
    data.cells.forEach(c => {
      const h = byHour.get(c.hour) ?? { bills: 0, subtotal: 0 };
      h.bills += c.bills;
      h.subtotal += c.subtotal;
      byHour.set(c.hour, h);
    });
    const hours = [...byHour.keys()].sort((a, b) => a - b);
    if (!hours.length) return {};
    const span = Array.from({ length: hours[hours.length - 1] - hours[0] + 1 }, (_, i) => hours[0] + i);
    const vals = span.map(h => (byHour.get(h)?.bills ?? 0) / days);
    const max = Math.max(...vals);
    return {
      ...base,
      grid: { left: 4, right: 8, top: 18, bottom: 4, containLabel: true },
      tooltip: tooltip({
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } },
        formatter: (items: { dataIndex: number }[]) => {
          const h = span[items[0]?.dataIndex ?? 0];
          const x = byHour.get(h);
          return tipTitle(`${hourLabel(h)}–${hourLabel(h + 1)}`) + tipRow(INK.accent, formatNumber(Math.round((x?.bills ?? 0) / days)), perDay ? 'bills per day' : 'bills')
            + tipRow(INK.accent, formatCurrency(Math.round((x?.subtotal ?? 0) / days)), perDay ? 'sales per day' : 'sales');
        },
      }),
      xAxis: categoryAxis(span.map(h => String(h).padStart(2, '0'))),
      yAxis: valueAxis(compactNumber, { splitNumber: 3 }),
      series: [{ type: 'bar', barMaxWidth: 18, data: vals.map(v => ({ value: Math.round(v), itemStyle: { color: v === max ? '#184f95' : '#6da7ec', borderRadius: [4, 4, 0, 0] } })) }],
    };
  }, [data, perDay]);
  if (!data.cells.length) return <p className="py-6 text-center text-sm text-slate-400">No sales</p>;
  return <EChart option={option} height={200} ariaLabel="Bills per hour" />;
}

/* ------------------------------------------------------------------ one menu */

export function MenuDrawer({ q, menuId, menuKind }: { q: string; menuId: string; menuKind: string }) {
  const drill = useDrill();
  const [measure, setMeasure] = useState<'qty' | 'subtotal'>('qty');
  const res = useOverview<MenuDetailResponse>('menu-detail', withParams(q, { menuId, kind: menuKind }));
  return (
    <Loaded resource={res} height={400}>
      {d => {
        const t = d.totals;
        return (
          <>
            <p className="-mt-1 mb-4 text-xs text-slate-500">{[d.menu.category, d.menu.categoryDetail].filter(Boolean).join(' · ')}{d.menu.kind !== 'menu' ? ` · ${d.menu.kind}` : ''}</p>
            <Tiles columns={5} tiles={[
              { label: 'Qty', value: num(t.qty), delta: t.qtyDeltaPct, sub: t.previousQty !== null ? `prev. ${num(t.previousQty)}` : 'no comparison' },
              { label: 'Sales', value: compactRupiah(t.subtotal), title: formatCurrency(t.subtotal), sub: t.previousSubtotal !== null ? `prev. ${compactRupiah(t.previousSubtotal)}` : '' },
              { label: 'Bills', value: num(t.bills), sub: t.bills ? `${num(t.qty / t.bills, 2)} per bill` : '' },
              { label: 'Avg price', value: rp(t.avgPrice), sub: t.discount ? `${compactRupiah(t.discount)} discount` : 'no discount' },
              { label: 'Share of menus', value: pctText(t.shareOfMenus, 2), sub: 'of menu sales' },
            ]} />
            <Block title={`Per ${d.granularity}`} actions={<Segmented label="Measure" value={measure} onChange={setMeasure} options={[{ value: 'qty', label: 'Qty' }, { value: 'subtotal', label: 'Sales' }]} />}>
              <MenuSeries data={d} measure={measure} onSelect={date => {
                const [from, until] = bucketRange(date, d.granularity, d.filters.from, d.filters.to);
                drill.drill(to.period(from, until, bucketLabel(date, d.granularity)));
              }} />
            </Block>
            <div className="grid gap-x-6 lg:grid-cols-2">
              <Block title="Branches" subtitle="Click a branch for its profile">
                <DetailTable caption="Menu per branch" csvName={`menu-${d.menu.name}-branches`} rows={d.branches} rowKey={r => r.key} initialSort={{ key: 'qty', desc: true }}
                  search={r => `${r.label} ${r.key}`} onRowClick={r => drill.drill(to.branch(r.key, r.label))} maxHeight={360}
                  columns={[
                    { key: 'branch', label: 'Branch', value: r => r.label, render: r => short(r.label) },
                    { key: 'qty', label: 'Qty', align: 'right', value: r => r.qty },
                    { key: 'sales', label: 'Sales', align: 'right', value: r => r.subtotal, render: r => compactRupiah(r.subtotal) },
                    { key: 'share', label: 'Share', align: 'right', value: r => r.share, render: r => pctText(r.share) },
                  ]} />
              </Block>
              <Block title="Channels">
                <DetailTable caption="Menu per channel" csvName={`menu-${d.menu.name}-channels`} rows={d.channels} rowKey={r => r.key} initialSort={{ key: 'qty', desc: true }}
                  onRowClick={r => drill.drill(to.channel(r.key))}
                  columns={[
                    { key: 'channel', label: 'Channel', value: r => r.label, render: r => <span className="flex items-center gap-2"><SeriesKey color={channelColor(r.key)} /><ChannelLogo channel={r.key} height={14} /></span> },
                    { key: 'qty', label: 'Qty', align: 'right', value: r => r.qty },
                    { key: 'sales', label: 'Sales', align: 'right', value: r => r.subtotal, render: r => compactRupiah(r.subtotal) },
                    { key: 'share', label: 'Share', align: 'right', value: r => r.share, render: r => <ShareBar value={r.share} color={channelColor(r.key)} /> },
                  ]} />
              </Block>
            </div>
          </>
        );
      }}
    </Loaded>
  );
}

function MenuSeries({ data, measure, onSelect }: { data: MenuDetailResponse; measure: 'qty' | 'subtotal'; onSelect: (date: string) => void }) {
  const option = useMemo<ChartOption>(() => {
    const g = data.granularity;
    return {
      ...base,
      grid: { left: 4, right: 8, top: 14, bottom: 4, containLabel: true },
      tooltip: tooltip({
        trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } },
        formatter: (items: { dataIndex: number }[]) => {
          const s = data.series[items[0]?.dataIndex ?? 0];
          return tipTitle(g === 'day' ? longDate(s.date) : bucketLabel(s.date, 'month')) + tipRow(INK.accent, `${formatNumber(s.qty)} pcs`, 'ordered')
            + tipRow(INK.accent, formatCurrency(s.subtotal), 'sales') + tipFooter(`${formatNumber(s.bills)} bills`);
        },
      }),
      xAxis: categoryAxis(data.series.map(s => shortDate(s.date, g))),
      yAxis: valueAxis(measure === 'qty' ? compactNumber : rupiahAxis, { splitNumber: 4 }),
      series: [{ type: 'bar', barMaxWidth: 18, data: data.series.map(s => s[measure]), itemStyle: { color: INK.accent, borderRadius: [3, 3, 0, 0] } }],
    };
  }, [data, measure]);
  if (!data.series.length) return <p className="py-6 text-center text-sm text-slate-400">Not sold in this period</p>;
  return <EChart option={option} height={240} ariaLabel="Menu sold over time" onClick={p => { const s = data.series[p.dataIndex]; if (s) onSelect(s.date); }} />;
}

/* ------------------------------------------------------------------ one payment method */

export function PaymentDrawer({ q, method }: { q: string; method: string }) {
  const drill = useDrill();
  const byDate = useOverview<BreakdownResponse>('breakdown', withParams(q, { by: 'date', paymentMethod: method }));
  const byBranch = useOverview<BreakdownResponse>('breakdown', withParams(q, { by: 'branch', paymentMethod: method }));
  const byChannel = useOverview<BreakdownResponse>('breakdown', withParams(q, { by: 'channel', paymentMethod: method }));
  const kpis = useOverview<KpisResponse>('kpis', q);

  return (
    <>
      <Loaded resource={byBranch} height={90}>
        {d => {
          const all = kpis.data?.kpis.sales.value ?? null;
          return (
            <Tiles tiles={[
              { label: 'Sales', value: compactRupiah(d.totals.subtotal), title: formatCurrency(d.totals.subtotal), sub: all ? `${pctText((d.totals.subtotal / all) * 100)} of all sales` : '' },
              { label: 'Bills', value: num(d.totals.bills), sub: kpis.data ? `${pctText((d.totals.bills / Math.max(1, kpis.data.kpis.bills.value)) * 100)} of bills` : '' },
              { label: 'Avg ticket', value: rp(d.totals.bills ? d.totals.subtotal / d.totals.bills : null) },
              { label: 'Branches', value: num(d.rows.length), sub: d.rows[0] ? `top: ${short(d.rows[0].label)}` : '' },
            ]} />
          );
        }}
      </Loaded>
      <Block title="Per day" subtitle="Click a day for its profile">
        <Loaded resource={byDate} height={220}>
          {d => <BreakdownDays data={d} onSelect={date => drill.drill(to.period(date, date, longDate(date)))} />}
        </Loaded>
      </Block>
      <div className="grid gap-x-6 lg:grid-cols-2">
        <Block title="Branches">
          <Loaded resource={byBranch} height={200}>
            {d => (
              <DetailTable caption="Per branch" csvName={`payment-${method}-branches`} rows={d.rows} rowKey={r => r.key} initialSort={{ key: 'sales', desc: true }}
                search={r => `${r.label} ${r.key}`} onRowClick={r => drill.drill(to.branch(r.key, r.label))} maxHeight={360}
                columns={[
                  { key: 'branch', label: 'Branch', value: r => r.label, render: r => short(r.label) },
                  { key: 'sales', label: 'Sales', align: 'right', value: r => r.subtotal, render: r => compactRupiah(r.subtotal) },
                  { key: 'bills', label: 'Bills', align: 'right', value: r => r.bills },
                  { key: 'share', label: 'Share', align: 'right', value: r => r.share, render: r => pctText(r.share) },
                  { key: 'chg', label: 'Change', align: 'right', value: r => r.deltaPct, render: r => delta(r.deltaPct) },
                ]} />
            )}
          </Loaded>
        </Block>
        <Block title="Channels">
          <Loaded resource={byChannel} height={160}>
            {d => (
              <DetailTable caption="Per channel" csvName={`payment-${method}-channels`} rows={d.rows} rowKey={r => r.key} initialSort={{ key: 'sales', desc: true }}
                onRowClick={r => drill.drill(to.channel(r.key))}
                columns={[
                  { key: 'channel', label: 'Channel', value: r => r.label, render: r => <span className="flex items-center gap-2"><SeriesKey color={channelColor(r.key)} /><ChannelLogo channel={r.key} height={14} /></span> },
                  { key: 'sales', label: 'Sales', align: 'right', value: r => r.subtotal, render: r => compactRupiah(r.subtotal) },
                  { key: 'bills', label: 'Bills', align: 'right', value: r => r.bills },
                  { key: 'share', label: 'Share', align: 'right', value: r => r.share, render: r => <ShareBar value={r.share} color={channelColor(r.key)} /> },
                ]} />
            )}
          </Loaded>
        </Block>
      </div>
    </>
  );
}

function BreakdownDays({ data, onSelect }: { data: BreakdownResponse; onSelect: (date: string) => void }) {
  const option = useMemo<ChartOption>(() => ({
    ...base,
    grid: { left: 4, right: 8, top: 14, bottom: 4, containLabel: true },
    tooltip: tooltip({
      trigger: 'axis', axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } },
      formatter: (items: { dataIndex: number }[]) => {
        const r = data.rows[items[0]?.dataIndex ?? 0];
        return tipTitle(longDate(r.key)) + tipRow(INK.accent, formatCurrency(r.subtotal), 'sales') + tipRow(INK.accent, formatNumber(r.bills), 'bills');
      },
    }),
    xAxis: categoryAxis(data.rows.map(r => shortDate(r.key))),
    yAxis: valueAxis(rupiahAxis, { splitNumber: 4 }),
    series: [{ type: 'bar', barMaxWidth: 18, data: data.rows.map(r => r.subtotal), itemStyle: { color: INK.accent, borderRadius: [3, 3, 0, 0] } }],
  }), [data]);
  return <EChart option={option} height={220} ariaLabel="Sales per day for this payment method" onClick={p => { const r = data.rows[p.dataIndex]; if (r) onSelect(r.key); }} />;
}
