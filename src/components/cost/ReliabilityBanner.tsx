'use client';

import { AlertTriangle, ArrowRight, BookOpen, CheckCircle2, Clock } from 'lucide-react';
import InfoTip from '@/components/ui/InfoTip';
import { Freshness, IssuesResponse, SummaryResponse } from '@/lib/costControl';
import { NetworkReliability, Reliability, RELIABILITY, RELIABILITY_ORDER } from '@/lib/costReliability';
import { formatCurrency, formatDateTime, formatNumber } from '@/lib/format';

const ICON: Record<Reliability, typeof CheckCircle2> = { final: CheckCircle2, provisional: Clock, check: AlertTriangle };

export function ReliabilityPill({ level, compact = false }: { level: Reliability; compact?: boolean }) {
  const r = RELIABILITY[level];
  const Icon = ICON[level];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${r.bg} ${r.text} ${r.ring}`}>
      <Icon size={12} aria-hidden />{compact ? null : r.label}
      {compact && <span className="sr-only">{r.label}</span>}
    </span>
  );
}

/**
 * First thing on the page: can these figures be trusted yet, and why not. Counts outlets by
 * reliability and lists what makes figures provisional or wrong, with the way to Data quality.
 */
export default function ReliabilityBanner({ summary, issues, network, freshness, onShowIssues, onShowGuide }: {
  summary: SummaryResponse;
  issues: IssuesResponse | null;
  network: NetworkReliability;
  freshness?: Freshness;
  onShowIssues: () => void;
  onShowGuide: () => void;
}) {
  const t = summary.total;
  const { counts, outlets, level } = network;
  const pendingOutlets = summary.outlets.filter(o => o.pendingOpnameCount > 0 && (o.netSales > 0 || o.subtotal > 0)).length;
  const noOpname = summary.outlets.filter(o => !o.hasOpname && (o.netSales > 0 || o.subtotal > 0)).length;
  const spikesOpen = issues?.stockSpikes.filter(s => s.open).length ?? 0;
  const headline = {
    final: 'Figures are final',
    provisional: 'Figures are provisional',
    check: 'Some figures need a data check',
  }[level];
  const sentence = {
    final: 'Every stock opname in this range is posted in ESB and no data issue touches these outlets.',
    provisional: `${formatNumber(pendingOutlets)} outlet(s) still have stock opnames that are not posted in ESB. Their stock variance — and so actual COGS — can still change.`,
    check: `${formatNumber(counts.check)} outlet(s) have data errors in ESB that distort their figures${counts.provisional ? `, ${formatNumber(counts.provisional)} more are provisional` : ''}. Fix them in ESB; the portal updates after the nightly sync.`,
  }[level];

  const items: { tone: 'red' | 'amber' | 'slate'; text: string }[] = [];
  if (t.excludedPendingLines > 0) {
    items.push({ tone: 'red', text: `${formatNumber(t.excludedPendingLines)} impossible opname line(s) left out of actual COGS (${formatCurrency(Math.round(t.excludedPendingVariance))})` });
  }
  if (issues?.quantityErrors.length) {
    items.push({ tone: 'red', text: `${formatNumber(issues.quantityErrors.length)} ESB document line(s) with an impossible quantity (e.g. grams typed into KG)` });
  }
  if (issues?.stockSpikes.length) {
    items.push({ tone: 'red', text: `${formatNumber(issues.stockSpikes.length)} period(s) with phantom stock${spikesOpen ? ` — ${spikesOpen} still in stock` : ''}` });
  }
  const neg = issues?.bookStock;
  if (neg && neg.negative < -0.5) {
    const top = neg.items[0];
    items.push({ tone: 'red', text: `Negative book stock ${formatCurrency(Math.round(neg.negative))}${top ? ` — largest: ${top.productName} at ${top.locationName.replace(/^Kopi Calf (To Go )?/, '')} ${formatCurrency(Math.round(top.value))}` : ''}` });
  }
  if (issues?.hppAnomalies.length) {
    items.push({ tone: 'red', text: `${formatNumber(issues.hppAnomalies.length)} HPP anomaly(ies) in the ESB valuation` });
  }
  if (issues?.usageSpikes.length) {
    items.push({ tone: 'amber', text: `${formatNumber(issues.usageSpikes.length)} recipe (BOM) usage spike(s)` });
  }
  if (t.pendingOpnameCount > 0) {
    items.push({ tone: 'amber', text: `${formatNumber(t.pendingOpnameCount)} stock opname(s) still Draft/New in ESB (pending variance ${formatCurrency(Math.round(t.pendingVariance))})` });
  }
  if (noOpname > 0) {
    items.push({ tone: 'amber', text: `${formatNumber(noOpname)} outlet(s) without a stock opname in this range — usage vs recipes not measurable` });
  }
  if (summary.withoutSales.length) {
    items.push({ tone: 'slate', text: `${formatNumber(summary.withoutSales.length)} bulk-order / stock location(s) without POS sales are kept out of the totals` });
  }

  const r = RELIABILITY[level];
  const Icon = ICON[level];
  return (
    <section aria-label="Data reliability" className={`rounded-xl border bg-white ${level === 'final' ? 'border-emerald-200' : level === 'provisional' ? 'border-amber-200' : 'border-red-200'}`}>
      <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-start lg:gap-6">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${r.bg} ${r.text}`}><Icon size={18} aria-hidden /></span>
            <h2 className="text-sm font-semibold text-slate-900 sm:text-base">{headline}</h2>
            <InfoTip info="costReliability" />
          </div>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">{sentence}</p>
          {items.length > 0 && (
            <ul className="mt-3 grid gap-x-6 gap-y-1.5 text-xs text-slate-600 md:grid-cols-2">
              {items.map(i => (
                <li key={i.text} className="flex gap-2">
                  <span className={`mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full ${i.tone === 'red' ? 'bg-red-500' : i.tone === 'amber' ? 'bg-amber-500' : 'bg-slate-400'}`} aria-hidden />
                  {/* a typographic minus: browsers may break a line after "-" */}
                  <span>{i.text.replace(/-Rp/g, '\u2212Rp').replace(/Rp (?=\d)/g, 'Rp\u00a0')}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="w-full flex-shrink-0 lg:w-80">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Outlets by data status</p>
          <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden>
            {RELIABILITY_ORDER.map(l => counts[l] ? (
              <div key={l} style={{ width: `${(counts[l] / Math.max(outlets, 1)) * 100}%`, background: RELIABILITY[l].dot }} className="border-r-2 border-white last:border-r-0" />
            ) : null)}
          </div>
          <ul className="mt-2 space-y-1 text-xs">
            {RELIABILITY_ORDER.map(l => (
              <li key={l} className="flex items-center justify-between gap-2">
                <ReliabilityPill level={l} />
                <span className="tabular-nums text-slate-700">{formatNumber(counts[l])} of {formatNumber(outlets)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-500 sm:px-5">
        <span>
          ESB valuation synced {freshness?.valuationSyncedAt ? formatDateTime(freshness.valuationSyncedAt) : '–'}
          {' '}· recalculated {freshness?.refreshedAt ? formatDateTime(freshness.refreshedAt) : '–'} · updates nightly (05:10 WIB)
        </span>
        <span className="flex flex-wrap gap-1.5">
          <button type="button" onClick={onShowGuide} className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 font-medium text-slate-600 hover:bg-slate-50">
            <BookOpen size={12} /> How to read this page
          </button>
          {level !== 'final' && (
            <button type="button" onClick={onShowIssues} className="inline-flex h-7 items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 font-medium text-white hover:bg-slate-800">
              What to fix in ESB <ArrowRight size={12} />
            </button>
          )}
        </span>
      </div>
    </section>
  );
}
