'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import DashboardLayout from '@/components/layout/DashboardLayout';
import TransactionDetail from '@/components/TransactionDetail';
import ExportButton from '@/components/ExportButton';
import {
  Search,
  ChevronRight,
  X,
  FileSpreadsheet,
  ChevronsLeft,
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
}

const DEFAULT_LIMIT = 50;

export default function SalesPage() {
  const [data, setData] = useState<TransactionCombined[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationInfo>({ cursor: null, hasMore: false, limit: DEFAULT_LIMIT });
  const [summary, setSummary] = useState<SummaryInfo>({ totalRows: 0, totalHeaders: 0, totalItems: 0 });
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<TransactionCombined | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [localSearch, setLocalSearch] = useState('');
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const limitRef = useRef(DEFAULT_LIMIT);

  const isMounted = useRef(true);

  const fetchData = useCallback(async (cursor: string | null = null, isReset: boolean = false) => {
    if (!isMounted.current) return;

    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.append('limit', limitRef.current.toString());

      if (cursor) params.append('cursor', cursor);
      if (search) params.append('search', search);
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);

      const res = await fetch(`/api/transactions?${params}`);
      const result = await res.json();

      if (isMounted.current) {
        if (isReset || !cursor) {
          setData(result.data || []);
        } else {
          setData(prev => [...(prev || []), ...(result.data || [])]);
        }
        setPagination(result.pagination || { cursor: null, hasMore: false, limit: DEFAULT_LIMIT });
        setSummary(result.summary || { totalRows: 0, totalHeaders: 0, totalItems: 0 });
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [search, dateFrom, dateTo]);

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

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
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
    }).format(value);
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

  const hasActiveFilters = dateFrom || dateTo || search;

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-100">
        {/* Page Header */}
        <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Sales Transactions</h1>
              <p className="text-sm text-slate-500 mt-0.5">
                {summary.totalRows.toLocaleString()} rows ({summary.totalHeaders.toLocaleString()} transactions)
              </p>
            </div>

            {/* Compact Search & Tools */}
            <div className="flex items-center gap-2">
              {/* Compact Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Search..."
                  value={localSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="w-32 sm:w-48 pl-8 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {/* Filter Button */}
              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`p-2 rounded-lg transition-colors ${
                  showFilters || hasActiveFilters
                    ? 'bg-blue-100 text-blue-600'
                    : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                }`}
                title="Filter"
              >
                <div className="w-4 h-4 relative">
                  <Image
                    src="/assets/filter.png"
                    alt="Filter"
                    fill
                    className="object-contain"
                  />
                </div>
              </button>

              {/* Export Button */}
              <ExportButton dateFrom={dateFrom} dateTo={dateTo} />
            </div>
          </div>

          {/* Filter Panel */}
          {showFilters && (
            <div className="mt-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
              <div className="flex flex-col sm:flex-row gap-4 items-end">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => handleDateFrom(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-slate-600 mb-1">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => handleDateTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                  />
                </div>
                <button
                  onClick={clearFilters}
                  className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                >
                  Clear
                </button>
              </div>
            </div>
          )}

          {/* Active Filters Summary */}
          {hasActiveFilters && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
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
            </div>
          )}
        </div>

        {/* Table Container */}
        <div className="p-4 sm:p-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            {/* Table */}
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
                  {loading && data.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-500">
                          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mb-3"></div>
                          <span className="text-sm font-medium">Loading transactions...</span>
                        </div>
                      </td>
                    </tr>
                  ) : data.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="px-4 py-16 text-center">
                        <div className="flex flex-col items-center justify-center text-slate-500">
                          <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mb-3">
                            <FileSpreadsheet size={28} className="text-slate-400" />
                          </div>
                          <p className="font-medium text-slate-700">No transactions found</p>
                          <p className="text-xs text-slate-400 mt-1">Try adjusting your search or filters</p>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    data.map((tx, index) => (
                      <tr
                        key={`${tx.sales_num}-${tx.line_number || index}`}
                        className={`hover:bg-slate-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
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
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Load More / Pagination */}
            {data.length > 0 && (
              <div className="bg-slate-50 border-t border-slate-200 px-4 sm:px-6 py-3 sm:py-4">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-xs sm:text-sm text-slate-600 order-2 sm:order-1">
                    Showing <span className="font-medium">{data.length}</span> rows
                    {pagination.hasMore && (
                      <span className="ml-1">(more available)</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 order-1 sm:order-2">
                    <button
                      onClick={() => fetchData(null, true)}
                      disabled={loading}
                      className="p-2 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50 transition-colors"
                      title="Reset"
                    >
                      <ChevronsLeft size={16} />
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
        </div>

        {/* Detail Modal */}
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
