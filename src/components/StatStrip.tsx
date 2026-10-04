'use client';

import { ReactNode } from 'react';

/**
 * Headline figures without cards: one band on the page background, metrics
 * separated by hairlines (1px gaps over a slate backdrop). Values are shown in
 * full (no B/M), so: 1 column on phones, 2 on tablets, `columns` from xl up.
 */
export function StatStrip({ children, columns = 4, label }: { children: ReactNode; columns?: 3 | 4 | 5; label: string }) {
  const xl = { 3: 'xl:grid-cols-3', 4: 'xl:grid-cols-4', 5: 'xl:grid-cols-5' }[columns];
  return (
    <section aria-label={label} className={`grid grid-cols-1 gap-px border-y border-slate-200 bg-slate-200 sm:grid-cols-2 ${xl}`}>
      {children}
    </section>
  );
}

export function Stat({
  label, icon, value, title, children, emphasis = false, className = '',
}: {
  label: string;
  icon?: ReactNode;
  value: ReactNode;
  /** Full value shown on hover (the visible one may be compact). */
  title?: string;
  children?: ReactNode;
  emphasis?: boolean;
  className?: string;
}) {
  return (
    <div className={`relative min-w-0 bg-slate-50 px-4 py-4 sm:px-5 ${className}`}>
      {emphasis && <span className="absolute inset-y-4 left-0 w-0.5 rounded-full bg-blue-600" aria-hidden />}
      <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
        {icon}
        {label}
      </p>
      <div className="mt-1.5 truncate text-2xl font-semibold tracking-tight text-slate-900 tabular-nums" title={title}>
        {value}
      </div>
      {children && <div className="mt-1.5 space-y-1 text-xs text-slate-500">{children}</div>}
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="space-y-2">
      <div className="h-8 w-3/4 animate-pulse rounded bg-slate-200/70" />
      <div className="h-3 w-1/2 animate-pulse rounded bg-slate-200/70" />
    </div>
  );
}
