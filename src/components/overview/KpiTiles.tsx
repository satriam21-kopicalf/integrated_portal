'use client';

import { Receipt, ShoppingBag, Tag, Wallet } from 'lucide-react';
import Sparkline from '@/components/charts/Sparkline';
import { Stat, StatSkeleton, StatStrip } from '@/components/StatStrip';
import { formatCurrency, formatNumber } from '@/lib/format';
import { KpisResponse, Resource } from '@/lib/overview';
import { Delta } from './Card';

type Key = keyof KpisResponse['kpis'];

const METRICS: {
  key: Key; label: string; hint: string; icon: typeof Wallet;
  format: (v: number) => string; full: (v: number) => string; series: (d: KpisResponse['daily'][number]) => number;
}[] = [
  { key: 'sales', label: 'Sales', hint: 'Subtotal of finished sales with a bill number', icon: Wallet,
    format: formatCurrency, full: formatCurrency, series: d => d.subtotal },
  { key: 'nettSales', label: 'Nett sales', hint: 'After item and bill discounts', icon: Tag,
    format: formatCurrency, full: formatCurrency, series: d => d.nettSales },
  { key: 'bills', label: 'Bills', hint: 'Number of sales transactions', icon: Receipt,
    format: formatNumber, full: formatNumber, series: d => d.bills },
  { key: 'avgTicket', label: 'Avg ticket', hint: 'Sales ÷ bills', icon: ShoppingBag,
    format: formatCurrency, full: formatCurrency, series: d => d.avgTicket ?? 0 },
];

/** Period summary: Sales, Nett sales, Bills, Avg ticket (no cards, see StatStrip). */
export default function KpiTiles({ resource }: { resource: Resource<KpisResponse> }) {
  const { data, error, retry } = resource;
  const days = data?.filters.days;
  const hasPrev = data?.filters.previous.complete;
  return (
    <StatStrip label="Key figures for the selected period">
      {METRICS.map((m, i) => {
        const k = data?.kpis[m.key];
        const Icon = m.icon;
        return (
          <Stat
            key={m.key}
            label={m.label}
            icon={<Icon size={13} strokeWidth={2} aria-hidden />}
            value={k ? m.format(k.value) : error ? '—' : <StatSkeleton />}
            title={k ? `${m.label}: ${m.full(k.value)} · ${m.hint}` : m.hint}
            emphasis={i === 0}
          >
            {k && (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Delta value={k.deltaPct} />
                  <span className="truncate">
                    {hasPrev ? <>vs <span className="tabular-nums text-slate-600">{m.format(k.previous)}</span> · prev. {days} {days === 1 ? 'day' : 'days'}</> : 'no comparison'}
                  </span>
                </div>
                <Sparkline className="mt-2" values={data!.daily.map(m.series)} height={30} label={`${m.label} per day`} />
              </>
            )}
            {error && !k && (
              <button type="button" onClick={retry} className="text-xs font-medium text-slate-500 underline">Try again</button>
            )}
          </Stat>
        );
      })}
    </StatStrip>
  );
}
