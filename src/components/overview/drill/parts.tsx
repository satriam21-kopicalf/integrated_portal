'use client';

import { ReactNode, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ChevronRight, Download, Search } from 'lucide-react';
import { formatCurrency, formatDate, formatNumber } from '@/lib/format';
import { Granularity, Resource } from '@/lib/overview';
import { Delta, Skeleton } from '../Card';

/* ------------------------------------------------------------------ layout */

/** One titled block of a drill-down drawer. */
export function Block({ title, subtitle, actions, children }: { title: string; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <section className="space-y-3 border-b border-slate-100 pb-6 last:border-b-0 last:pb-0 [&:not(:first-child)]:pt-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

/** Renders a resource: skeleton on first load, faded while refetching, error text on failure. */
export function Loaded<T>({ resource, height = 160, children }: { resource: Resource<T>; height?: number; children: (data: T) => ReactNode }) {
  if (resource.error && !resource.loading) {
    return (
      <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Could not load: {resource.error}{' '}
        <button type="button" onClick={resource.retry} className="font-medium underline">Try again</button>
      </p>
    );
  }
  if (!resource.data) return <Skeleton height={height} />;
  return <div className={`transition-opacity ${resource.loading ? 'opacity-50' : ''}`}>{children(resource.data)}</div>;
}

export interface Tile {
  label: string;
  value: string;
  sub?: ReactNode;
  delta?: number | null;
  deltaUnit?: string;
  upIsGood?: boolean;
  title?: string;
}

/** Headline figures of a drawer. */
export function Tiles({ tiles, columns = 4 }: { tiles: Tile[]; columns?: 2 | 3 | 4 | 5 }) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4', 5: 'sm:grid-cols-3 lg:grid-cols-5' }[columns];
  return (
    <dl className={`grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 ${cols}`}>
      {tiles.map(t => (
        <div key={t.label} className="min-w-0 bg-white px-3.5 py-3" title={t.title ?? t.value}>
          <dt className="truncate text-[10px] font-semibold uppercase tracking-wider text-slate-400">{t.label}</dt>
          {/* full figures stay on one line: long ones (Rp 45.795.696.100) get a smaller size */}
          <dd className={`mt-0.5 truncate font-semibold tabular-nums tracking-tight text-slate-900 ${t.value.length > 14 ? 'text-[15px]' : 'text-lg'}`}>{t.value}</dd>
          {(t.delta !== undefined || t.sub) && (
            <dd className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 text-[11px] text-slate-500">
              {t.delta !== undefined && <Delta value={t.delta} unit={t.deltaUnit} upIsGood={t.upIsGood} />}
              {t.sub && <span className="truncate">{t.sub}</span>}
            </dd>
          )}
        </div>
      ))}
    </dl>
  );
}

/* ------------------------------------------------------------------ table */

export interface Column<R> {
  key: string;
  label: string;
  align?: 'left' | 'right';
  /** sort + CSV value */
  value: (r: R) => number | string | null;
  /** cell content (default: the formatted value) */
  render?: (r: R) => ReactNode;
  title?: string;
}

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Full data table of a drawer: click a header to sort, optional search, CSV download
 * (the exact numbers, unformatted) and clickable rows that drill further.
 */
export function DetailTable<R>({
  rows, columns, rowKey, caption, csvName, search, onRowClick, initialSort, maxHeight = 420, footer, rowHint,
}: {
  rows: R[];
  columns: Column<R>[];
  rowKey: (r: R) => string;
  caption: string;
  csvName?: string;
  /** fields searched by the search box (shown when set) */
  search?: (r: R) => string;
  onRowClick?: (r: R) => void;
  initialSort?: { key: string; desc: boolean };
  maxHeight?: number;
  footer?: ReactNode;
  rowHint?: string;
}) {
  const [sort, setSort] = useState<{ key: string; desc: boolean } | null>(initialSort ?? null);
  const [q, setQ] = useState('');
  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    const list = needle && search ? rows.filter(r => search(r).toLowerCase().includes(needle)) : [...rows];
    const col = sort && columns.find(c => c.key === sort.key);
    if (col) {
      list.sort((a, b) => {
        const x = col.value(a);
        const y = col.value(b);
        if (x === y) return 0;
        if (x === null || x === undefined) return 1;
        if (y === null || y === undefined) return -1;
        const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
        return sort!.desc ? -c : c;
      });
    }
    return list;
  }, [rows, q, search, sort, columns]);

  const download = () => {
    const lines = [columns.map(c => csvCell(c.label)).join(','), ...shown.map(r => columns.map(c => csvCell(c.value(r))).join(','))];
    const blob = new Blob([`﻿${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${csvName ?? caption}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        {search && (
          <label className="relative min-w-[10rem] flex-1">
            <span className="sr-only">Search {caption}</span>
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search"
              className="h-8 w-full rounded-lg border border-slate-200 pl-8 pr-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none" />
          </label>
        )}
        <span className="text-[11px] text-slate-400">{formatNumber(shown.length)}{shown.length !== rows.length ? ` of ${formatNumber(rows.length)}` : ''} rows{onRowClick ? ` · ${rowHint ?? 'click a row for details'}` : ''}</span>
        {csvName !== undefined && (
          <button type="button" onClick={download} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900">
            <Download size={13} /> CSV
          </button>
        )}
      </div>
      <div className="custom-scrollbar overflow-auto rounded-lg border border-slate-200" style={{ maxHeight }}>
        <table className="w-full whitespace-nowrap text-xs">
          <caption className="sr-only">{caption}</caption>
          <thead className="sticky top-0 z-10 bg-slate-50 text-slate-500">
            <tr>
              {columns.map(c => {
                const active = sort?.key === c.key;
                return (
                  <th key={c.key} scope="col" aria-sort={active ? (sort!.desc ? 'descending' : 'ascending') : 'none'}
                    className={`px-3 py-2 font-medium ${c.align === 'right' ? 'text-right' : 'text-left'}`}>
                    <button type="button" title={c.title} onClick={() => setSort({ key: c.key, desc: active ? !sort!.desc : c.align === 'right' })}
                      className={`inline-flex items-center gap-0.5 hover:text-slate-900 ${active ? 'text-slate-900' : ''}`}>
                      {c.label}
                      {active && (sort!.desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}
                    </button>
                  </th>
                );
              })}
              {onRowClick && <th scope="col" className="w-6" aria-hidden />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map(r => (
              <tr key={rowKey(r)} onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={onRowClick ? 'group cursor-pointer hover:bg-blue-50/50' : 'hover:bg-slate-50/60'}>
                {columns.map(c => (
                  <td key={c.key} className={`px-3 py-1.5 text-slate-700 ${c.align === 'right' ? 'text-right tabular-nums' : 'text-left'}`}>
                    {c.render ? c.render(r) : fmtCell(c.value(r))}
                  </td>
                ))}
                {onRowClick && <td className="pr-2 text-slate-300 group-hover:text-blue-600"><ChevronRight size={14} /></td>}
              </tr>
            ))}
            {!shown.length && (
              <tr><td colSpan={columns.length + (onRowClick ? 1 : 0)} className="px-3 py-6 text-center text-slate-400">No rows</td></tr>
            )}
          </tbody>
          {footer}
        </table>
      </div>
    </div>
  );
}

function fmtCell(v: number | string | null): ReactNode {
  if (v === null || v === undefined || v === '') return '-';
  return typeof v === 'number' ? formatNumber(v) : v;
}

/* ------------------------------------------------------------------ formatting helpers */

export const rp = (v: number | null | undefined) => (v === null || v === undefined ? '-' : formatCurrency(Math.round(v)));
export const num = (v: number | null | undefined, digits = 0) =>
  v === null || v === undefined ? '-' : digits ? v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : formatNumber(Math.round(v));
export const pctText = (v: number | null | undefined, digits = 1) => (v === null || v === undefined ? '-' : `${v.toFixed(digits)}%`);
export const delta = (v: number | null | undefined) => <Delta value={v ?? null} />;

/** A share bar inside a table cell. */
export function ShareBar({ value, color = '#2a78d6' }: { value: number | null; color?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <span className="inline-flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full" style={{ width: `${v}%`, background: color }} /></span>
      <span className="w-12 text-right tabular-nums">{pctText(value)}</span>
    </span>
  );
}

/** Start/end of a trend bucket, clipped to the period. */
export function bucketRange(date: string, g: Granularity, from: string, to: string): [string, string] {
  if (g === 'day') return [date, date];
  const start = new Date(`${date}T00:00:00`);
  const end = new Date(start);
  if (g === 'week') end.setDate(end.getDate() + 6);
  else end.setMonth(end.getMonth() + 1, 0);
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return [iso(start) < from ? from : iso(start), iso(end) > to ? to : iso(end)];
}

export function rangeText(from: string, to: string): string {
  return from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
}
