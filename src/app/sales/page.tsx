'use client';

import { Lozenge } from '@/jira';
import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { CompanySwitch, useCompany, withCompany } from '@/lib/company';
import TransactionDetail from '@/components/TransactionDetail';
import ExportButton from '@/components/ExportButton';
import { useFilterLog } from '@/lib/activity';
import type { DatePreset } from '@/components/DateRangePicker';
import { FilterButton, FilterDrawer, FilterField } from '@/jira/filters';
import { PeriodField } from '@/aggregator/fields';
import { Branch, branchesLabel, splitBranches } from '@/components/BranchFilter';
import { ArrowUpCircle, ChevronRight, CircleMinus, Info, Layers, Loader2, Receipt, Tag, Wallet, X } from 'lucide-react';
import { TransactionCombined } from '@/types/transactions';
import { formatCurrency, formatDate, formatNumber, formatTime, toIsoDate, fixed } from '@/lib/format';
import { Stat, StatSkeleton, StatStrip } from '@/jira';
import { useRealtime } from '@/lib/realtime';
import { nameCase } from '@/lib/title-case';
import { tr, serverMsg } from '@/lib/i18n';
import { SearchInput, btn } from '@/jira/kc';

interface PaginationInfo {
  cursor: string | null;
  hasMore: boolean;
  limit: number;
}

