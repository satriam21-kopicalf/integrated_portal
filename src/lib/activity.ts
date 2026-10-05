'use client';

// Activity log (superadmin: /activity). The backend records sign-in, exports,
// transaction details, user changes and refused access by itself; the dashboard
// only reports what the server cannot see: which page is open and which filters
// were applied (POST /api/activity/events).

import { useEffect, useRef } from 'react';

type ClientAction = 'page.view' | 'filter.change';

export function logActivity(action: ClientAction, page: string, details?: Record<string, unknown>, summary?: string) {
  fetch('/api/activity/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, page, details, summary }),
    keepalive: true,
  }).catch(() => { /* the log never gets in the way */ });
}

/** One page view per visited path (query strings are filters, logged separately). */
export function usePageViewLog(pathname: string, enabled: boolean) {
  const last = useRef<string | null>(null);
  useEffect(() => {
    if (!enabled || last.current === pathname) return;
    last.current = pathname;
    logActivity('page.view', pathname, { referrer: document.referrer || null });
  }, [pathname, enabled]);
}

/**
 * Filter changes of a page, debounced (a range picked in two clicks is one entry).
 * The first value after the page opens is part of the page view and is skipped.
 */
export function useFilterLog(page: string, details: Record<string, unknown> | null, summary: string, delayMs = 1500) {
  const key = details ? JSON.stringify(details) : null;
  const first = useRef<string | null>(null);
  const latest = useRef({ details, summary });
  useEffect(() => {
    latest.current = { details, summary };
  });
  useEffect(() => {
    if (key === null) return;
    if (first.current === null) {
      first.current = key;
      return;
    }
    if (key === first.current) return;
    const t = setTimeout(() => {
      first.current = key;
      logActivity('filter.change', page, latest.current.details ?? undefined, latest.current.summary);
    }, delayMs);
    return () => clearTimeout(t);
  }, [key, page, delayMs]);
}
