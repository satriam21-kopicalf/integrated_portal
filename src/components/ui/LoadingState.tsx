'use client';

import { tr } from '@/lib/i18n';

/** A shimmering placeholder line or block (same look everywhere). */
export function SkeletonBlock({ className = '' }: { className?: string }) {
  return <span className={`skeleton block rounded ${className}`} aria-hidden />;
}

/**
 * The one loading state of every analytic: a chart-shaped shimmer with a small spinner and
 * "Loading <what>…". Fills `height` so the card keeps its size while the data arrives.
 */
export default function LoadingState({ height = 200, label = 'data' }: { height?: number; label?: string }) {
  return (
    <div className="relative flex flex-col gap-3" style={{ height }} role="status" aria-live="polite" aria-label={tr('Loading {0}', label)}>
      <div className="flex gap-2">
        <SkeletonBlock className="h-3 w-28" />
        <SkeletonBlock className="h-3 w-16" />
      </div>
      <div className="skeleton flex flex-1 items-end gap-1.5 rounded-lg px-3 pb-3 pt-6" aria-hidden>
        {[38, 55, 46, 70, 52, 82, 64, 74, 48, 60].map((h, i) => (
          <span key={i} className="flex-1 rounded-t bg-white/60" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

/** Thin progress bar for a card that refreshes while showing its previous data (parent: relative). */
export function RefreshBar() {
  return <span className="loading-bar" role="progressbar" aria-label={tr('Updating')} />;
}
