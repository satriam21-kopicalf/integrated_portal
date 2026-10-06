'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import TransactionDetail from '@/components/TransactionDetail';
import ExportButton from '@/components/ExportButton';
import { useFilterLog } from '@/lib/activity';
import DateRangePicker, { DatePreset } from '@/components/DateRangePicker';
import BranchFilter, { Branch, branchesLabel, splitBranches } from '@/components/BranchFilter';
import { ArrowUpCircle, ChevronRight, CircleMinus, Info, Layers, Loader2, Receipt, Search, Tag, Wallet, X } from 'lucide-react';
import { TransactionCombined } from '@/types/transactions';
import { formatCurrency, formatDate, formatNumber, formatTime, toIsoDate } from '@/lib/format';
import { Stat, StatSkeleton, StatStrip } from '@/components/StatStrip';
import { RealtimeIndicator, useRealtime } from '@/lib/realtime';

interface PaginationInfo {
  cursor: string | null;
  hasMore: boolean;
  limit: number;
}

// Same buckets as the backend (/api/summary); "sales" equals the ESB
// Sales Recapitulation Detail Report.
type TxType = 'sales' | 'void' | 'other_cost' | 'all';
const TX_TYPES: { value: TxType; label: string; short: string }[] = [
  { value: 'sales', label: 'Sales', short: 'Sales' },
  { value: 'void', label: 'Void & Cancelled', short: 'Void' },
  { value: 'other_cost', label: 'Other Cost', short: 'Other Cost' },
  { value: 'all', label: 'All Transactions', short: 'All' },
];

interface SummaryBucket {
  transactions: number;
  subtotal: number;
  nettSales: number;
  total: number;
}

interface SalesSummary {
  dateRange: { from: string; to: string };
  totals: Record<'gross' | 'void' | 'other_cost' | 'open' | 'sales', SummaryBucket>;
  otherCostByMethod: Record<string, SummaryBucket>;
}

/** Consecutive report rows of the same sale. */
interface SaleGroup {
  key: string;
  rows: TransactionCombined[];
}

const DEFAULT_LIMIT = 100;

/** The page opens on yesterday: the last complete day. */
function yesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return toIsoDate(d);
}

function salesPresets(): DatePreset[] {
  const now = new Date();
  const d = (offset: number) => {
    const x = new Date(now);
    x.setDate(x.getDate() + offset);
    return toIsoDate(x);
  };
  const y = now.getFullYear();
  const m = now.getMonth();
  return [
    { label: 'Today', from: d(0), to: d(0) },
    { label: 'Yesterday', from: d(-1), to: d(-1) },
    { label: 'Last 7 days', from: d(-7), to: d(-1) },
    { label: 'Last 30 days', from: d(-30), to: d(-1) },
    { label: 'Last 90 days', from: d(-90), to: d(-1) },
    // to date = from the 1st up to yesterday (the last complete day); on the 1st itself: today
    { label: 'Month to date', from: toIsoDate(new Date(y, m, 1)), to: now.getDate() === 1 ? d(0) : d(-1) },
    { label: 'This month (incl. today)', from: toIsoDate(new Date(y, m, 1)), to: d(0) },
    { label: 'Last month', from: toIsoDate(new Date(y, m - 1, 1)), to: toIsoDate(new Date(y, m, 0)) },
    { label: 'Year to date', from: toIsoDate(new Date(y, 0, 1)), to: now.getMonth() === 0 && now.getDate() === 1 ? d(0) : d(-1) },
  ];
}

