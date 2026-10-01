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
  TrendingDown,
  ArrowRight,
  ShoppingBag,
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
    // Animate in
    setTimeout(() => setIsOpen(true), 10);

    // Prevent body scroll
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

  // Calculate stay duration
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
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[480px] lg:w-[560px] bg-white shadow-2xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-200 z-10">
          <div className="flex items-center justify-between px-4 sm:px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <Receipt size={20} className="text-blue-600" />
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
          {/* Status & Branch Banner */}
          <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.bg} ${statusInfo.text}`}>
                  {statusInfo.label}
                </span>
              </div>
              <div className="text-right text-white">
                <p className="text-xs opacity-80">Total</p>
                <p className="text-xl font-bold">{formatCurrency(transaction.total_amount)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-3 text-white/80 text-sm">
              <MapPin size={14} />
              <span>{transaction.branch_name || '-'}</span>
            </div>
          </div>

          {/* Main Info Section */}
          <div className="px-4 sm:px-6 py-4">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Transaction Info</h3>
            <div className="grid grid-cols-2 gap-3">
              <InfoCard icon={<Receipt size={14} />} label="Bill Number" value={transaction.bill_num || '-'} />
              <InfoCard icon={<Calendar size={14} />} label="Sales Date" value={formatDateOnly(transaction.sales_date)} />
              <InfoCard icon={<CreditCard size={14} />} label="Payment" value={transaction.payment_method || '-'} />
              <InfoCard icon={<User size={14} />} label="Cashier" value={transaction.cashier_id || '-'} />
            </div>
          </div>

          {/* Timeline Section */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Timeline</h3>
            <div className="relative">
              {/* Timeline Line */}
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-slate-200" />

              {/* Timeline Items */}
              <div className="space-y-4">
                <TimelineItem
                  icon={<ArrowRight size={12} />}
                  iconBg="bg-blue-100"
                  iconColor="text-blue-600"
                  label="Time In"
                  value={formatDate(transaction.sales_date_in)}
                />
                <TimelineItem
                  icon={<CalendarClock size={12} />}
                  iconBg="bg-emerald-100"
                  iconColor="text-emerald-600"
                  label="Order Time"
                  value={formatDate(transaction.order_time)}
                />
                <TimelineItem
                  icon={<ArrowRight size={12} />}
                  iconBg="bg-purple-100"
                  iconColor="text-purple-600"
                  label="Time Out"
                  value={formatDate(transaction.sales_date_out)}
                />
                <TimelineItem
                  icon={<Clock size={12} />}
                  iconBg="bg-amber-100"
                  iconColor="text-amber-600"
                  label="Duration"
                  value={getStayDuration()}
                  isLast
                />
              </div>
            </div>
          </div>

          {/* Order Item Section */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100">
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
                <tbody className="divide-y divide-slate-200">
                  <tr>
                    <td className="px-3 py-2.5 text-xs text-slate-400">{transaction.line_number || '-'}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium text-slate-900">{transaction.menu_name || 'N/A'}</p>
                      {transaction.menu_category && (
                        <p className="text-xs text-slate-500">{transaction.menu_category}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 text-center">
                      {transaction.quantity ?? '-'}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600 text-right">
                      {formatCurrency(transaction.unit_price)}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-medium text-slate-900 text-right">
                      {formatCurrency(transaction.total_item)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Summary Section */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Payment Summary</h3>
            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-xl p-4">
              <div className="space-y-2.5">
                <SummaryRow label="Subtotal" value={formatCurrency(transaction.subtotal)} />
                <SummaryRow label="Discount" value={`-${formatCurrency(transaction.discount_amount)}`} isDiscount />
                <div className="border-t border-slate-200 pt-2.5 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-base font-semibold text-slate-900">Grand Total</span>
                    <span className="text-xl font-bold text-blue-600">
                      {formatCurrency(transaction.total_amount)}
                    </span>
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-2.5 mt-2 space-y-1.5">
                  <SummaryRow label="Cash Received" value={formatCurrency(transaction.cash_received)} />
                  <SummaryRow label="Change Given" value={formatCurrency(transaction.change_given)} />
                </div>
              </div>
            </div>
          </div>

          {/* Additional Info Section */}
          {(transaction.customer_name || transaction.employee_name || transaction.regular_member_name) && (
            <div className="px-4 sm:px-6 py-4 border-t border-slate-100">
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Customer & Employee</h3>
              <div className="grid grid-cols-2 gap-3">
                {transaction.customer_name && (
                  <InfoCard icon={<User size={14} />} label="Customer" value={transaction.customer_name} />
                )}
                {transaction.employee_name && (
                  <InfoCard icon={<User size={14} />} label="Employee" value={transaction.employee_name} />
                )}
                {transaction.regular_member_name && (
                  <InfoCard icon={<Receipt size={14} />} label="Member" value={transaction.regular_member_name} />
                )}
                {transaction.loyalty_member_type && (
                  <InfoCard icon={<Package size={14} />} label="Member Type" value={transaction.loyalty_member_type} />
                )}
              </div>
            </div>
          )}

          {/* Visit Info */}
          <div className="px-4 sm:px-6 py-4 border-t border-slate-100">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Visit Information</h3>
            <div className="grid grid-cols-2 gap-3">
              <InfoCard label="Pax Total" value={transaction.pax_total?.toString() || '0'} />
              <InfoCard label="Visit Purpose" value={transaction.visit_purpose || '-'} />
              {transaction.brand && <InfoCard label="Brand" value={transaction.brand} />}
              {transaction.city && <InfoCard label="City" value={transaction.city} />}
            </div>
          </div>

          {/* Footer Spacing */}
          <div className="h-8" />
        </div>
      </div>
    </>
  );
}

function InfoCard({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-slate-400">{icon}</span>}
        <span className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-sm font-medium text-slate-900 truncate">{value}</p>
    </div>
  );
}

function TimelineItem({
  icon,
  iconBg,
  iconColor,
  label,
  value,
  isLast = false
}: {
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <div className="relative flex items-start gap-3 pl-1">
      <div className={`relative z-10 w-7 h-7 rounded-full ${iconBg} flex items-center justify-center ${iconColor}`}>
        {icon}
      </div>
      <div className="flex-1 pt-0.5">
        <p className="text-xs text-slate-500">{label}</p>
        <p className="text-sm font-medium text-slate-900">{value}</p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, isDiscount = false }: { label: string; value: string; isDiscount?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-slate-600">{label}</span>
      <span className={`font-medium ${isDiscount ? 'text-rose-600' : 'text-slate-900'}`}>{value}</span>
    </div>
  );
}
