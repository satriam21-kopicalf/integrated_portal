'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Radio } from 'lucide-react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { formatCurrency, formatNumber } from '@/lib/format';
import { base, categoryAxis, INK, tipRow, tipTitle, tooltip } from '@/lib/chartTheme';
import { clock, LiveResponse, LiveSale, minutesAgo, useCountUp } from '@/lib/live';
import { channelColor, channelLabel, compactRupiah, paymentLabel } from '@/lib/overview';
import { Delta } from './Card';

const MAX_ROWS = 30;
const STREAM_MS = 450; // gap between newly arrived sales sliding in

interface Row {
  sale: LiveSale;
  mode: 'initial' | 'fresh';
  delay: number;
}

/** Pulsing "Live" badge. */
export function LiveBadge({ stale = false }: { stale?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${stale ? 'bg-slate-100 text-slate-500' : 'bg-emerald-50 text-emerald-700'}`}>
      <span className="relative flex h-2 w-2">
        {!stale && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${stale ? 'bg-slate-400' : 'bg-emerald-500'}`} />
      </span>
      Live
    </span>
  );
}

export function itemsLine(sale: LiveSale): string {
  const names = sale.items.map(i => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name)).join(', ');
  return sale.moreItems ? `${names} +${sale.moreItems} more` : names;
}

export default function LiveSalesCard({ data, error }: { data: LiveResponse | null; error: string | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const seen = useRef<Set<string>>(new Set());
  const [now, setNow] = useState(() => Date.now());

  // "updated x min ago" stays current between polls
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
      setRows(data.transactions.slice(0, MAX_ROWS).map((sale, i) => ({ sale, mode: 'initial', delay: i * 45 })));
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
      setRows(r => [{ sale, mode: 'fresh' as const, delay: 0 }, ...r].slice(0, MAX_ROWS));
    }, STREAM_MS);
    return () => clearInterval(id);
  }, [data]);

  const t = data?.today;
  const sales = useCountUp(t?.subtotal ?? 0);
  const bills = useCountUp(t?.bills ?? 0);
  const syncedAgo = minutesAgo(data?.lastSyncedAt ?? null, now);
  const stale = !data?.lastSyncedAt || now - new Date(data.lastSyncedAt).getTime() > 2 * 3600_000;

  const hourOption = useMemo<ChartOption | null>(() => {
    if (!t?.hours.length) return null;
    const hours = t.hours;
    const last = hours[hours.length - 1].hour;
    return {
      ...base,
      grid: { left: 0, right: 0, top: 6, bottom: 0, containLabel: true },
      tooltip: tooltip({
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } },
        formatter: (items: { dataIndex: number }[]) => {
          const h = hours[items[0]?.dataIndex ?? 0];
          return tipTitle(`Today ${String(h.hour).padStart(2, '0')}:00–${String(h.hour + 1).padStart(2, '0')}:00`)
            + tipRow(INK.accent, formatCurrency(h.subtotal), 'sales')
            + tipRow(INK.accent, formatNumber(h.bills), 'bills');
        },
      }),
      xAxis: categoryAxis(hours.map(h => String(h.hour).padStart(2, '0')), { axisLabel: { color: INK.muted, fontSize: 10, interval: 2 } }),
      yAxis: { type: 'value', show: false },
      series: [{
        type: 'bar',
        barMaxWidth: 14,
        data: hours.map(h => ({ value: h.subtotal, itemStyle: { color: h.hour === last ? '#1baf7a' : '#9ec5f4', borderRadius: [3, 3, 0, 0] } })),
      }],
    };
  }, [t]);

  return (
    <section className="flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white">
      <header className="flex items-start justify-between gap-2 px-4 pb-2 pt-4 sm:px-5">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
            Live sales <LiveBadge stale={stale} />
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {data ? <>Last sync {syncedAgo} · refreshes every 30 s</> : error ? 'Could not load live sales' : 'Connecting…'}
          </p>
        </div>
        <Radio size={16} className="mt-0.5 flex-shrink-0 text-slate-300" aria-hidden />
      </header>

      <div className="px-4 sm:px-5">
        <div className="rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 p-4 text-white">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-300">
            Today so far{t ? ` · ${new Date(`${t.date}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}
          </p>
          {t ? (
            <>
              <p className="mt-1 text-2xl font-semibold tabular-nums sm:text-3xl" title={formatCurrency(t.subtotal)}>
                {formatCurrency(Math.round(sales))}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-300">
                <span><span className="font-semibold tabular-nums text-white">{formatNumber(Math.round(bills))}</span> bills</span>
                <span>avg <span className="font-semibold tabular-nums text-white">{formatNumber(Math.round(t.avgTicket))}</span></span>
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-300">
                <span className="rounded bg-white px-1.5 py-0.5"><Delta value={t.deltaPct} /></span>
                vs yesterday at this time ({compactRupiah(t.yesterdaySameTime.subtotal)})
              </p>
            </>
          ) : (
            <div className="mt-2 h-9 w-2/3 animate-pulse rounded bg-white/15" />
          )}
        </div>
        {hourOption && (
          <div className="mt-2">
            <EChart option={hourOption} height={80} ariaLabel="Sales per hour today" />
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between px-4 sm:px-5">
        <p className="text-xs font-medium text-slate-500">Latest sales</p>
        <p className="text-[11px] text-slate-400">outlet local time</p>
      </div>
      <ol className="custom-scrollbar mt-1 max-h-[22rem] flex-1 overflow-y-auto px-2 pb-3 sm:px-3" aria-live="polite" aria-label="Latest sales">
        {rows.map(({ sale, mode, delay }) => (
          <li
            key={sale.salesNum}
            className={`rounded-lg px-2 py-2 ${mode === 'fresh' ? 'live-enter' : 'live-fade'}`}
            style={mode === 'initial' ? { animationDelay: `${delay}ms` } : undefined}
          >
            <div className="flex items-start gap-2.5">
              <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full" style={{ background: channelColor(sale.channel) }} title={channelLabel(sale.channel)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium text-slate-800" title={sale.branchName}>{sale.branchName}</p>
                  <p className="flex-shrink-0 text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(sale.subtotal)}</p>
                </div>
                <p className="truncate text-xs text-slate-500" title={itemsLine(sale)}>{itemsLine(sale)}</p>
                <p className="text-[11px] text-slate-400">
                  {clock(sale.orderTime)} · {channelLabel(sale.channel)}{sale.paymentMethod ? ` · ${paymentLabel(sale.paymentMethod)}` : ''}
                </p>
              </div>
            </div>
          </li>
        ))}
        {data && !rows.length && <li className="py-8 text-center text-sm text-slate-400">No sales yet today</li>}
      </ol>
      <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400 sm:px-5">
        New sales arrive with every POS data sync (hourly at :05).
      </p>
    </section>
  );
}
