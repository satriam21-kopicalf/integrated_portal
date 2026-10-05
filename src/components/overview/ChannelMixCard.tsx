'use client';

import { useMemo, useState } from 'react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { SeriesKey } from '@/components/charts/common';
import ChannelLogo, { channelRichLabel } from '@/components/ChannelLogo';
import { formatCurrency, formatNumber } from '@/lib/format';
import { base, categoryAxis, INK, rupiahAxis, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import {
  bucketLabel, channelColor, channelKey, channelOrder, ChannelRow, ChannelsResponse, compactRupiah, Resource, shortDate,
} from '@/lib/overview';
import { Card, Delta, Segmented } from './Card';
import { to, useDrill } from './drill/DrillContext';

/** Fold channels outside the fixed palette into "Other" (never a generated colour). */
function foldChannels(rows: ChannelRow[]): ChannelRow[] {
  const out = new Map<string, ChannelRow>();
  for (const r of rows) {
    const key = channelKey(r.channel);
    const o = out.get(key);
    if (!o) {
      out.set(key, { ...r, channel: key });
      continue;
    }
    o.bills += r.bills;
    o.subtotal += r.subtotal;
    o.nettSales += r.nettSales;
    o.previousSubtotal += r.previousSubtotal;
    o.share = (o.share ?? 0) + (r.share ?? 0);
    o.avgTicket = o.bills ? o.subtotal / o.bills : null;
    o.discountPct = o.subtotal ? ((o.subtotal - o.nettSales) / o.subtotal) * 100 : null;
    o.deltaPct = o.previousSubtotal ? ((o.subtotal - o.previousSubtotal) / o.previousSubtotal) * 100 : null;
  }
  return [...out.values()].sort((a, b) => channelOrder(a.channel) - channelOrder(b.channel));
}

export default function ChannelMixCard({ resource }: { resource: Resource<ChannelsResponse> }) {
  const [view, setView] = useState<'share' | 'daily'>('share');
  const drill = useDrill();
  return (
    <Card
      title="Channel mix"
      subtitle="Sales and share per channel · click a channel for its details"
      resource={resource}
      minHeight={360}
      onOpen={() => drill.open({ kind: 'channels' })}
      actions={<Segmented label="View" value={view} options={[{ value: 'share', label: 'Share' }, { value: 'daily', label: 'Over time' }]} onChange={setView} />}
    >
      {data => <ChannelBody data={data} view={view} />}
    </Card>
  );
}

function ChannelBody({ data, view }: { data: ChannelsResponse; view: 'share' | 'daily' }) {
  const channels = useMemo(() => foldChannels(data.channels), [data]);
  const drill = useDrill();
  // "Other" folds several source channels: open the first one (or the list when there are more)
  const openChannel = (name: string) => {
    const sources = data.channels.filter(c => channelKey(c.channel) === name).map(c => c.channel);
    if (sources.length === 1) drill.open(to.channel(sources[0]));
    else drill.open({ kind: 'channels' });
  };
  const g = data.granularity;

  const shareOption = useMemo<ChartOption>(() => {
    const rows = [...channels].sort((a, b) => a.subtotal - b.subtotal); // largest on top
    return {
      ...base,
      grid: { left: 4, right: 112, top: 4, bottom: 4, containLabel: true },
      tooltip: tooltip({
        trigger: 'item',
        formatter: (p: { dataIndex: number }) => {
          const c = rows[p.dataIndex];
          return tipTitle(c.channel)
            + tipRow(channelColor(c.channel), formatCurrency(c.subtotal), `${c.share?.toFixed(1)}% of sales`)
            + tipRow(channelColor(c.channel), formatNumber(c.bills), 'bills')
            + tipFooter(`Avg ticket ${formatCurrency(c.avgTicket)} · discount ${c.discountPct?.toFixed(1) ?? '-'}%`);
        },
      }),
      xAxis: { type: 'value', show: false, max: (v: { max: number }) => v.max * 1.02 },
      yAxis: categoryAxis(rows.map(c => c.channel), {
        axisLine: { show: false },
        axisLabel: {
          color: INK.primary,
          fontSize: 12,
          formatter: (name: string) => channelRichLabel(name).text,
          rich: Object.assign({}, ...rows.map(c => channelRichLabel(c.channel).rich)),
        },
      }),
      series: [{
        type: 'bar',
        data: rows.map(c => ({ value: c.subtotal, itemStyle: { color: channelColor(c.channel), borderRadius: [0, 4, 4, 0] } })),
        barWidth: 18,
        label: {
          show: true,
          position: 'right',
          color: INK.primary,
          fontSize: 12,
          formatter: (p: { dataIndex: number }) => `{b|${compactRupiah(rows[p.dataIndex].subtotal)}}  {m|${rows[p.dataIndex].share?.toFixed(1)}%}`,
          rich: { b: { fontWeight: 600, color: INK.primary }, m: { color: INK.secondary } },
        },
      }],
    };
  }, [channels]);

  const dailyOption = useMemo<ChartOption>(() => {
    const names = channels.map(c => c.channel);
    const values = (name: string) => data.series.map(b =>
      Object.entries(b.values).filter(([ch]) => channelKey(ch) === name).reduce((sum, [, v]) => sum + v.subtotal, 0));
    const stacks = names.map(n => ({ name: n, values: values(n) }));
    const totals = data.series.map((_, i) => stacks.reduce((s, st) => s + st.values[i], 0));
    return {
      ...base,
      grid: { left: 4, right: 8, top: 10, bottom: 4, containLabel: true },
      tooltip: tooltip({
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } },
        formatter: (items: { dataIndex: number }[]) => {
          const i = items[0]?.dataIndex ?? 0;
          return tipTitle(`${bucketLabel(data.series[i].date, g)} · ${compactRupiah(totals[i])}`)
            + [...stacks].reverse().map(st => tipRow(channelColor(st.name), compactRupiah(st.values[i]),
              `${st.name} · ${totals[i] ? ((st.values[i] / totals[i]) * 100).toFixed(1) : '0.0'}%`)).join('');
        },
      }),
      xAxis: categoryAxis(data.series.map(b => shortDate(b.date, g))),
      yAxis: valueAxis(rupiahAxis),
      series: stacks.map((st, k) => ({
        name: st.name,
        type: 'bar',
        stack: 'sales',
        data: st.values,
        barMaxWidth: 22,
        itemStyle: { color: channelColor(st.name), borderColor: '#fff', borderWidth: 1, borderRadius: k === stacks.length - 1 ? [4, 4, 0, 0] : 0 },
        emphasis: { focus: 'series' },
      })),
    };
  }, [channels, data, g]);

  return (
    <div className="space-y-3">
      {view === 'share' ? (
        <EChart option={shareOption} height={Math.max(150, channels.length * 36)} ariaLabel="Sales per channel with share"
          onClick={p => { const rows = [...channels].sort((a, b) => a.subtotal - b.subtotal); if (rows[p.dataIndex]) openChannel(rows[p.dataIndex].channel); }} />
      ) : (
        <>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
            {channels.map(c => (
              <li key={c.channel} className="flex items-center gap-1.5">
                <SeriesKey color={channelColor(c.channel)} />
                <ChannelLogo channel={c.channel} height={14} labelClassName="text-slate-600" />
              </li>
            ))}
          </ul>
          <EChart option={dailyOption} height={220} ariaLabel={`Sales per channel per ${g}`} />
        </>
      )}
      <table className="w-full whitespace-nowrap text-xs">
        <caption className="sr-only">Sales per channel</caption>
        <thead className="border-b border-slate-100 text-slate-500">
          <tr>
            <th scope="col" className="py-1.5 text-left font-medium">Channel</th>
            <th scope="col" className="py-1.5 pl-3 text-right font-medium">Bills</th>
            <th scope="col" className="py-1.5 pl-3 text-right font-medium">Avg ticket</th>
            <th scope="col" className="py-1.5 pl-3 text-right font-medium">Disc.</th>
            <th scope="col" className="py-1.5 pl-3 text-right font-medium">Change</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {channels.map(c => (
            <tr key={c.channel} onClick={() => openChannel(c.channel)} className="cursor-pointer hover:bg-blue-50/50">
              <td className="py-1.5"><span className="flex items-center gap-2"><SeriesKey color={channelColor(c.channel)} /><ChannelLogo channel={c.channel} height={14} /></span></td>
              <td className="py-1.5 pl-3 text-right tabular-nums text-slate-700">{formatNumber(c.bills)}</td>
              <td className="py-1.5 pl-3 text-right tabular-nums text-slate-700">{c.avgTicket === null ? '-' : formatNumber(Math.round(c.avgTicket))}</td>
              <td className="py-1.5 pl-3 text-right tabular-nums text-slate-700">{c.discountPct === null ? '-' : `${c.discountPct.toFixed(1)}%`}</td>
              <td className="py-1.5 pl-3 text-right"><Delta value={c.deltaPct} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
