'use client';

import HBarChart from '@/components/charts/HBarChart';
import { formatCurrency, formatNumber } from '@/lib/format';
import { compactRupiah, paymentLabel, PaymentsResponse, Resource } from '@/lib/overview';
import { Card } from './Card';

const TOP = 7;

export default function PaymentsCard({ resource }: { resource: Resource<PaymentsResponse> }) {
  return (
    <Card title="Payment methods" subtitle="Share of sales by the bill's payment method" resource={resource} minHeight={330}>
      {data => {
        const top = data.methods.slice(0, TOP);
        const rest = data.methods.slice(TOP);
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {data.types.map(t => (
                <span key={t.type} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  {t.type} <span className="text-slate-900">{t.share === null ? '-' : `${t.share.toFixed(1)}%`}</span>
                </span>
              ))}
            </div>
            <HBarChart
              ariaLabel="Share of sales per payment method"
              max={Math.max(...top.map(m => m.share ?? 0)) * 1.05}
              labelWidth={150}
              items={top.map(m => ({
                key: `${m.type}-${m.method}`,
                label: paymentLabel(m.method),
                value: m.share ?? 0,
                display: `${m.share?.toFixed(1) ?? '-'}% · ${compactRupiah(m.subtotal)}`,
                tip: { rows: [[formatCurrency(m.subtotal), 'sales'], [formatNumber(m.bills), 'bills']], footer: m.type },
              }))}
            />
            {rest.length > 0 && (
              <p className="text-[11px] text-slate-400">
                +{rest.length} more: {rest.map(m => paymentLabel(m.method)).join(', ')} ({compactRupiah(rest.reduce((s, m) => s + m.subtotal, 0))})
              </p>
            )}
          </div>
        );
      }}
    </Card>
  );
}
