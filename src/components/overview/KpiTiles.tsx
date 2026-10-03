'use client';

import Sparkline from '@/components/charts/Sparkline';
import { formatCurrency, formatNumber } from '@/lib/format';
import { compactNumber, compactRupiah, KpisResponse, Resource } from '@/lib/overview';
import { Delta } from './Card';

type Key = keyof KpisResponse['kpis'];

const TILES: { key: Key; label: string; hint: string; money: boolean; series: (d: KpisResponse['daily'][number]) => number }[] = [
  { key: 'sales', label: 'Sales', hint: 'Subtotal of finished sales with a bill number', money: true, series: d => d.subtotal },
  { key: 'nettSales', label: 'Nett sales', hint: 'After item and bill discounts', money: true, series: d => d.nettSales },
  { key: 'bills', label: 'Bills', hint: 'Number of sales transactions', money: false, series: d => d.bills },
  { key: 'avgTicket', label: 'Avg ticket', hint: 'Sales ÷ bills', money: true, series: d => d.avgTicket ?? 0 },
];

export default function KpiTiles({ resource }: { resource: Resource<KpisResponse> }) {
  const { data, loading, error, retry } = resource;
  const days = data?.filters.days;
  return (
    <section aria-label="Key figures" className={`grid grid-cols-2 gap-3 xl:grid-cols-4 ${loading && data ? 'opacity-50' : ''}`}>
      {TILES.map(t => {
        const k = data?.kpis[t.key];
        const full = k ? (t.money ? formatCurrency(k.value) : formatNumber(k.value)) : '';
        return (
          <div key={t.key} className="min-w-0 rounded-xl border border-slate-200 bg-white p-4" title={t.hint}>
            <p className="text-xs font-medium text-slate-500">{t.label}</p>
            {k ? (
              <>
                <p className="mt-1 truncate text-xl font-semibold text-slate-900 sm:text-2xl" title={full}>
                  {t.key === 'avgTicket' ? formatCurrency(k.value) : t.money ? compactRupiah(k.value) : compactNumber(k.value)}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-slate-400">
                  <Delta value={k.deltaPct} />
                  <span>
                    vs {data!.filters.previous.complete
                      ? (t.key === 'avgTicket' ? formatCurrency(k.previous) : t.money ? compactRupiah(k.previous) : compactNumber(k.previous))
                      : 'n/a'}{' '}
                    prev. {days} {days === 1 ? 'day' : 'days'}
                  </span>
                </div>
                <Sparkline className="mt-2" values={data!.daily.map(t.series)} label={`${t.label} per day`} />
              </>
            ) : error ? (
              <button type="button" onClick={retry} className="mt-2 text-xs font-medium text-slate-500 underline">
                Could not load, try again
              </button>
            ) : (
              <div className="mt-2 space-y-2">
                <div className="h-7 w-3/4 animate-pulse rounded bg-slate-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
                <div className="h-7 animate-pulse rounded bg-slate-100" />
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
