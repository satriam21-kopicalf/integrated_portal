'use client';

import { formatCurrency } from '@/lib/format';
import { clock, LiveResponse } from '@/lib/live';
import { channelColor, channelLabel } from '@/lib/overview';
import { LiveBadge } from './LiveSalesCard';

/** Continuously scrolling strip of the latest sales (pauses on hover). */
export default function LiveTicker({ data }: { data: LiveResponse | null }) {
  const sales = data?.transactions.slice(0, 20) ?? [];
  if (!sales.length) return null;
  const duration = Math.max(40, sales.length * 4);
  const items = (copy: string) => sales.map(s => (
    <span key={`${s.salesNum}${copy}`} className="inline-flex items-center gap-2 whitespace-nowrap px-4 text-xs">
      <span className="h-2 w-2 rounded-full" style={{ background: channelColor(s.channel) }} aria-hidden />
      <span className="font-medium text-slate-800">{s.branchName.replace(/^Kopi Calf /, '')}</span>
      <span className="text-slate-400">{channelLabel(s.channel)}</span>
      <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(s.subtotal)}</span>
      <span className="tabular-nums text-slate-400">{clock(s.orderTime)}</span>
    </span>
  ));

  return (
    <div className="live-ticker flex items-center overflow-hidden rounded-xl border border-slate-200 bg-white" aria-label="Latest sales ticker">
      <div className="z-10 flex flex-shrink-0 items-center gap-2 border-r border-slate-100 bg-white py-2 pl-3 pr-3">
        <LiveBadge />
        <span className="hidden text-xs font-medium text-slate-600 sm:inline">Latest sales</span>
      </div>
      <div className="relative min-w-0 flex-1 overflow-hidden py-2 [mask-image:linear-gradient(to_right,transparent,black_24px,black_calc(100%-24px),transparent)]">
        <div className="live-ticker-track inline-flex" style={{ animationDuration: `${duration}s` }}>
          {/* two copies so the loop is seamless (-50% = one copy) */}
          <span className="inline-flex">{items('')}</span>
          <span className="inline-flex" aria-hidden>{items('-copy')}</span>
        </div>
      </div>
    </div>
  );
}
