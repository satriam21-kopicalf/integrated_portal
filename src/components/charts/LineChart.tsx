'use client';

import { KeyboardEvent, PointerEvent, ReactNode, useState } from 'react';
import { CHART, ChartTooltip, labelIndices, niceTicks, useElementWidth } from './common';

export interface LineSeries {
  key: string;
  label: string;
  color: string;
  values: (number | null)[];
  /** 10% wash under the line (primary series only). */
  area?: boolean;
  /** Value label at the line end. */
  endLabel?: boolean;
}

interface LineChartProps {
  ariaLabel: string;
  xLabels: string[];
  series: LineSeries[];
  tooltipTitle: (index: number) => string;
  formatValue: (value: number) => string;
  formatTick: (value: number) => string;
  tooltipFooter?: (index: number) => ReactNode;
  height?: number;
}

const M = { top: 10, right: 56, bottom: 24, left: 64 };

/** Line chart with a crosshair that snaps to the nearest x and lists every series. */
export default function LineChart({
  ariaLabel, xLabels, series, tooltipTitle, formatValue, formatTick, tooltipFooter, height = 240,
}: LineChartProps) {
  const [ref, width] = useElementWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const n = xLabels.length;
  const innerW = Math.max(0, width - M.left - M.right);
  const innerH = height - M.top - M.bottom;
  const max = Math.max(0, ...series.flatMap(s => s.values.filter((v): v is number => v !== null)));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1] || 1;
  const x = (i: number) => M.left + (n <= 1 ? innerW / 2 : (i / (n - 1)) * innerW);
  const y = (v: number) => M.top + innerH - (v / top) * innerH;

  const path = (values: (number | null)[]) => {
    let d = '';
    let pen = false;
    values.forEach((v, i) => {
      if (v === null) { pen = false; return; }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };
  const area = (values: (number | null)[]) => {
    const pts = values.map((v, i) => (v === null ? null : [x(i), y(v)] as const)).filter(Boolean) as [number, number][];
    if (pts.length < 2) return '';
    const base = y(0);
    return `M${pts[0][0]},${base}` + pts.map(([px, py]) => `L${px.toFixed(1)},${py.toFixed(1)}`).join('') + `L${pts[pts.length - 1][0]},${base}Z`;
  };

  const onPointerMove = (e: PointerEvent<SVGRectElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / Math.max(1, rect.width);
    setActive(Math.min(n - 1, Math.max(0, Math.round(rel * (n - 1)))));
  };
  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === 'ArrowRight') setActive(i => Math.min(n - 1, (i ?? -1) + 1));
    else if (e.key === 'ArrowLeft') setActive(i => Math.max(0, (i ?? n) - 1));
    else if (e.key === 'Escape') setActive(null);
    else return;
    e.preventDefault();
  };

  const shown = labelIndices(n, innerW, 72);

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
          className="block rounded-md outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20"
        >
          {ticks.map(t => (
            <g key={t}>
              <line x1={M.left} x2={M.left + innerW} y1={y(t)} y2={y(t)} stroke={t === 0 ? CHART.axis : CHART.grid} strokeWidth={1} />
              <text x={M.left - 8} y={y(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={CHART.tick} className="tabular-nums">
                {formatTick(t)}
              </text>
            </g>
          ))}
          {shown.map(i => (
            <text key={i} x={x(i)} y={height - 6} textAnchor={n > 1 && i === 0 ? 'start' : 'middle'} fontSize={11} fill={CHART.tick}>
              {xLabels[i]}
            </text>
          ))}
          {series.filter(s => s.area).map(s => (
            <path key={`area-${s.key}`} d={area(s.values)} fill={s.color} fillOpacity={0.1} />
          ))}
          {/* draw de-emphasised series first so the primary sits on top */}
          {[...series].reverse().map(s => (
            <path key={s.key} d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          ))}
          {series.filter(s => s.endLabel).map(s => {
            const last = s.values.reduce<number>((acc, v, i) => (v !== null ? i : acc), -1);
            if (last < 0) return null;
            return (
              <text key={`end-${s.key}`} x={x(last) + 8} y={y(s.values[last] as number)} dy="0.32em" fontSize={11} fontWeight={600} fill={CHART.text} className="tabular-nums">
                {formatTick(s.values[last] as number)}
              </text>
            );
          })}
          {active !== null && (
            <g pointerEvents="none">
              <line x1={x(active)} x2={x(active)} y1={M.top} y2={M.top + innerH} stroke={CHART.axis} strokeWidth={1} />
              {series.map(s => {
                const v = s.values[active];
                return v === null || v === undefined ? null : (
                  <circle key={s.key} cx={x(active)} cy={y(v)} r={4} fill={s.color} stroke={CHART.surface} strokeWidth={2} />
                );
              })}
            </g>
          )}
          <rect
            x={M.left}
            y={M.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPointerMove={onPointerMove}
            onPointerDown={onPointerMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}
      {active !== null && width > 0 && (
        <ChartTooltip
          x={x(active)}
          y={M.top}
          containerWidth={width}
          title={tooltipTitle(active)}
          rows={series.map((s, i) => {
            const v = s.values[active];
            return { key: s.key, color: s.color, label: s.label, value: v === null || v === undefined ? '-' : formatValue(v), muted: i > 0 };
          })}
          footer={tooltipFooter?.(active)}
        />
      )}
    </div>
  );
}
