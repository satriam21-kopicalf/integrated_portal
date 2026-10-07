'use client';

// Overview page data layer: types of /api/overview/* (integrated_portal_be,
// app/routes/overview.py), a fetch hook and the fixed channel palette.

import { useEffect, useRef, useState } from 'react';
import { useRealtime } from './realtime';

export interface OverviewFilters {
  from: string;
  to: string;
  days: number;
  /** comparison period: the same length just before, or the one chosen with compareFrom/compareTo (custom) */
  previous: { from: string; to: string; complete: boolean; custom?: boolean; days?: number };
  branch: string | null;
  channels: string[];
}

export interface Freshness {
  dataFrom: string | null;
  dataTo: string | null;
  lastSyncedAt: string | null;
  refreshedAt: string | null;
}

export interface Kpi {
  value: number;
  previous: number;
  deltaPct: number | null;
}

export interface KpisResponse {
  filters: OverviewFilters;
  kpis: Record<'sales' | 'nettSales' | 'bills' | 'avgTicket', Kpi>;
  daily: { date: string; subtotal: number; nettSales: number; bills: number; avgTicket: number | null }[];
  freshness: Freshness;
}

export type Granularity = 'hour' | 'day' | 'week' | 'month';

export interface TrendPoint {
  date: string;
  /** granularity "hour": hour of the day (one day, e.g. day vs day) */
  hour?: number;
  days: number;
  subtotal: number;
  /** not kept per hour (null for granularity "hour") */
  nettSales: number | null;
  bills: number;
  discountPct: number | null;
  previous: { subtotal: number; nettSales: number | null; bills: number };
  /** this period per channel (the "By channel" chart) */
  channels: Record<string, { subtotal: number; bills: number }>;
}

export interface TrendResponse {
  filters: OverviewFilters;
  granularity: Granularity;
  series: TrendPoint[];
}

export interface ChannelRow {
  channel: string;
  bills: number;
  subtotal: number;
  nettSales: number;
  share: number | null;
  avgTicket: number | null;
  discountPct: number | null;
  previousSubtotal: number;
  deltaPct: number | null;
}

export interface ChannelsResponse {
  filters: OverviewFilters;
  granularity: Granularity;
  channels: ChannelRow[];
  series: { date: string; days: number; values: Record<string, { subtotal: number; bills: number }> }[];
}

export interface BranchRow {
  branchCode: string;
  branchName: string;
  subtotal: number;
  nettSales: number;
  bills: number;
  activeDays: number;
  voidBills: number;
  spark: number[];
  avgTicket: number;
  subtotalPerDay: number;
  previousSubtotal: number;
  deltaPct: number | null;
  isNew: boolean;
  voidRate: number | null;
}

export interface BranchesResponse {
  filters: OverviewFilters;
  granularity: Granularity;
  buckets: string[];
  branches: BranchRow[];
}

export interface HourCell {
  dow: number; // 1 = Monday
  hour: number;
  bills: number;
  subtotal: number;
  avgBills: number;
  avgSubtotal: number;
}

export interface HourlyResponse {
  filters: OverviewFilters;
  daysPerDow: Record<string, number>;
  cells: HourCell[];
  peak: HourCell | null;
  /** the comparison period per hour, averaged per day */
  previous?: { from: string; to: string; days: number; bills: number; subtotal: number; avgBillsPerDay: number;
    hours: { hour: number; bills: number; subtotal: number; avgBills: number; avgSubtotal: number }[]; peakHour: number | null } | null;
}

export interface MenuRow {
  menuId: string;
  name: string;
  category: string;
  categoryDetail: string;
  bills: number;
  qty: number;
  subtotal: number;
  discount: number;
  share: number | null;
  previousQty?: number;
  previousSubtotal?: number;
  deltaPct?: number | null;
  qtyDeltaPct?: number | null;
}

export interface MenusResponse {
  filters: OverviewFilters;
  totals: { subtotal: number; qty: number; previousSubtotal?: number; previousQty?: number; deltaPct?: number | null };
  top: MenuRow[];
  categories: { category: string; qty: number; subtotal: number; share: number | null; previousSubtotal?: number; deltaPct?: number | null;
    details: { name: string; qty: number; subtotal: number }[] }[];
  addons: { group: string; qty: number; subtotal: number; options: { menuId: string; name: string; qty: number; subtotal: number; share: number | null }[] }[];
}

