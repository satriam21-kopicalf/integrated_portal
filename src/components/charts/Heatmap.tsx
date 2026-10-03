'use client';

import { useState } from 'react';
import { ChartTooltip, useElementWidth } from './common';

/** Sequential single-hue ramp (blue 100 -> 700). */
export const SEQUENTIAL = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95', '#0d366b'];
const EMPTY = '#f1f5f9';

export function sequentialColor(value: number, max: number): string {
  if (!(value > 0) || !(max > 0)) return EMPTY;
  const step = Math.min(SEQUENTIAL.length - 1, Math.floor((value / max) * SEQUENTIAL.length));
  return SEQUENTIAL[step];
}

interface HeatmapProps {
  ariaLabel: string;
  rows: string[];
  columns: string[];
  /** values[row][column] */
  values: number[][];
  tooltip: (row: number, column: number) => { title: string; value: string; detail?: string };
  scaleLabel: (value: number) => string;
}

/** Grid of cells separated by the 2px surface gap; scrolls horizontally on narrow screens. */
export default function Heatmap({ ariaLabel, rows, columns, values, tooltip, scaleLabel }: HeatmapProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<[number, number] | null>(null);
  const max = Math.max(0, ...values.flat());
  const labelW = 32;
  const cell = width ? Math.max(10, Math.min(22, Math.floor((width - labelW) / columns.length) - 2)) : 16;
  const cellH = Math.max(cell, 16); // keep weekday labels readable when cells get narrow
  const labelEvery = cell >= 18 ? 2 : 3;
  const gridW = labelW + columns.length * (cell + 2);

  const tip = active ? tooltip(active[0], active[1]) : null;
  const tipX = active ? labelW + active[1] * (cell + 2) + cell / 2 : 0;

  return (
    <div>
      <div ref={ref} className="relative">
        <div className="custom-scrollbar overflow-x-auto pb-1" onPointerLeave={() => setActive(null)}>
          <div role="img" aria-label={ariaLabel} style={{ width: gridW }}>
            {rows.map((row, r) => (
              <div key={row} className="flex items-center" style={{ height: cellH + 2 }}>
                <span className="flex-shrink-0 text-[11px] text-slate-500" style={{ width: labelW }}>{row}</span>
                {columns.map((_, c) => {
                  const v = values[r]?.[c] ?? 0;
                  const isActive = active?.[0] === r && active?.[1] === c;
                  return (
                    <span
                      key={c}
                      onPointerEnter={() => setActive([r, c])}
                      onPointerDown={() => setActive([r, c])}
                      className={`mr-[2px] inline-block flex-shrink-0 rounded-[3px] ${isActive ? 'ring-2 ring-slate-900' : ''}`}
                      style={{ width: cell, height: cellH, background: sequentialColor(v, max) }}
                    />
                  );
                })}
              </div>
            ))}
            <div className="flex" style={{ paddingLeft: labelW }}>
              {columns.map((col, c) => (
                <span key={col} className="mr-[2px] flex-shrink-0 text-center text-[10px] text-slate-400" style={{ width: cell }}>
                  {c % labelEvery === 0 ? col : ''}
                </span>
              ))}
            </div>
          </div>
        </div>
        {tip && width > 0 && (
          <ChartTooltip
            x={Math.min(tipX, width - 8)}
            y={active ? active[0] * (cellH + 2) + cellH + 4 : 0}
            containerWidth={width}
            title={tip.title}
            rows={[{ key: 'v', color: sequentialColor(values[active![0]][active![1]], max), shape: 'square', label: tip.detail ?? '', value: tip.value }]}
          />
        )}
      </div>
      <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
        <span>{scaleLabel(0)}</span>
        <span className="flex overflow-hidden rounded-sm">
          {SEQUENTIAL.map(c => <span key={c} className="h-2 w-5" style={{ background: c }} />)}
        </span>
        <span>{scaleLabel(max)}</span>
      </div>
    </div>
  );
}
