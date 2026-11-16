'use client';

// Drop-ins with the props of @/so/ui (Page, Panel) and @/components/StatStrip (StatStrip, Stat, StatSkeleton) in the
// new design: a page moves to it by changing the import path only — its logic stays as it is. Used by the Aggregator
// pages first (2026-11-02); the next pages follow the same way.

import { tc } from '@/lib/title-case';
import { createContext, useContext, type ReactNode } from 'react';
import { PageHeader, PageShell, StatBody, cx, statCardClass } from './index';

/** Inside a tab of another page (Monitoring COTR → Master): no own shell and title, the actions stay on top. */
export const EmbeddedPage = createContext(false);

export function Page({ title, subtitle, actions, stats, children, eyebrow, media }: {
  title: ReactNode; subtitle?: string; actions?: ReactNode; stats?: ReactNode; children: ReactNode; eyebrow?: ReactNode; media?: ReactNode;
}) {
  if (useContext(EmbeddedPage)) {
    return (
      <div className="space-y-4">
        {(subtitle || actions) && <div className="flex flex-wrap items-center justify-between gap-3">
          {subtitle ? <p className="text-sm text-neutral-500">{subtitle}</p> : <span />}
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}</div>}
        {stats}
        {children}
      </div>
    );
  }
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
    <section className={cx('overflow-hidden rounded-2xl border border-neutral-200/70 bg-white shadow-[0_1px_2px_0_rgb(15_23_42/0.04)]', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-start justify-between gap-3 px-4 pb-2.5 pt-3.5 sm:px-5">
          <div className="min-w-0">
            {title && <h2 className="text-base font-bold tracking-tight text-neutral-900">{tc(title)}</h2>}
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
export function Stat({ label, icon, value, title, children, emphasis = false, className = '', valueClassName, info, onClick, active = false }: {
  label: string; icon?: ReactNode; info?: ReactNode; value: ReactNode; title?: string; children?: ReactNode; emphasis?: boolean;
  className?: string; valueClassName?: string; onClick?: () => void; active?: boolean;
}) {
  // the same card as StatCard (index.tsx, 2026-11-16 kopicalf-hrms look); `emphasis` = a faint brand border
  const body = <StatBody label={label} value={value} sub={children} icon={icon} info={info} title={title} arrow={!!onClick}
    valueClassName={valueClassName ? valueClassName.replace(/text-(xl|2xl|lg)|sm:text-\S+/g, '').trim() + ' text-[22px]' : undefined} />;
  const cls = cx(statCardClass(active, !!onClick), emphasis && !active && 'border-brand-200', className);
  return onClick ? <button type="button" onClick={onClick} aria-pressed={active} className={cls}>{body}</button> : <div className={cls}>{body}</div>;
}

export { SkeletonValue as StatSkeleton } from './Skeleton';
