// How far Cost Control figures can be trusted, per outlet and for the network: combines the
// summary (pending opnames, implausible lines left out, opname coverage) with the Data quality
// checks (/api/cost-control/issues) of the same date range.

import { IssuesResponse, OutletCost } from './costControl';
import { formatCurrency, formatNumber } from './format';

export type Reliability = 'final' | 'provisional' | 'check';

export const RELIABILITY: Record<Reliability, { label: string; text: string; bg: string; ring: string; dot: string }> = {
  final: { label: 'Final', text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200', dot: '#16a34a' },
  provisional: { label: 'Provisional', text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200', dot: '#d97706' },
  check: { label: 'Check data', text: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200', dot: '#dc2626' },
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
    reasons.push({ level: 'check', text: `${o.excludedPendingLines} impossible opname line(s) left out of actual COGS (${formatCurrency(Math.round(o.excludedPendingVariance))}) — wrong system stock in ESB` });
  }
  if (issues) {
    for (const s of issues.stockSpikes.filter(x => x.branchCode === code)) {
      const out = s.direction === 'out';
      reasons.push({
        level: 'check',
        text: s.open
          ? (out
            ? `Phantom stock going out still in ESB: ${s.productName} ${qty(s.inQty)} taken out (usual ${qty(s.usualInQty)} a week) — book stock now ${qty(s.latestEndQty)}`
            : `Phantom stock still in ESB: ${s.productName} ${qty(s.latestEndQty)} (usual inflow ${qty(s.usualInQty)} a week) — the next opname will show a large loss`)
          : `HPP distorted by phantom stock (${out ? 'going out' : 'coming in'}): ${s.productName}, period from ${s.periodStart}`,
      });
    }
    for (const n of (issues.bookStock?.items ?? []).filter(x => x.branchCode === code)) {
      if (issues.stockSpikes.some(x => x.branchCode === code && x.productId === n.productId && x.open)) continue;  // already listed above
      reasons.push({ level: 'check', text: `Negative book stock: ${n.productName} ${qty(n.qty)} (${formatCurrency(Math.round(n.value))}) — more recorded going out than coming in` });
    }
    const wrong = issues.quantityErrors.filter(x => x.branchCode === code);
    const stockIn = wrong.filter(x => STOCK_IN.has(x.module));
    if (stockIn.length) {
      reasons.push({ level: 'check', text: `${stockIn.length} production/receipt document(s) with an impossible quantity (e.g. ${stockIn[0].docNum}: ${qty(stockIn[0].qty)} ${stockIn[0].unit})` });
    }
    if (wrong.length > stockIn.length) {
      const j = wrong.find(x => !STOCK_IN.has(x.module))!;
      reasons.push({ level: 'check', text: `${wrong.length - stockIn.length} item journal line(s) far above usual (e.g. ${j.productName} ${qty(j.qty)} ${j.unit}) — confirm or correct` });
    }
    for (const h of issues.hppAnomalies.filter(x => x.branchCode === code)) {
      reasons.push({ level: 'check', text: `HPP anomaly: ${h.productName} at ${formatCurrency(Math.round(h.hpp))}/${h.unit ?? 'unit'} vs network ${formatCurrency(Math.round(h.medianHpp))} (≈ ${formatCurrency(Math.round(h.impact))} too much COGS)` });
    }
  }
  if (o.pendingOpnameCount > 0) {
    reasons.push({ level: 'provisional', text: `${o.pendingOpnameCount} stock opname(s) not posted in ESB yet — the stock variance can still change` });
  }
  if (!o.hasOpname) {
    reasons.push({ level: 'provisional', text: 'No stock opname in this range — actual COGS is recipes + item journals only; usage vs recipes cannot be measured' });
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
