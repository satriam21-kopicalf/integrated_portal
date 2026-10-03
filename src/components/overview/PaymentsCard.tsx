'use client';

import BarList from '@/components/charts/BarList';
import { formatCurrency, formatNumber } from '@/lib/format';
import { compactRupiah, PaymentsResponse, Resource } from '@/lib/overview';
import { Card } from './Card';

/** ESB integration method codes -> readable names. */
const METHOD_LABELS: Record<string, string> = {
  GOFOOD_INT: 'GoFood (integrated)',
  GRABFOOD_INT: 'GrabFood (integrated)',
  SHOPEEFOOD_INT: 'ShopeeFood (integrated)',
};

export default function PaymentsCard({ resource }: { resource: Resource<PaymentsResponse> }) {
  return (
    <Card title="Payment methods" subtitle="Share of sales by the bill's payment method" resource={resource} minHeight={360}>
      {data => (
        <div className="space-y-3">
          <p className="text-xs text-slate-500">
            {data.types.map(t => `${t.type} ${t.share === null ? '-' : `${t.share.toFixed(1)}%`}`).join(' · ')}
          </p>
          <BarList
            max={100}
            items={data.methods.slice(0, 8).map(m => ({
              key: `${m.type}-${m.method}`,
              label: METHOD_LABELS[m.method] ?? m.method,
              value: m.share ?? 0,
              display: `${m.share === null ? '-' : `${m.share.toFixed(1)}%`} · ${compactRupiah(m.subtotal)}`,
              detail: `${formatCurrency(m.subtotal)} · ${formatNumber(m.bills)} bills`,
            }))}
          />
          {data.methods.length > 8 && (
            <p className="text-[11px] text-slate-400">
              +{data.methods.length - 8} more ({compactRupiah(data.methods.slice(8).reduce((s, m) => s + m.subtotal, 0))})
            </p>
          )}
        </div>
      )}
    </Card>
  );
}
