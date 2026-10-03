'use client';

import ColumnChart from '@/components/charts/ColumnChart';
import { Legend, SeriesKey } from '@/components/charts/common';
import { formatCurrency, formatNumber } from '@/lib/format';
import {
  bucketLabel, channelColor, channelKey, channelOrder, ChannelRow, ChannelsResponse, compactRupiah, OTHER_CHANNEL,
  Resource, shortDate,
} from '@/lib/overview';
import { Card, Delta } from './Card';

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
  return (
    <Card title="Channel mix" subtitle="Share of sales per channel" resource={resource} minHeight={300}>
      {data => {
        const channels = foldChannels(data.channels);
        const names = channels.map(c => c.channel);
        const g = data.granularity;
        const stacks = names.map(name => ({
          key: name,
          label: name,
          color: channelColor(name),
          values: data.series.map(b =>
            Object.entries(b.values)
              .filter(([ch]) => channelKey(ch) === name)
              .reduce((sum, [, v]) => sum + v.subtotal, 0),
          ),
        }));
        const totals = data.series.map((_, i) => stacks.reduce((s, st) => s + st.values[i], 0));
        return (
          <div className="space-y-3">
            <Legend items={names.map(n => ({ key: n, label: n, color: channelColor(n) }))} />
            <ColumnChart
              ariaLabel={`Channel share of sales per ${g}`}
              xLabels={data.series.map(b => shortDate(b.date, g))}
              stacks={stacks}
              percent
              tooltipTitle={i => `${bucketLabel(data.series[i].date, g)} · ${compactRupiah(totals[i])}`}
              formatValue={(v, i) => `${totals[i] ? ((v / totals[i]) * 100).toFixed(1) : '0.0'}% · ${compactRupiah(v)}`}
              formatTick={v => `${v}%`}
              height={180}
            />
            <div className="custom-scrollbar -mx-1 overflow-x-auto">
              <table className="w-full min-w-[18rem] whitespace-nowrap text-xs">
                <caption className="sr-only">Sales per channel</caption>
                <thead className="text-slate-500">
                  <tr>
                    <th scope="col" className="px-1 py-1.5 text-left font-medium">Channel</th>
                    <th scope="col" className="px-1 py-1.5 text-right font-medium">Sales</th>
                    <th scope="col" className="px-1 py-1.5 text-right font-medium">Share</th>
                    <th scope="col" className="px-1 py-1.5 text-right font-medium">Disc.</th>
                    <th scope="col" className="px-1 py-1.5 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {channels.map(c => (
                    <tr key={c.channel} title={`${c.channel}: ${formatCurrency(c.subtotal)} · ${formatNumber(c.bills)} bills · avg ticket ${formatCurrency(c.avgTicket)}`}>
                      <td className="px-1 py-1.5">
                        <span className="flex items-center gap-1.5 text-slate-700">
                          <SeriesKey color={channelColor(c.channel)} />
                          {c.channel === OTHER_CHANNEL ? 'Other' : c.channel}
                        </span>
                      </td>
                      <td className="px-1 py-1.5 text-right tabular-nums text-slate-900">{compactRupiah(c.subtotal)}</td>
                      <td className="px-1 py-1.5 text-right tabular-nums text-slate-700">{c.share === null ? '-' : `${c.share.toFixed(1)}%`}</td>
                      <td className="px-1 py-1.5 text-right tabular-nums text-slate-700">{c.discountPct === null ? '-' : `${c.discountPct.toFixed(1)}%`}</td>
                      <td className="px-1 py-1.5 text-right"><Delta value={c.deltaPct} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      }}
    </Card>
  );
}
