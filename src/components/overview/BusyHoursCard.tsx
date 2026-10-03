'use client';

import { useState } from 'react';
import Heatmap from '@/components/charts/Heatmap';
import { formatCurrency, formatNumber } from '@/lib/format';
import { compactRupiah, DOW_LABELS, HourlyResponse, Resource } from '@/lib/overview';
import { Card, DataTable, Segmented } from './Card';

const hourLabel = (h: number) => `${String(h).padStart(2, '0')}:00`;

export default function BusyHoursCard({ resource }: { resource: Resource<HourlyResponse> }) {
  const [view, setView] = useState<'chart' | 'table'>('chart');
  return (
    <Card
      title="Busy hours"
      subtitle="Average bills per day by weekday and hour (order time)"
      resource={resource}
      minHeight={300}
      actions={<Segmented label="View" value={view} options={[{ value: 'chart', label: 'Heatmap' }, { value: 'table', label: 'Table' }]} onChange={setView} />}
    >
      {data => {
        const withBills = data.cells.filter(c => c.bills > 0).map(c => c.hour);
        if (!withBills.length) return <p className="py-10 text-center text-sm text-slate-400">No sales in this period</p>;
        const first = Math.min(...withBills);
        const last = Math.max(...withBills);
        const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
        const cell = (dow: number, hour: number) => data.cells.find(c => c.dow === dow && c.hour === hour);
        const peak = data.peak;

        if (view === 'table') {
          return (
            <DataTable
              caption="Average bills per day by hour and weekday"
              columns={[{ key: 'hour', label: 'Hour' }, ...DOW_LABELS.map(d => ({ key: d, label: d, align: 'right' as const }))]}
              rows={hours.map(h => ({
                key: String(h),
                cells: {
                  hour: hourLabel(h),
                  ...Object.fromEntries(DOW_LABELS.map((d, i) => [d, formatNumber(Math.round(cell(i + 1, h)?.avgBills ?? 0))])),
                },
              }))}
            />
          );
        }
        return (
          <div className="space-y-3">
            {peak && (
              <p className="text-xs text-slate-600">
                Peak: <span className="font-semibold text-slate-900">{DOW_LABELS[peak.dow - 1]} {hourLabel(peak.hour)}</span> ·{' '}
                {formatNumber(Math.round(peak.avgBills))} bills/day · {compactRupiah(peak.avgSubtotal)}
              </p>
            )}
            <Heatmap
              ariaLabel="Heatmap of average bills per day by weekday and hour"
              rows={DOW_LABELS}
              columns={hours.map(h => String(h).padStart(2, '0'))}
              values={DOW_LABELS.map((_, d) => hours.map(h => cell(d + 1, h)?.avgBills ?? 0))}
              tooltip={(r, c) => {
                const x = cell(r + 1, hours[c]);
                return {
                  title: `${DOW_LABELS[r]} ${hourLabel(hours[c])}–${hourLabel(hours[c] + 1)}`,
                  value: `${formatNumber(Math.round(x?.avgBills ?? 0))} bills/day`,
                  detail: x ? formatCurrency(Math.round(x.avgSubtotal)) : '',
                };
              }}
              scaleLabel={v => formatNumber(Math.round(v))}
            />
          </div>
        );
      }}
    </Card>
  );
}
