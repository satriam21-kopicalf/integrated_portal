'use client';

import InfoTip from '@/components/ui/InfoTip';
import { ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Clock3, Receipt, ShoppingBag, Tag } from 'lucide-react';
import ChannelLogo from '@/components/ChannelLogo';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { formatCurrency, formatNumber } from '@/lib/format';
import { base, categoryAxis, INK, tipRow, tipTitle, tooltip } from '@/lib/chartTheme';
import { clock, LiveResponse, LiveSale, minutesAgo, useCountUp } from '@/lib/live';
import { channelColor, channelKey, channelOrder, paymentLabel } from '@/lib/overview';
import { useRealtime } from '@/lib/realtime';
import { Delta } from './Card';

const MAX_ROWS = 25;
const STREAM_MS = 450; // gap between newly arrived sales sliding in
const FRESH_MS = 60_000; // how long a newly arrived sale keeps its "New" label

interface Row {
  sale: LiveSale;
  mode: 'initial' | 'fresh';
  delay: number;
  arrived: number;
}

export function itemsLine(sale: LiveSale): string {
  const names = sale.items.map(i => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(', ');
  return sale.moreItems ? `${names} +${sale.moreItems} more` : names;
}

const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

export default function LiveSalesCard({ data, error }: { data: LiveResponse | null; error: string | null }) {
  const { salesSyncedAt } = useRealtime();
  const [rows, setRows] = useState<Row[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());

  // keeps "x min ago" and the "New" labels current
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // first batch fades in; sales that arrive later stream in one by one at the top
  useEffect(() => {
    if (!data) return;
    setNow(Date.now());
    const incoming = data.transactions.filter(t => !seen.current.has(t.salesNum));
    if (!incoming.length) return;
    const initial = seen.current.size === 0;
    incoming.forEach(t => seen.current.add(t.salesNum));
    if (initial) {
      setRows(data.transactions.slice(0, MAX_ROWS).map((sale, i) => ({ sale, mode: 'initial', delay: i * 40, arrived: 0 })));
      return;
    }
    const queue = [...incoming].reverse(); // oldest first, so the newest ends on top
    let i = 0;
    const id = setInterval(() => {
      const sale = queue[i++];
      if (!sale) {
        clearInterval(id);
        return;
      }
      setRows(r => [{ sale, mode: 'fresh' as const, delay: 0, arrived: Date.now() }, ...r].slice(0, MAX_ROWS));
    }, STREAM_MS);
    return () => clearInterval(id);
  }, [data]);

  const t = data?.today;
  const sales = useCountUp(t?.subtotal ?? 0);
  const bills = useCountUp(t?.bills ?? 0);
  const ofYesterday = t && data?.yesterday.subtotal ? (t.subtotal / data.yesterday.subtotal) * 100 : null;

  const hourOption = useMemo<ChartOption | null>(() => {
    if (!data) return null;
    const today = new Map(data.today.hours.map(h => [h.hour, h]));
    const yday = new Map(data.yesterday.hours.map(h => [h.hour, h]));
    const all = [...today.keys(), ...yday.keys()];
    if (!all.length) return null;
    const hours = Array.from({ length: Math.max(...all) - Math.min(...all) + 1 }, (_, i) => Math.min(...all) + i);
    return {
      ...base,
      grid: { left: 2, right: 2, top: 8, bottom: 2, containLabel: true },
      tooltip: tooltip({
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } },
        formatter: (items: { dataIndex: number }[]) => {
          const h = hours[items[0]?.dataIndex ?? 0];
          return tipTitle(`${hourLabel(h)}–${hourLabel(h + 1)}`)
            + tipRow(INK.accent, formatCurrency(today.get(h)?.subtotal ?? 0), `today · ${formatNumber(today.get(h)?.bills ?? 0)} bills`)
            + tipRow(INK.previous, formatCurrency(yday.get(h)?.subtotal ?? 0), 'yesterday', 'line');
        },
      }),
      xAxis: categoryAxis(hours.map(h => String(h).padStart(2, '0')), { axisLabel: { color: INK.muted, fontSize: 10, interval: 2 } }),
      yAxis: { type: 'value', show: false },
      series: [
        { name: 'Today', type: 'bar', barMaxWidth: 12, data: hours.map(h => today.get(h)?.subtotal ?? 0),
          itemStyle: { color: INK.accent, borderRadius: [3, 3, 0, 0] } },
        { name: 'Yesterday', type: 'line', symbol: 'none', data: hours.map(h => yday.get(h)?.subtotal ?? 0),
          lineStyle: { color: INK.previous, width: 1.5, type: 'dashed' } },
      ],
    };
  }, [data]);

  const channels = useMemo(() => {
    if (!t) return [];
    const folded = new Map<string, { channel: string; subtotal: number; bills: number }>();
    for (const c of t.channels) {
      const key = channelKey(c.channel);
      const f = folded.get(key) ?? { channel: key, subtotal: 0, bills: 0 };
      f.subtotal += c.subtotal;
      f.bills += c.bills;
      folded.set(key, f);
    }
    return [...folded.values()].sort((a, b) => channelOrder(a.channel) - channelOrder(b.channel));
  }, [t]);

  const batch = data?.lastBatch;
  const dateLabel = t
    ? new Date(`${t.date}T00:00:00`).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })
    : '';

  return (
    <section className="overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Sales today">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            <CalendarClock size={15} className="text-blue-600" aria-hidden /> Today <InfoTip info="today" />
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {dateLabel || 'Today'} · follows the branch and channel filters
          </p>
        </div>
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Clock3 size={13} aria-hidden />
          {data && (data.lastSyncedAt || salesSyncedAt)
            ? <>Last new data {minutesAgo(data.lastSyncedAt ?? salesSyncedAt, now)}</>
            : error ? 'Could not load live sales' : 'Connecting…'}
        </p>
      </header>

      <div className="grid divide-y divide-slate-100 xl:grid-cols-12 xl:divide-x xl:divide-y-0">
        {/* Today's figures */}
        <div className="space-y-4 p-4 sm:p-5 xl:col-span-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sales today</p>
            {t ? (
              <>
                <p className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 tabular-nums" title={formatCurrency(t.subtotal)}>
                  {formatCurrency(Math.round(sales))}
                </p>
                <p className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
                  <Delta value={t.deltaPct} />
                  vs yesterday at this time ({formatCurrency(t.yesterdaySameTime.subtotal)})
                </p>
              </>
            ) : (
              <div className="mt-2 h-9 w-2/3 animate-pulse rounded bg-slate-100" />
            )}
          </div>

          {t && ofYesterday !== null && (
            <div>
              <div className="flex items-baseline justify-between text-xs">
                <span className="text-slate-500">Progress vs yesterday&apos;s full day</span>
                <span className="font-semibold tabular-nums text-slate-900">{ofYesterday.toFixed(0)}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full rounded-full bg-blue-600 transition-[width] duration-700" style={{ width: `${Math.min(100, ofYesterday)}%` }} />
              </div>
              <p className="mt-1 text-[11px] text-slate-400">Yesterday: {formatCurrency(data!.yesterday.subtotal)}</p>
            </div>
          )}

          <dl className="divide-y divide-slate-100 rounded-lg border border-slate-100">
            <MiniStat icon={<Receipt size={13} />} label="Bills" value={t ? formatNumber(Math.round(bills)) : '—'} delta={t?.billsDeltaPct} />
            <MiniStat icon={<ShoppingBag size={13} />} label="Avg ticket" value={t ? formatCurrency(Math.round(t.avgTicket)) : '—'} />
            <MiniStat icon={<Tag size={13} />} label="Nett sales" value={t ? formatCurrency(t.nettSales) : '—'} delta={t?.nettDeltaPct} />
          </dl>
        </div>

        {/* Hourly and channels */}
        <div className="space-y-4 p-4 sm:p-5 xl:col-span-4">
          <div>
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Sales by hour</p>
              <span className="flex items-center gap-3 text-[11px] text-slate-500">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-sm bg-[#2a78d6]" />Today</span>
                <span className="flex items-center gap-1"><span className="h-0 w-3 border-t-2 border-dashed border-[#a8a29e]" />Yesterday</span>
              </span>
            </div>
            {hourOption ? <EChart option={hourOption} height={120} ariaLabel="Sales per hour today compared with yesterday" /> : <div className="h-[120px]" />}
          </div>
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Channels today</p>
            {channels.length > 0 && t ? (
              <>
                <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Share of today's sales per channel">
                  {channels.map(c => (
                    <span key={c.channel} className="h-full border-r-2 border-white last:border-r-0"
                      style={{ width: `${(c.subtotal / t.subtotal) * 100}%`, background: channelColor(c.channel) }} />
                  ))}
                </div>
                <ul className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                  {channels.map(c => (
                    <li key={c.channel} className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="h-2 w-2 flex-shrink-0 rounded-sm" style={{ background: channelColor(c.channel) }} />
                        <ChannelLogo channel={c.channel} height={13} labelClassName="text-slate-600" />
                      </span>
                      <span className="tabular-nums text-slate-900">{((c.subtotal / t.subtotal) * 100).toFixed(0)}%</span>
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-2 text-xs text-slate-400">No sales yet today</p>
            )}
          </div>
        </div>

        {/* Latest sales feed */}
        <div className="flex min-w-0 flex-col xl:col-span-4">
          <div className="flex items-center justify-between px-4 pt-4 sm:px-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Latest sales</p>
            {batch && batch.bills > 0 && (
              <span className="text-[11px] text-slate-500" title="Sales that arrived with the most recent sync">
                +{formatNumber(batch.bills)} at last sync · {formatCurrency(batch.subtotal)}
              </span>
            )}
          </div>
          <ol className="custom-scrollbar mt-2 max-h-[19rem] flex-1 overflow-y-auto px-2 pb-2 sm:px-3" aria-live="polite" aria-label="Latest sales">
            {rows.map(({ sale, mode, delay, arrived }) => {
              const isNew = mode === 'fresh' && now - arrived < FRESH_MS;
              return (
                <li
                  key={sale.salesNum}
                  className={`grid grid-cols-[3rem_1fr_auto] items-start gap-2 rounded-lg px-2 py-2 ${mode === 'fresh' ? 'live-enter' : 'live-fade'}`}
                  style={mode === 'initial' ? { animationDelay: `${delay}ms` } : undefined}
                >
                  <span className="pt-0.5 font-mono text-[11px] tabular-nums text-slate-400">{clock(sale.orderTime)}</span>
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5 truncate text-[13px] font-medium text-slate-800" title={sale.branchName}>
                      {isNew && <span className="rounded bg-blue-600 px-1 text-[9px] font-bold uppercase tracking-wide text-white">New</span>}
                      <span className="truncate">{sale.branchName.replace(/^Kopi Calf /, '')}</span>
                    </p>
                    <p className="truncate text-[11px] text-slate-500" title={itemsLine(sale)}>{itemsLine(sale)}</p>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <ChannelLogo channel={sale.channel} height={12} labelClassName="text-slate-500" />
                      {sale.paymentMethod && <span className="truncate">· {paymentLabel(sale.paymentMethod)}</span>}
                    </p>
                  </div>
                  <span className="pt-0.5 text-[13px] font-semibold tabular-nums text-slate-900">{formatNumber(sale.subtotal)}</span>
                </li>
              );
            })}
            {data && !rows.length && <li className="py-8 text-center text-sm text-slate-400">No sales yet today</li>}
          </ol>
          <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 sm:px-5">
            Outlet local time · updates automatically after every POS sync (hourly at :05)
          </p>
        </div>
      </div>
    </section>
  );
}

function MiniStat({ icon, label, value, delta }: { icon: ReactNode; label: string; value: string; delta?: number | null }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2">
      <dt className="flex flex-1 items-center gap-1.5 text-xs text-slate-500">{icon}{label}</dt>
      <dd className="text-sm font-semibold tabular-nums text-slate-900">{value}</dd>
      {delta !== undefined && <dd className="w-16 text-right"><Delta value={delta ?? null} /></dd>}
    </div>
  );
}