interface Bucket {
  bills: number;
  subtotal: number;
}

export interface DeductionBranch {
  branchCode: string;
  branchName: string;
  bills: number;
  voidBills: number;
  voidSubtotal: number;
  otherCostBills: number;
  otherCostSubtotal: number;
  voidRate: number;
  status: 'review' | 'normal';
}

export interface DeductionsResponse {
  filters: OverviewFilters;
  totals: Record<'sales' | 'void' | 'other_cost' | 'open' | 'gross' | 'otherCost', Bucket>;
  voidRate: number;
  threshold: number | null;
  otherCostByMethod: { method: string; bills: number; subtotal: number }[];
  branches: DeductionBranch[];
  daily: { date: string; bills: number; voidBills: number; voidSubtotal: number; otherCostSubtotal: number; voidRate: number }[];
  /** offline (Dine In, Takeaway) vs online (delivery apps, online order) */
  groups: (DeductionSplit & { group: ChannelGroup; label: string })[];
  channels: (DeductionSplit & { channel: string; group: ChannelGroup })[];
  dailyGroups: ({ date: string } & Record<'offline' | 'online', DeductionSplit>)[];
  branchGroups: ({ branchCode: string; branchName: string } & Record<'offline' | 'online', DeductionSplit>)[];
}

export type ChannelGroup = 'offline' | 'online' | 'other';

export interface DeductionSplit {
  bills: number;
  subtotal: number;
  salesBills: number;
  salesSubtotal: number;
  voidBills: number;
  voidSubtotal: number;
  otherCostBills: number;
  otherCostSubtotal: number;
  openBills: number;
  openSubtotal: number;
  /** void bills / all bills, % */
  voidRate: number;
  otherCostRate: number;
  /** void value / (sales + void value), % */
  voidValueRate: number;
  previousVoidRate?: number | null;
  previousVoidBills?: number | null;
  /** share of all void bills, % */
  voidShare?: number;
}

/** Offline / online in the categorical order (slots 1 and 2). */
export const GROUP_COLORS: Record<ChannelGroup, string> = { offline: '#2a78d6', online: '#eb6834', other: '#a8a29e' };
export const GROUP_LABELS: Record<ChannelGroup, string> = { offline: 'Offline', online: 'Online', other: 'Other' };

export interface MonthRow {
  month: string;
  days: number;
  partial: boolean;
  subtotal: number;
  nettSales: number;
  bills: number;
  branches: number;
  avgDaily: number | null;
  momPct: number | null;
  yoyPct: number | null;
  sameStore: { branches: number; growthPct: number | null };
}

export interface MonthlyResponse {
  filters: OverviewFilters;
  months: MonthRow[];
}

export interface PaymentsResponse {
  filters: OverviewFilters;
  methods: { type: string; method: string; bills: number; subtotal: number; share: number | null; billShare: number | null;
    previousSubtotal?: number; previousBills?: number; previousShare?: number | null; deltaPct?: number | null }[];
  types: { type: string; bills: number; subtotal: number; share: number | null; previousSubtotal?: number; deltaPct?: number | null }[];
  previous?: { subtotal: number; bills: number } | null;
}

export interface Basket {
  bills: number;
  linesPerBill: number | null;
  qtyPerBill: number | null;
  beverageBills: number;
  foodBills: number;
  bothBills: number;
  foodSharePct: number | null;
  foodAttachPct: number | null;
}

export interface BasketResponse {
  filters: OverviewFilters;
  granularity: Granularity;
  totals: Basket;
  previous: Basket;
  channels: (Basket & { channel: string })[];
  series: (Basket & { date: string })[];
}

export interface MetaResponse {
  channels: { channel: string; bills: number | null }[];
  defaultPeriod: { from: string; to: string };
  freshness: Freshness;
}

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * GET /api/overview/{path}?{query}. Keeps the previous data while a new request runs,
 * and re-fetches silently (no loading state) when the realtime aggregates version changes.
 */
