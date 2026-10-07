'use client';

import { Receipt, ShoppingBag, Tag, Wallet } from 'lucide-react';
import Sparkline from '@/components/charts/Sparkline';
import { Stat, StatSkeleton, StatStrip } from '@/components/StatStrip';
import { formatCurrency, formatNumber } from '@/lib/format';
import { KpisResponse, Resource } from '@/lib/overview';
import { infoLine } from '@/lib/metricInfo';
import { Delta } from './Card';
import { useOptionalDrill } from './drill/DrillContext';

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
  const drill = useOptionalDrill();
  const days = data?.filters.previous.days ?? data?.filters.days;
  const custom = data?.filters.previous.custom;
  const hasPrev = data?.filters.previous.complete;
  return (
    <StatStrip label="Key figures for the selected period">
      {METRICS.map((m, i) => {
        const k = data?.kpis[m.key];
        const Icon = m.icon;
        const tile = (
          <Stat
            key={m.key}
            className={drill ? 'h-full transition-colors group-hover:bg-white' : ''}
            label={m.label}
            icon={<Icon size={13} strokeWidth={2} aria-hidden />}
            value={k ? m.format(k.value) : error ? '—' : <StatSkeleton />}
            title={`${k ? `${m.label}: ${m.full(k.value)}\n\n` : ''}${infoLine(m.key)}`}
            emphasis={i === 0}
          >
            {k && (
              <>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <Delta value={k.deltaPct} />
                  {hasPrev && (
                    <span className={`font-semibold tabular-nums ${k.value - k.previous > 0 ? 'text-emerald-700' : k.value - k.previous < 0 ? 'text-red-700' : 'text-slate-500'}`}
                      title="Difference with the comparison period">
                      {k.value - k.previous > 0 ? '+' : k.value - k.previous < 0 ? '−' : '±'}{m.format(Math.abs(Math.round(k.value - k.previous)))}
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate">
                    {hasPrev ? <>vs <span className="tabular-nums text-slate-600">{m.format(k.previous)}</span> · {custom ? 'comparison' : 'prev.'} {days} {days === 1 ? 'day' : 'days'}</> : 'no comparison'}
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
        if (!drill || !k) return tile;
        return (
          <button key={m.key} type="button" onClick={() => drill.open({ kind: 'kpi', metric: m.key })}
            className="group relative text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title={`${m.label}: open details per day, weekday and the previous period`}>
            {tile}
            <span className="absolute right-3 top-3 text-[10px] font-medium text-slate-400 opacity-0 transition-opacity group-hover:opacity-100">Details ›</span>
          </button>
        );
      })}
    </StatStrip>
  );
}
