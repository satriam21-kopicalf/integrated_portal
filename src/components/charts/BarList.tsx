'use client';

import { ReactNode } from 'react';

export interface BarItem {
  key: string;
  label: string;
  sublabel?: string;
  value: number;
  display: string;
  detail?: string;
  color?: string;
}

/** Ranked horizontal bars: label + value on one line, the bar underneath (rounded data end). */
export default function BarList({
  items, color = '#2a78d6', max, empty = 'No data', leading,
}: {
  items: BarItem[];
  color?: string;
  max?: number;
  empty?: string;
  leading?: (item: BarItem, index: number) => ReactNode;
}) {
  if (!items.length) return <p className="py-6 text-center text-sm text-slate-400">{empty}</p>;
  const top = max ?? Math.max(...items.map(i => i.value), 0);
  return (
    <ol className="space-y-2.5">
      {items.map((item, i) => (
        <li key={item.key} title={item.detail ? `${item.label}: ${item.detail}` : undefined}>
          <div className="flex items-baseline gap-2 text-sm">
            {leading?.(item, i)}
            <span className="min-w-0 flex-1 truncate text-slate-700">
              {item.label}
              {item.sublabel && <span className="ml-1.5 text-xs text-slate-400">{item.sublabel}</span>}
            </span>
            <span className="flex-shrink-0 font-medium tabular-nums text-slate-900">{item.display}</span>
          </div>
          <div className="mt-1 h-2 w-full overflow-hidden rounded-r bg-slate-100">
            <div
              className="h-full rounded-r"
              style={{ width: `${top > 0 ? Math.max(0.5, (item.value / top) * 100) : 0}%`, background: item.color ?? color }}
            />
          </div>
        </li>
      ))}
    </ol>
  );
}
