'use client';

// The one loading look of the portal (2026-11-02): a neutral block with a soft shimmer (the `.skeleton` class of
// globals.css), shaped like what is coming — a value, table rows, a list, number cards, a whole page. Every loading
// state uses these (directly or through so/ui SkeletonRows, StatSkeleton and LoadingState).

import { tr } from '@/lib/i18n';
import { cx } from './index';

/** A shimmering block; size it with classes (h-4 w-24 …). */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cx('skeleton block rounded-md', className)} aria-hidden />;
}

const WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/12', 'w-7/12'];

/** Table rows while loading: one bar per column (the first a name with a line under it). */
export function SkeletonRows({ cols, rows = 6 }: { cols: number; rows?: number }) {
  return (
    <>
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} aria-hidden>
          {Array.from({ length: Math.max(1, cols) }, (_, c) => (
            <td key={c} className="px-4 py-3.5">
              {c === 0 ? (
                <span className="flex items-center gap-3">
                  <Skeleton className="h-8 w-8 flex-shrink-0 rounded-lg" />
                  <span className="flex-1 space-y-1.5"><Skeleton className={cx('h-3', WIDTHS[r % WIDTHS.length])} /><Skeleton className="h-2.5 w-1/3" /></span>
                </span>
              ) : <Skeleton className={cx('h-3', WIDTHS[(r + c) % WIDTHS.length])} />}
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

/** A list (cards, timeline rows) while loading. */
export function SkeletonList({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cx('divide-y divide-neutral-100', className)} role="status" aria-label={tr('Loading…')}>
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3.5" aria-hidden>
          <Skeleton className="h-9 w-9 flex-shrink-0 rounded-lg" />
          <span className="flex-1 space-y-2"><Skeleton className={cx('h-3', WIDTHS[i % WIDTHS.length])} /><Skeleton className="h-2.5 w-1/3" /></span>
          <Skeleton className="h-6 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}

/** The value of a number card while loading. */
export function SkeletonValue() {
  return (
    <span className="block space-y-2" aria-hidden>
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-2.5 w-1/2" />
    </span>
  );
}

/** A row of number cards while loading. */
export function SkeletonCards({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="space-y-2.5 rounded-xl border border-neutral-200 bg-white px-4 py-3.5">
          <Skeleton className="h-2.5 w-1/2" />
          <SkeletonValue />
        </div>
      ))}
    </div>
  );
}

/** A whole page while loading (a detail page before its data): header, number cards, a card with rows. */
export function PageSkeleton({ cards = 4, rows = 6 }: { cards?: number; rows?: number }) {
  return (
    <div className="mx-auto w-full max-w-[1400px] space-y-5 px-4 py-5 sm:px-6 lg:px-8 lg:py-6" role="status" aria-label={tr('Loading…')}>
      <div className="space-y-2" aria-hidden><Skeleton className="h-2.5 w-24" /><Skeleton className="h-6 w-64" /><Skeleton className="h-3 w-80 max-w-full" /></div>
      {cards > 0 && <SkeletonCards count={cards} />}
      <div className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
        <div className="px-4 py-3.5 sm:px-5" aria-hidden><Skeleton className="h-9 w-full max-w-sm rounded-lg" /></div>
        <SkeletonList rows={rows} className="border-t border-neutral-100" />
      </div>
    </div>
  );
}
