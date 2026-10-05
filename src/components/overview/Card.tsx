'use client';

import { ReactNode } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Maximize2, Minus, RotateCw } from 'lucide-react';
import { Resource } from '@/lib/overview';

/**
 * Widget frame. First load shows a skeleton; a refetch keeps the previous render
 * at reduced opacity (no layout jump); errors offer "Try again".
 */
export function Card<T>({
  title, subtitle, actions, resource, children, className = '', minHeight = 240, onOpen,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  resource: Resource<T>;
  children: (data: T) => ReactNode;
  className?: string;
  minHeight?: number;
  /** opens the detail drawer of this analytic (title and "Details" button) */
  onOpen?: () => void;
}) {
  const { data, loading, error, retry } = resource;
  return (
    <section className={`group/card flex h-full min-w-0 flex-col rounded-xl border border-slate-200 bg-white transition-shadow ${onOpen ? 'hover:shadow-md hover:shadow-slate-200/70' : ''} ${className}`}>
      <header className="flex flex-wrap items-start justify-between gap-2 px-4 pb-2 pt-4 sm:px-5">
        <div className="min-w-0">
          {onOpen ? (
            <button type="button" onClick={onOpen} className="text-left text-sm font-semibold text-slate-900 hover:text-blue-700">{title}</button>
          ) : (
            <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
          )}
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {actions}
          {onOpen && <DetailsButton onClick={onOpen} />}
        </div>
      </header>
      <div className="relative flex-1 px-4 pb-4 sm:px-5" style={{ minHeight }}>
        {error && !loading ? (
          <div className="flex h-full min-h-[inherit] flex-col items-center justify-center gap-2 text-center">
            <AlertTriangle size={20} className="text-amber-500" />
            <p className="text-sm text-slate-600">Could not load this widget</p>
            <p className="max-w-xs text-xs text-slate-400">{error}</p>
            <button type="button" onClick={retry} className="mt-1 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
              <RotateCw size={13} /> Try again
            </button>
          </div>
        ) : data ? (
          <div className={`transition-opacity ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
            {children(data)}
          </div>
        ) : (
          <Skeleton height={minHeight - 16} />
        )}
      </div>
    </section>
  );
}

/** "Details" entry to a card's drawer. */
export function DetailsButton({ onClick, label = 'Details' }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} title="All data behind this analytic"
      className="inline-flex h-7 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-600 transition-colors hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700">
      <Maximize2 size={12} /> {label}
    </button>
  );
}

export function Skeleton({ height = 200 }: { height?: number }) {
  return (
    <div className="space-y-3" style={{ height }} aria-label="Loading">
      <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
      <div className="h-[calc(100%-2rem)] animate-pulse rounded-lg bg-slate-100" />
    </div>
  );
}

/** Signed change with an arrow icon + text, colour by direction x whether up is good. */
export function Delta({
  value, upIsGood = true, suffix = '', className = '', unit = '%',
}: {
  value: number | null | undefined;
  upIsGood?: boolean;
  suffix?: string;
  className?: string;
  unit?: string;
}) {
  if (value === null || value === undefined) {
    return (
      <span className={`inline-flex items-center gap-0.5 text-xs text-slate-400 ${className}`} title="No comparable previous period">
        <Minus size={12} /> n/a
      </span>
    );
  }
  const flat = Math.abs(value) < 0.05;
  const up = value > 0;
  const good = flat ? null : up === upIsGood;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const tone = good === null ? 'text-slate-500' : good ? 'text-emerald-700' : 'text-rose-700';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${tone} ${className}`}>
      <Icon size={13} strokeWidth={2.25} aria-hidden />
      <span>
        {up ? '+' : value < 0 ? '−' : ''}
        {Math.abs(value).toFixed(1)}
        {unit}
        {suffix}
      </span>
    </span>
  );
}

export function Segmented<V extends string>({
  value, options, onChange, label,
}: {
  value: V;
  options: { value: V; label: string }[];
  onChange: (value: V) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            value === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Scrollable data table used as the accessible alternative to each chart. */
export function DataTable({
  columns, rows, caption, maxHeight = 320,
}: {
  columns: { key: string; label: string; align?: 'left' | 'right' }[];
  rows: { key: string; cells: Record<string, ReactNode> }[];
  caption: string;
  maxHeight?: number;
}) {
  return (
    <div className="custom-scrollbar overflow-auto rounded-lg border border-slate-100" style={{ maxHeight }}>
      <table className="w-full text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 bg-slate-50 text-slate-500">
          <tr>
            {columns.map(c => (
              <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map(r => (
            <tr key={r.key} className="hover:bg-slate-50/60">
              {columns.map(c => (
                <td key={c.key} className={`whitespace-nowrap px-3 py-1.5 ${c.align === 'right' ? 'text-right tabular-nums' : 'text-left'} text-slate-700`}>
                  {r.cells[c.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
