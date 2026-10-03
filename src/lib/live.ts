'use client';

// /api/live (integrated_portal_be, app/routes/live.py): today so far and the
// latest sales that reached the database. Polled while the tab is visible.

import { useEffect, useRef, useState } from 'react';

export interface LiveSale {
  salesNum: string;
  billNum: string;
  branchCode: string;
  branchName: string;
  channel: string;
  paymentMethod: string | null;
  subtotal: number;
  total: number;
  /** Outlet wall-clock time (no timezone), e.g. 2026-10-03T12:45:42 */
  orderTime: string | null;
  syncedAt: string | null;
  itemQty: number;
  items: { name: string; qty: number }[];
  moreItems: number;
}

export interface LiveResponse {
  serverTime: string;
  lastSyncedAt: string | null;
  today: {
    date: string;
    bills: number;
    subtotal: number;
    nettSales: number;
    avgTicket: number;
    hours: { hour: number; bills: number; subtotal: number }[];
    yesterdaySameTime: { bills: number; subtotal: number };
    deltaPct: number | null;
  };
  transactions: LiveSale[];
}

export const LIVE_POLL_MS = 30_000;

export function useLive(query: string): { data: LiveResponse | null; error: string | null; fetchedAt: number | null } {
  const [state, setState] = useState<{ data: LiveResponse | null; error: string | null; fetchedAt: number | null }>({
    data: null, error: null, fetchedAt: null,
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let stopped = false;
    const controller = new AbortController();

    const load = async () => {
      if (timer.current) clearTimeout(timer.current);
      try {
        const res = await fetch(`/api/live?${query}`, { signal: controller.signal, cache: 'no-store' });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || `HTTP ${res.status}`);
        if (!stopped) setState({ data: body, error: null, fetchedAt: Date.now() });
      } catch (error) {
        if (stopped || controller.signal.aborted) return;
        setState(s => ({ ...s, error: (error as Error).message }));
      }
      if (!stopped && document.visibilityState === 'visible') timer.current = setTimeout(load, LIVE_POLL_MS);
    };
    // pause while the tab is hidden, refresh immediately when it comes back
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
      else if (timer.current) clearTimeout(timer.current);
    };

    load();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stopped = true;
      controller.abort();
      if (timer.current) clearTimeout(timer.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [query]);

  return state;
}

/** Animates a number from its previous value to `value` (ease-out). */
export function useCountUp(value: number, duration = 900): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);

  useEffect(() => {
    const start = from.current;
    if (start === value) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      from.current = value;
      setShown(value);
      return;
    }
    const t0 = performance.now();
    let frame = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - k, 3);
      const v = start + (value - start) * eased;
      from.current = v;
      setShown(v);
      if (k < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, duration]);

  return shown;
}

/** "12:45" from an outlet wall-clock timestamp. */
export function clock(value: string | null): string {
  return value ? value.slice(11, 16) : '--:--';
}

export function minutesAgo(iso: string | null, now: number): string {
  if (!iso) return 'never';
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return `${h} h ${m % 60} min ago`;
}
