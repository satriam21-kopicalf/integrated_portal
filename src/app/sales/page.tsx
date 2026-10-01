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
  Eye
} from 'lucide-react';
import { TransactionCombined } from '@/types/transactions';

interface PaginationInfo {
  cursor: string | null;
  hasMore: boolean;
  limit: number;
}

interface SummaryInfo {
  totalRows: number;
  totalHeaders: number;
  totalItems: number;
  totalRevenue: number;
  totalTransactions: number;
  avgTransactionValue: number;
}

interface Branch {
  branch_name: string;
  count: number;
}

const DEFAULT_LIMIT = 100;

export default function SalesPage() {
  const [data, setData] = useState<TransactionCombined[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchesLoading, setBranchesLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({ cursor: null, hasMore: false, limit: DEFAULT_LIMIT });
  const [summary, setSummary] = useState<SummaryInfo>({
    totalRows: 0,
    totalHeaders: 0,
    totalItems: 0,
    totalRevenue: 0,
    totalTransactions: 0,
    avgTransactionValue: 0
  });
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [branch, setBranch] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionCombined | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
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

    setLoading(true);
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

        // Summary from loaded data
        const loadedData = isReset || !cursor ? (result.data || []) : [...(data || []), ...(result.data || [])];
        calculateSummary(loadedData);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [search, dateFrom, dateTo, branch]);

  // Calculate summary from loaded data
  const calculateSummary = (loadedData: TransactionCombined[]) => {
    if (!loadedData || loadedData.length === 0) {
      setSummary({
        totalRows: 0,
        totalHeaders: 0,
        totalItems: 0,
        totalRevenue: 0,
        totalTransactions: 0,
        avgTransactionValue: 0
      });
      return;
    }

    // Group by sales_num for unique transactions
    const uniqueTransactions = new Map<string, { total: number; items: number }>();
    let totalItems = 0;

    for (const row of loadedData) {
      const existing = uniqueTransactions.get(row.sales_num);
      const total = parseFloat(String(row.total_amount || 0));

      if (existing) {
        existing.items += 1;
      } else {
        uniqueTransactions.set(row.sales_num, { total, items: 1 });
      }

      if (row.line_number) totalItems++;
    }

    const totalRevenue = Array.from(uniqueTransactions.values()).reduce((sum, t) => sum + t.total, 0);
    const totalTransactions = uniqueTransactions.size;

    setSummary({
      totalRows: loadedData.length,
      totalHeaders: totalTransactions,
      totalItems: totalItems,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      totalTransactions,
      avgTransactionValue: totalTransactions > 0 ? Math.round((totalRevenue / totalTransactions) * 100) / 100 : 0
    });
  };

  useEffect(() => {
    isMounted.current = true;
    fetchData(null, true);

    return () => {
      isMounted.current = false;
    };
  }, [fetchData]);

  // Debounced search
  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setSearch(value);
    }, 500);
  };

  const handleSearch = () => {
    setSearch(localSearch);
    fetchData(null, true);
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
    setLocalSearch('');
    fetchData(null, true);
  };

  const loadMore = () => {
    if (pagination.cursor && !loading) {
      fetchData(pagination.cursor);
    }
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

  const hasActiveFilters = dateFrom || dateTo || branch || search;

  const toggleRowExpand = (salesNum: string) => {
    setExpandedRow(expandedRow === salesNum ? null : salesNum);
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-100">
        {/* Page Header */}
        <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-3 sm:py-4">
          {/* Title Row */}
          <div className="flex items-center justify-between gap-2 mb-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-slate-900">Sales Transactions</h1>
              <p className="text-xs sm:text-sm text-slate-500">
                {formatNumber(summary.totalRows)} rows • {formatNumber(summary.totalTransactions)} transactions
              </p>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
              >
                <Filter size={16} />
              </button>
              <ExportButton dateFrom={dateFrom} dateTo={dateTo} branch={branch} />
            </div>
          </div>

          {/* Search Bar - Inside Header */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Search sales number, bill, branch..."
                value={localSearch}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
            <button
              onClick={handleSearch}
              className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </div>

          {/* Summary Stats - Inline Design */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Revenue:</span>
              <span className="font-semibold text-emerald-600">{formatCurrency(summary.totalRevenue)}</span>
            </div>
            <div className="w-px h-4 bg-slate-300 hidden sm:block"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Transactions:</span>
              <span className="font-semibold text-blue-600">{formatNumber(summary.totalTransactions)}</span>
            </div>
            <div className="w-px h-4 bg-slate-300 hidden sm:block"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Items:</span>
              <span className="font-semibold text-purple-600">{formatNumber(summary.totalItems)}</span>
            </div>
            <div className="w-px h-4 bg-slate-300 hidden sm:block"></div>
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">Avg:</span>
              <span className="font-semibold text-amber-600">{formatCurrency(summary.avgTransactionValue)}</span>
            </div>
          </div>

          {/* Filter Panel - Collapsible */}
          {showFilters && (
            <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex flex-col gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Branch</label>
                  <div className="relative">
                    <select
                      value={branch}
                      onChange={(e) => handleBranchChange(e.target.value)}
                      className="w-full pl-3 pr-8 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 bg-white appearance-none"
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
                    <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => handleDateFrom(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => handleDateTo(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                    />
                  </div>
                </div>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Clear All Filters
                </button>
              </div>
            </div>
          )}

          {/* Active Filters Pills */}
          {hasActiveFilters && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {branch && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs">
                  <span className="truncate max-w-[120px]">{branch}</span>
                  <button onClick={() => handleBranchChange('')} className="hover:text-blue-800 flex-shrink-0">
                    <X size={12} />
                  </button>
                </span>
              )}
              {dateFrom && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs">
                  From: {dateFrom}
                  <button onClick={() => handleDateFrom('')} className="hover:text-blue-800">
                    <X size={12} />
                  </button>
                </span>
              )}
              {dateTo && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs">
                  To: {dateTo}
                  <button onClick={() => handleDateTo('')} className="hover:text-blue-800">
                    <X size={12} />
                  </button>
                </span>
              )}
              {search && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-600 rounded text-xs">
                  &quot;{search}&quot;
                  <button onClick={() => { setSearch(''); setLocalSearch(''); }} className="hover:text-blue-800">
                    <X size={12} />
                  </button>
                </span>
              )}
            </div>
          )}
        </div>

        {/* Mobile Card View / Desktop Table View */}
        <div className="p-3 sm:p-4 space-y-2">
          {/* Loading State */}
          {loading && data.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <p className="text-sm text-slate-500">Loading transactions...</p>
            </div>
          )}

          {/* Empty State */}
          {!loading && data.length === 0 && (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <p className="font-medium text-slate-700">No transactions found</p>
              <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters</p>
            </div>
          )}

          {/* Mobile Card View */}
          <div className="lg:hidden space-y-2">
            {data.map((tx, index) => {
              const isExpanded = expandedRow === tx.sales_num;
              return (
                <div
                  key={`${tx.sales_num}-${tx.line_number || index}`}
                  className={`bg-white rounded-xl border ${isExpanded ? 'border-blue-300 shadow-md' : 'border-slate-200'} overflow-hidden`}
                >
                  {/* Card Header */}
                  <div className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-blue-600 text-sm truncate">{tx.sales_num || '-'}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{formatDate(tx.sales_date)}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="font-bold text-slate-900">{formatCurrency(tx.total_amount)}</p>
                        {getStatusBadge(tx.status)}
                      </div>
                    </div>

                    {/* Quick Info Row */}
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-xs text-slate-500">
                      <span className="truncate max-w-[100px]">{tx.branch_name || '-'}</span>
                      <span>•</span>
                      <span>{tx.payment_method || '-'}</span>
                      <span>•</span>
                      <span>{tx.menu_name || '-'}</span>
                    </div>
                  </div>

                  {/* Expand Button */}
                  <button
                    onClick={() => toggleRowExpand(tx.sales_num)}
                    className="w-full flex items-center justify-center gap-1 py-2 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp size={14} />
                        Hide Details
                      </>
                    ) : (
                      <>
                        <ChevronDown size={14} />
                        View Details
                      </>
                    )}
                  </button>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="p-3 bg-slate-50 border-t border-slate-200">
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <p className="text-slate-400">Bill Number</p>
                          <p className="font-medium text-slate-700">{tx.bill_num || '-'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Branch</p>
                          <p className="font-medium text-slate-700">{tx.branch_name || '-'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Payment</p>
                          <p className="font-medium text-slate-700">{tx.payment_method || '-'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Status</p>
                          <p className="font-medium text-slate-700">{tx.status || '-'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Menu</p>
                          <p className="font-medium text-slate-700">{tx.menu_name || '-'}</p>
                        </div>
                        <div>
                          <p className="text-slate-400">Quantity</p>
                          <p className="font-medium text-slate-700">{tx.quantity ?? '-'}</p>
                        </div>
                        <div className="col-span-2">
                          <p className="text-slate-400">Total</p>
                          <p className="font-bold text-slate-900">{formatCurrency(tx.total_amount)}</p>
                        </div>
                      </div>

                      {/* View Full Detail Button */}
                      <button
                        onClick={() => setSelectedTransaction(tx)}
                        className="w-full mt-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                      >
                        <Eye size={16} />
                        View Full Details
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
                  <tr>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Sales #</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Bill #</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Date</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Branch</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap hidden xl:table-cell">Payment</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Total</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap">Status</th>
                    <th className="px-3 py-2.5 text-center text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">#</th>
                    <th className="px-3 py-2.5 text-left text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Menu</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Qty</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Price</th>
                    <th className="px-3 py-2.5 text-right text-[10px] font-semibold text-slate-600 uppercase tracking-wider whitespace-nowrap hidden lg:table-cell">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data.map((tx, index) => (
                    <tr
                      key={`${tx.sales_num}-${tx.line_number || index}`}
                      className={`hover:bg-slate-50 transition-colors cursor-pointer ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                      onClick={() => setSelectedTransaction(tx)}
                    >
                      <td className="px-3 py-2.5">
                        <span className="font-semibold text-blue-600 text-xs">{tx.sales_num || '-'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 hidden md:table-cell">
                        {tx.bill_num || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 whitespace-nowrap">
                        {formatDate(tx.sales_date)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 hidden lg:table-cell">
                        <span className="max-w-[120px] truncate block">{tx.branch_name || '-'}</span>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 hidden xl:table-cell">
                        {tx.payment_method || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-semibold text-slate-900 text-right whitespace-nowrap">
                        {formatCurrency(tx.total_amount)}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        {getStatusBadge(tx.status)}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-500 text-center hidden lg:table-cell">
                        {tx.line_number || '-'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 hidden lg:table-cell">
                        <div className="max-w-[150px] truncate">
                          <span className="font-medium">{tx.menu_name || '-'}</span>
                          {tx.menu_category && (
                            <span className="block text-[10px] text-slate-400">{tx.menu_category}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 text-right hidden lg:table-cell">
                        {tx.quantity ?? '-'}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-slate-600 text-right hidden lg:table-cell">
                        {formatCurrency(tx.unit_price)}
                      </td>
                      <td className="px-3 py-2.5 text-xs font-medium text-slate-900 text-right hidden lg:table-cell">
                        {formatCurrency(tx.total_item)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination Controls */}
          {data.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 px-4 py-3">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="text-xs sm:text-sm text-slate-600 order-2 sm:order-1">
                  Showing <span className="font-medium">{formatNumber(data.length)}</span> rows
                  {pagination.hasMore && (
                    <span className="ml-1">(Load more for next page)</span>
                  )}
                </div>
                <div className="flex items-center gap-2 order-1 sm:order-2">
                  <button
                    onClick={() => fetchData(null, true)}
                    disabled={loading}
                    className="px-3 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
                  >
                    Reset
                  </button>
                  <button
                    onClick={loadMore}
                    disabled={loading || !pagination.hasMore}
                    className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                  >
                    {loading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : (
                      <>
                        Load More
                        <ChevronRight size={16} />
                      </>
                    )}
                  </button>
                </div>
              </div>
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
