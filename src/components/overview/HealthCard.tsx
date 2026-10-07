'use client';

import { AlertTriangle, CheckCircle2, Database, HeartPulse, XCircle } from 'lucide-react';
import LoadingState from '@/components/ui/LoadingState';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { useOverview } from '@/lib/overview';

type HealthStatus = 'good' | 'watch' | 'risk' | 'info';

interface Indicator {
  key: string; group: string; label: string; value: number | null; unit: 'Rp' | '%' | 'count';
  status: HealthStatus; target: string | null; total?: number;
}

interface HealthResponse {
  period: { from: string; to: string; days: number };
  score: number | null;
  grade: 'healthy' | 'watch' | 'risk' | null;
  counts: Record<HealthStatus, number>;
  indicators: Indicator[];
}

const STATUS: Record<Exclude<HealthStatus, 'info'>, { label: string; cls: string; Icon: typeof CheckCircle2 }> = {
  good: { label: 'Good', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', Icon: CheckCircle2 },
  watch: { label: 'Watch', cls: 'bg-amber-50 text-amber-700 ring-amber-200', Icon: AlertTriangle },
  risk: { label: 'At risk', cls: 'bg-red-50 text-red-700 ring-red-200', Icon: XCircle },
};
const GRADE: Record<string, { label: string; ring: string; text: string }> = {
  healthy: { label: 'Healthy', ring: '#16a34a', text: 'text-emerald-700' },
  watch: { label: 'Needs attention', ring: '#d97706', text: 'text-amber-700' },
  risk: { label: 'At risk', ring: '#dc2626', text: 'text-red-700' },
};
const GROUPS = ['Business', 'Sales quality', 'Outlets', 'Menu & demand'];

function value(i: Indicator): string {
  if (i.value === null) return '–';
  if (i.unit === 'Rp') return formatCurrency(Math.round(i.value));
  if (i.unit === 'count') return formatNumber(i.value) + (i.total !== undefined ? ` of ${formatNumber(i.total)}` : '');
  return `${i.value.toFixed(1)}%`;
}

/** Company health: the current condition of the business from all ESB data (network level, not filtered). */
export default function HealthCard() {
  const res = useOverview<HealthResponse>('health', '');
  const d = res.data;
  const g = d?.grade ? GRADE[d.grade] : null;
  return (
    <section aria-label="Company health" className="rounded-xl border border-slate-200 bg-white shadow-sm">
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-slate-900"><HeartPulse size={16} className="text-rose-600" /> Company health</h2>
        <p className="flex items-center gap-1.5 text-xs text-slate-500">
          <Database size={13} className="text-slate-400" />
          {d ? <>All ESB data · {formatDate(d.period.from)} – {formatDate(d.period.to)} ({formatNumber(d.period.days)} days) · all outlets</> : 'All ESB data'}
        </p>
      </header>

      {!d ? (
        <div className="p-4 sm:p-5">
          {res.error ? <p className="text-sm text-slate-500">Could not load the company health ({res.error}).</p> : <LoadingState height={220} label="company health" />}
        </div>
      ) : (
        <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-12">
          <div className="flex items-center gap-4 lg:col-span-3 lg:flex-col lg:items-start xl:flex-row xl:items-center">
            <div className="relative h-24 w-24 flex-shrink-0" role="img" aria-label={`Health score ${d.score ?? '–'} of 100`}>
              <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f1f5f9" strokeWidth="3.5" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke={g?.ring ?? '#94a3b8'} strokeWidth="3.5" strokeLinecap="round"
                  strokeDasharray={`${((d.score ?? 0) / 100) * 97.4} 97.4`} />
              </svg>
              <span className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-2xl font-bold tabular-nums text-slate-900">{d.score ?? '–'}</span>
                <span className="text-[10px] text-slate-400">of 100</span>
              </span>
            </div>
            <div>
              <p className={`text-base font-semibold ${g?.text ?? 'text-slate-700'}`}>{g?.label ?? '–'}</p>
              <p className="mt-1 text-xs text-slate-500">{d.counts.good} good · {d.counts.watch} watch · {d.counts.risk} at risk</p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:col-span-9 xl:grid-cols-4">
            {GROUPS.map(group => (
              <div key={group} className="min-w-0">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{group}</p>
                <dl className="divide-y divide-slate-100">
                  {d.indicators.filter(i => i.group === group).map(i => (
                    <div key={i.key} className="py-1.5" title={i.target ? `Target ${i.target}` : undefined}>
                      <dt className="flex items-center justify-between gap-2 text-xs text-slate-500">
                        <span className="min-w-0">{i.label}</span>
                        {i.status !== 'info' && <Pill status={i.status} />}
                      </dt>
                      <dd className={`text-sm font-semibold tabular-nums ${i.status === 'risk' ? 'text-red-700' : 'text-slate-900'}`}>{value(i)}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function Pill({ status }: { status: Exclude<HealthStatus, 'info'> }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex flex-shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${s.cls}`}>
      <s.Icon size={10} aria-hidden />{s.label}
    </span>
  );
}
