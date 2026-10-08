'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, Receipt, X } from 'lucide-react';
import { TransactionCombined } from '@/types/transactions';
import { formatCurrency, formatDate, formatDateTime, formatNumber, parseLocalDate } from '@/lib/format';
import { channelLabel } from '@/lib/overview';
import { tr } from '@/lib/i18n';

interface Props {
  transaction: TransactionCombined;
  onClose: () => void;
}

/** Response of GET /api/transactions/{sales_num} (header + ESB report rows). */
type Detail = TransactionCombined & { report_rows?: TransactionCombined[] };

function statusStyle(status?: string | null) {
  const s = (status || '').toLowerCase();
  if (s === 'finished' || s === 'completed') return 'bg-emerald-50 text-emerald-700 ring-emerald-600/20';
  if (s === 'void' || s === 'cancelled') return 'bg-rose-50 text-rose-700 ring-rose-600/20';
  return 'bg-amber-50 text-amber-700 ring-amber-600/20';
}

function duration(from?: string | null, to?: string | null): string {
  if (!from || !to) return '-';
  const mins = Math.round((parseLocalDate(to).getTime() - parseLocalDate(from).getTime()) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return '-';
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

export default function TransactionDrawer({ transaction, onClose }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  const handleClose = useCallback(() => {
    setIsOpen(false);
    setTimeout(onClose, 250);
  }, [onClose]);

  useEffect(() => {
    const t = setTimeout(() => setIsOpen(true), 10);
    document.body.style.overflow = 'hidden';
    return () => {
      clearTimeout(t);
      document.body.style.overflow = '';
    };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [handleClose]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/transactions/${encodeURIComponent(transaction.sales_num)}`)
      .then(res => (res.ok ? res.json() : null))
      .then(body => { if (!cancelled) setDetail(body); })
      .catch(error => console.error('Error fetching transaction:', error))
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [transaction.sales_num]);

  const tx: TransactionCombined = detail ?? transaction;
  const rows = detail?.report_rows ?? [];
  const discount = Number(tx.discount_amount || 0);

  return (
    <>
      <div
        className={`fixed inset-0 z-[80] bg-slate-900/40 dark:bg-black/70 transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <aside
        className={`fixed inset-y-0 right-0 z-[80] flex w-full flex-col bg-white shadow-2xl transition-transform duration-300 ease-out sm:w-[440px] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        role="dialog"
        aria-modal="true"
        aria-label={tr('Transaction detail')}
      >
        {/* Header */}
        <div className="flex items-start gap-3 border-b border-slate-200 px-5 py-4">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-slate-100">
            <Receipt size={20} className="text-slate-600" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{tr('Transaction')}</p>
            <p className="truncate font-mono text-sm font-semibold text-slate-900">{tx.sales_num}</p>
          </div>
          <button type="button" onClick={handleClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label={tr('Close')}>
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Total */}
          <div className="border-b border-slate-100 px-5 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusStyle(tx.status)}`}>
                {tx.status || tr('Unknown')}
              </span>
              <span className="flex min-w-0 items-center gap-1 text-xs text-slate-500">
                <MapPin size={12} className="flex-shrink-0" />
                <span className="truncate">{tx.branch_name || '-'}</span>
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">{tr('Grand total')}</p>
            <p className="text-3xl font-semibold tabular-nums text-slate-900">{formatCurrency(tx.total_amount)}</p>
          </div>

          {/* Information */}
          <Section title={tr('Information')}>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Field label={tr('Bill number')} value={tx.bill_num || 'No bill number'} />
              <Field label={tr('Sales date')} value={formatDate(tx.sales_date)} />
              <Field label={tr('Payment method')} value={tx.payment_method || '-'} />
              <Field label={tr('Visit purpose')} value={tx.visit_purpose ? channelLabel(tx.visit_purpose) : '-'} />
              <Field label={tr('Customer')} value={tx.customer_name && tx.customer_name !== '-' ? tx.customer_name : 'Walk-in'} />
              <Field label={tr('Cashier')} value={tx.cashier_id || '-'} />
              <Field label={tr('Time in')} value={formatDateTime(tx.sales_date_in)} />
              <Field label={tr('Time out')} value={formatDateTime(tx.sales_date_out)} />
              <Field label={tr('Duration')} value={duration(tx.sales_date_in, tx.sales_date_out)} />
              <Field label={tr('Pax')} value={formatNumber(tx.pax_total)} />
            </dl>
          </Section>

          {/* Items */}
          <Section title={tr('Items{0}', rows.length ? ` (${rows.filter(r => !r.menu_name?.endsWith(')')).length})` : '')}>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-9 animate-pulse rounded bg-slate-100" />)}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-slate-500">{tr('No items recorded for this transaction.')}</p>
            ) : (
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {rows.map((r, i) => {
                  const addon = r.menu_name?.endsWith(')');
                  return (
                    <li key={i} className={`flex items-start justify-between gap-3 px-3 py-2 ${addon ? 'bg-slate-50/60' : ''}`}>
                      <div className="min-w-0">
                        <p className={`truncate text-sm ${addon ? 'pl-3 text-slate-500' : 'font-medium text-slate-800'}`}>{r.menu_name}</p>
                        <p className={`text-xs text-slate-400 ${addon ? 'pl-3' : ''}`}>
                          {formatNumber(r.quantity)} × {formatCurrency(r.unit_price)}
                          {Number(r.discount_item) ? tr(' · disc. {0}', formatCurrency(r.discount_item)) : ''}
                        </p>
                      </div>
                      <p className="whitespace-nowrap text-sm tabular-nums text-slate-800">{formatCurrency(r.total_item)}</p>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Payment summary */}
          <Section title={tr('Payment summary')}>
            <dl className="space-y-1.5 text-sm">
              <Row label={tr('Subtotal')} value={formatCurrency(tx.subtotal)} />
              {discount > 0 && <Row label={tr('Discount')} value={`−${formatCurrency(discount)}`} tone="text-rose-600" />}
              {Number(tx.tax_amount) > 0 && <Row label={tr('Tax')} value={formatCurrency(tx.tax_amount)} />}
              <div className="my-2 border-t border-slate-200" />
              <Row label={tr('Grand total')} value={formatCurrency(tx.total_amount)} strong />
              {tx.nett_sales !== undefined && <Row label={tr('Nett sales')} value={formatCurrency(tx.nett_sales)} />}
            </dl>
          </Section>

          {(tx.brand || tx.city) && (
            <Section title={tr('Branch')}>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
                <Field label={tr('Branch')} value={tx.branch_name || '-'} />
                <Field label={tr('Code')} value={tx.branch_code || '-'} />
                {tx.brand && <Field label={tr('Brand')} value={tx.brand} />}
                {tx.city && <Field label={tr('City')} value={tx.city} />}
              </dl>
            </Section>
          )}
        </div>
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-slate-100 px-5 py-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-400">{label}</dt>
      <dd className="truncate text-sm font-medium text-slate-800" title={value}>{value}</dd>
    </div>
  );
}

function Row({ label, value, strong = false, tone = 'text-slate-700' }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={strong ? 'font-semibold text-slate-900' : 'text-slate-500'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-semibold text-slate-900' : tone}`}>{value}</dd>
    </div>
  );
}
