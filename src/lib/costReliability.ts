// How far Cost Control figures can be trusted, per outlet and for the network: combines the
// summary (pending opnames, implausible lines left out, opname coverage) with the Data quality
// checks (/api/cost-control/issues) of the same date range.

import { IssuesResponse, OutletCost } from './costControl';
import { formatCurrency, formatNumber } from './format';
import { tr } from './i18n';

export type Reliability = 'final' | 'provisional' | 'check';

export const RELIABILITY: Record<Reliability, { label: string; text: string; bg: string; ring: string; dot: string }> = {
  final: { get label() { return tr('Final'); }, text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200', dot: '#16a34a' },
  provisional: { get label() { return tr('Provisional'); }, text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200', dot: '#d97706' },
  check: { get label() { return tr('Check data'); }, text: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200', dot: '#dc2626' },
};

export const RELIABILITY_ORDER: Reliability[] = ['final', 'provisional', 'check'];

export interface Reason {
  level: Exclude<Reliability, 'final'>;
  text: string;
}

export interface OutletReliability {
  level: Reliability;
  reasons: Reason[];
}

/** documents that bring stock in: a wrong quantity there creates phantom stock */
const STOCK_IN = new Set(['simple_manufacturing', 'simple_purchase', 'goods_receipt', 'goods_delivery', 'simple_transfer']);
const qty = (v: number) => formatNumber(Math.round(v));

export function outletReliability(o: OutletCost, issues: IssuesResponse | null): OutletReliability {
  const reasons: Reason[] = [];
  const code = o.branchCode;
  if (o.excludedPendingLines > 0) {
    reasons.push({ level: 'check', text: tr('{0} impossible opname line(s) left out of actual COGS ({1}) — wrong system stock in ESB', o.excludedPendingLines, formatCurrency(Math.round(o.excludedPendingVariance))) });
  }
  if (issues) {
    for (const s of issues.stockSpikes.filter(x => x.branchCode === code)) {
      const out = s.direction === 'out';
      reasons.push({
        level: 'check',
        text: s.open
          ? (out
            ? tr('Phantom stock going out still in ESB: {0} {1} taken out (usual {2} a week) — book stock now {3}', s.productName, qty(s.inQty), qty(s.usualInQty), qty(s.latestEndQty))
            : tr('Phantom stock still in ESB: {0} {1} (usual inflow {2} a week) — the next opname will show a large loss', s.productName, qty(s.latestEndQty), qty(s.usualInQty)))
          : tr('HPP distorted by phantom stock ({0}): {1}, period from {2}', out ? tr('going out') : tr('coming in'), s.productName, s.periodStart),
      });
    }
    for (const n of (issues.bookStock?.items ?? []).filter(x => x.branchCode === code)) {
      if (issues.stockSpikes.some(x => x.branchCode === code && x.productId === n.productId && x.open)) continue;  // already listed above
      reasons.push({ level: 'check', text: tr('Negative book stock: {0} {1} ({2}) — more recorded going out than coming in', n.productName, qty(n.qty), formatCurrency(Math.round(n.value))) });
    }
    const wrong = issues.quantityErrors.filter(x => x.branchCode === code);
    const stockIn = wrong.filter(x => STOCK_IN.has(x.module));
    if (stockIn.length) {
      reasons.push({ level: 'check', text: tr('{0} production/receipt document(s) with an impossible quantity (e.g. {1}: {2} {3})', stockIn.length, stockIn[0].docNum, qty(stockIn[0].qty), stockIn[0].unit) });
    }
    if (wrong.length > stockIn.length) {
      const j = wrong.find(x => !STOCK_IN.has(x.module))!;
      reasons.push({ level: 'check', text: tr('{0} item journal line(s) far above usual (e.g. {1} {2} {3}) — confirm or correct', wrong.length - stockIn.length, j.productName, qty(j.qty), j.unit) });
    }
    for (const h of issues.hppAnomalies.filter(x => x.branchCode === code)) {
      reasons.push({ level: 'check', text: tr('HPP anomaly: {0} at {1}/{2} vs network {3} (≈ {4} too much COGS)', h.productName, formatCurrency(Math.round(h.hpp)), h.unit ?? 'unit', formatCurrency(Math.round(h.medianHpp)), formatCurrency(Math.round(h.impact))) });
    }
  }
  if (o.pendingOpnameCount > 0) {
    reasons.push({ level: 'provisional', text: tr('{0} stock opname(s) not posted in ESB yet — the stock variance can still change', o.pendingOpnameCount) });
  }
  if (!o.hasOpname) {
    reasons.push({ level: 'provisional', text: tr('No stock opname in this range — actual COGS is recipes + item journals only; usage vs recipes cannot be measured') });
  }
  const level: Reliability = reasons.some(r => r.level === 'check') ? 'check' : reasons.length ? 'provisional' : 'final';
  return { level, reasons };
}

export interface NetworkReliability {
  level: Reliability;
  counts: Record<Reliability, number>;
  outlets: number;
  byOutlet: Map<string, OutletReliability>;
}

export function networkReliability(outlets: OutletCost[], issues: IssuesResponse | null): NetworkReliability {
  const counts: Record<Reliability, number> = { final: 0, provisional: 0, check: 0 };
  const byOutlet = new Map<string, OutletReliability>();
  for (const o of outlets) {
    if (o.netSales <= 0 && o.subtotal <= 0) continue;
    const r = outletReliability(o, issues);
    byOutlet.set(o.branchCode, r);
    counts[r.level] += 1;
  }
  const level: Reliability = counts.check ? 'check' : counts.provisional ? 'provisional' : 'final';
  return { level, counts, outlets: byOutlet.size, byOutlet };
}
