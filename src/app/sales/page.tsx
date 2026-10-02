'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import TransactionDetail from '@/components/TransactionDetail';
import ExportButton from '@/components/ExportButton';
import {
  Search,
  ChevronRight,
  X,
  ChevronDown,
  Filter,
  ChevronUp,
  Eye,
  Loader2,
  Package,
  SlidersHorizontal
} from 'lucide-react';
import { TransactionCombined } from '@/types/transactions';

interface PaginationInfo {
  cursor: string | null;
  hasMore: boolean;
  limit: number;
}

interface Branch {
  branch_name: string;
  count: number;
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
  const [branch, setBranch] = useState('');

  // UI State
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionCombined | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

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
      if (search) params.append('search', search);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      if (branch) params.append('branch', branch);

      const res = await fetch(`/api/transactions?${params}`);
      const result = await res.json();

      if (isMounted.current) {
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
      if (isMounted.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  }, [search, dateFrom, dateTo, branch]);

  useEffect(() => {
    isMounted.current = true;
    fetchData(null, true);

    return () => {
      isMounted.current = false;
    };
  }, []);

  // Auto-search as you type
  const handleSearchChange = (value: string) => {
    setSearch(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchData(null, true);
    }, 400);
  };

  const handleDateFrom = (value: string) => {
    setDateFrom(value);
    fetchData(null, true);
  };

  const handleDateTo = (value: string) => {
    setDateTo(value);
    fetchData(null, true);
  };

  const handleBranchChange = (value: string) => {
    setBranch(value);
    fetchData(null, true);
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setBranch('');
    setSearch('');
    fetchData(null, true);
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

  const hasActiveFilters = dateFrom || dateTo || branch;
  const activeFilterCount = [dateFrom, dateTo, branch].filter(Boolean).length;

  const toggleRowExpand = (salesNum: string) => {
    setExpandedRow(expandedRow === salesNum ? null : salesNum);
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-100">
        {/* Page Header */}
        <div className="bg-white border-b border-slate-200">
          {/* Top Bar */}
          <div className="px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900">Sales Transactions</h1>
                <p className="text-sm text-slate-500">
                  {formatNumber(data.length)} rows displayed
                  {pagination.hasMore && ' (more available)'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    showFilters || hasActiveFilters
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  <SlidersHorizontal size={16} />
                  <span>Filter</span>
                  {activeFilterCount > 0 && (
                    <span className="w-5 h-5 rounded-full bg-white/20 text-xs flex items-center justify-center">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <ExportButton dateFrom={dateFrom} dateTo={dateTo} branch={branch} />
              </div>
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="px-4 pb-4 border-t border-slate-100">
              <div className="mt-3 p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {/* Branch */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">Branch</label>
                    <div className="relative">
                      <select
                        value={branch}
                        onChange={(e) => handleBranchChange(e.target.value)}
                        className="w-full pl-3 pr-8 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white appearance-none"
                      >
                        <option value="">All Branches</option>
                        {branchesLoading ? (
                          <option value="" disabled>Loading...</option>
                        ) : (
                          branches.map((b) => (
                            <option key={b.branch_name} value={b.branch_name}>
                              {b.branch_name} ({formatNumber(b.count)})
                            </option>
                          ))
                        )}
                      </select>
                      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  {/* Date From */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">From Date</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => handleDateFrom(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  {/* Date To */}
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1.5">To Date</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => handleDateTo(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>

                  {/* Clear */}
                  <div className="flex items-end">
                    <button
                      onClick={clearFilters}
                      className="w-full px-4 py-2.5 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>

                {/* Active Filter Tags */}
                {hasActiveFilters && (
                  <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-200">
                    {branch && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        Branch: {branch}
                        <button onClick={() => handleBranchChange('')} className="hover:text-blue-900">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                    {dateFrom && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        From: {dateFrom}
                        <button onClick={() => handleDateFrom('')} className="hover:text-blue-900">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                    {dateTo && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 rounded-full text-xs font-medium">
                        To: {dateTo}
                        <button onClick={() => handleDateTo('')} className="hover:text-blue-900">
                          <X size={12} />
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Content Area */}
        <div className="p-4">
          {/* Mobile Card View */}
          <div className="lg:hidden">
            {/* Search in Card View */}
            <div className="mb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                <input
                  type="text"
                  placeholder="Search sales number, bill, branch..."
                  value={search}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 text-sm border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <div className="w-10 h-10 mx-auto mb-3 relative">
                  <div className="absolute inset-0 w-10 h-10 border-3 border-slate-200 rounded-full"></div>
                  <div className="absolute inset-0 w-10 h-10 border-3 border-t-blue-600 rounded-full animate-spin"></div>
                </div>
                <p className="text-sm font-medium text-slate-600">Loading transactions...</p>
              </div>
            )}

            {/* Empty State */}
            {!loading && data.length === 0 && (
              <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
                <div className="w-12 h-12 mx-auto mb-3 bg-slate-100 rounded-full flex items-center justify-center">
                  <Package size={24} className="text-slate-400" />
                </div>
                <p className="text-sm font-medium text-slate-600">No transactions found</p>
                <p className="text-xs text-slate-400 mt-1">Try adjusting your filters</p>
              </div>
            )}

            {/* Card List */}
            {!loading && data.map((tx, index) => {
              const isExpanded = expandedRow === tx.sales_num;
              return (
                <div
                  key={`${tx.sales_num}-${tx.line_number || index}`}
                  className={`bg-white rounded-xl border mb-2 overflow-hidden transition-all ${
                    isExpanded ? 'border-blue-300 shadow-md' : 'border-slate-200'
                  }`}
                >
                  <div className="p-3" onClick={() => toggleRowExpand(tx.sales_num)}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-blue-600 text-sm truncate">{tx.sales_num || '-'}</p>
                        <p className="text-xs text-slate-500">{formatDate(tx.sales_date)}</p>
                      </div>
                      <div className="text-right ml-2">
                        <p className="font-bold text-slate-900">{formatCurrency(tx.total_amount)}</p>
                        {getStatusBadge(tx.status)}
                      </div>
                    </div>
                    <div className="flex gap-2 mt-2">
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600 truncate max-w-[140px]">
                        {tx.branch_name || '-'}
                      </span>
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                        {tx.payment_method || '-'}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => toggleRowExpand(tx.sales_num)}
                    className="w-full flex items-center justify-center gap-1 py-2 text-xs font-medium text-blue-600 bg-blue-50 border-t border-blue-100"
                  >
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    {isExpanded ? 'Less' : 'More'}
                  </button>

                  {isExpanded && (
                    <div className="p-3 bg-slate-50 border-t border-slate-200">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div><p className="text-slate-400">Bill</p><p className="font-medium">{tx.bill_num || '-'}</p></div>
                        <div><p className="text-slate-400">Menu</p><p className="font-medium">{tx.menu_name || '-'}</p></div>
                        <div><p className="text-slate-400">Qty</p><p className="font-medium">{tx.quantity ?? '-'}</p></div>
                        <div><p className="text-slate-400">Price</p><p className="font-medium">{formatCurrency(tx.unit_price)}</p></div>
                      </div>
                      <button
                        onClick={() => setSelectedTransaction(tx)}
                        className="w-full mt-3 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg flex items-center justify-center gap-1"
                      >
                        <Eye size={14} /> Full Details
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop Table View */}
          <div className="hidden lg:block bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead className="bg-slate-50 border-b border-slate-200">
                  {/* Table Header Row */}
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      <div className="flex items-center gap-2">
                        Sales #
                      </div>
                    </th>
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
                  {/* Search Row */}
                  <tr className="bg-white">
                    <th className="px-4 py-2">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                        <input
                          type="text"
                          placeholder="Search..."
                          value={search}
                          onChange={(e) => handleSearchChange(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-500"
                        />
                      </div>
                    </th>
                    <th className="px-4 py-2 hidden md:table-cell"></th>
                    <th className="px-4 py-2"></th>
                    <th className="px-4 py-2 hidden lg:table-cell"></th>
                    <th className="px-4 py-2 hidden xl:table-cell"></th>
                    <th className="px-4 py-2"></th>
                    <th className="px-4 py-2"></th>
                    <th className="px-4 py-2 hidden lg:table-cell"></th>
                    <th className="px-4 py-2 hidden lg:table-cell"></th>
                    <th className="px-4 py-2 hidden lg:table-cell"></th>
                    <th className="px-4 py-2 hidden lg:table-cell"></th>
                    <th className="px-4 py-2 hidden lg:table-cell"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {/* Loading Row */}
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
                  {/* Empty Row */}
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
                  {/* Data Rows */}
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
          </div>

          {/* Pagination Footer */}
          {!loading && data.length > 0 && (
            <div className="mt-4 bg-white rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-sm text-slate-600 order-2 sm:order-1">
                  Showing <span className="font-semibold">{formatNumber(data.length)}</span> rows
                  {pagination.hasMore && <span className="text-slate-400 ml-1">(more available)</span>}
                </div>
                <div className="flex items-center gap-2 order-1 sm:order-2">
                  <button
                    onClick={() => fetchData(null, true)}
                    className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    onClick={loadMore}
                    disabled={loadingMore || !pagination.hasMore}
                    className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 size={16} className="animate-spin" /> Loading...
                      </>
                    ) : (
                      <>Load More <ChevronRight size={16} /></>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Loading More */}
          {loadingMore && (
            <div className="mt-4 flex items-center justify-center gap-2 py-3 text-sm text-slate-500">
              <Loader2 size={18} className="animate-spin text-blue-600" />
              <span>Loading more transactions...</span>
            </div>
          )}
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
