'use client';

// /api/live (integrated_portal_be, app/routes/live.py): today so far and the
// latest sales that reached the database, refreshed through the realtime connection.

import { useEffect, useRef, useState } from 'react';
import { useRealtime } from './realtime';
import { tr, serverMsg } from './i18n';

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

export interface LiveHour {
  hour: number;
  bills: number;
  subtotal: number;
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
    hours: LiveHour[];
    channels: { channel: string; bills: number; subtotal: number }[];
    yesterdaySameTime: { bills: number; subtotal: number; nettSales: number };
    deltaPct: number | null;
    billsDeltaPct: number | null;
    nettDeltaPct: number | null;
  };
  yesterday: { date: string; bills: number; subtotal: number; hours: LiveHour[] };
  lastBatch: { bills: number; subtotal: number; syncedHour: string | null };
  transactions: LiveSale[];
}

/**
 * GET /api/live: re-fetched whenever the realtime connection reports newly
 * synced sales (no polling of its own).
 */
export function useLive(query: string): { data: LiveResponse | null; error: string | null; fetchedAt: number | null } {
  const { salesSyncedAt, ready } = useRealtime();
  const [state, setState] = useState<{ data: LiveResponse | null; error: string | null; fetchedAt: number | null }>({
    data: null, error: null, fetchedAt: null,
  });

  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();
    const v = salesSyncedAt ? `&v=${encodeURIComponent(salesSyncedAt)}` : '';
    fetch(`/api/live?${query}${v}`, { signal: controller.signal, cache: 'no-store' })
      .then(async res => {
        const body = await res.json();
        if (!res.ok) throw new Error(serverMsg(body.error) || `HTTP ${res.status}`);
        setState({ data: body, error: null, fetchedAt: Date.now() });
      })
      .catch((error: Error) => {
        if (!controller.signal.aborted) setState(s => ({ ...s, error: error.message }));
      });
    return () => controller.abort();
  }, [query, salesSyncedAt, ready]);

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
  if (m < 60) return tr('{0} min ago', m);
  const h = Math.floor(m / 60);
  return tr('{0} h {1} min ago', h, m % 60);
}
