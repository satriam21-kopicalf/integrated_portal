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
import { tr } from '@/lib/i18n';

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
            { label: tr('Gross sales'), value: rp(d.kpis.sales.value), delta: d.kpis.sales.deltaPct, sub: d.filters.previous.complete ? tr('prev. {0}', compactRupiah(d.kpis.sales.previous)) : tr('no comparison') },
            { label: tr('Nett sales'), value: rp(d.kpis.nettSales.value), delta: d.kpis.nettSales.deltaPct },
            { label: tr('Bills'), value: num(d.kpis.bills.value), delta: d.kpis.bills.deltaPct },
            { label: tr('Avg ticket'), value: rp(d.kpis.avgTicket.value), delta: d.kpis.avgTicket.deltaPct },
          ]} />
        )}
      </Loaded>

      {singleDay ? (
        <Block title={tr('Hour by hour')} subtitle={tr('Bills and gross sales per hour of that day')}>
          <Loaded resource={hourly} height={220}>{d => <DayHours data={d} />}</Loaded>
        </Block>
      ) : (
        <Block title={tr('Trend')} subtitle={focus === 'period' ? tr('Within this period · click a point to zoom in') : tr('Click a point for that day / week / month')}
          actions={<><Segmented label={tr('Metric')} value={metric} options={TREND_METRICS} onChange={setMetric} /><ChartTypeSelect value={chart} onChange={setChart} /></>}>
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
        <Block title={tr('Channels')} actions={<MoreButton label={tr('All channel details')} onClick={() => drill.drill({ kind: 'channels' })} />}>
          <Loaded resource={channels} height={160}>
            {d => (
              <DetailTable caption={tr('Channels')} rows={d.channels} rowKey={c => c.channel} initialSort={{ key: 'sales', desc: true }} maxHeight={260}
                onRowClick={c => drill.drill(to.channel(c.channel))}
                columns={[
                  { key: 'channel', label: tr('Channel'), value: c => c.channel, render: c => <span className="flex items-center gap-2"><SeriesKey color={channelColor(c.channel)} /><ChannelLogo channel={c.channel} height={14} /></span> },
                  { key: 'sales', label: tr('Gross sales'), align: 'right', value: c => c.subtotal, render: c => rp(c.subtotal) },
                  { key: 'share', label: tr('Share'), align: 'right', value: c => c.share, render: c => <ShareBar value={c.share} color={channelColor(c.channel)} /> },
                  { key: 'bills', label: tr('Bills'), align: 'right', value: c => c.bills },
                  { key: 'avg', label: tr('Avg ticket'), align: 'right', value: c => c.avgTicket, render: c => rp(c.avgTicket) },
                  { key: 'chg', label: tr('Change'), align: 'right', value: c => c.deltaPct, render: c => delta(c.deltaPct) },
                ]} />
            )}
          </Loaded>
        </Block>
      )}

      {!oneBranch && (
        <Block title={tr('Branches')} actions={<MoreButton label={tr('All branch details')} onClick={() => drill.drill({ kind: 'branches' })} />}>
          <Loaded resource={branches} height={200}>
            {d => (
              <DetailTable caption={tr('Branches')} rows={d.branches.filter(b => b.subtotal > 0)} rowKey={b => b.branchCode} initialSort={{ key: 'sales', desc: true }} maxHeight={300}
                search={b => `${b.branchName} ${b.branchCode}`} onRowClick={b => drill.drill(to.branch(b.branchCode, b.branchName))}
                columns={[
                  { key: 'branch', label: tr('Branch'), value: b => b.branchName, render: b => short(b.branchName) },
                  { key: 'sales', label: tr('Gross sales'), align: 'right', value: b => b.subtotal, render: b => rp(b.subtotal) },
                  { key: 'chg', label: tr('Change'), align: 'right', value: b => b.deltaPct, render: b => delta(b.deltaPct) },
                  { key: 'bills', label: tr('Bills'), align: 'right', value: b => b.bills },
                  { key: 'avg', label: tr('Avg ticket'), align: 'right', value: b => b.avgTicket, render: b => rp(b.avgTicket) },
                  { key: 'void', label: tr('Void rate'), align: 'right', value: b => b.voidRate, render: b => pctText(b.voidRate, 2) },
                ]} />
            )}
          </Loaded>
        </Block>
      )}

      {!singleDay && (
        <Block title={tr('Busy hours')} actions={<MoreButton label={tr('Heatmap & compare')} onClick={() => drill.drill({ kind: 'hours' })} />}>
          <Loaded resource={hourly} height={180}>{d => <DayHours data={d} perDay />}</Loaded>
        </Block>
      )}

      <Block title={tr('Top menus')} actions={<MoreButton label={tr('All menus')} onClick={() => drill.drill({ kind: 'menus' })} />}>
        <Loaded resource={menus} height={200}>
          {d => (
            <DetailTable caption={tr('Top menus')} rows={d.top} rowKey={m => m.menuId} initialSort={{ key: 'sales', desc: true }} maxHeight={320}
              onRowClick={m => drill.drill({ kind: 'menu', menuId: m.menuId, menuKind: 'menu', name: m.name })}
              columns={[
                { key: 'name', label: tr('Menu'), value: m => m.name },
                { key: 'cat', label: tr('Sub-category'), value: m => m.categoryDetail },
                { key: 'qty', label: tr('Qty'), align: 'right', value: m => m.qty },
                { key: 'sales', label: tr('Gross sales'), align: 'right', value: m => m.subtotal, render: m => rp(m.subtotal) },
                { key: 'share', label: tr('Share'), align: 'right', value: m => m.share, render: m => pctText(m.share) },
              ]} />
          )}
        </Loaded>
      </Block>

      <div className="grid gap-x-6 lg:grid-cols-2">
        <Block title={tr('Payments')} actions={<MoreButton label={tr('All methods')} onClick={() => drill.drill({ kind: 'payments' })} />}>
          <Loaded resource={payments} height={160}>
            {d => (
              <DetailTable caption={tr('Payment methods')} rows={d.methods.slice(0, 8)} rowKey={m => `${m.type}-${m.method}`} maxHeight={260}
                onRowClick={m => drill.drill({ kind: 'payment', method: m.method, label: paymentLabel(m.method) })}
                columns={[
                  { key: 'method', label: tr('Method'), value: m => paymentLabel(m.method) },
                  { key: 'share', label: tr('Share'), align: 'right', value: m => m.share, render: m => pctText(m.share) },
                  { key: 'sales', label: tr('Gross sales'), align: 'right', value: m => m.subtotal, render: m => compactRupiah(m.subtotal) },
                ]} />
            )}
          </Loaded>
        </Block>
        <Block title={tr('Basket & deductions')} actions={<MoreButton label={tr('Deductions')} onClick={() => drill.drill({ kind: 'deductions' })} />}>
          <div className="space-y-3">
            <Loaded resource={basket} height={70}>
              {d => (
                <Tiles columns={2} tiles={[
                  { label: tr('Items / bill'), value: num(d.totals.qtyPerBill, 2), sub: tr('{0} lines', num(d.totals.linesPerBill, 2)) },
                  { label: tr('Food attach'), value: pctText(d.totals.foodAttachPct), sub: tr('{0} bills with food', pctText(d.totals.foodSharePct)) },
                ]} />
              )}
            </Loaded>
            <Loaded resource={deductions} height={70}>
              {d => (
                <Tiles columns={2} tiles={[
                  { label: tr('Void rate'), value: pctText(d.voidRate, 2), sub: tr('{0} bills · {1}', num(d.totals.void.bills), compactRupiah(d.totals.void.subtotal)), upIsGood: false },
                  { label: tr('Other cost'), value: compactRupiah(d.totals.otherCost.subtotal), sub: tr('{0} bills', num(d.totals.otherCost.bills)) },
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
            + tipRow(INK.accent, formatCurrency(Math.round((x?.subtotal ?? 0) / days)), perDay ? 'gross sales per day' : 'gross sales');
        },
      }),
      xAxis: categoryAxis(span.map(h => String(h).padStart(2, '0'))),
      yAxis: valueAxis(compactNumber, { splitNumber: 3 }),
      series: [{ type: 'bar', barMaxWidth: 18, data: vals.map(v => ({ value: Math.round(v), itemStyle: { color: v === max ? '#184f95' : '#6da7ec', borderRadius: [4, 4, 0, 0] } })) }],
    };
  }, [data, perDay]);
  if (!data.cells.length) return <p className="py-6 text-center text-sm text-slate-400">{tr('No sales')}</p>;
  return <EChart option={option} height={200} ariaLabel={tr('Bills per hour')} />;
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
              { label: tr('Qty'), value: num(t.qty), delta: t.qtyDeltaPct, sub: t.previousQty !== null ? tr('prev. {0}', num(t.previousQty)) : tr('no comparison') },
              { label: tr('Gross sales'), value: compactRupiah(t.subtotal), title: formatCurrency(t.subtotal), sub: t.previousSubtotal !== null ? tr('prev. {0}', compactRupiah(t.previousSubtotal)) : '' },
              { label: tr('Bills'), value: num(t.bills), sub: t.bills ? tr('{0} per bill', num(t.qty / t.bills, 2)) : '' },
              { label: tr('Avg price'), value: rp(t.avgPrice), sub: t.discount ? tr('{0} discount', compactRupiah(t.discount)) : tr('no discount') },
              { label: tr('Share of menus'), value: pctText(t.shareOfMenus, 2), sub: tr('of menu sales') },
            ]} />
            <Block title={tr('Per {0}', tr(d.granularity))} actions={<Segmented label={tr('Measure')} value={measure} onChange={setMeasure} options={[{ value: 'qty', label: tr('Qty') }, { value: 'subtotal', label: tr('Gross sales') }]} />}>
              <MenuSeries data={d} measure={measure} onSelect={date => {
                const [from, until] = bucketRange(date, d.granularity, d.filters.from, d.filters.to);
                drill.drill(to.period(from, until, bucketLabel(date, d.granularity)));
              }} />
            </Block>
            <div className="grid gap-x-6 lg:grid-cols-2">
              <Block title={tr('Branches')} subtitle={tr('Click a branch for its profile')}>
                <DetailTable caption={tr('Menu per branch')} csvName={`menu-${d.menu.name}-branches`} rows={d.branches} rowKey={r => r.key} initialSort={{ key: 'qty', desc: true }}
                  search={r => `${r.label} ${r.key}`} onRowClick={r => drill.drill(to.branch(r.key, r.label))} maxHeight={360}
                  columns={[
                    { key: 'branch', label: tr('Branch'), value: r => r.label, render: r => short(r.label) },
                    { key: 'qty', label: tr('Qty'), align: 'right', value: r => r.qty },
                    { key: 'sales', label: tr('Gross sales'), align: 'right', value: r => r.subtotal, render: r => compactRupiah(r.subtotal) },
                    { key: 'share', label: tr('Share'), align: 'right', value: r => r.share, render: r => pctText(r.share) },
                  ]} />
              </Block>
              <Block title={tr('Channels')}>
                <DetailTable caption={tr('Menu per channel')} csvName={`menu-${d.menu.name}-channels`} rows={d.channels} rowKey={r => r.key} initialSort={{ key: 'qty', desc: true }}
                  onRowClick={r => drill.drill(to.channel(r.key))}
                  columns={[
                    { key: 'channel', label: tr('Channel'), value: r => r.label, render: r => <span className="flex items-center gap-2"><SeriesKey color={channelColor(r.key)} /><ChannelLogo channel={r.key} height={14} /></span> },
                    { key: 'qty', label: tr('Qty'), align: 'right', value: r => r.qty },
                    { key: 'sales', label: tr('Gross sales'), align: 'right', value: r => r.subtotal, render: r => compactRupiah(r.subtotal) },
                    { key: 'share', label: tr('Share'), align: 'right', value: r => r.share, render: r => <ShareBar value={r.share} color={channelColor(r.key)} /> },
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
          return tipTitle(g === 'day' ? longDate(s.date) : bucketLabel(s.date, 'month')) + tipRow(INK.accent, tr('{0} pcs', formatNumber(s.qty)), 'ordered')
            + tipRow(INK.accent, formatCurrency(s.subtotal), 'sales') + tipFooter(tr('{0} bills', formatNumber(s.bills)));
        },
      }),
      xAxis: categoryAxis(data.series.map(s => shortDate(s.date, g))),
      yAxis: valueAxis(measure === 'qty' ? compactNumber : rupiahAxis, { splitNumber: 4 }),
      series: [{ type: 'bar', barMaxWidth: 18, data: data.series.map(s => s[measure]), itemStyle: { color: INK.accent, borderRadius: [3, 3, 0, 0] } }],
    };
  }, [data, measure]);
  if (!data.series.length) return <p className="py-6 text-center text-sm text-slate-400">{tr('Not sold in this period')}</p>;
  return <EChart option={option} height={240} ariaLabel={tr('Menu sold over time')} onClick={p => { const s = data.series[p.dataIndex]; if (s) onSelect(s.date); }} />;
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
              { label: tr('Gross sales'), value: compactRupiah(d.totals.subtotal), title: formatCurrency(d.totals.subtotal), sub: all ? tr('{0} of all gross sales', pctText((d.totals.subtotal / all) * 100)) : '' },
              { label: tr('Bills'), value: num(d.totals.bills), sub: kpis.data ? tr('{0} of bills', pctText((d.totals.bills / Math.max(1, kpis.data.kpis.bills.value)) * 100)) : '' },
              { label: tr('Avg ticket'), value: rp(d.totals.bills ? d.totals.subtotal / d.totals.bills : null) },
              { label: tr('Branches'), value: num(d.rows.length), sub: d.rows[0] ? tr('top: {0}', short(d.rows[0].label)) : '' },
            ]} />
          );
        }}
      </Loaded>
      <Block title={tr('Per day')} subtitle={tr('Click a day for its profile')}>
        <Loaded resource={byDate} height={220}>
          {d => <BreakdownDays data={d} onSelect={date => drill.drill(to.period(date, date, longDate(date)))} />}
        </Loaded>
      </Block>
      <div className="grid gap-x-6 lg:grid-cols-2">
        <Block title={tr('Branches')}>
          <Loaded resource={byBranch} height={200}>
            {d => (
              <DetailTable caption={tr('Per branch')} csvName={`payment-${method}-branches`} rows={d.rows} rowKey={r => r.key} initialSort={{ key: 'sales', desc: true }}
                search={r => `${r.label} ${r.key}`} onRowClick={r => drill.drill(to.branch(r.key, r.label))} maxHeight={360}
                columns={[
                  { key: 'branch', label: tr('Branch'), value: r => r.label, render: r => short(r.label) },
                  { key: 'sales', label: tr('Gross sales'), align: 'right', value: r => r.subtotal, render: r => compactRupiah(r.subtotal) },
                  { key: 'bills', label: tr('Bills'), align: 'right', value: r => r.bills },
                  { key: 'share', label: tr('Share'), align: 'right', value: r => r.share, render: r => pctText(r.share) },
                  { key: 'chg', label: tr('Change'), align: 'right', value: r => r.deltaPct, render: r => delta(r.deltaPct) },
                ]} />
            )}
          </Loaded>
        </Block>
        <Block title={tr('Channels')}>
          <Loaded resource={byChannel} height={160}>
            {d => (
              <DetailTable caption={tr('Per channel')} csvName={`payment-${method}-channels`} rows={d.rows} rowKey={r => r.key} initialSort={{ key: 'sales', desc: true }}
                onRowClick={r => drill.drill(to.channel(r.key))}
                columns={[
                  { key: 'channel', label: tr('Channel'), value: r => r.label, render: r => <span className="flex items-center gap-2"><SeriesKey color={channelColor(r.key)} /><ChannelLogo channel={r.key} height={14} /></span> },
                  { key: 'sales', label: tr('Gross sales'), align: 'right', value: r => r.subtotal, render: r => compactRupiah(r.subtotal) },
                  { key: 'bills', label: tr('Bills'), align: 'right', value: r => r.bills },
                  { key: 'share', label: tr('Share'), align: 'right', value: r => r.share, render: r => <ShareBar value={r.share} color={channelColor(r.key)} /> },
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
  return <EChart option={option} height={220} ariaLabel={tr('Gross sales per day for this payment method')} onClick={p => { const r = data.rows[p.dataIndex]; if (r) onSelect(r.key); }} />;
}
