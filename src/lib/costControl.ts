'use client';

// Cost Control data layer: types of /api/cost-control/* (integrated_portal_be,
// app/routes/cost_control.py), a fetch hook and the status scale.

import { useEffect, useRef, useState } from 'react';
import { useRealtime } from './realtime';
import { Resource } from './overview';

export type Status = 'good' | 'warning' | 'serious' | 'critical';
export type Basis = 'net' | 'subtotal';

export interface Bands {
  good: number;
  warning: number;
  serious: number;
}

export interface CostSettings {
  cogs_bands: Bands;
  usage_bands: Bands;
  variance_bands: Bands;
  waste_bands: Bands;
  forecast: { lookback_days: number; safety_days: number; trend_cap_pct: number };
}

export interface Freshness {
  dataFrom: string | null;
  dataTo: string | null;
  refreshedAt: string | null;
  valuationSyncedAt: string | null;
}

export interface CostMetrics {
  bills: number;
  netSales: number;
  subtotal: number;
  otherCostSubtotal: number;
  beginValue: number;
  endValue: number;
  purchases: number;
  transfersIn: number;
  transfersOut: number;
  theoreticalCogs: number;
  actualCogs: number;
  otherUsage: number;
  manufacturingNet: number;
  postedVariance: number;
  pendingVariance: number;
  variance: number;
  opnameCount: number;
  pendingOpnameCount: number;
  lastOpnameDate: string | null;
  /** implausible lines of unposted opnames, left out of actual COGS (see /issues) */
  excludedPendingVariance: number;
  excludedPendingLines: number;
  hasOpname: boolean;
  theoreticalPctNet: number | null;
  actualPctNet: number | null;
  theoreticalPctSubtotal: number | null;
  actualPctSubtotal: number | null;
  wastePctNet: number | null;
  wastePctSubtotal: number | null;
  variancePctNet: number | null;
  usageRatio: number | null;
  gapPpNet: number | null;
  gapPpSubtotal: number | null;
  status: {
    cogsNet: Status | null;
    cogsSubtotal: Status | null;
    theoreticalNet: Status | null;
    theoreticalSubtotal: Status | null;
    usage: Status | null;
    gapNet: Status | null;
    waste: Status | null;
  };
}

export interface OutletCost extends CostMetrics {
  branchCode: string;
  branchName: string;
  periods: number;
}

export interface SummaryResponse {
  filters: { dateFrom: string; dateTo: string };
  periods: { start: string; end: string }[];
  settings: CostSettings;
  total: CostMetrics;
  medians: Record<'actualPctNet' | 'actualPctSubtotal' | 'theoreticalPctNet' | 'theoreticalPctSubtotal' | 'usageRatio' | 'wastePctNet', number | null>;
  statusCounts: Partial<Record<Status | 'none', number>>;
  outlets: OutletCost[];
  /** stock locations with usage but no POS sales: not in the network totals */
  withoutSales: { branchCode: string; branchName: string; actualCogs: number; theoreticalCogs: number }[];
  freshness: Freshness;
}

export interface IssuesResponse {
  filters: { dateFrom: string; dateTo: string; branch: string | null };
  rule: { floor: number; share: number };
  suspectLines: {
    branchCode: string; branchName: string; docNum: string; docDate: string; status: string; productId: string; productName: string;
    physicalQty: number; systemQty: number; hpp: number; variance: number; periodTheoreticalCogs: number;
  }[];
  pendingOpnames: { branchCode: string; branchName: string; docNum: string; docDate: string; status: string; lines: number }[];
  withoutSales: { branchCode: string; branchName: string; actualCogs: number }[];
  /** outlet HPP of an item > 3x the network median in the period (ESB valuation) */
  hppAnomalies: {
    branchCode: string; branchName: string; periodStart: string; productId: string; productName: string; unit: string | null;
    qty: number; hpp: number; medianHpp: number; impact: number;
  }[];
  /** item usage per Rp of sales in a month > 3x its median month (recipe / BOM) */
  usageSpikes: { month: string; productId: string; productName: string; unit: string | null; qty: number; value: number; factor: number }[];
}

export interface TrendResponse {
  filters: { dateFrom: string; dateTo: string; branch: string | null; grain: 'period' | 'month' };
  series: (CostMetrics & { start: string; end: string })[];
}

export interface CostItem {
  productId: string;
  productCode: string | null;
  productName: string;
  category: string | null;
  unit: string | null;
  purchaseQty: number;
  purchaseValue: number;
  theoreticalQty: number;
  theoreticalValue: number;
  otherQty: number;
  otherValue: number;
  varianceQty: number;
  varianceValue: number;
  actualQty: number;
  actualValue: number;
  usageRatio: number | null;
  status: Status | null;
}

