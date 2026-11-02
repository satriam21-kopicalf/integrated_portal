'use client';

import { currentCompany, withCompany } from '@/lib/company';
import { useEffect, useState } from 'react';
import Drawer, { DrawerSection } from '@/components/kc/Drawer';
import { MapPin, Receipt } from 'lucide-react';
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
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(withCompany(`/api/transactions/${encodeURIComponent(transaction.sales_num)}`, currentCompany()))
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
    <Drawer open onClose={onClose} title={tr('Transaction detail')} icon={<Receipt />} focusFirstField={false}
      description={<span className="font-mono">{tx.sales_num}</span>}>
          {/* Total */}
          <div className="mb-6 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
              <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${statusStyle(tx.status)}`}>
                {tx.status || tr('Unknown')}
              </span>
              <span className="flex min-w-0 items-center gap-1 text-xs text-neutral-500">
                <MapPin size={12} className="flex-shrink-0" />
                <span className="truncate">{tx.branch_name || '-'}</span>
              </span>
            </div>
            <p className="mt-3 text-xs text-neutral-500">{tr('Grand total')}</p>
            <p className="text-3xl font-semibold tabular-nums text-neutral-900">{formatCurrency(tx.total_amount)}</p>
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
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-9 skeleton rounded" />)}
              </div>
            ) : rows.length === 0 ? (
              <p className="text-sm text-neutral-500">{tr('No items recorded for this transaction.')}</p>
            ) : (
              <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
                {rows.map((r, i) => {
                  const addon = r.menu_name?.endsWith(')');
                  return (
                    <li key={i} className={`flex items-start justify-between gap-3 px-3 py-2 ${addon ? 'bg-neutral-50/60' : ''}`}>
                      <div className="min-w-0">
                        <p className={`truncate text-sm ${addon ? 'pl-3 text-neutral-500' : 'font-medium text-neutral-800'}`}>{r.menu_name}</p>
                        <p className={`text-xs text-neutral-400 ${addon ? 'pl-3' : ''}`}>
                          {formatNumber(r.quantity)} × {formatCurrency(r.unit_price)}
                          {Number(r.discount_item) ? tr(' · disc. {0}', formatCurrency(r.discount_item)) : ''}
                        </p>
                      </div>
                      <p className="whitespace-nowrap text-sm tabular-nums text-neutral-800">{formatCurrency(r.total_item)}</p>
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
              <div className="my-2 border-t border-neutral-200" />
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
    </Drawer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <DrawerSection title={title}>{children}</DrawerSection>;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-neutral-400">{label}</dt>
      <dd className="truncate text-sm font-medium text-neutral-800" title={value}>{value}</dd>
    </div>
  );
}

function Row({ label, value, strong = false, tone = 'text-neutral-700' }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={strong ? 'font-semibold text-neutral-900' : 'text-neutral-500'}>{label}</dt>
      <dd className={`tabular-nums ${strong ? 'font-semibold text-neutral-900' : tone}`}>{value}</dd>
    </div>
  );
}