// Same buckets as the backend (/api/summary); "sales" equals the ESB
// Sales Recapitulation Detail Report.
type TxType = 'sales' | 'void' | 'other_cost' | 'all';
const TX_TYPES: { value: TxType; label: string; short: string }[] = [
  { value: 'sales', get label() { return tr('Sales'); }, get short() { return tr('Sales'); } },
  { value: 'void', get label() { return tr('Void & Cancelled'); }, get short() { return tr('Void'); } },
  { value: 'other_cost', get label() { return tr('Other Cost'); }, get short() { return tr('Other Cost'); } },
  { value: 'all', get label() { return tr('All Transactions'); }, get short() { return tr('All'); } },
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

/** The page opens on today (WIB), the day that is running (user decision 2026-10-17). */
function defaultDay(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
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
    { label: tr('Today'), from: d(0), to: d(0) },
    { label: tr('Yesterday'), from: d(-1), to: d(-1) },
    { label: tr('Last 7 Days'), from: d(-7), to: d(-1) },
    { label: tr('Last 30 Days'), from: d(-30), to: d(-1) },
    { label: tr('Last 90 Days'), from: d(-90), to: d(-1) },
    // running period: from the 1st (of the month / year) up to and including today
    { label: tr('Month to Date'), from: toIsoDate(new Date(y, m, 1)), to: d(0) },
    { label: tr('Last Month'), from: toIsoDate(new Date(y, m - 1, 1)), to: toIsoDate(new Date(y, m, 0)) },
    { label: tr('Year to Date'), from: toIsoDate(new Date(y, 0, 1)), to: d(0) },
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
  const [draft, setDraft] = useState<SalesDraft | null>(null);
  const [txType, setTxType] = useState<TxType>('sales');
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  // dates are set on mount (today in WIB), fetching waits for that
  const [datesReady, setDatesReady] = useState(false);
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [newData, setNewData] = useState(false);
  const { salesSyncedAt, ready: realtimeReady } = useRealtime();
  const syncedRef = useRef<string | null>(null);
  const version = salesSyncedAt ? `&v=${encodeURIComponent(salesSyncedAt)}` : '';

  const [selectedTransaction, setSelectedTransaction] = useState<TransactionCombined | null>(null);
  // the brand of the page (Kopi Calf | Wasgee Tea): its transactions and branches only (lib/company.tsx)
  const { company } = useCompany();
  const shownCompany = useRef(company);
  useEffect(() => {
    if (shownCompany.current === company) return;
    shownCompany.current = company;
    setBranch('');
  }, [company]);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  // Ignore responses from requests that were superseded by a newer one
  const requestIdRef = useRef(0);

  useEffect(() => {
    const day = defaultDay();
    setDateFrom(day);
    setDateTo(day);
    setDatesReady(true);
  }, []);

  useEffect(() => {
    fetch(withCompany('/api/branches', company))
      .then(res => (res.ok ? res.json() : []))
      .then(setBranches)
      .catch(error => console.error('Error fetching branches:', error))
      .finally(() => setBranchesLoading(false));
  }, [company]);

  const fetchData = useCallback(async (cursor: string | null = null, silent = false) => {
    if (!isMounted.current) return;
    const requestId = ++requestIdRef.current;
    if (cursor) setLoadingMore(true);
    else if (!silent) setLoading(true);
    setLoadError(null);

    try {
      const params = new URLSearchParams({ limit: String(DEFAULT_LIMIT), cache: 'false', type: txType, company });
      if (cursor) params.append('cursor', cursor);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (branch) params.append('branch', branch);

      const res = await fetch(`/api/transactions?${params}`);
      const result = await res.json();
      if (!res.ok) throw new Error(serverMsg(result.error) || `HTTP ${res.status}`);

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
  }, [debouncedSearch, dateFrom, dateTo, branch, txType, company]);

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
    const params = new URLSearchParams({ company });
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
  }, [dateFrom, dateTo, branch, version, datesReady, realtimeReady, company]);

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
    setDateFrom(from || to || defaultDay());
    setDateTo(to || from || defaultDay());
  };

  const clearFilters = () => {
    clearSearch();
    setDateFrom(defaultDay());
    setDateTo(defaultDay());
    setBranch('');
    setTxType('sales');
  };

  const branchName = (code: string) => branches.find(b => b.branch_code === code)?.branch_name || code;
  const typeInfo = TX_TYPES.find(t => t.value === txType) ?? TX_TYPES[0];
  const periodLabel = summary
    ? `${formatDate(summary.dateRange.from)} – ${formatDate(summary.dateRange.to)}`
    : dateFrom ? `${formatDate(dateFrom)} – ${formatDate(dateTo || dateFrom)}` : tr('Today');
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

  const defaultDates = dateFrom === defaultDay() && dateTo === defaultDay();
  const hasChips = Boolean(!defaultDates || branch || txType !== 'sales' || debouncedSearch);
  const initialLoading = loading && data.length === 0;
  const refreshing = loading && data.length > 0;

  return (
    <DashboardLayout>
      <div className="min-h-full bg-white">
        <header className="px-4 pt-4 sm:px-6 lg:pt-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-2xl font-bold tracking-tight text-[color:var(--j-172B4D)]">{tr('Sales Transactions')}</h1>
              <p className="truncate text-xs text-[color:var(--j-626F86)] sm:text-sm">
                {periodLabel} · {branchLabel}
              </p>
            </div>
            <CompanySwitch className="w-full sm:w-auto" />
          </div>
        </header>

        <div className="space-y-4 px-4 py-4 sm:p-6">
          <SummaryStrip summary={summary} loading={summaryLoading} />

          {draft && <SalesFilterDrawer draft={draft} setDraft={setDraft} branches={branches} loading={branchesLoading}
            onApply={() => { handleDateChange(draft.from, draft.to); setBranch(draft.branch); setDraft(null); }}
            onReset={() => setDraft({ from: defaultDay(), to: defaultDay(), branch: '' })} onClose={() => setDraft(null)} />}

          {/* Transactions card */}
          <section className="overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white ">
            {/* Transaction type tabs */}
            <div className="flex gap-x-5 overflow-x-auto border-b border-[color:var(--j-DCDFE4)] px-4 pt-3 sm:px-5" role="tablist">
              {TX_TYPES.map(t => {
                const active = t.value === txType;
                return (
                  <button
                    key={t.value}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setTxType(t.value)}
                    className={`-mb-px flex items-center gap-1.5 whitespace-nowrap border-b-2 pb-2.5 pt-1.5 text-sm font-medium transition-colors ${
                      active ? 'border-[color:var(--j-0C66E4)] text-[color:var(--j-0C66E4)]' : 'border-transparent text-[color:var(--j-626F86)] hover:text-[color:var(--j-172B4D)]'
                    }`}
                  >
                    <span className="sm:hidden">{t.short}</span>
                    <span className="hidden sm:inline">{t.label}</span>
                    {typeCounts[t.value] !== undefined && (
                      <span className="rounded-full bg-[color:var(--j-091E420F)] px-1.5 text-[11px] font-semibold tabular-nums text-[color:var(--j-626F86)]">
                        {formatNumber(typeCounts[t.value])}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--j-DCDFE4)] p-3 sm:px-5 sm:py-3.5">
              <SearchInput value={search} onChange={(v) => (v ? handleSearchChange(v) : clearSearch())} placeholder={tr('Search sales no., bill no. or branch')} />
              <div className="flex min-w-0 items-center gap-2 sm:ml-auto">
                {/* 2026-11-28 one Filter: period and branches together in one drawer */}
                <FilterButton count={(dateFrom !== defaultDay() || dateTo !== defaultDay() ? 1 : 0) + (branch ? 1 : 0)} onClick={() => setDraft({ from: dateFrom, to: dateTo, branch })} />
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

            {/* Active filters */}
            {hasChips && (
              <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--j-F1F2F4)] px-3 py-2 sm:px-4">
                {!defaultDates && <Chip label={tr('Date: {0} – {1}', formatDate(dateFrom), formatDate(dateTo || dateFrom))} onRemove={() => handleDateChange('', '')} />}
                {splitBranches(branch).map(code => (
                  <Chip key={code} label={tr('Branch: {0}', branchName(code))}
                    onRemove={() => setBranch(splitBranches(branch).filter(c => c !== code).join(','))} />
                ))}
                {txType !== 'sales' && <Chip label={tr('Type: {0}', typeInfo.label)} onRemove={() => setTxType('sales')} />}
                {debouncedSearch && <Chip label={tr('Search: “{0}”', debouncedSearch)} onRemove={clearSearch} />}
                <button type="button" onClick={clearFilters} className="text-xs font-medium text-[color:var(--j-626F86)] hover:text-[color:var(--j-172B4D)]">
                  {tr('Clear All')}
                </button>
              </div>
            )}

            {txType !== 'sales' && (
              <div className="flex items-start gap-2 border-b border-[color:var(--j-F1F2F4)] bg-[color:var(--j-F7F8F9)] px-3 py-2 text-xs text-[color:var(--j-626F86)] sm:px-4">
                <Info size={14} className="mt-0.5 flex-shrink-0" />
                <span>
                  {txType === 'all'
                    ? tr('Showing every transaction, including void, cancelled and other-cost bills that are excluded from sales.')
                    : txType === 'void'
                    ? tr('Void and cancelled bills are excluded from sales and shown here as deductions.')
                    : tr('Other-cost bills (e.g. CUPPING, WASTE) have no bill number and are excluded from sales.')}
                </span>
              </div>
            )}

            {newData && (
              <div className="flex items-center justify-between gap-3 border-b border-[color:var(--j-85B8FF)] bg-[color:var(--j-E9F2FF)] px-3 py-2 text-xs text-[color:var(--j-0055CC)] sm:px-4">
                <span className="flex items-center gap-1.5"><ArrowUpCircle size={14} /> {tr('New transactions were synced.')}</span>
                <button type="button" onClick={() => fetchData(null)} className="rounded-[3px] bg-[color:var(--j-0C66E4)] px-2.5 py-1 font-medium text-white hover:bg-[color:var(--j-0C66E4)]">
                  {tr('Show latest')}
                </button>
              </div>
            )}

            {/* Results */}
            <div className="relative">
              {loadError && !loading && (
                <div className="flex flex-col items-center gap-2 px-4 py-16 text-center">
                  <p className="text-sm font-medium text-[color:var(--j-172B4D)]">{tr('Couldn’t load transactions')}</p>
                  <p className="text-xs text-[color:var(--j-626F86)]">{loadError}</p>
                  <button type="button" onClick={() => fetchData(null)} className="mt-2 rounded-[3px] border border-[color:var(--j-DCDFE4)] px-3 py-1.5 text-sm font-medium text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]">
                    {tr('Try Again')}
                  </button>
                </div>
              )}

              {!loadError && !loading && data.length === 0 && (
                <div className="flex flex-col items-center px-4 py-16 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[color:var(--j-091E420F)]">
                    <Receipt size={22} className="text-[color:var(--j-626F86)]" />
                  </div>
                  <p className="text-sm font-medium text-[color:var(--j-172B4D)]">{tr('No transactions found')}</p>
                  <p className="mt-1 text-xs text-[color:var(--j-626F86)]">{tr('Try another date range, branch or transaction type.')}</p>
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
                  <div className="flex items-center gap-2 rounded-full border border-[color:var(--j-DCDFE4)] bg-white px-4 py-2 text-sm font-medium text-[color:var(--j-44546F)]">
                    <Loader2 size={16} className="animate-spin text-[color:var(--j-626F86)]" />
                    {tr('Updating results…')}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            {data.length > 0 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] px-3 py-3 sm:flex-row sm:px-4">
                <p className="text-xs text-[color:var(--j-626F86)] sm:text-sm">
                  {tr('Showing')} <span className="font-semibold text-[color:var(--j-172B4D)]">{formatNumber(groups.length)}</span> {tr('transactions')}
                  {' · '}
                  <span className="font-semibold text-[color:var(--j-172B4D)]">{formatNumber(data.length)}</span> {tr('item rows')}
                  {pagination.hasMore && <span className="text-[color:var(--j-626F86)]"> {tr('· more available')}</span>}
                </p>
                {pagination.hasMore && (
                  <button
                    type="button"
                    onClick={() => pagination.cursor && fetchData(pagination.cursor)}
                    disabled={loadingMore}
                    className={`${btn('solid')} h-10 w-full sm:h-9 sm:w-auto`}
                  >
                    {loadingMore ? <><Loader2 size={15} className="animate-spin" /> {tr('Loading…')}</> : <>{tr('Load more')} <ChevronRight size={15} /></>}
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
        { key: 'sales', label: tr('Gross sales'), value: t.sales.subtotal, color: '#2a78d6' },
        { key: 'void', label: tr('Void & Cancelled'), value: t.void.subtotal, color: '#e34948' },
        { key: 'other', label: tr('Other cost'), value: t.other_cost.subtotal, color: '#eda100' },
        { key: 'open', label: tr('Open Bills'), value: t.open.subtotal, color: '#a8a29e' },
      ].filter(p => p.value > 0)
    : [];
  const money = (v: number | undefined) => formatCurrency(v);

  return (
    // phones: a swipe row of full cards (the rupiah figures stay whole); tablets 2, desktop 4 columns
    <StatStrip label={tr('Sales Summary')} gridClassName="grid-flow-col auto-cols-[minmax(15.5rem,86%)] items-start snap-x snap-mandatory scroll-px-4 overflow-x-auto overscroll-x-contain -mx-4 px-4 pb-1 sm:mx-0 sm:items-stretch sm:grid-flow-row sm:auto-cols-auto sm:grid-cols-2 sm:scroll-px-0 sm:overflow-visible sm:px-0 sm:pb-0 xl:grid-cols-4 [&>*]:snap-start">
      <Stat label={tr('Gross sales')} icon={<Wallet size={13} aria-hidden />} emphasis
        value={pending ? <StatSkeleton /> : money(t?.sales.subtotal)} title={formatCurrency(t?.sales.subtotal)}>
        {t && <p>{formatNumber(t.sales.transactions)} {tr('transactions · avg')} {formatCurrency(avg)}</p>}
      </Stat>
      <Stat label={tr('Nett Sales')} icon={<Tag size={13} aria-hidden />}
        value={pending ? <StatSkeleton /> : money(t?.sales.nettSales)} title={formatCurrency(t?.sales.nettSales)}>
        {t && (
          <p>
            {tr('After discounts ·')} <span className="tabular-nums text-[color:var(--j-44546F)]">{formatCurrency(discount)}</span>
            {t.sales.subtotal ? ` (${fixed(((discount / t.sales.subtotal) * 100), 1)}%)` : ''}
          </p>
        )}
      </Stat>
      <Stat label={tr('All Transactions')} icon={<Layers size={13} aria-hidden />}
        value={pending ? <StatSkeleton /> : money(t?.gross.subtotal)} title={formatCurrency(t?.gross.subtotal)}>
        {t && (
          <>
            <p>{formatNumber(t.gross.transactions)} {tr('transactions, all statuses (before deductions)')}</p>
            {parts.length > 0 && (
              <div className="flex h-1.5 overflow-hidden rounded-full bg-[color:var(--j-DCDFE4)]" role="img"
                aria-label={parts.map(p => `${p.label} ${fixed(((p.value / t.gross.subtotal) * 100), 1)}%`).join(', ')}>
                {parts.map(p => (
                  <span key={p.key} title={`${p.label}: ${formatCurrency(p.value)} (${fixed(((p.value / t.gross.subtotal) * 100), 1)}%)`}
                    className="h-full border-r border-[color:var(--j-F7F8F9)] last:border-r-0"
                    style={{ width: `${Math.max(0.5, (p.value / t.gross.subtotal) * 100)}%`, background: p.color }} />
                ))}
              </div>
            )}
          </>
        )}
      </Stat>
      <Stat label={tr('Deductions')} icon={<CircleMinus size={13} aria-hidden />}
        value={pending ? <StatSkeleton /> : <span className="text-[color:var(--j-C9372C)]">{deductions !== undefined ? <>−{money(deductions)}</> : '-'}</span>}
        title={deductions !== undefined ? `−${formatCurrency(deductions)}` : undefined}>
        {t && (
          <dl className="hidden space-y-0.5 sm:block">
            <DeductionRow label={tr('Void & Cancelled')} color="#e34948" value={t.void.subtotal} count={t.void.transactions} />
            <DeductionRow label={tr('Other cost')} color="#eda100" value={t.other_cost.subtotal} count={t.other_cost.transactions} hint={methods.join(', ')} />
            {!!t.open.transactions && <DeductionRow label={tr('Open Bills')} color="#a8a29e" value={t.open.subtotal} count={t.open.transactions} />}
          </dl>
        )}
      </Stat>
    </StatStrip>
  );
}

function DeductionRow({ label, color, value, count, hint }: { label: string; color: string; value: number; count: number; hint?: string }) {
  const title = [hint, tr('{0} transactions', formatNumber(count))].filter(Boolean).join(' · ');
  return (
    <div className="flex items-baseline justify-between gap-3" title={title}>
      <dt className="flex items-center gap-1.5 whitespace-nowrap">
        <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: color }} aria-hidden />
        {label}
        <span className="text-[color:var(--j-626F86)]">· {formatNumber(count)}</span>
      </dt>
      <dd className="whitespace-nowrap tabular-nums text-[color:var(--j-44546F)]">−{formatCurrency(value)}</dd>
    </div>
  );
}

/* -------------------------------------------------------------------- table */

function StatusBadge({ status }: { status?: string | null }) {
  if (!status) return <span className="text-[color:var(--j-626F86)]">-</span>;
  const s = status.toLowerCase();
  return <Lozenge tone={s === 'finished' || s === 'completed' ? 'green' : s === 'void' || s === 'cancelled' ? 'red' : 'amber'}>{status}</Lozenge>;
}

// the Jira issue table (2026-11-18): small caps grey heads, dense rows
const TH = 'px-2 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-[color:var(--j-626F86)] whitespace-nowrap first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5';
const TD = 'px-2 py-2 text-[13px] align-top first:pl-4 last:pr-4 sm:first:pl-5 sm:last:pr-5';

function DesktopTable({ groups, skeleton, onSelect }: { groups: SaleGroup[]; skeleton: boolean; onSelect: (t: TransactionCombined) => void }) {
  return (
    <div className="hidden max-h-[calc(100dvh-17rem)] min-h-[16rem] overflow-auto md:block">
      <table className="w-full min-w-[900px] border-separate border-spacing-0 2xl:min-w-[1040px]">
        <thead className="sticky top-0 z-[5] bg-white/95 backdrop-blur">
          <tr className="[&>th]:border-b-2 [&>th]:border-[color:var(--j-DCDFE4)]">
            <th className={TH}>Key</th>
            <th className={TH}>{tr('Date')}</th>
            <th className={TH}>{tr('Branch / Payment')}</th>
            <th className={`${TH} min-w-[220px]`}>{tr('Menu Item')}</th>
            <th className={`${TH} text-right`}>{tr('Qty')}</th>
            <th className={`${TH} hidden text-right 2xl:table-cell`}>{tr('Price')}</th>
            <th className={`${TH} text-right`}>{tr('Item Total')}</th>
            <th className={`${TH} text-right`}>{tr('Bill Total / Status')}</th>
          </tr>
        </thead>
        <tbody>
          {skeleton &&
            Array.from({ length: 8 }).map((_, i) => (
              <tr key={i}>
                {Array.from({ length: 8 }).map((__, j) => (
                  <td key={j} className="border-b border-[color:var(--j-F1F2F4)] px-3 py-3">
                    <div className="h-4 skeleton rounded" style={{ width: `${50 + ((i + j) % 4) * 12}%` }} />
                  </td>
                ))}
              </tr>
            ))}
          {!skeleton &&
            groups.map(group =>
              group.rows.map((tx, i) => {
                const first = i === 0;
                const last = i === group.rows.length - 1;
                const border = last ? 'border-b border-[color:var(--j-F1F2F4)]' : 'border-b border-transparent';
                return (
                  <tr
                    key={`${group.key}-${tx.line_number ?? i}`}
                    onClick={() => onSelect(tx)}
                    className="group cursor-pointer [&>td]:transition-colors hover:[&>td]:bg-[color:var(--j-F7F8F9)]"
                  >
                    <td className={`${TD} ${border}`}>
                      {first && (
                        <>
                          <p className="font-medium text-[color:var(--j-0C66E4)] group-hover:underline">{tx.sales_num}</p>
                          <p className="text-xs text-[color:var(--j-626F86)]">{tx.bill_num || tr('No bill number')}</p>
                        </>
                      )}
                    </td>
                    <td className={`${TD} ${border} whitespace-nowrap`}>
                      {first && (
                        <>
                          <p className="text-[color:var(--j-44546F)]">{formatDate(tx.sales_date)}</p>
                          <p className="text-xs text-[color:var(--j-626F86)]">{formatTime(tx.sales_date_in)}</p>
                        </>
                      )}
                    </td>
                    <td className={`${TD} ${border} max-w-[190px]`}>
                      {first && (
                        <>
                          <p className="truncate text-[color:var(--j-44546F)]" title={tx.branch_name}>{tx.branch_name || '-'}</p>
                          <p className="truncate text-xs text-[color:var(--j-626F86)]" title={tx.payment_method}>{tx.payment_method || '-'}</p>
                        </>
                      )}
                    </td>
                    <td className={`${TD} ${border}`}>
                      <p className={tx.menu_name?.endsWith(')') ? 'pl-3 text-[color:var(--j-626F86)]' : 'font-medium text-[color:var(--j-172B4D)]'}>{tx.menu_name || '-'}</p>
                      {tx.menu_category && !tx.menu_name?.endsWith(')') && (
                        <p className="text-xs text-[color:var(--j-626F86)]">{nameCase(tx.menu_category)}{tx.menu_category_detail ? ` · ${nameCase(tx.menu_category_detail)}` : ''}</p>
                      )}
                    </td>
                    <td className={`${TD} ${border} text-right tabular-nums text-[color:var(--j-44546F)]`}>{formatNumber(tx.quantity)}</td>
                    <td className={`${TD} ${border} hidden text-right tabular-nums text-[color:var(--j-44546F)] 2xl:table-cell`}>{formatCurrency(tx.unit_price)}</td>
                    <td className={`${TD} ${border} text-right tabular-nums text-[color:var(--j-172B4D)]`}>{formatCurrency(tx.total_item)}</td>
                    <td className={`${TD} ${border} text-right`}>
                      {first && (
                        <>
                          <p className="font-semibold tabular-nums text-[color:var(--j-172B4D)]">{formatCurrency(tx.total_amount)}</p>
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
      <ul className="divide-y divide-[color:var(--j-F1F2F4)] md:hidden">
        {Array.from({ length: 5 }).map((_, i) => (
          <li key={i} className="space-y-2 p-4">
            <div className="h-4 w-2/3 skeleton rounded" />
            <div className="h-3 w-1/2 skeleton rounded" />
            <div className="h-3 w-full skeleton rounded" />
          </li>
        ))}
      </ul>
    );
  }
  return (
    <ul className="divide-y divide-[color:var(--j-F1F2F4)] md:hidden">
      {groups.map(group => {
        const tx = group.rows[0];
        const menus = group.rows.filter(r => r.menu_name && !r.menu_name.endsWith(')'));
        return (
          <li key={group.key}>
            <button type="button" onClick={() => onSelect(tx)} className="block w-full min-w-0 px-4 py-3.5 text-left active:bg-[color:var(--j-F7F8F9)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[color:var(--j-172B4D)]">{tx.branch_name || tx.sales_num}</p>
                  <p className="mt-0.5 truncate text-xs text-[color:var(--j-626F86)]">
                    <span className="font-mono">{tx.sales_num}</span> · {formatDate(tx.sales_date)} {formatTime(tx.sales_date_in)}
                  </p>
                </div>
                <div className="flex-shrink-0 text-right">
                  <p className="text-sm font-semibold tabular-nums text-[color:var(--j-172B4D)]">{formatCurrency(tx.total_amount)}</p>
                  <div className="mt-1"><StatusBadge status={tx.status} /></div>
                </div>
              </div>
              {menus.length > 0 && (
                <ul className="mt-2.5 space-y-1 rounded-[3px] bg-[color:var(--j-F7F8F9)] px-2.5 py-2 text-xs text-[color:var(--j-44546F)]">
                  {menus.slice(0, 3).map((m, i) => (
                    <li key={i} className="flex justify-between gap-3">
                      <span className="truncate">{formatNumber(m.quantity)} × {m.menu_name}</span>
                      <span className="whitespace-nowrap tabular-nums text-[color:var(--j-626F86)]">{formatCurrency(m.total_item)}</span>
                    </li>
                  ))}
                  {menus.length > 3 && <li className="text-[color:var(--j-626F86)]">+{menus.length - 3} {tr('more items')}</li>}
                </ul>
              )}
              <p className="mt-2 flex items-center justify-between gap-2 text-[11px] text-[color:var(--j-626F86)]">
                <span className="truncate">{tx.payment_method || '-'} · {tx.bill_num || tr('No bill number')}</span>
                <ChevronRight size={14} className="flex-shrink-0 text-[color:var(--j-8590A2)]" />
              </p>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Chip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex max-w-full items-center gap-1 rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white py-0.5 pl-2 pr-1 text-xs font-medium text-[color:var(--j-44546F)]">
      <span className="truncate">{label}</span>
      <button type="button" onClick={onRemove} className="rounded p-0.5 text-[color:var(--j-626F86)] hover:bg-[color:var(--j-091E420F)] hover:text-[color:var(--j-44546F)]" aria-label={tr('Remove {0}', label)}>
        <X size={12} />
      </button>
    </span>
  );
}

type SalesDraft = { from: string; to: string; branch: string };

/** The filters of Sales Transactions in one drawer (2026-11-28): the period (presets or dates) and the branches. */
function SalesFilterDrawer({ draft, setDraft, branches, loading, onApply, onReset, onClose }: {
  draft: SalesDraft; setDraft: (d: SalesDraft) => void; branches: Branch[]; loading: boolean; onApply: () => void; onReset: () => void; onClose: () => void;
}) {
  const [q, setQ] = useState('');
  const presets = salesPresets().map((p, i) => ({ value: String(i), ...p }));
  const preset = presets.find(p => p.from === draft.from && p.to === draft.to)?.value ?? 'custom';
  const chosen = splitBranches(draft.branch);
  const toggle = (code: string) => setDraft({ ...draft, branch: (chosen.includes(code) ? chosen.filter(c => c !== code) : [...chosen, code]).join(',') });
  const shown = branches.filter(b => !q || `${b.branch_name} ${b.branch_code}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <FilterDrawer onClose={onClose} onApply={onApply} onReset={onReset}>
      <FilterField label={tr('Period')}>
        <PeriodField label={tr('Period')} from={draft.from} to={draft.to} preset={preset} presets={presets} maxDays={366} onChange={(from, to) => setDraft({ ...draft, from, to })} />
      </FilterField>
      <FilterField label={tr('Branch')} hint={chosen.length ? tr('{0} chosen', chosen.length) : tr('All Branches')}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr('Search branch')} aria-label={tr('Search branch')}
          className="mb-2 h-10 w-full rounded-[3px] border-2 border-[color:var(--j-DCDFE4)] bg-white px-3 text-sm text-[color:var(--j-172B4D)] placeholder:text-[color:var(--j-626F86)] focus:border-[color:var(--j-388BFF)] focus:outline-none sm:h-9" />
        <ul className="max-h-[45vh] divide-y divide-[color:var(--j-F1F2F4)] overflow-y-auto rounded-[3px] border border-[color:var(--j-DCDFE4)]">
          <li><label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm font-medium text-[color:var(--j-172B4D)] hover:bg-[color:var(--j-F7F8F9)]">
            <input type="checkbox" checked={!chosen.length} onChange={() => setDraft({ ...draft, branch: '' })} className="h-4 w-4 accent-[color:var(--j-0C66E4)]" />{tr('All Branches')}</label></li>
          {loading ? <li className="px-3 py-3 text-sm text-[color:var(--j-626F86)]">{tr('Loading…')}</li> : shown.map(b => (
            <li key={b.branch_code}><label className="flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2 text-sm text-[color:var(--j-172B4D)] hover:bg-[color:var(--j-F7F8F9)]">
              <input type="checkbox" checked={chosen.includes(b.branch_code)} onChange={() => toggle(b.branch_code)} className="h-4 w-4 accent-[color:var(--j-0C66E4)]" />
              <span className="min-w-0 flex-1 truncate">{b.branch_name}</span><span className="text-xs text-[color:var(--j-626F86)]">{b.branch_code}</span></label></li>
          ))}
        </ul>
      </FilterField>
    </FilterDrawer>
  );
}
