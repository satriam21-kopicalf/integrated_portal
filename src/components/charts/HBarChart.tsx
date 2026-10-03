'use client';

import { useMemo } from 'react';
import EChart, { ChartOption } from './EChart';
import { base, INK, tipFooter, tipRow, tipTitle, tooltip } from '@/lib/chartTheme';

export interface HBarItem {
  key: string;
  label: string;
  value: number;
  /** Text at the bar end. */
  display: string;
  color?: string;
  tip?: { rows: [string, string][]; footer?: string };
}

/** Ranked horizontal bars, largest on top, value label at the bar end. */
export default function HBarChart({
  items, ariaLabel, color = INK.accent, rowHeight = 30, labelWidth = 170, max,
}: {
  items: HBarItem[];
  ariaLabel: string;
  color?: string;
  rowHeight?: number;
  labelWidth?: number;
  max?: number;
}) {
  // keyed on content: parents rebuild `items` on every render (e.g. realtime updates)
  const signature = JSON.stringify(items);
  const option = useMemo<ChartOption>(() => {
    const rows = (JSON.parse(signature) as HBarItem[]).reverse();
    const longest = Math.max(0, ...rows.map(i => i.display.length));
    return {
      ...base,
      grid: { left: 4, right: Math.min(150, 16 + longest * 7), top: 2, bottom: 2, containLabel: true },
      tooltip: tooltip({
        trigger: 'item',
        formatter: (p: { dataIndex: number }) => {
          const it = rows[p.dataIndex];
          const c = it.color ?? color;
          return tipTitle(it.label)
            + (it.tip?.rows ?? [[it.display, '']]).map(([v, l]) => tipRow(c, v, l)).join('')
            + (it.tip?.footer ? tipFooter(it.tip.footer) : '');
        },
      }),
      xAxis: { type: 'value', show: false, max: max ?? ((v: { max: number }) => v.max) },
      yAxis: {
        type: 'category',
        data: rows.map(r => r.label),
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: { color: INK.primary, fontSize: 12, width: labelWidth, overflow: 'truncate' },
      },
      series: [{
        type: 'bar',
        data: rows.map(r => ({ value: r.value, itemStyle: { color: r.color ?? color, borderRadius: [0, 4, 4, 0] } })),
        barWidth: Math.min(16, Math.round(rowHeight * 0.5)),
        showBackground: true,
        backgroundStyle: { color: '#f1f5f9', borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: 'right',
          color: INK.primary,
          fontSize: 11,
          fontWeight: 600,
          formatter: (p: { dataIndex: number }) => rows[p.dataIndex].display,
        },
      }],
    };
  }, [signature, color, rowHeight, labelWidth, max]);

  if (!items.length) return <p className="py-6 text-center text-sm text-slate-400">No data</p>;
  return <EChart option={option} height={items.length * rowHeight + 8} ariaLabel={ariaLabel} />;
}
