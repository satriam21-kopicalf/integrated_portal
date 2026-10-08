'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import StatusBadge from '@/components/cost/StatusBadge';
import { Card, Segmented } from '@/components/overview/Card';
import {
  Basis, cogsPct, cogsStatus, ForecastResponse, pctText, periodLabel, sales, STATUS, STATUS_ORDER, SummaryResponse, useCostControl,
} from '@/lib/costControl';
import { formatCurrency, fixed } from '@/lib/format';
import { tr } from '@/lib/i18n';

/**
 * Cost control at a glance on the Overview: COGS ratio, usage ratio, stock variance,
 * next week's purchases and the outlets that need attention. Follows the Overview's
 * dates and branches (cost figures come in stock-opname periods: 1-7, 8-14, 15-21, 22-end).
 */
export default function CostControlCard({ dateFrom, dateTo, branch }: { dateFrom?: string; dateTo?: string; branch: string }) {
  const [basis, setBasis] = useState<Basis>('net');
  const p = new URLSearchParams();
  if (dateFrom) p.set('dateFrom', dateFrom);
  if (dateTo) p.set('dateTo', dateTo);
  if (branch) p.set('branch', branch);
  const query = p.toString();
  const summary = useCostControl<SummaryResponse>('summary', query, Boolean(dateFrom));
  const forecast = useCostControl<ForecastResponse>('forecast', branch ? `branch=${encodeURIComponent(branch)}` : '');
  const link = `/cost-control?${new URLSearchParams({
    ...(dateFrom ? { from: dateFrom } : {}), ...(dateTo ? { to: dateTo } : {}), ...(branch ? { branch } : {}), ...(basis === 'subtotal' ? { basis } : {}),
  })}`;

  return (
    <Card
      title={tr('Cost control')}
      info="cost"
      subtitle={summary.data?.periods.length
        ? tr('COGS & usage · opname periods {0}', periodLabel(summary.data.periods[0].start, summary.data.periods[summary.data.periods.length - 1].end))
        : tr('COGS & usage per stock-opname period')}
      resource={summary}
      minHeight={260}
      actions={
        <>
          <Segmented label={tr('Ratio basis')} value={basis} options={[{ value: 'net', label: tr('Net sales') }, { value: 'subtotal', label: tr('Subtotal') }]} onChange={setBasis} />
          <Link href={link} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50">
            {tr('Open Cost Control')} <ArrowRight size={13} />
          </Link>
        </>
      }
    >
      {data => {
        const t = data.total;
        const gap = basis === 'net' ? t.gapPpNet : t.gapPpSubtotal;
        const active = data.outlets.filter(o => sales(o, basis) > 0);
        const counts = STATUS_ORDER.map(s => ({ s, n: active.filter(o => cogsStatus(o, basis) === s).length }));
        const attention = [...active]
          .sort((a, b) => (cogsPct(b, basis, 'actual') ?? 0) - (cogsPct(a, basis, 'actual') ?? 0))
          .slice(0, 5);
        if (!active.length) return <p className="py-12 text-center text-sm text-slate-400">{tr('No cost data for this period yet')}</p>;
        return (
          <div className="grid gap-4 lg:grid-cols-12">
            <dl className="grid grid-cols-2 gap-px self-start overflow-hidden rounded-lg border border-slate-200 bg-slate-200 sm:grid-cols-3 lg:col-span-7">
              <Fig label={tr('Actual COGS')} value={formatCurrency(Math.round(t.actualCogs))}>
                <StatusBadge status={cogsStatus(t, basis)} value={pctText(cogsPct(t, basis, 'actual'))} />
              </Fig>
              <Fig label={tr('Theoretical COGS')} value={formatCurrency(Math.round(t.theoreticalCogs))}>
                <span className="text-xs text-slate-500">{pctText(cogsPct(t, basis, 'theoretical'))} {tr('· recipes')}</span>
              </Fig>
              <Fig label={tr('Usage ratio')} value={t.hasOpname ? pctText(t.usageRatio) : '–'}>
                <StatusBadge status={t.status.gapNet} value={gap === null ? '–' : `${gap > 0 ? '+' : ''}${fixed(gap, 1)} pp`} />
              </Fig>
              <Fig label={tr('Stock variance')} value={formatCurrency(Math.round(t.variance))}>
                <span className="text-xs text-slate-500">{tr('other usage')} {formatCurrency(Math.round(t.otherUsage))}</span>
              </Fig>
              <Fig label={tr('Purchases')} value={formatCurrency(Math.round(t.purchases))}>
                <span className="text-xs text-slate-500">{tr('received in the period')}</span>
              </Fig>
              <Fig label={tr('Next 7 days (est.)')} value={forecast.data ? formatCurrency(Math.round(forecast.data.totals.spend7)) : '…'}>
                <span className="text-xs text-slate-500">{forecast.data ? tr('1 month {0}', formatCurrency(Math.round(forecast.data.totals.spend30))) : tr('purchase forecast')}</span>
              </Fig>
            </dl>
            <div className="min-w-0 space-y-2 lg:col-span-5">
              <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
                {counts.map(({ s, n }) => n ? <div key={s} style={{ width: `${(n / active.length) * 100}%`, background: STATUS[s].dot }} className="border-r-2 border-white last:border-r-0" /> : null)}
              </div>
              <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
                {counts.map(({ s, n }) => (
                  <span key={s} className="inline-flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: STATUS[s].dot }} aria-hidden />{STATUS[s].label} {n}
                  </span>
                ))}
              </p>
              <p className="pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{tr('Highest COGS')}</p>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-100">
                {attention.map(o => (
                  <li key={o.branchCode} className="flex items-center gap-2 px-3 py-2 text-xs">
                    <span className="min-w-0 flex-1 truncate font-medium text-slate-800" title={o.branchName}>{o.branchName}</span>
                    <StatusBadge status={cogsStatus(o, basis)} value={pctText(cogsPct(o, basis, 'actual'))} />
                    <StatusBadge status={o.status.usage} value={o.hasOpname ? pctText(o.usageRatio) : 'no opname'} title={tr('Usage ratio')} />
                  </li>
                ))}
              </ul>
            </div>
          </div>
        );
      }}
    </Card>
  );
}

function Fig({ label, value, children }: { label: string; value: string; children?: React.ReactNode }) {
  return (
    <div className="min-w-0 bg-white px-3 py-3">
      <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{label}</dt>
      <dd className="mt-1 truncate text-base font-semibold tabular-nums text-slate-900" title={value}>{value}</dd>
      {children && <dd className="mt-1">{children}</dd>}
    </div>
  );
}
