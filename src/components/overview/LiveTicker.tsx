'use client';

import ChannelLogo from '@/components/ChannelLogo';
import { formatNumber } from '@/lib/format';
import { clock, LiveResponse } from '@/lib/live';
import { tr } from '@/lib/i18n';

/**
 * Latest sales strip: the newest sales scroll by continuously (pauses on hover /
 * keyboard focus). Brand blue band with red accents; connection status lives
 * in the page header only.
 */
export default function LiveTicker({ data }: { data: LiveResponse | null }) {
  const sales = data?.transactions.slice(0, 24) ?? [];
  if (!data) return <div className="h-12 animate-pulse rounded-xl bg-blue-100" aria-hidden />;
  if (!sales.length) return null;
  const duration = Math.max(45, sales.length * 5);

  const items = (copy: string) => sales.map(s => (
    <span key={`${s.salesNum}${copy}`} className="inline-flex items-center gap-3 whitespace-nowrap px-5 text-xs">
      <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-red-400" aria-hidden />
      <span className="font-mono tabular-nums text-blue-200">{clock(s.orderTime)}</span>
      <span className="font-medium text-white">{s.branchName.replace(/^Kopi Calf /, '')}</span>
      <span className="inline-flex h-6 items-center rounded-md bg-white px-2">
        <ChannelLogo channel={s.channel} height={13} labelClassName="text-[11px] font-medium text-slate-700" />
      </span>
      <span className="text-blue-200">{formatNumber(s.itemQty)} {s.itemQty === 1 ? tr('item') : tr('items')}</span>
      <span className="rounded-md bg-red-500 px-2 py-0.5 font-semibold tabular-nums text-white">{tr('Rp')} {formatNumber(s.subtotal)}</span>
    </span>
  ));

  return (
    <div
      className="live-ticker relative overflow-hidden rounded-xl bg-gradient-to-r from-blue-800 via-blue-700 to-blue-800 shadow-sm ring-1 ring-blue-900/20"
      aria-label={tr('Latest sales')}
      tabIndex={0}
    >
      <span className="absolute inset-x-0 bottom-0 h-0.5 bg-red-500" aria-hidden />
      <div className="py-3 [mask-image:linear-gradient(to_right,transparent,black_32px,black_calc(100%-32px),transparent)]">
        <div className="live-ticker-track inline-flex" style={{ animationDuration: `${duration}s` }}>
          {/* two copies so the loop is seamless (-50% = one copy) */}
          <span className="inline-flex">{items('')}</span>
          <span className="inline-flex" aria-hidden>{items('-copy')}</span>
        </div>
      </div>
    </div>
  );
}
