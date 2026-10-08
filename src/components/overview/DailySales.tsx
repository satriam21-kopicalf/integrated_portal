'use client';

import { useMemo, useState } from 'react';
import EChart, { ChartOption } from '@/components/charts/EChart';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { base, categoryAxis, changeHtml, INK, tipFooter, tipRow, tipTitle, tooltip, valueAxis } from '@/lib/chartTheme';
import { compactRupiah, GrowthResponse, SERIES_COLORS } from '@/lib/overview';
import { Delta } from './Card';
import { DetailTable, rp } from './drill/parts';

/** Monday … Sunday, in the categorical order (validated: scripts/validate_palette.js, light surface). */
export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const WEEKDAY_COLORS = SERIES_COLORS.slice(0, 7);

/** 1 = Monday … 7 = Sunday */
export const isoWeekday = (iso: string) => ((new Date(`${iso}T00:00:00`).getDay() + 6) % 7) + 1;
const dayLabel = (iso: string) => {
  const d = new Date(`${iso}T00:00:00`);
  return `${String(d.getDate()).padStart(2, '0')} ${d.toLocaleDateString('en-GB', { month: 'short' })} (${WEEKDAYS[isoWeekday(iso) - 1].slice(0, 3)})`;
};

/* ------------------------------------------------------------------ daily bars */

/**
 * Gross sales per day, one colour per weekday (the weekday is also in every axis label, so
 * colour is never the only cue). Legend chips highlight one or more weekdays; a dashed line
 * marks the daily average of the period. Click a bar for that day's details.
 */
export function DailySalesChart({ data, onSelect }: { data: GrowthResponse; onSelect?: (date: string) => void }) {
  const [focus, setFocus] = useState<number[]>([]);
  const days = data.series;
  const avg = days.length ? days.reduce((s, p) => s + p.subtotal, 0) / days.length : 0;

  // average per weekday over the period, for the tooltip and the legend
  const byDow = useMemo(() => {
    const m = new Map<number, { sum: number; n: number }>();
    for (const p of days) {
      const k = isoWeekday(p.date);
      const o = m.get(k) ?? { sum: 0, n: 0 };
      o.sum += p.subtotal;
      o.n += 1;
      m.set(k, o);
    }
    return m;
  }, [days]);

  const option = useMemo<ChartOption>(() => {
    const dense = days.length > 31;
    return {
      ...base,
      grid: { left: 4, right: 12, top: 24, bottom: 4, containLabel: true },
      tooltip: tooltip({
        trigger: 'axis',
        axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(148,163,184,0.12)' } },
        formatter: (items: { dataIndex: number }[]) => {
          const p = days[items[0]?.dataIndex ?? 0];
          if (!p) return '';
          const dow = isoWeekday(p.date);
          const w = byDow.get(dow);
          const wAvg = w && w.n ? w.sum / w.n : null;
          return tipTitle(`${WEEKDAYS[dow - 1]}, ${formatDate(p.date)}`)
            + tipRow(WEEKDAY_COLORS[dow - 1], formatCurrency(p.subtotal), 'gross sales')
            + tipRow(INK.muted, formatNumber(p.bills), 'bills')
            + (wAvg !== null ? tipRow(INK.muted, formatCurrency(Math.round(wAvg)), `avg ${WEEKDAYS[dow - 1]} in the period`) : '')
            + tipFooter(p.compareSubtotal !== null
              ? `vs comparison ${p.compareFrom ? formatDate(p.compareFrom) : ''}: ${changeHtml(p.growthPct)}`
              : 'No comparison day') + (onSelect ? tipFooter('Click for the details of this day') : '');
        },
      }),
      xAxis: categoryAxis(days.map(p => dayLabel(p.date)), {
        axisLabel: { color: INK.muted, fontSize: 10, rotate: dense ? 60 : 45, interval: dense ? 'auto' : 0, hideOverlap: true },
      }),
      yAxis: valueAxis(compactRupiah),
      series: [{
        type: 'bar',
        barMaxWidth: 28,
        barCategoryGap: '25%',
        data: days.map(p => {
          const dow = isoWeekday(p.date);
          const dim = focus.length > 0 && !focus.includes(dow);
          return { value: p.subtotal, itemStyle: { color: WEEKDAY_COLORS[dow - 1], borderRadius: [4, 4, 0, 0], opacity: dim ? 0.18 : 1 } };
        }),
        markLine: avg ? {
          symbol: 'none', silent: true,
          lineStyle: { color: INK.secondary, type: 'dashed', width: 1 },
          label: { formatter: `avg ${compactRupiah(avg)}/day`, color: INK.secondary, fontSize: 10, position: 'insideEndTop' },
          data: [{ yAxis: avg }],
        } : undefined,
      }],
    };
  }, [days, byDow, focus, avg, onSelect]);

  const toggle = (dow: number) => setFocus(f => (f.includes(dow) ? f.filter(x => x !== dow) : [...f, dow]));

  return (
    <div className="space-y-3">
      <EChart option={option} height={300} ariaLabel="Gross sales per day, coloured by weekday"
        onClick={onSelect ? p => { const d = days[p.dataIndex]; if (d) onSelect(d.date); } : undefined} />
      <div className="flex flex-wrap items-center justify-center gap-1.5" role="group" aria-label="Highlight weekdays">
        {WEEKDAYS.map((name, i) => {
          const dow = i + 1;
          const on = focus.includes(dow);
          const w = byDow.get(dow);
          return (
            <button key={name} type="button" onClick={() => toggle(dow)} aria-pressed={on}
              title={w ? `${w.n} ${name}s · avg ${formatCurrency(Math.round(w.sum / w.n))}` : `No ${name} in the period`}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors ${
                on ? 'border-slate-900 bg-slate-900 text-white'
                  : focus.length ? 'border-slate-200 bg-white text-slate-400 hover:text-slate-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}>
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: WEEKDAY_COLORS[i] }} aria-hidden />
              {name}
              {w && <span className={on ? 'text-white/70' : 'text-slate-400'}>{compactRupiah(w.sum / w.n)}</span>}
            </button>
          );
        })}
        {focus.length > 0 && (
          <button type="button" onClick={() => setFocus([])} className="ml-1 text-xs font-medium text-slate-500 hover:text-slate-900 hover:underline">Show all</button>
        )}
      </div>
      <p className="text-center text-[11px] text-slate-500">Click a weekday to highlight it · numbers = average gross sales per day of that weekday</p>
    </div>
  );
}

