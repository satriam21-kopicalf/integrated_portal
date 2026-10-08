'use client';

import HBarChart from '@/components/charts/HBarChart';
import { formatCurrency, formatNumber } from '@/lib/format';
import { compactRupiah, deltaText, paymentLabel, PaymentsResponse, Resource } from '@/lib/overview';
import { Card } from './Card';
import { useDrill } from './drill/DrillContext';

const TOP = 7;

export default function PaymentsCard({ resource }: { resource: Resource<PaymentsResponse> }) {
  const drill = useDrill();
  return (
    <Card title="Payment methods" info="payments" subtitle="Share of gross sales by the bill's payment method · click a method for its details" resource={resource} minHeight={330}
      onOpen={() => drill.open({ kind: 'payments' })}>
      {data => {
        const top = data.methods.slice(0, TOP);
        const rest = data.methods.slice(TOP);
        return (
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {data.types.map(t => (
                <span key={t.type} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                  {t.type} <span className="text-slate-900">{t.share === null ? '-' : `${t.share.toFixed(1)}%`}</span>
                  {t.deltaPct !== undefined && t.deltaPct !== null && <span className={t.deltaPct >= 0 ? ' text-emerald-700' : ' text-red-700'}> {deltaText(t.deltaPct)}</span>}
                </span>
              ))}
            </div>
            <HBarChart
              ariaLabel="Share of gross sales per payment method"
              max={Math.max(...top.map(m => m.share ?? 0)) * 1.05}
              labelWidth={150}
              items={top.map(m => ({
                key: `${m.type}-${m.method}`,
                label: paymentLabel(m.method),
                value: m.share ?? 0,
                display: `${m.share?.toFixed(1) ?? '-'}% · ${compactRupiah(m.subtotal)}${m.previousSubtotal !== undefined ? ` · ${deltaText(m.deltaPct) || 'new'}` : ''}`,
                tip: {
                  rows: [[formatCurrency(m.subtotal), 'sales'], [formatNumber(m.bills), 'bills'],
                    ...(m.previousSubtotal !== undefined ? [[formatCurrency(m.previousSubtotal), `comparison period (${m.previousShare?.toFixed(1) ?? '-'}%)`] as [string, string]] : [])],
                  footer: m.type,
                },
              }))}
              onSelect={key => {
                const m = top.find(x => `${x.type}-${x.method}` === key);
                if (m) drill.open({ kind: 'payment', method: m.method, label: paymentLabel(m.method) });
              }}
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
