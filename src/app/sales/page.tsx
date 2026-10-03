'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import TransactionDetail from '@/components/TransactionDetail';
import ExportButton from '@/components/ExportButton';
import DateRangePicker from '@/components/DateRangePicker';
import BranchFilter, { Branch } from '@/components/BranchFilter';
import { ChevronRight, Info, Loader2, Receipt, RefreshCw, Search, X } from 'lucide-react';
import { TransactionCombined } from '@/types/transactions';
import { formatCompactCurrency, formatCurrency, formatDate, formatNumber, formatTime } from '@/lib/format';

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
  const [branch, setBranch] = useState(''); // branch_code
  const [txType, setTxType] = useState<TxType>('sales');
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [selectedTransaction, setSelectedTransaction] = useState<TransactionCombined | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  // Ignore responses from requests that were superseded by a newer one
  const requestIdRef = useRef(0);

  useEffect(() => {
    fetch('/api/branches')
      .then(res => (res.ok ? res.json() : []))
      .then(setBranches)
      .catch(error => console.error('Error fetching branches:', error))
      .finally(() => setBranchesLoading(false));
  }, []);

  const fetchData = useCallback(async (cursor: string | null = null) => {
    if (!isMounted.current) return;
    const requestId = ++requestIdRef.current;
    if (cursor) setLoadingMore(true);
    else setLoading(true);
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
    fetchData(null);
  }, [fetchData, refreshKey]);

  // Gross / deductions / sales summary for the selected period and branch
  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams();
    if (dateFrom) params.append('dateFrom', dateFrom);
    if (dateTo) params.append('dateTo', dateTo);
    if (branch) params.append('branch', branch);
    setSummaryLoading(true);
    fetch(`/api/summary?${params}`)
      .then(res => (res.ok ? res.json() : null))
      .then(result => { if (!cancelled) setSummary(result); })
      .catch(error => console.error('Error fetching summary:', error))
      .finally(() => { if (!cancelled) setSummaryLoading(false); });
    return () => { cancelled = true; };
  }, [dateFrom, dateTo, branch, refreshKey]);

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

  const handleDateChange = (from: string, to: string) => {
    setDateFrom(from);
    setDateTo(to);
  };

  const clearFilters = () => {
    clearSearch();
    setDateFrom('');
    setDateTo('');
    setBranch('');
    setTxType('sales');
  };

  const branchName = (code: string) => branches.find(b => b.branch_code === code)?.branch_name || code;
  const typeInfo = TX_TYPES.find(t => t.value === txType) ?? TX_TYPES[0];
  const periodLabel = summary
    ? `${formatDate(summary.dateRange.from)} – ${formatDate(summary.dateRange.to)}`
    : dateFrom ? `${formatDate(dateFrom)} – ${formatDate(dateTo || dateFrom)}` : 'Last 65 days';
  const branchLabel = branch ? branchName(branch) : 'All branches';

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

  const hasChips = Boolean(dateFrom || dateTo || branch || txType !== 'sales' || debouncedSearch);
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
            <button
              type="button"
              onClick={() => setRefreshKey(k => k + 1)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
              title="Refresh data"
            >
              <RefreshCw size={15} className={loading || summaryLoading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </header>

        <div className="space-y-4 p-4 sm:p-6">
          <SummaryCards summary={summary} loading={summaryLoading} />

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
                <DateRangePicker dateFrom={dateFrom} dateTo={dateTo} onChange={handleDateChange} />
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
                {(dateFrom || dateTo) && <Chip label={`Date: ${formatDate(dateFrom)} – ${formatDate(dateTo || dateFrom)}`} onRemove={() => handleDateChange('', '')} />}
                {branch && <Chip label={`Branch: ${branchName(branch)}`} onRemove={() => setBranch('')} />}
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

            {/* Results */}
            <div className="relative">
              {loadError && !loading && (
                <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                  <p className="text-sm font-medium text-slate-800">Couldn’t load transactions</p>
                  <p className="text-xs text-slate-500">{loadError}</p>
                  <button type="button" onClick={() => setRefreshKey(k => k + 1)} className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
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

function SummaryCards({ summary, loading }: { summary: SalesSummary | null; loading: boolean }) {
  const t = summary?.totals;
  const deductions = t ? t.void.subtotal + t.other_cost.subtotal + t.open.subtotal : undefined;
  const avg = t && t.sales.transactions ? t.sales.subtotal / t.sales.transactions : undefined;
  const methods = summary ? Object.entries(summary.otherCostByMethod) : [];
  const pending = loading && !summary;

  return (
    <section className="grid grid-cols-2 gap-3 xl:grid-cols-4" aria-label="Sales summary">
      <KpiCard
        className="col-span-2 sm:col-span-1"
        title="Sales Subtotal"
        value={t?.sales.subtotal}
        footer={t ? `${formatNumber(t.sales.transactions)} transactions · avg ${formatCurrency(avg)}` : undefined}
        loading={pending}
        emphasis
      />
      <KpiCard
        title="Nett Sales"
        value={t?.sales.nettSales}
        footer={t ? `After item & bill discounts · ${formatCurrency(t.sales.subtotal - t.sales.nettSales)} discount` : undefined}
        loading={pending}
      />
      <KpiCard
        title="Gross Subtotal"
        value={t?.gross.subtotal}
        footer={t ? `${formatNumber(t.gross.transactions)} transactions, all statuses` : undefined}
        loading={pending}
      />
      <div className="col-span-2 min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:col-span-1">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Deductions</p>
        {pending ? (
          <div className="mt-2 h-7 w-40 animate-pulse rounded bg-slate-100" />
        ) : (
          <p className="mt-1 text-xl font-semibold tabular-nums text-rose-600 sm:text-2xl">
            {deductions !== undefined ? `−${formatCurrency(deductions)}` : '-'}
          </p>
        )}
        {t && (
          <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">
            {formatNumber(t.void.transactions + t.other_cost.transactions + t.open.transactions)} transactions excluded from sales
          </p>
        )}
        <dl className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs">
          <DeductionRow label="Void & cancelled" value={t?.void.subtotal} count={t?.void.transactions} />
          <DeductionRow
            label="Other cost"
            value={t?.other_cost.subtotal}
            count={t?.other_cost.transactions}
            hint={methods.map(([m]) => m).join(', ')}
          />
          {!!t?.open.transactions && <DeductionRow label="Open bills" value={t.open.subtotal} count={t.open.transactions} />}
        </dl>
      </div>
    </section>
  );
}

function KpiCard({
  title, badge, value, footer, loading, emphasis = false, className = '',
}: {
  className?: string;
  title: string;
  badge?: string;
  value: number | undefined;
  footer?: string;
  loading: boolean;
  emphasis?: boolean;
}) {
  return (
    <div className={`min-w-0 rounded-xl border p-4 ${className} ${emphasis ? 'border-slate-900 bg-slate-900 text-white' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-2">
        <p className={`text-xs font-medium uppercase tracking-wide ${emphasis ? 'text-slate-300' : 'text-slate-500'}`}>{title}</p>
        {badge && <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide">{badge}</span>}
      </div>
      {loading ? (
        <div className={`mt-2 h-7 w-3/4 animate-pulse rounded ${emphasis ? 'bg-white/20' : 'bg-slate-100'}`} />
      ) : (
        <p className={`mt-1 font-semibold tabular-nums ${emphasis ? 'text-white' : 'text-slate-900'}`}>
          <span className="text-lg sm:hidden">{formatCompactCurrency(value)}</span>
          <span className="hidden text-2xl sm:inline">{formatCurrency(value)}</span>
        </p>
      )}
      {footer && !loading && (
        <p className={`mt-1 line-clamp-2 text-[11px] sm:text-xs ${emphasis ? 'text-slate-300' : 'text-slate-500'}`}>{footer}</p>
      )}
    </div>
  );
}

function DeductionRow({ label, value, count, hint }: { label: string; value?: number; count?: number; hint?: string }) {
  const title = [hint, count !== undefined ? `${formatNumber(count)} transactions` : ''].filter(Boolean).join(' · ');
  return (
    <div className="flex items-baseline justify-between gap-3" title={title}>
      <dt className="min-w-0 truncate text-slate-500">
        {label}
        {hint && <span className="text-slate-400"> ({hint})</span>}
      </dt>
      <dd className="whitespace-nowrap font-medium tabular-nums text-slate-700">{value !== undefined ? `−${formatCurrency(value)}` : '-'}</dd>
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