/* ------------------------------------------------------------------ average sales */

export interface AverageSalesRow {
  key: string; label: string; days: number; averageSales: number | null; compareAverage: number | null;
  pendingSales: number; sales: number; bills: number; totalSales: number; variancePct: number | null;
}

export interface AverageSalesResponse {
  filters: { from: string; to: string; previous: { from: string; to: string; complete: boolean } };
  weekday: number | null;
  weekdayName: string | null;
  days: number;
  compareDays: number;
  totals: { averageSales: number | null; compareAverage: number | null; pendingSales: number; sales: number; totalSales: number; variancePct: number | null };
  rows: AverageSalesRow[];
}

/**
 * Average gross sales per day per branch for the filter period against the comparison period
 * (like the other analytics); optionally one weekday only.
 */
export function AverageSalesBody({ data, weekday, onWeekday }: {
  data: AverageSalesResponse; weekday: number | null; onWeekday: (w: number | null) => void;
}) {
  const f = data.filters;
  const t = data.totals;
  const dayName = data.weekdayName ?? 'All days';
  const range = (a: string, b: string) => (a === b ? formatDate(a) : `${formatDate(a)} – ${formatDate(b)}`);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-slate-500">
          <span className="font-medium text-slate-900">{range(f.from, f.to)}</span>
          {' '}({formatNumber(data.days)} {data.weekdayName ? `${data.weekdayName}${data.days === 1 ? '' : 's'}` : data.days === 1 ? 'day' : 'days'})
          {f.previous.complete
            ? <> vs {range(f.previous.from, f.previous.to)} ({formatNumber(data.compareDays)})</>
            : <> · no comparison before Aug 2025</>}
        </p>
        <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Day of week">
          {[null, 1, 2, 3, 4, 5, 6, 7].map(w => {
            const on = weekday === w;
            return (
              <button key={w ?? 0} type="button" role="radio" aria-checked={on} onClick={() => onWeekday(w)}
                className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors ${
                  on ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-900'}`}>
                {w && <span className="h-2 w-2 rounded-sm" style={{ background: WEEKDAY_COLORS[w - 1] }} aria-hidden />}
                {w ? WEEKDAYS[w - 1].slice(0, 3) : 'All days'}
              </button>
            );
          })}
        </div>
      </div>

      <DetailTable<AverageSalesRow>
        caption="Average sales" csvName={`average-sales-${f.from}-${f.to}${data.weekday ? `-${dayName.toLowerCase()}` : ''}`}
        rows={data.rows} rowKey={r => r.key} search={r => `${r.label} ${r.key}`} initialSort={{ key: 'branch', desc: false }} maxHeight={460}
        columns={[
          { key: 'branch', label: 'Branch', value: r => r.label, render: r => <span className="font-medium text-slate-900">{r.label}</span> },
          { key: 'dow', label: 'Day of week', value: () => dayName },
          { key: 'avg', label: 'Average sales', align: 'right', value: r => r.averageSales,
            title: 'Gross sales per day in the period (days the branch sold)', render: r => (r.averageSales === null ? '-' : rp(r.averageSales)) },
          { key: 'cmp', label: 'Comparison avg', align: 'right', value: r => r.compareAverage,
            title: 'Gross sales per day in the comparison period', render: r => (r.compareAverage === null ? '-' : rp(r.compareAverage)) },
          { key: 'pending', label: 'Pending sales', align: 'right', value: r => r.pendingSales, title: 'Open bills (not finished yet)', render: r => rp(r.pendingSales) },
          { key: 'sales', label: 'Gross sales', align: 'right', value: r => r.sales, title: 'Total gross sales in the period', render: r => rp(r.sales) },
          { key: 'total', label: 'Total sales', align: 'right', value: r => r.totalSales, title: 'Gross sales + pending',
            render: r => <span className="font-semibold text-slate-900">{rp(r.totalSales)}</span> },
          { key: 'var', label: 'Variance', align: 'right', value: r => r.variancePct,
            title: '(Average sales − comparison avg) ÷ comparison avg × 100', render: r => <Delta value={r.variancePct} /> },
        ]}
        footer={
          <tfoot className="sticky bottom-0 bg-slate-50 text-xs font-semibold text-slate-900">
            <tr className="border-t border-slate-200">
              <td className="px-3 py-2" colSpan={2}>Total · {formatNumber(data.rows.length)} branches</td>
              <td className="px-3 py-2 text-right tabular-nums">{t.averageSales === null ? '-' : rp(t.averageSales)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{t.compareAverage === null ? '-' : rp(t.compareAverage)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{rp(t.pendingSales)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{rp(t.sales)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{rp(t.totalSales)}</td>
              <td className="px-3 py-2 text-right"><Delta value={t.variancePct} /></td>
            </tr>
          </tfoot>
        }
      />
    </div>
  );
}
