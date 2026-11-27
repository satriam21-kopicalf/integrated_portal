'use client';

import { ReactNode } from 'react';
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Maximize2, Minus, RotateCw } from 'lucide-react';
import type { InfoKey } from '@/lib/metricInfo';
import { Resource } from '@/lib/overview';
import InfoTip from '@/components/ui/InfoTip';
import LoadingState, { RefreshBar } from '@/components/ui/LoadingState';
import { tr } from '@/lib/i18n';
import { tc } from '@/lib/title-case';
import { fixed } from '@/lib/format';

/**
 * Widget frame. First load shows a skeleton; a refetch keeps the previous render
 * at reduced opacity (no layout jump); errors offer "Try again".
 */
export function Card<T>({
  title, subtitle, actions, resource, children, className = '', minHeight = 240, onOpen, info, tabs,
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
  /** ⓘ: source, definition and formulas (lib/metricInfo.ts) */
  info?: InfoKey;
  /** views of the card (CardTabs), shown under the header also while loading */
  tabs?: ReactNode;
}) {
  const { data, loading, error, retry } = resource;
  return (
    <section className={`group/card relative flex h-full min-w-0 flex-col rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white  transition-shadow ${onOpen ? 'hover:border-[color:var(--j-8590A2)]' : ''} ${className}`}>
      {loading && data && <RefreshBar />}
      <header className="flex flex-wrap items-start justify-between gap-2 px-4 pb-2 pt-4 sm:px-5">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            {onOpen ? (
              <button type="button" onClick={onOpen} className="text-left text-base font-bold tracking-tight text-[color:var(--j-172B4D)] hover:text-[color:var(--j-0C66E4)]">{tc(title)}</button>
            ) : (
              <h2 className="text-base font-bold tracking-tight text-[color:var(--j-172B4D)]">{tc(title)}</h2>
            )}
            {info && <InfoTip info={info} />}
          </div>
          {subtitle && <p className="mt-0.5 text-xs text-[color:var(--j-626F86)]">{subtitle}</p>}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          {actions}
          {onOpen && <DetailsButton onClick={onOpen} />}
        </div>
      </header>
      {tabs && <div className="px-4 sm:px-5">{tabs}</div>}
      <div className={`relative flex-1 px-4 pb-4 sm:px-5 ${tabs ? 'pt-4' : ''}`} style={{ minHeight }}>
        {error && !loading ? (
          <div className="flex h-full min-h-[inherit] flex-col items-center justify-center gap-2 text-center">
            <AlertTriangle size={20} className="text-amber-500" />
            <p className="text-sm text-[color:var(--j-44546F)]">{tr('Could not load this widget')}</p>
            <p className="max-w-xs text-xs text-[color:var(--j-626F86)]">{error}</p>
            <button type="button" onClick={retry} className="mt-1 inline-flex items-center gap-1.5 rounded-[3px] border border-[color:var(--j-DCDFE4)] px-3 py-1.5 text-xs font-medium text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]">
              <RotateCw size={13} /> {tr('Try Again')}
            </button>
          </div>
        ) : data ? (
          <div className={`transition-opacity ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
            {children(data)}
          </div>
        ) : (
          <Skeleton height={minHeight - 16} label={title.toLowerCase()} />
        )}
      </div>
    </section>
  );
}

/** Underlined view tabs of a card. */
export function CardTabs<V extends string>({ value, options, onChange, label }: {
  value: V; options: { value: V; label: string }[]; onChange: (v: V) => void; label: string;
}) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-[color:var(--j-F1F2F4)]" role="tablist" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)}
          className={`-mb-px whitespace-nowrap border-b-2 px-3 pb-2.5 pt-1 text-xs font-bold transition-colors ${
            value === o.value ? 'border-[color:var(--j-0C66E4)] text-[color:var(--j-0C66E4)]' : 'border-transparent text-[color:var(--j-626F86)] hover:text-[color:var(--j-172B4D)]'}`}>
          {tc(o.label)}
        </button>
      ))}
    </div>
  );
}

/** "Details" entry to a card's drawer. */
export function DetailsButton({ onClick, label = tr('Details') }: { onClick: () => void; label?: string }) {
  return (
    <button type="button" onClick={onClick} title={tr('All data behind this analytic')}
      className="inline-flex h-7 items-center gap-1.5 rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white px-2.5 text-xs font-medium text-[color:var(--j-44546F)] transition-colors hover:border-[color:var(--j-85B8FF)] hover:bg-[color:var(--j-E9F2FF)] hover:text-[color:var(--j-0C66E4)]">
      <Maximize2 size={12} /> {label}
    </button>
  );
}

/** The shared loading state (components/ui/LoadingState.tsx). */
export function Skeleton({ height = 200, label }: { height?: number; label?: string }) {
  return <LoadingState height={height} label={label} />;
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
      <span className={`inline-flex items-center gap-0.5 text-xs text-[color:var(--j-626F86)] ${className}`} title={tr('No comparable comparison period')}>
        <Minus size={12} /> n/a
      </span>
    );
  }
  const flat = Math.abs(value) < 0.05;
  const up = value > 0;
  const good = flat ? null : up === upIsGood;
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const tone = good === null ? 'text-[color:var(--j-626F86)]' : good ? 'text-emerald-700' : 'text-rose-700';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${tone} ${className}`}>
      <Icon size={13} strokeWidth={2.25} aria-hidden />
      <span>
        {up ? '+' : value < 0 ? '−' : ''}
        {fixed(Math.abs(value), 1)}
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
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-[3px] bg-[color:var(--j-091E420F)] p-0.5">
      {options.map(o => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={`rounded-[3px] px-2.5 py-1 text-xs font-medium transition-colors ${
            value === o.value ? 'bg-white text-[color:var(--j-172B4D)]' : 'text-[color:var(--j-626F86)] hover:text-[color:var(--j-172B4D)]'
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
    <div className="custom-scrollbar overflow-auto rounded-[3px] border border-[color:var(--j-F1F2F4)]" style={{ maxHeight }}>
      <table className="w-full text-xs">
        <caption className="sr-only">{caption}</caption>
        <thead className="sticky top-0 border-b-2 border-[color:var(--j-DCDFE4)] bg-white text-left text-[11px] font-semibold uppercase tracking-wide text-[color:var(--j-626F86)]">
          <tr>
            {columns.map(c => (
              <th key={c.key} scope="col" className={`whitespace-nowrap px-3 py-2 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[color:var(--j-F1F2F4)]">
          {rows.map(r => (
            <tr key={r.key} className="hover:bg-[color:var(--j-F7F8F9)]">
              {columns.map(c => (
                <td key={c.key} className={`whitespace-nowrap px-3 py-1.5 ${c.align === 'right' ? 'text-right tabular-nums' : 'text-left'} text-[color:var(--j-44546F)]`}>
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