export function useOverview<T>(path: string, query: string): Resource<T> {
  const { aggregatesRefreshedAt, ready } = useRealtime();
  const [state, setState] = useState<{ data: T | null; loading: boolean; error: string | null }>({
    data: null,
    loading: true,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);
  const lastRequest = useRef<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    const request = `${path}?${query}#${attempt}`;
    const silent = lastRequest.current === request; // only the data version changed
    lastRequest.current = request;
    const controller = new AbortController();
    if (!silent) setState(s => ({ ...s, loading: true, error: null }));
    const params = [query, aggregatesRefreshedAt ? `v=${encodeURIComponent(aggregatesRefreshedAt)}` : ''].filter(Boolean).join('&');
    fetch(`/api/overview/${path}${params ? `?${params}` : ''}`, { signal: controller.signal })
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
  }, [path, query, attempt, aggregatesRefreshedAt, ready]);

  return { ...state, retry: () => setAttempt(a => a + 1) };
}

// ---------------------------------------------------------------- channels

/** Fixed categorical order (validated palette, docs/overview-analytics.md §5.3). */
export const CHANNELS: { name: string; color: string }[] = [
  { name: 'Dine In', color: '#2a78d6' },
  { name: 'ShopeeFood', color: '#eb6834' },
  { name: 'GrabFood', color: '#1baf7a' },
  { name: 'GoFood', color: '#eda100' },
  { name: 'Takeaway', color: '#e87ba4' },
];
export const OTHER_CHANNEL = 'Other';
export const OTHER_COLOR = '#a8a29e';

export function channelColor(name: string): string {
  return CHANNELS.find(c => c.name === name)?.color ?? OTHER_COLOR;
}

/** Known channels keep their slot; anything new from ESB is folded into "Other". */
export function channelKey(name: string): string {
  return CHANNELS.some(c => c.name === name) ? name : OTHER_CHANNEL;
}

/** Display names for source channel values (filters keep using the original value). */
const CHANNEL_LABELS: Record<string, string> = { 'Esb Order': 'Online Order' };

export function channelLabel(name: string): string {
  return CHANNEL_LABELS[name] ?? name;
}

/** Integration payment codes -> readable names. */
const PAYMENT_LABELS: Record<string, string> = {
  GOFOOD_INT: 'GoFood (integrated)',
  GRABFOOD_INT: 'GrabFood (integrated)',
  SHOPEEFOOD_INT: 'ShopeeFood (integrated)',
};

export function paymentLabel(method: string | null | undefined): string {
  return method ? PAYMENT_LABELS[method] ?? method : '';
}

export function channelOrder(name: string): number {
  const i = CHANNELS.findIndex(c => c.name === name);
  return i === -1 ? CHANNELS.length : i;
}

// ---------------------------------------------------------------- helpers

export const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Rp 45.8B" / "1.2M" style. */
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

export function compactNumber(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : compact.format(value);
}

export function compactRupiah(value: number | null | undefined): string {
  return value === null || value === undefined ? '-' : `Rp ${compact.format(value)}`; // never wraps
}

export function shortDate(value: string, granularity: Granularity = 'day'): string {
  const d = new Date(`${value}T00:00:00`);
  if (granularity === 'month') return d.toLocaleDateString('en-GB', { month: 'short', year: '2-digit' });
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function longDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
  });
}

/** "+12.3%" / "−4.0%" for compact displays (null: nothing). */
export function deltaText(pct: number | null | undefined): string {
  if (pct === null || pct === undefined) return '';
  return `${pct > 0 ? '▲ +' : pct < 0 ? '▼ −' : ''}${Math.abs(pct).toFixed(1)}%`;
}

