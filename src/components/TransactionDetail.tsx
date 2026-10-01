'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Clock,
  User,
  CreditCard,
  Receipt,
  MapPin,
  Calendar,
  Package,
  DollarSign,
  ArrowRight,
  CalendarClock
} from 'lucide-react';
import { TransactionCombined } from '@/types/transactions';

interface Props {
  transaction: TransactionCombined;
  onClose: () => void;
}

export default function TransactionDrawer({ transaction, onClose }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setTimeout(() => setIsOpen(true), 10);
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleClose = () => {
    setIsOpen(false);
    setTimeout(onClose, 300);
  };

  const formatCurrency = (value?: number | string | null) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num === null || num === undefined || isNaN(num)) return '-';
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(num);
  };

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateOnly = (dateStr?: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '-';
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusInfo = (status?: string | null) => {
    if (!status) return { bg: 'bg-slate-100', text: 'text-slate-700', label: 'Unknown' };
    const statusLower = status.toLowerCase();
    if (statusLower === 'finished' || statusLower === 'completed') {
      return { bg: 'bg-emerald-100', text: 'text-emerald-700', label: 'Completed' };
    }
    if (statusLower === 'void' || statusLower === 'cancelled') {
      return { bg: 'bg-rose-100', text: 'text-rose-700', label: 'Void' };
    }
    return { bg: 'bg-amber-100', text: 'text-amber-700', label: status };
  };

  const statusInfo = getStatusInfo(transaction.status);

  const getStayDuration = () => {
    if (!transaction.sales_date_in || !transaction.sales_date_out) return '-';
    const inTime = new Date(transaction.sales_date_in);
    const outTime = new Date(transaction.sales_date_out);
    if (isNaN(inTime.getTime()) || isNaN(outTime.getTime())) return '-';

    const diffMs = outTime.getTime() - inTime.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;

    if (hours > 0) return `${hours}h ${mins}m`;
    return `${mins}m`;
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[440px] lg:w-[480px] bg-white shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 z-10">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <Receipt size={20} className="text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">Transaction Detail</h2>
                <p className="text-xs text-slate-500 font-mono">{transaction.sales_num}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-slate-500" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(100vh-73px)] overflow-y-auto">
          {/* Status Banner */}
          <div className="px-5 py-4 bg-gradient-to-r from-slate-800 to-slate-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.text}`}>
                  {statusInfo.label}
                </span>
                <span className="flex items-center gap-1.5 text-white/80 text-sm">
                  <MapPin size={14} />
                  {transaction.branch_name || '-'}
                </span>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/60">Total Amount</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(transaction.total_amount)}</p>
              </div>
            </div>
          </div>

          {/* Info Grid */}
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Transaction Info</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Bill Number</p>
                <p className="text-sm font-medium text-slate-900 truncate">{transaction.bill_num || '-'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Sales Date</p>
                <p className="text-sm font-medium text-slate-900">{formatDateOnly(transaction.sales_date)}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Payment Method</p>
                <p className="text-sm font-medium text-slate-900">{transaction.payment_method || '-'}</p>
              </div>
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Cashier</p>
                <p className="text-sm font-medium text-slate-900 truncate">{transaction.cashier_id || '-'}</p>
              </div>
            </div>
          </div>

          {/* Timeline */}
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Timeline</h3>
            <div className="relative pl-4">
              <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-slate-200"></div>

              <div className="space-y-4">
                <div className="relative">
                  <div className="absolute -left-4 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                    <ArrowRight size={12} className="text-blue-600" />
                  </div>
                  <div className="ml-2">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Time In</p>
                    <p className="text-sm font-medium text-slate-900">{formatDate(transaction.sales_date_in)}</p>
                  </div>
                </div>

                {transaction.order_time && (
                  <div className="relative">
                    <div className="absolute -left-4 w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                      <CalendarClock size={12} className="text-emerald-600" />
                    </div>
                    <div className="ml-2">
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Order Time</p>
                      <p className="text-sm font-medium text-slate-900">{formatDate(transaction.order_time)}</p>
                    </div>
                  </div>
                )}

                <div className="relative">
                  <div className="absolute -left-4 w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                    <ArrowRight size={12} className="text-purple-600" />
                  </div>
                  <div className="ml-2">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Time Out</p>
                    <p className="text-sm font-medium text-slate-900">{formatDate(transaction.sales_date_out)}</p>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute -left-4 w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center">
                    <Clock size={12} className="text-amber-600" />
                  </div>
                  <div className="ml-2">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide">Duration</p>
                    <p className="text-sm font-semibold text-amber-600">{getStayDuration()}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Order Item */}
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Order Item</h3>
            <div className="bg-slate-50 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500">#</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-slate-500">Item</th>
                    <th className="px-3 py-2 text-center text-[10px] font-semibold text-slate-500">Qty</th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500">Price</th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-slate-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-slate-200">
                    <td className="px-3 py-2.5 text-xs text-slate-400">{transaction.line_number || '-'}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium text-slate-900">{transaction.menu_name || 'N/A'}</p>
                      {transaction.menu_category && (
                        <p className="text-xs text-slate-500">{transaction.menu_category}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 text-center">{transaction.quantity ?? '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 text-right">{formatCurrency(transaction.unit_price)}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-slate-900 text-right">
                      {formatCurrency(transaction.total_item)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="px-5 py-4 border-b border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Payment Summary</h3>
            <div className="bg-slate-50 rounded-xl p-4">
              <div className="space-y-2.5">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Subtotal</span>
                  <span className="text-slate-700 font-medium">{formatCurrency(transaction.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Discount</span>
                  <span className="text-rose-600 font-medium">-{formatCurrency(transaction.discount_amount)}</span>
                </div>

                <div className="border-t border-slate-200 pt-2.5 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-slate-900">Grand Total</span>
                    <span className="text-xl font-bold text-blue-600">
                      {formatCurrency(transaction.total_amount)}
                    </span>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-2.5 mt-2 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Cash Received</span>
                    <span className="text-slate-700 font-medium">{formatCurrency(transaction.cash_received)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500">Change Given</span>
                    <span className="text-slate-700 font-medium">{formatCurrency(transaction.change_given)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          {(transaction.customer_name || transaction.employee_name || transaction.pax_total) && (
            <div className="px-5 py-4 border-b border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Customer & Employee</h3>
              <div className="grid grid-cols-2 gap-3">
                {transaction.customer_name && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Customer</p>
                    <p className="text-sm font-medium text-slate-900 truncate">{transaction.customer_name}</p>
                  </div>
                )}
                {transaction.employee_name && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Employee</p>
                    <p className="text-sm font-medium text-slate-900 truncate">{transaction.employee_name}</p>
                  </div>
                )}
                {transaction.regular_member_name && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Member</p>
                    <p className="text-sm font-medium text-slate-900 truncate">{transaction.regular_member_name}</p>
                  </div>
                )}
                {transaction.pax_total !== undefined && transaction.pax_total !== null && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Pax</p>
                    <p className="text-sm font-medium text-slate-900">{transaction.pax_total}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Location Info */}
          {(transaction.brand || transaction.city || transaction.area) && (
            <div className="px-5 py-4">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Location</h3>
              <div className="grid grid-cols-2 gap-3">
                {transaction.brand && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Brand</p>
                    <p className="text-sm font-medium text-slate-900">{transaction.brand}</p>
                  </div>
                )}
                {transaction.city && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">City</p>
                    <p className="text-sm font-medium text-slate-900">{transaction.city}</p>
                  </div>
                )}
                {transaction.area && (
                  <div className="bg-slate-50 rounded-lg p-3">
                    <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-1">Area</p>
                    <p className="text-sm font-medium text-slate-900">{transaction.area}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="h-8" />
        </div>
      </div>
    </>
  );
}
