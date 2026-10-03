'use client';

import { formatNumber } from '@/lib/format';
import { clock, LiveResponse } from '@/lib/live';
import { channelColor, channelLabel, compactRupiah } from '@/lib/overview';
import { useRealtime } from '@/lib/realtime';

/**
 * "Latest sales" band: what the last sync brought in, then a continuously
 * moving strip of the newest sales (pauses on hover / keyboard focus).
 */
export default function LiveTicker({ data }: { data: LiveResponse | null }) {
  const { status, salesSyncedAt } = useRealtime();
  const sales = data?.transactions.slice(0, 24) ?? [];
  if (!data) return <div className="h-[52px] animate-pulse rounded-xl bg-slate-200/60" aria-hidden />;
  const batch = data.lastBatch;
  // today's newest sync, else the newest sync of any recent sale (early morning)
  const lastSync = data.lastSyncedAt ?? salesSyncedAt;
  const syncedAt = lastSync
    ? new Date(lastSync).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false })
    : null;
  const live = status === 'live';
  const duration = Math.max(45, sales.length * 5);

  const items = (copy: string) => sales.map(s => (
    <span key={`${s.salesNum}${copy}`} className="inline-flex items-center gap-2.5 whitespace-nowrap border-r border-white/10 px-5 text-xs">
      <span className="font-mono tabular-nums text-slate-400">{clock(s.orderTime)}</span>
      <span className="font-medium text-white">{s.branchName.replace(/^Kopi Calf /, '')}</span>
      <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-slate-200">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: channelColor(s.channel) }} aria-hidden />
        {channelLabel(s.channel)}
      </span>
      <span className="text-slate-400">{formatNumber(s.itemQty)} {s.itemQty === 1 ? 'item' : 'items'}</span>
      <span className="font-semibold tabular-nums text-white">Rp {formatNumber(s.subtotal)}</span>
    </span>
  ));

  return (
    <div className="live-ticker flex items-stretch overflow-hidden rounded-xl bg-slate-900 text-white shadow-sm" aria-label="Latest sales ticker" tabIndex={0}>
      <div className="z-10 flex flex-shrink-0 items-center gap-3 border-r border-white/10 bg-slate-900 px-4 py-2.5">
        <span className="relative flex h-2 w-2">
          {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? 'bg-emerald-400' : 'bg-slate-500'}`} />
        </span>
        <div className="leading-tight">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">{live ? 'Live' : 'Reconnecting'} · Latest sales</p>
          <p className="hidden text-[11px] text-slate-300 sm:block">
            {syncedAt ? <>Sync {syncedAt}</> : 'Waiting for data'}
            {batch.bills > 0 && <> · <span className="text-white">+{formatNumber(batch.bills)}</span> sales · {compactRupiah(batch.subtotal)}</>}
          </p>
        </div>
      </div>
      {sales.length ? (
        <div className="relative min-w-0 flex-1 overflow-hidden py-2.5 [mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]">
          <div className="live-ticker-track inline-flex" style={{ animationDuration: `${duration}s` }}>
            {/* two copies so the loop is seamless (-50% = one copy) */}
            <span className="inline-flex">{items('')}</span>
            <span className="inline-flex" aria-hidden>{items('-copy')}</span>
          </div>
        </div>
      ) : (
        <p className="flex flex-1 items-center px-4 text-xs text-slate-400">No sales yet today</p>
      )}
    </div>
  );
}