export function bucketLabel(value: string, granularity: Granularity): string {
  if (granularity === 'hour') return longDate(value);
  if (granularity === 'week') return `Week of ${shortDate(value)}`;
  if (granularity === 'month') {
    return new Date(`${value}T00:00:00`).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  return longDate(value);
}

// ---------------------------------------------------------------- drill-down endpoints

export interface HourStat {
  hour: number;
  bills: number;
  subtotal: number;
  avgBills: number;
  avgSubtotal: number;
  /** % of the period's bills in this hour */
  share: number;
}

export interface HoursProfile {
  from: string;
  to: string;
  days: number;
  complete: boolean;
  bills: number;
  subtotal: number;
  avgBillsPerDay: number;
  hours: HourStat[];
  cells: HourCell[];
  daysPerDow: Record<string, number>;
  peakHour: number | null;
}

export interface BranchHours {
  branchCode: string;
  branchName: string;
  activeDays: number;
  bills: number;
  subtotal: number;
  avgBillsPerDay: number;
  hours: HourStat[];
  peakHour: number | null;
}

export type HourlyCompareResponse =
  | { filters: OverviewFilters; mode: 'period'; current: HoursProfile; compare: HoursProfile }
  | { filters: OverviewFilters; mode: 'branches'; branches: BranchHours[] };

export interface BreakdownRow {
  key: string;
  label: string;
  bills: number;
  subtotal: number;
  nettSales: number;
  avgTicket: number | null;
  share: number | null;
  billShare: number | null;
  previousSubtotal: number | null;
  deltaPct: number | null;
}

export interface BreakdownResponse {
  filters: OverviewFilters;
  by: string;
  paymentMethod: string | null;
  txType: string;
  totals: { bills: number; subtotal: number; nettSales: number };
  rows: BreakdownRow[];
}

export interface MenuSplit {
  key: string;
  label: string;
  bills: number;
  qty: number;
  subtotal: number;
  share: number | null;
}

export interface MenuDetailResponse {
  filters: OverviewFilters;
  menu: { menuId: string; kind: string; name: string; category: string | null; categoryDetail: string | null };
  totals: {
    bills: number; qty: number; subtotal: number; discount: number; avgPrice: number | null; shareOfMenus: number | null;
    previousQty: number | null; previousSubtotal: number | null; qtyDeltaPct: number | null;
  };
  granularity: 'day' | 'month';
  series: { date: string; bills: number; qty: number; subtotal: number }[];
  branches: MenuSplit[];
  channels: MenuSplit[];
}

/** Fixed categorical order for comparing up to 8 items (validated, see dataviz reference palette). */
export const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948'];

/** `query` with some parameters set (string) or removed (null / ''). */
export function withParams(query: string, changes: Record<string, string | null | undefined>): string {
  const p = new URLSearchParams(query);
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === undefined || v === '') p.delete(k);
    else p.set(k, v);
  }
  return p.toString();
}

export const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

// ---------------------------------------------------------------- sales growth

export type GrowthBasis = 'previous' | 'lastYear' | 'sequential';

export interface GrowthPoint {
  date: string;
  days: number;
  subtotal: number;
  bills: number;
  compareSubtotal: number | null;
  compareBills: number | null;
  compareDays: number | null;
  compareFrom: string | null;
  avgPerDay: number;
  compareAvgPerDay: number | null;
  growthPct: number | null;
  /** previous / lastYear: Rp difference of the bucket; sequential: Rp difference per day */
  growthAbs: number | null;
}

export interface GrowthSplit {
  key: string;
  label: string;
  subtotal: number;
  compareSubtotal: number | null;
  bills: number;
  compareBills: number | null;
  growthAbs: number | null;
  growthPct: number | null;
  /** percentage points of the total growth explained by this row */
  contributionPp: number | null;
  status: 'new' | 'lost' | 'growing' | 'declining' | 'flat' | null;
}

export interface GrowthResponse {
  filters: OverviewFilters;
  granularity: Granularity;
  compare: { basis: GrowthBasis; from: string; to: string; complete: boolean };
  totals: {
    subtotal: number; bills: number; avgTicket: number | null;
    compareSubtotal: number | null; compareBills: number | null; compareAvgTicket: number | null;
    growthAbs: number | null; growthPct: number | null; billsGrowthPct: number | null; avgTicketGrowthPct: number | null;
    bucketsUp: number; bucketsDown: number;
  };
  series: GrowthPoint[];
  branches: GrowthSplit[];
  channels: GrowthSplit[];
}

/** Diverging pair (dataviz reference): growth blue, decline red, grey = no change. */
export const GROWTH_UP = '#2a78d6';
export const GROWTH_DOWN = '#e34948';
export const GROWTH_RAMP = ['#e34948', '#ef8a89', '#f6c3c2', '#f0efec', '#b7d3f6', '#6da7ec', '#2a78d6'];
