'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Clock,
  CreditCard,
  Receipt,
  MapPin,
  Calendar,
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
    if (!status) return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Unknown' };
    const statusLower = status.toLowerCase();
    if (statusLower === 'finished' || statusLower === 'completed') {
      return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Completed' };
    }
    if (statusLower === 'void' || statusLower === 'cancelled') {
      return { bg: 'bg-red-50', text: 'text-red-600', label: 'Void' };
    }
    return { bg: 'bg-gray-100', text: 'text-gray-700', label: status };
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
        className={`fixed inset-0 bg-black/40 z-50 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />

      {/* Drawer */}
      <div
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[400px] bg-white shadow-xl transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10">
          <div className="flex items-center justify-between px-5 py-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <Receipt size={20} className="text-gray-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Transaction Detail</h2>
                <p className="text-xs text-gray-500 font-mono">{transaction.sales_num}</p>
              </div>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X size={20} className="text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="h-[calc(100vh-73px)] overflow-y-auto">
          {/* Status & Total */}
          <div className="px-5 py-5 bg-gray-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.text}`}>
                  {statusInfo.label}
                </span>
                <span className="flex items-center gap-1.5 text-gray-400 text-sm">
                  <MapPin size={14} />
                  {transaction.branch_name || '-'}
                </span>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase tracking-wide">Total Amount</p>
                <p className="text-2xl font-bold text-white">{formatCurrency(transaction.total_amount)}</p>
              </div>
            </div>
          </div>

          {/* Transaction Info */}
          <div className="px-5 py-4">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Information</h4>
            <div className="grid grid-cols-2 gap-2.5">
              <InfoItem label="Bill Number" value={transaction.bill_num || '-'} />
              <InfoItem label="Sales Date" value={formatDateOnly(transaction.sales_date)} />
              <InfoItem label="Payment" value={transaction.payment_method || '-'} />
              <InfoItem label="Cashier" value={transaction.cashier_id || '-'} />
            </div>
          </div>

          {/* Timeline */}
          <div className="px-5 py-4 border-t border-gray-100">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Timeline</h4>
            <div className="space-y-3">
              <TimelineItem
                label="Time In"
                value={formatDate(transaction.sales_date_in)}
                icon={<ArrowRight size={12} />}
                iconBg="bg-gray-200"
                iconColor="text-gray-600"
              />
              {transaction.order_time && (
                <TimelineItem
                  label="Order"
                  value={formatDate(transaction.order_time)}
                  icon={<CalendarClock size={12} />}
                  iconBg="bg-gray-200"
                  iconColor="text-gray-600"
                />
              )}
              <TimelineItem
                label="Time Out"
                value={formatDate(transaction.sales_date_out)}
                icon={<ArrowRight size={12} />}
                iconBg="bg-gray-200"
                iconColor="text-gray-600"
              />
              <TimelineItem
                label="Duration"
                value={getStayDuration()}
                icon={<Clock size={12} />}
                iconBg="bg-gray-200"
                iconColor="text-gray-600"
                isLast
              />
            </div>
          </div>

          {/* Order Item */}
          <div className="px-5 py-4 border-t border-gray-100">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Order Item</h4>
            <div className="bg-gray-50 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500">#</th>
                    <th className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500">Item</th>
                    <th className="px-3 py-2 text-center text-[10px] font-semibold text-gray-500">Qty</th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500">Price</th>
                    <th className="px-3 py-2 text-right text-[10px] font-semibold text-gray-500">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-t border-gray-200">
                    <td className="px-3 py-2.5 text-xs text-gray-400">{transaction.line_number || '-'}</td>
                    <td className="px-3 py-2.5">
                      <p className="text-sm font-medium text-gray-900">{transaction.menu_name || 'N/A'}</p>
                      {transaction.menu_category && (
                        <p className="text-xs text-gray-500">{transaction.menu_category}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 text-center">{transaction.quantity ?? '-'}</td>
                    <td className="px-3 py-2.5 text-xs text-gray-600 text-right">{formatCurrency(transaction.unit_price)}</td>
                    <td className="px-3 py-2.5 text-xs font-semibold text-gray-900 text-right">
                      {formatCurrency(transaction.total_item)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="px-5 py-4 border-t border-gray-100">
            <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Payment Summary</h4>
            <div className="bg-gray-50 rounded-xl p-4">
              <div className="space-y-2">
                <PaymentRow label="Subtotal" value={formatCurrency(transaction.subtotal)} />
                <PaymentRow label="Discount" value={`-${formatCurrency(transaction.discount_amount)}`} isDiscount />
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-semibold text-gray-900">Grand Total</span>
                    <span className="text-lg font-bold text-gray-900">
                      {formatCurrency(transaction.total_amount)}
                    </span>
                  </div>
                </div>
                <div className="border-t border-gray-200 pt-2 mt-2 space-y-1.5">
                  <PaymentRow label="Cash Received" value={formatCurrency(transaction.cash_received)} />
                  <PaymentRow label="Change" value={formatCurrency(transaction.change_given)} />
                </div>
              </div>
            </div>
          </div>

          {/* Location */}
          {(transaction.brand || transaction.city || transaction.area) && (
            <div className="px-5 py-4 border-t border-gray-100">
              <h4 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">Location</h4>
              <div className="grid grid-cols-2 gap-2.5">
                {transaction.brand && <InfoItem label="Brand" value={transaction.brand} />}
                {transaction.city && <InfoItem label="City" value={transaction.city} />}
                {transaction.area && <InfoItem label="Area" value={transaction.area} />}
              </div>
            </div>
          )}

          <div className="h-6" />
        </div>
      </div>
    </>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-gray-50 rounded-lg p-3">
      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-medium text-gray-900 truncate">{value}</p>
    </div>
  );
}

function TimelineItem({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  isLast = false
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-7 h-7 rounded-full ${iconBg} flex items-center justify-center ${iconColor}`}>
        {icon}
      </div>
      <div className="flex-1">
        <p className="text-[10px] text-gray-400 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-medium text-gray-900">{value}</p>
      </div>
    </div>
  );
}

function PaymentRow({ label, value, isDiscount = false }: { label: string; value: string; isDiscount?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${isDiscount ? 'text-red-500' : 'text-gray-700'}`}>{value}</span>
    </div>
  );
}
