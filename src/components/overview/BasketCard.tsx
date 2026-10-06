'use client';

import { SeriesKey } from '@/components/charts/common';
import ChannelLogo from '@/components/ChannelLogo';
import { formatNumber } from '@/lib/format';
import { Basket, BasketResponse, channelColor, channelOrder, Resource } from '@/lib/overview';
import { Card, Delta } from './Card';
import { to, useDrill } from './drill/DrillContext';

const change = (cur: number | null, prev: number | null) => (cur !== null && prev ? ((cur - prev) / prev) * 100 : null);

export default function BasketCard({ resource }: { resource: Resource<BasketResponse> }) {
  const drill = useDrill();
  return (
    <Card title="Basket" info="basket" subtitle="What a bill contains" resource={resource} minHeight={360} onOpen={() => drill.open({ kind: 'basket' })}>
      {data => {
        const t = data.totals;
        const p: Basket | null = data.filters.previous.complete ? data.previous : null;
        const channels = [...data.channels].sort((a, b) => channelOrder(a.channel) - channelOrder(b.channel));
        return (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-2">
              <Stat label="Menu lines / bill" value={t.linesPerBill?.toFixed(2) ?? '-'} delta={change(t.linesPerBill, p?.linesPerBill ?? null)} />
              <Stat label="Items / bill" value={t.qtyPerBill?.toFixed(2) ?? '-'} delta={change(t.qtyPerBill, p?.qtyPerBill ?? null)} />
              <Stat
                label="Bills with food"
                value={t.foodSharePct === null ? '-' : `${t.foodSharePct.toFixed(1)}%`}
                delta={p && t.foodSharePct !== null && p.foodSharePct !== null ? t.foodSharePct - p.foodSharePct : null}
                unit=" pp"
                hint={`${formatNumber(t.foodBills)} of ${formatNumber(t.bills)} bills`}
              />
              <Stat
                label="Food attach rate"
                value={t.foodAttachPct === null ? '-' : `${t.foodAttachPct.toFixed(1)}%`}
                delta={p && t.foodAttachPct !== null && p.foodAttachPct !== null ? t.foodAttachPct - p.foodAttachPct : null}
                unit=" pp"
                hint="Beverage bills that also contain food"
              />
            </dl>
            <table className="w-full text-xs">
              <caption className="sr-only">Basket per channel</caption>
              <thead className="text-slate-500">
                <tr>
                  <th scope="col" className="py-1.5 text-left font-medium">Channel</th>
                  <th scope="col" className="py-1.5 text-right font-medium">Items / bill</th>
                  <th scope="col" className="py-1.5 text-right font-medium">With food</th>
                  <th scope="col" className="py-1.5 text-right font-medium">Attach</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {channels.map(c => (
                  <tr key={c.channel} onClick={() => drill.open(to.channel(c.channel))} className="cursor-pointer hover:bg-blue-50/50">
                    <td className="py-1.5">
                      <span className="flex items-center gap-2"><SeriesKey color={channelColor(c.channel)} /><ChannelLogo channel={c.channel} height={14} /></span>
                    </td>
                    <td className="py-1.5 text-right tabular-nums text-slate-700">{c.qtyPerBill?.toFixed(2) ?? '-'}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-700">{c.foodSharePct === null ? '-' : `${c.foodSharePct.toFixed(1)}%`}</td>
                    <td className="py-1.5 text-right tabular-nums text-slate-700">{c.foodAttachPct === null ? '-' : `${c.foodAttachPct.toFixed(1)}%`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }}
    </Card>
  );
}

function Stat({ label, value, delta, unit = '%', hint }: { label: string; value: string; delta: number | null; unit?: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-slate-50 p-2.5" title={hint}>
      <dt className="truncate text-[11px] text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold text-slate-900">{value}</dd>
      <dd><Delta value={delta} unit={unit} /></dd>
    </div>
  );
}
