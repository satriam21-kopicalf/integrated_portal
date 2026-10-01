'use client';

import { X, Clock, User, CreditCard, ShoppingBag } from 'lucide-react';

interface TransactionItem {
  sales_num: string;
  line_number: number;
  menu_category: string;
  menu_name: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  total: number;
}

interface TransactionDetail {
  sales_num: string;
  bill_num?: string;
  sales_date?: string;
  sales_date_in?: string;
  sales_date_out?: string;
  branch_name?: string;
  payment_method?: string;
  total_amount?: number;
  subtotal?: number;
  discount_amount?: number;
  cash_received?: number;
  change_given?: number;
  status?: string;
  pax_total?: number;
  cashier_id?: string;
  visit_purpose?: string;
  regular_member_name?: string;
  loyalty_member_name?: string;
  items?: TransactionItem[];
  // Combined format fields
  menu_category?: string;
  menu_name?: string;
  menu_code?: string;
  menu_notes?: string;
  quantity?: number;
  unit_price?: number;
  subtotal_item?: number;
  discount_item?: number;
  total_item?: number;
  order_time?: string;
  line_number?: number;
}

interface Props {
  transaction: TransactionDetail;
  onClose: () => void;
}

export default function TransactionDetail({ transaction, onClose }: Props) {
  const formatCurrency = (value?: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(value || 0);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status?: string) => {
    if (!status) return 'bg-slate-100 text-slate-700';
    const statusLower = status.toLowerCase();
    if (statusLower === 'finished' || statusLower === 'completed') {
      return 'bg-emerald-100 text-emerald-700';
    }
    if (statusLower === 'void' || statusLower === 'cancelled') {
      return 'bg-rose-100 text-rose-700';
    }
    return 'bg-amber-100 text-amber-700';
  };

  const lineNum = transaction.line_number;
  const menuName = transaction.menu_name;
  const qty = transaction.quantity;
  const price = transaction.unit_price;
  const itemTotal = transaction.total_item;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Transaction Details</h2>
            <p className="text-sm text-slate-500 font-mono mt-0.5">{transaction.sales_num}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
          >
            <X size={20} className="text-slate-500" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Status Badge */}
          <div className="flex items-center gap-3 mb-6">
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(transaction.status)}`}>
              {transaction.status || 'Unknown'}
            </span>
            <span className="text-sm text-slate-500">{transaction.branch_name || '-'}</span>
          </div>

          {/* Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <InfoCard icon={<CreditCard size={16} />} label="Bill Number" value={transaction.bill_num || '-'} />
            <InfoCard icon={<Clock size={16} />} label="Date" value={formatDate(transaction.sales_date)} />
            <InfoCard icon={<User size={16} />} label="Cashier" value={transaction.cashier_id || '-'} />
            <InfoCard icon={<ShoppingBag size={16} />} label="Payment" value={transaction.payment_method || '-'} />
            <InfoCard label="Pax" value={transaction.pax_total?.toString() || '0'} />
            <InfoCard label="Visit Purpose" value={transaction.visit_purpose || '-'} />
            {transaction.regular_member_name && (
              <InfoCard label="Member" value={transaction.regular_member_name} />
            )}
            {transaction.loyalty_member_name && (
              <InfoCard label="Loyalty" value={transaction.loyalty_member_name} />
            )}
          </div>

          {/* Timeline */}
          <div className="bg-slate-50 rounded-xl p-4 mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Clock size={16} className="text-slate-400" />
              Transaction Timeline
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-blue-600">IN</span>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Time In</p>
                  <p className="text-sm font-medium text-slate-900">{formatDate(transaction.sales_date_in)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-emerald-600">OUT</span>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Time Out</p>
                  <p className="text-sm font-medium text-slate-900">{formatDate(transaction.sales_date_out)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center">
                  <span className="text-xs font-bold text-purple-600">STAY</span>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Order Time</p>
                  <p className="text-sm font-medium text-slate-900">{formatDate(transaction.order_time)}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Item Details */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Order Item</h3>
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">#</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-slate-600">Item</th>
                    <th className="px-4 py-2 text-center text-xs font-semibold text-slate-600">Qty</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Price</th>
                    <th className="px-4 py-2 text-right text-xs font-semibold text-slate-600">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transaction.items?.map((item) => (
                    <tr key={item.line_number}>
                      <td className="px-4 py-2 text-sm text-slate-400">{item.line_number}</td>
                      <td className="px-4 py-2">
                        <p className="text-sm font-medium text-slate-900">{item.menu_name}</p>
                        <p className="text-xs text-slate-500">{item.menu_category}</p>
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-600 text-center">{item.quantity}x</td>
                      <td className="px-4 py-2 text-sm text-slate-600 text-right">{formatCurrency(item.unit_price)}</td>
                      <td className="px-4 py-2 text-sm font-medium text-slate-900 text-right">{formatCurrency(item.total)}</td>
                    </tr>
                  ))}
                  {!transaction.items && menuName && (
                    <tr>
                      <td className="px-4 py-2 text-sm text-slate-400">{lineNum || '-'}</td>
                      <td className="px-4 py-2">
                        <p className="text-sm font-medium text-slate-900">{menuName}</p>
                        {transaction.menu_category && (
                          <p className="text-xs text-slate-500">{transaction.menu_category}</p>
                        )}
                      </td>
                      <td className="px-4 py-2 text-sm text-slate-600 text-center">{qty ?? '-'}</td>
                      <td className="px-4 py-2 text-sm text-slate-600 text-right">{formatCurrency(price)}</td>
                      <td className="px-4 py-2 text-sm font-medium text-slate-900 text-right">{formatCurrency(itemTotal)}</td>
                    </tr>
                  )}
                  {!transaction.items && !menuName && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-sm text-slate-400">No items available</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary */}
          <div className="bg-slate-50 rounded-xl p-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Subtotal</span>
                <span className="font-medium text-slate-900">{formatCurrency(transaction.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Discount</span>
                <span className="font-medium text-rose-600">-{formatCurrency(transaction.discount_amount)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="font-semibold text-slate-900">Grand Total</span>
                  <span className="text-xl font-bold text-blue-600">
                    {formatCurrency(transaction.total_amount)}
                  </span>
                </div>
              </div>
              <div className="flex justify-between text-sm pt-2 border-t border-slate-200">
                <span className="text-slate-600">Cash Received</span>
                <span className="font-medium text-slate-900">{formatCurrency(transaction.cash_received)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600">Change</span>
                <span className="font-medium text-slate-900">{formatCurrency(transaction.change_given)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value }: { icon?: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-slate-50 rounded-lg p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon && <span className="text-slate-400">{icon}</span>}
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <p className="text-sm font-medium text-slate-900 truncate">{value}</p>
    </div>
  );
}
