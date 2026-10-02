'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import TransactionDetail from '@/components/TransactionDetail';
import ExportButton from '@/components/ExportButton';
import DateRangePicker from '@/components/DateRangePicker';
import {
  Search,
  ChevronRight,
  X,
  ChevronDown,
  Loader2,
  Package,
} from 'lucide-react';
import { TransactionCombined } from '@/types/transactions';

interface PaginationInfo {
  cursor: string | null;
  hasMore: boolean;
  limit: number;
}

interface Branch {
  branch_code: string;
  branch_name: string;
  count: number;
}

// Same buckets as the backend (/api/summary); "sales" equals the ESB
// Sales Recapitulation Detail Report.
type TxType = 'sales' | 'void' | 'other_cost' | 'all';
const TX_TYPES: { value: TxType; label: string }[] = [
  { value: 'sales', label: 'Sales (sesuai ESB)' },
  { value: 'void', label: 'Void & Cancelled' },
  { value: 'other_cost', label: 'Other Cost (CUPPING, WASTE)' },
  { value: 'all', label: 'Semua transaksi' },
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

const DEFAULT_LIMIT = 100;

export default function SalesPage() {
  const [data, setData] = useState<TransactionCombined[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({ cursor: null, hasMore: false, limit: DEFAULT_LIMIT });

  // Filters
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branch, setBranch] = useState(''); // branch_code
  const [txType, setTxType] = useState<TxType>('sales');
  const [summary, setSummary] = useState<SalesSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // UI State
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionCombined | null>(null);

  // Search input updates `search` immediately; the query uses the debounced value
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);
  // Ignore responses from requests that were superseded by a newer one
  const requestIdRef = useRef(0);

  // Fetch branches
  const fetchBranches = useCallback(async () => {
    try {
      const res = await fetch('/api/branches');
      if (res.ok) {
        const data = await res.json();
        setBranches(data);
      }
    } catch (error) {
      console.error('Error fetching branches:', error);
    } finally {
      setBranchesLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBranches();
  }, [fetchBranches]);

  const fetchData = useCallback(async (cursor: string | null = null, isReset: boolean = false) => {
    if (!isMounted.current) return;
    const requestId = ++requestIdRef.current;

    if (cursor) {
      setLoadingMore(true);
    } else {
      setLoading(true);
    }

    try {
      const params = new URLSearchParams();
      params.append('limit', DEFAULT_LIMIT.toString());
      params.append('cache', 'false');

      if (cursor) params.append('cursor', cursor);
      if (debouncedSearch) params.append('search', debouncedSearch);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (branch) params.append('branch', branch);
      params.append('type', txType);

      const res = await fetch(`/api/transactions?${params}`);
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || `HTTP ${res.status}`);

      if (isMounted.current && requestId === requestIdRef.current) {
        if (isReset || !cursor) {
          setData(result.data || []);
        } else {
          setData(prev => [...(prev || []), ...(result.data || [])]);
        }
        setPagination(result.pagination || { cursor: null, hasMore: false, limit: DEFAULT_LIMIT });
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
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
    fetchData(null, true);
  }, [fetchData]);

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
  }, [dateFrom, dateTo, branch]);

  // Auto-search as you type
  const handleSearchChange = (value: string) => {
    setSearch(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedSearch(value);
    }, 400);
  };

  const handleDateFromChange = (value: string) => {
    setDateFrom(value);
  };

  const handleDateToChange = (value: string) => {
    setDateTo(value);
  };

  const handleBranchChange = (value: string) => {
    setBranch(value);
  };

  const clearFilters = () => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    setDateFrom('');
    setDateTo('');
    setBranch('');
    setTxType('sales');
    setSearch('');
    setDebouncedSearch('');
  };

  const loadMore = () => {
    if (pagination.cursor && !loadingMore) {
      fetchData(pagination.cursor);
    }
  };

  const formatNumber = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('id-ID').format(value);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const getStatusBadge = (status: string | null | undefined) => {
    if (!status) return <span className="text-slate-400">-</span>;
    const statusLower = status.toLowerCase();
    if (statusLower === 'finished' || statusLower === 'completed') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">Finished</span>;
    }
    if (statusLower === 'void' || statusLower === 'cancelled') {
      return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-rose-100 text-rose-700">Void</span>;
    }
    return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">{status}</span>;
  };

  const branchName = (code: string) => branches.find(b => b.branch_code === code)?.branch_name || code;
  const typeLabel = TX_TYPES.find(t => t.value === txType)?.label || txType;

  const hasActiveFilters = dateFrom || dateTo || branch || txType !== 'sales';


  return (
    <DashboardLayout>
      <div className="h-screen flex flex-col bg-slate-100">
        {/* Page Header */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Sales Transactions</h1>
              <p className="text-sm text-slate-500">
                {typeLabel} · {formatNumber(data.length)} rows displayed
                {pagination.hasMore && ' (more available)'}
              </p>
            </div>
          </div>

          {/* Gross - deductions = Sales (identical to the ESB Sales Recapitulation report) */}
          <div className="mt-3 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2">
            {[
              { key: 'gross', label: 'Gross Subtotal', value: summary?.totals.gross.subtotal, count: summary?.totals.gross.transactions, tone: 'text-slate-900' },
              { key: 'void', label: '− Void & Cancelled', value: summary ? -summary.totals.void.subtotal : undefined, count: summary?.totals.void.transactions, tone: 'text-rose-600' },
              {
                key: 'other_cost',
                label: '− Other Cost',
                value: summary ? -summary.totals.other_cost.subtotal : undefined,
                count: summary?.totals.other_cost.transactions,
                tone: 'text-amber-600',
                hint: summary ? Object.entries(summary.otherCostByMethod).map(([m, b]) => `${m}: ${formatCurrency(b.subtotal)}`).join(' · ') : '',
              },
              { key: 'open', label: '− Open Bill', value: summary ? -summary.totals.open.subtotal : undefined, count: summary?.totals.open.transactions, tone: 'text-slate-500' },
              { key: 'sales', label: '= Sales Subtotal (ESB)', value: summary?.totals.sales.subtotal, count: summary?.totals.sales.transactions, tone: 'text-emerald-700' },
              { key: 'nett', label: 'Nett Sales', value: summary?.totals.sales.nettSales, count: summary?.totals.sales.transactions, tone: 'text-blue-700' },
            ].map(card => (
              <div key={card.key} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2" title={card.hint || undefined}>
                <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">{card.label}</p>
                <p className={`text-base font-bold ${card.tone}`}>
                  {summaryLoading && !summary ? '…' : formatCurrency(card.value)}
                </p>
                <p className="text-[11px] text-slate-400">
                  {card.count !== undefined ? `${formatNumber(card.count)} transaksi` : ''}
                  {card.hint ? ` · ${card.hint}` : ''}
                </p>
              </div>
            ))}
          </div>
          {summary && (
            <p className="mt-1 text-[11px] text-slate-400">
              Periode {summary.dateRange.from} s/d {summary.dateRange.to}{branch ? ` · ${branchName(branch)}` : ' · semua cabang'}
            </p>
          )}
        </div>

        {/* Table Container */}
        <div className="flex-1 overflow-hidden flex flex-col p-4">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm flex-1 flex flex-col overflow-hidden">
            {/* Table Header with Tools */}
            <div className="flex-shrink-0 border-b border-slate-200">
              {/* Search & Tools Row */}
              <div className="px-4 py-3 flex items-center gap-3 bg-slate-50">
                {/* Search */}
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                  <input
                    type="text"
                    placeholder="Search..."
                    value={search}
                    onChange={(e) => handleSearchChange(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>

                {/* Date Range Picker */}
                <DateRangePicker
                  dateFrom={dateFrom}
                  dateTo={dateTo}
                  onDateFromChange={handleDateFromChange}
                  onDateToChange={handleDateToChange}
                  onClear={clearFilters}
                />

                {/* Branch Filter */}
                <div className="relative">
                  <select
                    value={branch}
                    onChange={(e) => handleBranchChange(e.target.value)}
                    className="pl-3 pr-8 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white appearance-none"
                  >
                    <option value="">All Branches</option>
                    {branchesLoading ? (
                      <option value="" disabled>Loading...</option>
                    ) : (
                      branches.map((b) => (
                        <option key={b.branch_code} value={b.branch_code}>
                          {b.branch_name}
                        </option>
                      ))
                    )}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {/* Transaction Type Filter */}
                <div className="relative">
                  <select
                    value={txType}
                    onChange={(e) => setTxType(e.target.value as TxType)}
                    className="pl-3 pr-8 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white appearance-none"
                    title="Tipe transaksi"
                  >
                    {TX_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>

                {/* Export Button */}
                <ExportButton dateFrom={dateFrom} dateTo={dateTo} branch={branch} txType={txType} />
              </div>

              {/* Active Filter Tags */}
              {hasActiveFilters && (
                <div className="px-4 py-2 flex flex-wrap gap-2 border-t border-slate-100">
                  {branch && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      Branch: {branchName(branch)}
                      <button onClick={() => handleBranchChange('')} className="hover:text-blue-900">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {txType !== 'sales' && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-amber-50 text-amber-700 rounded text-xs font-medium">
                      Tipe: {typeLabel}
                      <button onClick={() => setTxType('sales')} className="hover:text-amber-900">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {dateFrom && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      From: {dateFrom}
                      <button onClick={() => handleDateFromChange('')} className="hover:text-blue-900">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                  {dateTo && (
                    <span className="inline-flex items-center gap-1.5 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                      To: {dateTo}
                      <button onClick={() => handleDateToChange('')} className="hover:text-blue-900">
                        <X size={12} />
                      </button>
                    </span>
                  )}
                </div>
              )}

              {/* Table Column Headers */}
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1200px]">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Sales #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden md:table-cell">Bill #</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell">Branch</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden xl:table-cell">Payment</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Status</th>
                      <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell">#</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell">Menu</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell">Qty</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell">Price</th>
                      <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider hidden lg:table-cell">Subtotal</th>
                    </tr>
                  </thead>
                </table>
              </div>
            </div>

            {/* Table Body - Scrollable */}
            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-[1200px]">
                <tbody className="divide-y divide-slate-100">
                  {/* Loading State */}
                  {loading && data.length === 0 && (
                    <tr>
                      <td colSpan={12} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-10 h-10 mb-3 relative">
                            <div className="absolute inset-0 w-10 h-10 border-3 border-slate-200 rounded-full"></div>
                            <div className="absolute inset-0 w-10 h-10 border-3 border-t-blue-600 rounded-full animate-spin"></div>
                          </div>
                          <p className="text-sm font-medium text-slate-600">Loading transactions...</p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Empty State */}
                  {!loading && data.length === 0 && (
                    <tr>
                      <td colSpan={12} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center">
                          <div className="w-12 h-12 mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                            <Package size={24} className="text-slate-400" />
                          </div>
                          <p className="text-sm font-medium text-slate-600">No transactions found</p>
                          <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
                        </div>
                      </td>
                    </tr>
                  )}

                  {/* Data Rows - Desktop */}
                  {!loading && data.map((tx, index) => (
                    <tr
                      key={`${tx.sales_num}-${tx.line_number || index}`}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                      onClick={() => setSelectedTransaction(tx)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-semibold text-blue-600 text-sm">{tx.sales_num || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 hidden md:table-cell">{tx.bill_num || '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 whitespace-nowrap">{formatDate(tx.sales_date)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 hidden lg:table-cell">
                        <span className="max-w-[150px] truncate block">{tx.branch_name || '-'}</span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 hidden xl:table-cell">{tx.payment_method || '-'}</td>
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900 text-right whitespace-nowrap">
                        {formatCurrency(tx.total_amount)}
                      </td>
                      <td className="px-4 py-3 text-center">{getStatusBadge(tx.status)}</td>
                      <td className="px-4 py-3 text-sm text-slate-500 text-center hidden lg:table-cell">{tx.line_number || '-'}</td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <span className="text-sm font-medium text-slate-700">{tx.menu_name || '-'}</span>
                        {tx.menu_category && <p className="text-xs text-slate-400">{tx.menu_category}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right hidden lg:table-cell">{tx.quantity ?? '-'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 text-right hidden lg:table-cell">{formatCurrency(tx.unit_price)}</td>
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 text-right hidden lg:table-cell">
                        {formatCurrency(tx.total_item)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination Footer - Inside Table */}
            {data.length > 0 && (
              <div className="flex-shrink-0 px-4 py-3 border-t border-slate-200 bg-slate-50">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-sm text-slate-600 order-2 sm:order-1">
                    Showing <span className="font-semibold">{formatNumber(data.length)}</span> rows
                    {pagination.hasMore && <span className="text-slate-400 ml-1">(more available)</span>}
                  </div>
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    <button
                      onClick={() => fetchData(null, true)}
                      disabled={loading}
                      className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                    >
                      Reset
                    </button>
                    <button
                      onClick={loadMore}
                      disabled={loadingMore || !pagination.hasMore}
                      className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                    >
                      {loadingMore ? (
                        <><Loader2 size={16} className="animate-spin" /> Loading...</>
                      ) : (
                        <>Load More <ChevronRight size={16} /></>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Loading More Indicator */}
            {loadingMore && (
              <div className="flex-shrink-0 px-4 py-2 text-center text-sm text-slate-500">
                <Loader2 size={18} className="inline animate-spin text-blue-600 mr-2" />
                Loading more transactions...
              </div>
            )}
          </div>
        </div>

        {/* Detail Drawer */}
        {selectedTransaction && (
          <TransactionDetail
            transaction={selectedTransaction}
            onClose={() => setSelectedTransaction(null)}
          />
        )}
      </div>
    </DashboardLayout>
  );
}
