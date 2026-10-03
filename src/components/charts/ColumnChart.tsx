'use client';

import { KeyboardEvent, ReactNode, useState } from 'react';
import { CHART, ChartTooltip, labelIndices, niceTicks, useElementWidth } from './common';

export interface ColumnStack {
  key: string;
  label: string;
  color: string;
  values: number[];
}

interface ColumnChartProps {
  ariaLabel: string;
  xLabels: string[];
  /** Bottom to top. One stack = plain columns. */
  stacks: ColumnStack[];
  /** Normalise each column to 100%. */
  percent?: boolean;
  tooltipTitle: (index: number) => string;
  formatValue: (value: number, index: number, key: string) => string;
  formatTick: (value: number) => string;
  /** Columns drawn lighter (e.g. a partial month). */
  muted?: (index: number) => boolean;
  tooltipFooter?: (index: number) => ReactNode;
  height?: number;
}

const M = { top: 10, right: 8, bottom: 24, left: 64 };
const GAP = 2; // surface gap between stacked segments
const MAX_BAR = 24;
const RADIUS = 4;

function roundedTop(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, h, w / 2);
  return `M${x},${y + h}V${y + rr}Q${x},${y} ${x + rr},${y}H${x + w - rr}Q${x + w},${y} ${x + w},${y + rr}V${y + h}Z`;
}

/** Columns from a single baseline; stacked segments separated by a 2px surface gap. */
export default function ColumnChart({
  ariaLabel, xLabels, stacks, percent = false, tooltipTitle, formatValue, formatTick, muted, tooltipFooter, height = 220,
}: ColumnChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = xLabels.length;
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const totals = xLabels.map((_, i) => stacks.reduce((sum, s) => sum + (s.values[i] || 0), 0));
  const ticks = percent ? [0, 25, 50, 75, 100] : niceTicks(Math.max(0, ...totals));
  const top = ticks[ticks.length - 1] || 1;
  const slot = n ? innerW / n : 0;
  const bar = Math.max(2, Math.min(MAX_BAR, slot * 0.7));
  const y = (v: number) => M.top + innerH - (v / top) * innerH;

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight') setActive(i => Math.min(n - 1, (i ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setActive(i => Math.max(0, (i ?? n) - 1));
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };

  const shown = labelIndices(n, innerW, 64);

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && n > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onFocus={() => setActive(a => a ?? n - 1)}
          onBlur={() => setActive(null)}
          onPointerLeave={() => setActive(null)}
          className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
        >
          {ticks.map(t => (
            <g key={t}>
              <line x1={M.left} x2={M.left + innerW} y1={y(t)} y2={y(t)} stroke={t === 0 ? CHART.axis : CHART.grid} strokeWidth={1} />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={CHART.tick} className="tabular-nums">
                {percent ? `${t}%` : formatTick(t)}
              </text>
            </g>
          ))}
          {shown.map(i => (
            <text key={i} x={M.left + slot * (i + 0.5)} y={height - 6} textAnchor="middle" fontSize={11} fill={CHART.tick}>
              {xLabels[i]}
            </text>
          ))}
          {xLabels.map((_, i) => {
            const total = totals[i];
            const scale = percent ? (total ? 100 / total : 0) : 1;
            const segments = stacks
              .map(s => ({ key: s.key, color: s.color, v: (s.values[i] || 0) * scale }))
              .filter(s => s.v > 0);
            let acc = 0;
            const x0 = M.left + slot * i + (slot - bar) / 2;
            const dim = active !== null && active !== i;
            return (
              <g key={i} opacity={dim ? 0.45 : muted?.(i) ? 0.55 : 1}>
                {segments.map((s, k) => {
                  const yTop = y(acc + s.v);
                  const yBottom = y(acc);
                  acc += s.v;
                  const gap = k > 0 ? GAP : 0; // gap above the previous segment
                  const h = Math.max(0, yBottom - yTop - gap);
                  if (h <= 0) return null;
                  return k === segments.length - 1 ? (
                    <path key={s.key} d={roundedTop(x0, yTop, bar, h, RADIUS)} fill={s.color} />
                  ) : (
                    <rect key={s.key} x={x0} y={yTop} width={bar} height={h} fill={s.color} />
                  );
                })}
                <rect
                  x={M.left + slot * i}
                  y={M.top}
                  width={slot}
                  height={innerH}
                  fill="transparent"
                  onPointerEnter={() => setActive(i)}
                  onPointerDown={() => setActive(i)}
                />
              </g>
            );
          })}
        </svg>
      )}
      {active !== null && width > 0 && (
        <ChartTooltip
          x={M.left + slot * (active + 0.5)}
          y={M.top}
          containerWidth={width}
          title={tooltipTitle(active)}
          rows={[...stacks].reverse().map(s => ({
            key: s.key,
            color: s.color,
            shape: 'square' as const,
            label: s.label,
            value: formatValue(s.values[active] || 0, active, s.key),
          }))}
          footer={tooltipFooter?.(active)}
        />
      )}
    </div>
  );
}
