'use client';

// Shared chart chrome: sizing, axis ticks, tooltip and legend. Marks follow the
// dashboard data-viz rules (docs/overview-analytics.md §5.3): thin marks, hairline
// gridlines, text in text colors (never the series color), legend for >= 2 series.

import { ReactNode, RefObject, useEffect, useRef, useState } from 'react';

export const CHART = {
  grid: '#e2e8f0', // slate-200 hairline
  axis: '#cbd5e1', // slate-300 baseline
  tick: '#94a3b8', // slate-400 axis text
  text: '#475569', // slate-600 labels
  surface: '#ffffff',
  previous: '#a8a29e', // de-emphasised comparison series
};

/** Width of an element, tracked with ResizeObserver (0 until measured). */
export function useElementWidth<T extends HTMLElement>(): [RefObject<T | null>, number] {
  const ref = useRef<T | null>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(entries => setWidth(Math.floor(entries[0].contentRect.width)));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** 0..top in `count` clean steps (1, 2, 2.5, 5 x 10^n). */
export function niceTicks(max: number, count = 4): number[] {
  if (!(max > 0)) return [0, 1];
  const raw = max / count;
  const exp = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map(s => s * exp).find(s => s >= raw) ?? 10 * exp;
  const top = Math.ceil(max / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let v = 0; v <= top + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return ticks;
}

/** Indices of x labels that fit `width` without overlapping (always includes the first). */
export function labelIndices(count: number, width: number, minGap = 64): number[] {
  if (count <= 0) return [];
  const max = Math.max(1, Math.floor(width / minGap));
  const stride = Math.max(1, Math.ceil(count / max));
  const out: number[] = [];
  for (let i = 0; i < count; i += stride) out.push(i);
  return out;
}

export interface TooltipRow {
  key: string;
  color: string;
  label: string;
  value: string;
  shape?: 'line' | 'square';
  muted?: boolean;
}

/** Positioned readout: value leads, the series name follows, keyed by a short stroke. */
export function ChartTooltip({
  x, y, containerWidth, title, rows, footer,
}: {
  x: number;
  y: number;
  containerWidth: number;
  title: string;
  rows: TooltipRow[];
  footer?: ReactNode;
}) {
  const flip = x > containerWidth / 2;
  return (
    <div
      className="pointer-events-none absolute z-20 min-w-[11rem] max-w-[16rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg"
      style={{ top: Math.max(0, y), left: flip ? undefined : x + 12, right: flip ? containerWidth - x + 12 : undefined }}
      role="status"
    >
      <p className="mb-1 font-medium text-slate-500">{title}</p>
      <ul className="space-y-0.5">
        {rows.map(r => (
          <li key={r.key} className="flex items-center gap-2">
            <SeriesKey color={r.color} shape={r.shape ?? 'line'} />
            <span className={`font-semibold tabular-nums ${r.muted ? 'text-slate-500' : 'text-slate-900'}`}>{r.value}</span>
            <span className="truncate text-slate-500">{r.label}</span>
          </li>
        ))}
      </ul>
      {footer && <div className="mt-1 border-t border-slate-100 pt-1 text-slate-500">{footer}</div>}
    </div>
  );
}

export function SeriesKey({ color, shape = 'square' }: { color: string; shape?: 'line' | 'square' | 'dot' }) {
  if (shape === 'line') return <span className="inline-block h-0.5 w-3 flex-shrink-0 rounded-full" style={{ background: color }} />;
  if (shape === 'dot') return <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ background: color }} />;
  return <span className="inline-block h-2.5 w-2.5 flex-shrink-0 rounded-[3px]" style={{ background: color }} />;
}

export function Legend({ items }: { items: { key: string; label: string; color: string; shape?: 'line' | 'square' }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
      {items.map(i => (
        <li key={i.key} className="flex items-center gap-1.5">
          <SeriesKey color={i.color} shape={i.shape} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