export interface ItemsResponse {
  filters: { dateFrom: string; dateTo: string; branch: string | null };
  items: CostItem[];
}

export interface ForecastOutlet {
  branchCode: string;
  branchName: string;
  trendFactor: number;
  lookbackDays: number;
  avgWeeklyPurchases: number;
  spend7: number;
  spend14: number;
  spend30: number;
  items: number;
}

export interface ForecastItem {
  productId: string;
  productCode: string | null;
  productName: string;
  category: string | null;
  unit: string | null;
  dailyUsage: number;
  stock: number;
  unitCost: number;
  basedOn: 'actual' | 'plan';
  need7: number;
  need14: number;
  need30: number;
  spend7: number;
  spend14: number;
  spend30: number;
}

export interface ForecastResponse {
  branch: string | null;
  asOf: string;
  horizons: number[];
  settings: CostSettings['forecast'];
  totals: { avgWeeklyPurchases: number; spend7: number; spend14: number; spend30: number };
  outlets: ForecastOutlet[];
  items: ForecastItem[];
}

export interface MetaResponse {
  settings: CostSettings;
  freshness: Freshness;
  periods: { period_start: string; period_end: string }[];
}

/** Fetch /api/cost-control/<path>; refetches silently when the aggregates change. */
export function useCostControl<T>(path: string, query: string, enabled = true): Resource<T> {
  const { aggregatesRefreshedAt, ready } = useRealtime();
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({ data: null, loading: true, error: null });
  const [attempt, setAttempt] = useState(0);
  const lastRequest = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !enabled) return;
    const request = `${path}?${query}#${attempt}`;
    const silent = lastRequest.current === request;
    lastRequest.current = request;
    const controller = new AbortController();
    if (!silent) setState(s => ({ ...s, loading: true, error: null }));
    const params = [query, aggregatesRefreshedAt ? `v=${encodeURIComponent(aggregatesRefreshedAt)}` : ''].filter(Boolean).join('&');
    fetch(`/api/cost-control/${path}${params ? `?${params}` : ''}`, { signal: controller.signal })
      .then(async res => {
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        setState({ data: body as T, loading: false, error: null });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) return;
        setState(s => ({ ...s, loading: false, error: error.message || 'Request failed' }));
      });
    return () => controller.abort();
  }, [path, query, attempt, aggregatesRefreshedAt, ready, enabled]);

  return { ...state, retry: () => setAttempt(a => a + 1) };
}

/* ------------------------------------------------------------------ status */

export const STATUS: Record<Status, { label: string; text: string; bg: string; ring: string; dot: string }> = {
  good: { label: 'Good', text: 'text-emerald-700', bg: 'bg-emerald-50', ring: 'ring-emerald-200', dot: '#16a34a' },
  warning: { label: 'Watch', text: 'text-amber-700', bg: 'bg-amber-50', ring: 'ring-amber-200', dot: '#d97706' },
  serious: { label: 'High', text: 'text-orange-700', bg: 'bg-orange-50', ring: 'ring-orange-200', dot: '#ea580c' },
  critical: { label: 'Critical', text: 'text-red-700', bg: 'bg-red-50', ring: 'ring-red-200', dot: '#dc2626' },
};

export const STATUS_ORDER: Status[] = ['good', 'warning', 'serious', 'critical'];

export function cogsPct(m: CostMetrics, basis: Basis, kind: 'actual' | 'theoretical'): number | null {
  if (kind === 'actual') return basis === 'net' ? m.actualPctNet : m.actualPctSubtotal;
  return basis === 'net' ? m.theoreticalPctNet : m.theoreticalPctSubtotal;
}

export function cogsStatus(m: CostMetrics, basis: Basis): Status | null {
  return basis === 'net' ? m.status.cogsNet : m.status.cogsSubtotal;
}

export function sales(m: CostMetrics, basis: Basis): number {
  return basis === 'net' ? m.netSales : m.subtotal;
}

export const pctText = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? '–' : `${v.toFixed(digits)}%`);

export function bandText(b: Bands, unit = '%'): string[] {
  return [`≤ ${b.good}${unit}`, `${b.good}–${b.warning}${unit}`, `${b.warning}–${b.serious}${unit}`, `> ${b.serious}${unit}`];
}

/** "1–7 Oct 2026" */
export function periodLabel(start: string, end: string): string {
  const s = new Date(`${start}T00:00:00`);
  const e = new Date(`${end}T00:00:00`);
  const sameMonth = s.getMonth() === e.getMonth();
  const left = s.toLocaleDateString('en-GB', { day: 'numeric', ...(sameMonth ? {} : { month: 'short' }) });
  return `${left}–${e.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}
