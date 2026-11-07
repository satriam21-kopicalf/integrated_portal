'use client';

// Drop-ins with the props of @/so/ui (Page, Panel) and @/components/StatStrip (StatStrip, Stat, StatSkeleton) in the
// new design: a page moves to it by changing the import path only — its logic stays as it is. Used by the Aggregator
// pages first (2026-11-02); the next pages follow the same way.

import type { ReactNode } from 'react';
import { PageHeader, PageShell, cx } from './index';

export function Page({ title, subtitle, actions, stats, children, eyebrow, media }: {
  title: ReactNode; subtitle?: string; actions?: ReactNode; stats?: ReactNode; children: ReactNode; eyebrow?: ReactNode; media?: ReactNode;
}) {
  return (
    <PageShell>
      <PageHeader title={title} subtitle={subtitle} actions={actions} eyebrow={eyebrow} media={media} />
      {stats}
      {children}
    </PageShell>
  );
}

/** A card holding a toolbar and a table; the body has no padding (as the old Panel). */
export function Panel({ title, description, actions, toolbar, footer, children, className }: {
  title?: string; description?: string; actions?: ReactNode; toolbar?: ReactNode; footer?: ReactNode; children: ReactNode; className?: string;
}) {
  return (
    <section className={cx('overflow-hidden rounded-xl border border-neutral-200 bg-white', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-2.5 pt-3.5 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-[15px] font-semibold text-neutral-900">{title}</h2>}
            {description && <p className="mt-0.5 text-xs text-neutral-500">{description}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {toolbar && <div className={cx('space-y-3 px-4 pb-3 sm:px-5', !(title || actions) && 'pt-3.5')}>{toolbar}</div>}
      <div className={cx(!!(title || actions || toolbar) && 'border-t border-neutral-100')}>{children}</div>
      {footer && (
        <div className="flex flex-col items-center justify-between gap-2 border-t border-neutral-100 bg-neutral-50/60 px-4 py-2.5 text-xs text-neutral-500 sm:flex-row sm:px-5">{footer}</div>
      )}
    </section>
  );
}

const GRID = { 3: 'lg:grid-cols-3', 4: 'lg:grid-cols-4', 5: 'lg:grid-cols-5' } as const;
export function StatStrip({ children, columns = 4, label, gridClassName }: { children: ReactNode; columns?: 3 | 4 | 5; label: string; gridClassName?: string }) {
  // gridClassName replaces the columns (phones included), e.g. a swipe row on phones
  return <section aria-label={label} className={cx('grid gap-3 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1', gridClassName ?? `grid-cols-2 ${GRID[columns]}`)}>{children}</section>;
}

/** A number card: label (+ icon / info), value, the lines under it; a quick filter when `onClick` is given. Every card
 * carries the Calf mark as a faint watermark (2026-11-07); the emphasised one a light brand gradient. */
export function Stat({ label, icon, value, title, children, emphasis = false, className = '', valueClassName = 'truncate text-xl sm:text-2xl', info, onClick, active = false }: {
  label: string; icon?: ReactNode; info?: ReactNode; value: ReactNode; title?: string; children?: ReactNode; emphasis?: boolean;
  className?: string; valueClassName?: string; onClick?: () => void; active?: boolean;
}) {
  const body = (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- decorative brand mark */}
      <img src="/assets/calf-logo.png" alt="" aria-hidden
        className={cx('pointer-events-none absolute -bottom-5 -right-4 h-20 w-20 rotate-[-12deg] select-none object-contain grayscale', emphasis ? 'opacity-[0.1]' : 'opacity-[0.05]')} />
      <span className="relative flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1 text-[11px] font-semibold uppercase leading-snug tracking-wide text-neutral-500">{label}{info}</span>
        {icon && <span className={cx('flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg [&>svg]:h-3.5 [&>svg]:w-3.5',
          emphasis ? 'bg-brand-100 text-brand-700' : 'bg-neutral-100 text-neutral-500')}>{icon}</span>}
      </span>
      <span title={title} className={cx('relative block font-semibold leading-tight tabular-nums', valueClassName, emphasis ? 'text-brand-800' : 'text-neutral-900')}>{value}</span>
      {children && <div className="relative space-y-0.5 text-xs text-neutral-500 [&_p]:truncate">{children}</div>}
    </>
  );
  const cls = cx('relative flex min-w-0 flex-col gap-1.5 overflow-hidden rounded-xl border px-4 py-3.5 text-left shadow-sm transition',
    emphasis ? 'border-brand-200 bg-gradient-to-br from-brand-50 via-white to-white' : 'border-neutral-200 bg-white',
    active && 'border-brand-400 ring-2 ring-brand-100', onClick && 'hover:-translate-y-px hover:shadow-md', className);
  return onClick ? <button type="button" onClick={onClick} aria-pressed={active} className={cls}>{body}</button> : <div className={cls}>{body}</div>;
}

export { SkeletonValue as StatSkeleton } from './Skeleton';