export default function SalesPage() {
  const [data, setData] = useState<TransactionCombined[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({ cursor: null, hasMore: false, limit: DEFAULT_LIMIT });

  // Filters
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branch, setBranch] = useState(''); // branch codes separated by commas, '' = all
  const [txType, setTxType] = useState<TxType>('sales');
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  // dates are set on mount (yesterday in the browser's timezone), fetching waits for that
  const [datesReady, setDatesReady] = useState(false);
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [newData, setNewData] = useState(false);
  const { salesSyncedAt, ready: realtimeReady } = useRealtime();
  const syncedRef = useRef<string | null>(null);
  const version = salesSyncedAt ? `&v=${encodeURIComponent(salesSyncedAt)}` : '';

  const [selectedTransaction, setSelectedTransaction] = useState<TransactionCombined | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  // Ignore responses from requests that were superseded by a newer one
  const requestIdRef = useRef(0);

  useEffect(() => {
    const day = yesterday();
    setDateFrom(day);
    setDateTo(day);
    setDatesReady(true);
  }, []);

  useEffect(() => {
    fetch('/api/branches')
      .then(res => (res.ok ? res.json() : []))
      .then(setBranches)
      .catch(error => console.error('Error fetching branches:', error))
      .finally(() => setBranchesLoading(false));
  }, []);

  const fetchData = useCallback(async (cursor: string | null = null, silent = false) => {
    if (!isMounted.current) return;
    const requestId = ++requestIdRef.current;
    if (cursor) setLoadingMore(true);
    else if (!silent) setLoading(true);
    setLoadError(null);

    try {
      const params = new URLSearchParams({ limit: String(DEFAULT_LIMIT), cache: 'false', type: txType });
      if (cursor) params.append('cursor', cursor);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (branch) params.append('branch', branch);

      const res = await fetch(`/api/transactions?${params}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);

      if (isMounted.current && requestId === requestIdRef.current) {
        setData(prev => (cursor ? [...prev, ...(result.data || [])] : result.data || []));
        setPagination(result.pagination || { cursor: null, hasMore: false, limit: DEFAULT_LIMIT });
        setPagesLoaded(n => (cursor ? n + 1 : 1));
        if (!cursor) setNewData(false);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      if (isMounted.current && requestId === requestIdRef.current) {
        setLoadError(error instanceof Error ? error.message : 'Unknown error');
      }
    } finally {
      if (isMounted.current && requestId === requestIdRef.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [debouncedSearch, dateFrom, dateTo, branch, txType]);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  // Refetch from the first page whenever a filter changes (fetchData changes with them)
  useEffect(() => {
    if (!datesReady || !realtimeReady) return;
    fetchData(null);
  }, [fetchData, datesReady, realtimeReady]);

  // New data synced (realtime): the first page reloads silently; when more pages are
  // loaded the reader's place is kept and a "new transactions" notice is shown instead.
  useEffect(() => {
    if (!salesSyncedAt) return;
    const previous = syncedRef.current;
    syncedRef.current = salesSyncedAt;
    if (!previous || previous === salesSyncedAt || !datesReady) return;
    if (pagesLoaded <= 1) fetchData(null, true);
    else setNewData(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salesSyncedAt]);

  // Gross / deductions / sales summary for the selected period and branch
  useEffect(() => {
    if (!datesReady || !realtimeReady) return;
    let cancelled = false;
    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    if (branch) params.append('branch', branch);
    setSummaryLoading(true);
    fetch(`/api/summary?${params}${version}`)
      .then(res => (res.ok ? res.json() : null))
      .then(result => { if (!cancelled) setSummary(result); })
      .catch(error => console.error('Error fetching summary:', error))
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, branch, version, datesReady, realtimeReady]);

  const handleSearchChange = (value: string) => {
    setSearch(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => setDebouncedSearch(value), 400);
  };

  const clearSearch = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setSearch('');
    setDebouncedSearch('');
  };

  // an empty range ("Clear") goes back to the default day
  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from || to || yesterday());
    setDateTo(to || from || yesterday());
  };

  const clearFilters = () => {
    clearSearch();
    setDateFrom(yesterday());
    setDateTo(yesterday());
    setBranch('');
    setTxType('sales');
  };

  const branchName = (code: string) => branches.find(b => b.branch_code === code)?.branch_name || code;
  const typeInfo = TX_TYPES.find(t => t.value === txType) ?? TX_TYPES[0];
  const periodLabel = summary
    ? `${formatDate(summary.dateRange.from)} – ${formatDate(summary.dateRange.to)}`
    : dateFrom ? `${formatDate(dateFrom)} – ${formatDate(dateTo || dateFrom)}` : 'Yesterday';
  const branchLabel = branchesLabel(branch, branches);

  useFilterLog(
    '/sales',
    datesReady ? { dateFrom, dateTo, branches: splitBranches(branch), type: txType, search: debouncedSearch || null } : null,
    `Filter Sales: ${dateFrom ? `${formatDate(dateFrom)} – ${formatDate(dateTo || dateFrom)}` : 'default'} · ${branchLabel} · ${typeInfo.label}`
      + (debouncedSearch ? ` · cari "${debouncedSearch}"` : ''),
  );

  const typeCounts: Record<TxType, number | undefined> = {
    sales: summary?.totals.sales.transactions,
    void: summary?.totals.void.transactions,
    other_cost: summary?.totals.other_cost.transactions,
    all: summary?.totals.gross.transactions,
  };

  const groups = useMemo<SaleGroup[]>(() => {
    const out: SaleGroup[] = [];
    for (const row of data) {
      const last = out[out.length - 1];
      if (last && last.key === row.sales_num) last.rows.push(row);
      else out.push({ key: row.sales_num, rows: [row] });
    }
    return out;
  }, [data]);

  const defaultDates = dateFrom === yesterday() && dateTo === yesterday();
  const hasChips = Boolean(!defaultDates || branch || txType !== 'sales' || debouncedSearch);
  const initialLoading = loading && data.length === 0;
  const refreshing = loading && data.length > 0;

  return (
    <DashboardLayout>
      <div className="min-h-full bg-slate-50">
        <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-lg font-semibold text-slate-900 sm:text-xl">Sales Transactions</h1>
              <p className="truncate text-xs text-slate-500 sm:text-sm">
                {periodLabel} · {branchLabel}
              </p>
            </div>
            <RealtimeIndicator />
          </div>
        </header>

        <div className="space-y-4 p-4 sm:p-6">
          <SummaryStrip summary={summary} loading={summaryLoading} />

          {/* Transactions card */}
          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {/* Toolbar */}
            <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:flex-row sm:items-center sm:p-4">
              <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search sales no., bill no. or branch"
                  value={search}
                  onChange={e => handleSearchChange(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-9 pr-9 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/5"
                />
                {search && (
                  <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700" aria-label="Clear search">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-end gap-2">
                <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={handleDateChange} presets={salesPresets} defaultLabel="yesterday" />
                <BranchFilter branches={branches} loading={branchesLoading} value={branch} onChange={setBranch} />
                <ExportButton
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  branch={branch}
                  branchLabel={branchLabel}
                  txType={txType}
                  typeLabel={typeInfo.label}
                />
              </div>
            </div>

            {/* Transaction type tabs */}
            <div className="flex gap-1 overflow-x-auto border-b border-slate-200 px-3 sm:px-4" role="tablist">
              {TX_TYPES.map(t => {
                const active = t.value === txType;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTxType(t.value)}
                    className={`-mb-px flex items-center gap-2 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                      active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <span className="sm:hidden">{t.short}</span>
                    <span className="hidden sm:inline">{t.label}</span>
                    {typeCounts[t.value] !== undefined && (
                      <span className={`rounded-full px-1.5 py-0.5 text-[11px] tabular-nums ${active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                        {formatNumber(typeCounts[t.value])}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active filters */}
            {hasChips && (
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-3 py-2 sm:px-4">
                {!defaultDates && <Chip label={`Date: ${formatDate(dateFrom)} – ${formatDate(dateTo || dateFrom)}`} onRemove={() => handleDateChange('', '')} />}
                {splitBranches(branch).map(code => (
                  <Chip key={code} label={`Branch: ${branchName(code)}`}
                    onRemove={() => setBranch(splitBranches(branch).filter(c => c !== code).join(','))} />
                ))}
                {txType !== 'sales' && <Chip label={`Type: ${typeInfo.label}`} onRemove={() => setTxType('sales')} />}
                {debouncedSearch && <Chip label={`Search: “${debouncedSearch}”`} onRemove={clearSearch} />}
                <button type="button" onClick={clearFilters} className="text-xs font-medium text-slate-500 hover:text-slate-900">
                  Clear all
                </button>
              </div>
            )}

            {txType !== 'sales' && (
              <div className="flex items-start gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-500 sm:px-4">
                <Info size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  {txType === 'all'
                    ? 'Showing every transaction, including void, cancelled and other-cost bills that are excluded from sales.'
                    : txType === 'void'
                    ? 'Void and cancelled bills are excluded from sales and shown here as deductions.'
                    : 'Other-cost bills (e.g. CUPPING, WASTE) have no bill number and are excluded from sales.'}
                </span>
              </div>
            )}

            {newData && (
              <div className="flex items-center justify-between gap-3 border-b border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800 sm:px-4">
                <span className="flex items-center gap-1.5"><ArrowUpCircle size={14} /> New transactions were synced.</span>
                <button type="button" onClick={() => fetchData(null)} className="rounded-md bg-blue-600 px-2.5 py-1 font-medium text-white hover:bg-blue-700">
                  Show latest
                </button>
              </div>
            )}

            {/* Results */}
            <div className="relative">
              {loadError && !loading && (
                <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                  <p className="text-sm font-medium text-slate-800">Couldn’t load transactions</p>
                  <p className="text-xs text-slate-500">{loadError}</p>
                  <button type="button" onClick={() => fetchData(null)} className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Try again
                  </button>
                </div>
              )}

              {!loadError && !loading && data.length === 0 && (
                <div className="flex flex-col items-center px-4 py-16 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <Receipt size={22} className="text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-800">No transactions found</p>
                  <p className="mt-1 text-xs text-slate-500">Try another date range, branch or transaction type.</p>
                </div>
              )}

              {(initialLoading || data.length > 0) && !loadError && (
                <>
                  <DesktopTable groups={groups} skeleton={initialLoading} onSelect={setSelectedTransaction} />
                  <MobileList groups={groups} skeleton={initialLoading} onSelect={setSelectedTransaction} />
                </>
              )}

              {refreshing && (
                <div className="absolute inset-0 z-10 flex items-start justify-center bg-white/60 pt-24 backdrop-blur-[1px]">
                  <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm">
                    <Loader2 size={16} className="animate-spin text-slate-500" />
                    Updating results…
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {data.length > 0 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/60 px-3 py-3 sm:flex-row sm:px-4">
                <p className="text-xs text-slate-500 sm:text-sm">
                  Showing <span className="font-semibold text-slate-800">{formatNumber(groups.length)}</span> transactions
                  {' · '}
                  <span className="font-semibold text-slate-800">{formatNumber(data.length)}</span> item rows
                  {pagination.hasMore && <span className="text-slate-400"> · more available</span>}
                </p>
                {pagination.hasMore && (
                  <button
                    type="button"
                    onClick={() => pagination.cursor && fetchData(pagination.cursor)}
                    disabled={loadingMore}
                    className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-slate-800 disabled:opacity-60 sm:w-auto"
                  >
                    {loadingMore ? <><Loader2 size={15} className="animate-spin" /> Loading…</> : <>Load more <ChevronRight size={15} /></>}
                  </button>
                )}
              </div>
            )}
          </section>
        </div>

        {selectedTransaction && (
          <TransactionDetail transaction={selectedTransaction} onClose={() => setSelectedTransaction(null)} />
        )}
      </div>
    </DashboardLayout>
  );
}

/* ------------------------------------------------------------------ summary */

function SummaryStrip({ summary, loading }: { summary: SalesSummary | null; loading: boolean }) {
  const t = summary?.totals;
  const deductions = t ? t.void.subtotal + t.other_cost.subtotal + t.open.subtotal : undefined;
  const avg = t && t.sales.transactions ? t.sales.subtotal / t.sales.transactions : undefined;
  const methods = summary ? Object.keys(summary.otherCostByMethod) : [];
  const pending = loading && !summary;
  const discount = t ? t.sales.subtotal - t.sales.nettSales : 0;
  const parts = t && t.gross.subtotal
    ? [
        { key: 'sales', label: 'Sales', value: t.sales.subtotal, color: '#2a78d6' },
        { key: 'void', label: 'Void & cancelled', value: t.void.subtotal, color: '#e34948' },
        { key: 'other', label: 'Other cost', value: t.other_cost.subtotal, color: '#eda100' },
        { key: 'open', label: 'Open bills', value: t.open.subtotal, color: '#a8a29e' },
      ].filter(p => p.value > 0)
    : [];
  const money = (v: number | undefined) => formatCurrency(v);

  return (
    <StatStrip label="Sales summary">
      <Stat label="Sales subtotal" icon={<Wallet size={13} aria-hidden />} emphasis
        value={pending ? <StatSkeleton /> : money(t?.sales.subtotal)} title={formatCurrency(t?.sales.subtotal)}>
        {t && <p>{formatNumber(t.sales.transactions)} transactions · avg {formatCurrency(avg)}</p>}
      </Stat>
      <Stat label="Nett sales" icon={<Tag size={13} aria-hidden />}
        value={pending ? <StatSkeleton /> : money(t?.sales.nettSales)} title={formatCurrency(t?.sales.nettSales)}>
        {t && (
          <p>
            After discounts · <span className="tabular-nums text-slate-600">{formatCurrency(discount)}</span>
            {t.sales.subtotal ? ` (${((discount / t.sales.subtotal) * 100).toFixed(1)}%)` : ''}
          </p>
        )}
      </Stat>
      <Stat label="Gross subtotal" icon={<Layers size={13} aria-hidden />}
        value={pending ? <StatSkeleton /> : money(t?.gross.subtotal)} title={formatCurrency(t?.gross.subtotal)}>
        {t && (
          <>
            <p>{formatNumber(t.gross.transactions)} transactions, all statuses</p>
            {parts.length > 0 && (
              <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-200" role="img"
                aria-label={parts.map(p => `${p.label} ${((p.value / t.gross.subtotal) * 100).toFixed(1)}%`).join(', ')}>
                {parts.map(p => (
                  <span key={p.key} title={`${p.label}: ${formatCurrency(p.value)} (${((p.value / t.gross.subtotal) * 100).toFixed(1)}%)`}
                    className="h-full border-r border-slate-50 last:border-r-0"
                    style={{ width: `${Math.max(0.5, (p.value / t.gross.subtotal) * 100)}%`, background: p.color }} />
                ))}
              </div>
            )}
          </>
        )}
      </Stat>
      <Stat label="Deductions" icon={<CircleMinus size={13} aria-hidden />}
        value={pending ? <StatSkeleton /> : <span className="text-rose-600">{deductions !== undefined ? <>−{money(deductions)}</> : '-'}</span>}
        title={deductions !== undefined ? `−${formatCurrency(deductions)}` : undefined}>
        {t && (
          <dl className="space-y-0.5">
            <DeductionRow label="Void & cancelled" color="#e34948" value={t.void.subtotal} count={t.void.transactions} />
            <DeductionRow label="Other cost" color="#eda100" value={t.other_cost.subtotal} count={t.other_cost.transactions} hint={methods.join(', ')} />
            {!!t.open.transactions && <DeductionRow label="Open bills" color="#a8a29e" value={t.open.subtotal} count={t.open.transactions} />}
          </dl>
        )}
      </Stat>
    </StatStrip>
  );
}

function DeductionRow({ label, color, value, count, hint }: { label: string; color: string; value: number; count: number; hint?: string }) {
  const title = [hint, `${formatNumber(count)} transactions`].filter(Boolean).join(' · ');
  return (
    <div className="flex items-baseline justify-between gap-3" title={title}>
      <dt className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        {label}
        <span className="text-slate-400">· {formatNumber(count)}</span>
      </dt>
      <dd className="whitespace-nowrap tabular-nums text-slate-700">−{formatCurrency(value)}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------- table */

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-slate-400">-</span>;
  const s = status.toLowerCase();
  const style =
    s === 'finished' || s === 'completed'
      ? 'bg-emerald-50 text-emerald-700 ring-emerald-600/20'
      : s === 'void' || s === 'cancelled'
      ? 'bg-rose-50 text-rose-700 ring-rose-600/20'
      : 'bg-amber-50 text-amber-700 ring-amber-600/20';
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}>{status}</span>;
}

const TH = 'px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap';
const TD = 'px-3 py-2.5 text-sm align-top';

function DesktopTable({ groups, skeleton, onSelect }: { groups: SaleGroup[]; skeleton: boolean; onSelect: (t: TransactionCombined) => void }) {
  return (
    <div className="hidden max-h-[calc(100dvh-17rem)] min-h-[16rem] overflow-auto md:block">
      <table className="w-full min-w-[900px] border-separate border-spacing-0 2xl:min-w-[1040px]">
        <thead className="sticky top-0 z-[5] bg-slate-50">
          <tr className="[&>th]:border-b [&>th]:border-slate-200">
            <th className={TH}>Sales / Bill</th>
            <th className={TH}>Date</th>
            <th className={TH}>Branch / Payment</th>
            <th className={`${TH} min-w-[220px]`}>Menu item</th>
            <th className={`${TH} text-right`}>Qty</th>
            <th className={`${TH} hidden text-right 2xl:table-cell`}>Price</th>
            <th className={`${TH} text-right`}>Item total</th>
            <th className={`${TH} text-right`}>Bill total / Status</th>
          </tr>
        </thead>
        <tbody>
          {skeleton &&
            Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 8 }).map((__, j) => (
                  <td key={j} className="border-b border-slate-100 px-3 py-3">
                    <div className="h-4 animate-pulse rounded bg-slate-100" style={{ width: `${50 + ((i + j) % 4) * 12}%` }} />
                  </td>
                ))}
              </tr>
            ))}
          {!skeleton &&
            groups.map(group =>
              group.rows.map((tx, i) => {
                const first = i === 0;
                const last = i === group.rows.length - 1;
                const border = last ? 'border-b border-slate-200' : 'border-b border-transparent';
                return (
                  <tr
                    key={`${group.key}-${tx.line_number ?? i}`}
                    onClick={() => onSelect(tx)}
                    className="group cursor-pointer [&>td]:transition-colors hover:[&>td]:bg-slate-50"
                  >
                    <td className={`${TD} ${border}`}>
                      {first && (
                        <>
                          <p className="font-medium text-slate-900 group-hover:text-blue-700">{tx.sales_num}</p>
                          <p className="text-xs text-slate-400">{tx.bill_num || 'No bill number'}</p>
                        </>
                      )}
                    </td>
                    <td className={`${TD} ${border} whitespace-nowrap`}>
                      {first && (
                        <>
                          <p className="text-slate-700">{formatDate(tx.sales_date)}</p>
                          <p className="text-xs text-slate-400">{formatTime(tx.sales_date_in)}</p>
                        </>
                      )}
                    </td>
                    <td className={`${TD} ${border} max-w-[190px]`}>
                      {first && (
                        <>
                          <p className="truncate text-slate-700" title={tx.branch_name}>{tx.branch_name || '-'}</p>
                          <p className="truncate text-xs text-slate-400" title={tx.payment_method}>{tx.payment_method || '-'}</p>
                        </>
                      )}
                    </td>
                    <td className={`${TD} ${border}`}>
                      <p className={tx.menu_name?.endsWith(')') ? 'pl-3 text-slate-500' : 'font-medium text-slate-800'}>{tx.menu_name || '-'}</p>
                      {tx.menu_category && !tx.menu_name?.endsWith(')') && (
                        <p className="text-xs text-slate-400">{tx.menu_category}{tx.menu_category_detail ? ` · ${tx.menu_category_detail}` : ''}</p>
                      )}
                    </td>
                    <td className={`${TD} ${border} text-right tabular-nums text-slate-700`}>{formatNumber(tx.quantity)}</td>
                    <td className={`${TD} ${border} hidden text-right tabular-nums text-slate-600 2xl:table-cell`}>{formatCurrency(tx.unit_price)}</td>
                    <td className={`${TD} ${border} text-right tabular-nums text-slate-800`}>{formatCurrency(tx.total_item)}</td>
                    <td className={`${TD} ${border} text-right`}>
                      {first && (
                        <>
                          <p className="font-semibold tabular-nums text-slate-900">{formatCurrency(tx.total_amount)}</p>
                          <div className="mt-1"><StatusBadge status={tx.status} /></div>
                        </>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
        </tbody>
      </table>
    </div>
  );
}

function MobileList({ groups, skeleton, onSelect }: { groups: SaleGroup[]; skeleton: boolean; onSelect: (t: TransactionCombined) => void }) {
  if (skeleton) {
    return (
      <ul className="divide-y divide-slate-100 md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="space-y-2 p-4">
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-slate-100" />
            <div className="h-3 w-full animate-pulse rounded bg-slate-100" />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="divide-y divide-slate-100 md:hidden">
      {groups.map(group => {
        const tx = group.rows[0];
        const menus = group.rows.filter(r => r.menu_name && !r.menu_name.endsWith(')'));
        return (
          <li key={group.key}>
            <button type="button" onClick={() => onSelect(tx)} className="block w-full min-w-0 p-4 text-left active:bg-slate-50">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{tx.sales_num}</p>
                  <p className="truncate text-xs text-slate-500">
                    {formatDate(tx.sales_date)} · {formatTime(tx.sales_date_in)} · {tx.branch_name}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(tx.total_amount)}</p>
                  <div className="mt-1"><StatusBadge status={tx.status} /></div>
                </div>
              </div>
              {menus.length > 0 && (
                <ul className="mt-2 space-y-0.5 text-xs text-slate-600">
                  {menus.slice(0, 3).map((m, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="truncate">{formatNumber(m.quantity)} × {m.menu_name}</span>
                      <span className="whitespace-nowrap tabular-nums text-slate-500">{formatCurrency(m.total_item)}</span>
                    </li>
                  ))}
                  {menus.length > 3 && <li className="text-slate-400">+{menus.length - 3} more items</li>}
                </ul>
              )}
              <p className="mt-2 truncate text-[11px] text-slate-400">{tx.payment_method || '-'} · {tx.bill_num || 'No bill number'}</p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-md border border-slate-200 bg-white py-0.5 pl-2 pr-1 text-xs font-medium text-slate-700">
      <span className="truncate">{label}</span>
      <button type="button" onClick={onRemove} className="rounded p-0.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={`Remove ${label}`}>
        <X size={12} />
      </button>
    </span>
  );
}
