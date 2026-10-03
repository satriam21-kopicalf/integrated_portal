'use client';

// Realtime updates over a WebSocket to integrated_portal_be (wss://api.kopicalf.co.id/ws).
//
// The socket carries version stamps, not data: when today's sales sync or the
// Overview aggregates change, every page re-fetches what it shows (with its own
// filters) through the normal /api/* endpoints. The stamp is sent along as `v`,
// so the backend's response cache never serves data older than the update.
// If the socket is down the provider reconnects with back-off and meanwhile
// polls GET /api/realtime/version, so pages keep updating either way.

import { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'wss://api.kopicalf.co.id/ws';
const FALLBACK_POLL_MS = 60_000;
/** Pages wait this long at most for the first version before fetching anyway. */
const READY_TIMEOUT_MS = 2_500;
const BACKOFF_MS = [1_000, 2_000, 5_000, 10_000, 30_000];

export type RealtimeStatus = 'connecting' | 'live' | 'offline';

export interface RealtimeState {
  status: RealtimeStatus;
  /** Newest synced_at of today's / yesterday's POS sales (hourly sync at :05). */
  salesSyncedAt: string | null;
  /** Newest refresh of the Overview aggregates (hourly at :20). */
  aggregatesRefreshedAt: string | null;
  /** When the last change notification arrived (ms epoch). */
  updatedAt: number | null;
  /** True once the first version is known (or the wait timed out): pages fetch from then on. */
  ready: boolean;
}

const initial: RealtimeState = {
  status: 'connecting', salesSyncedAt: null, aggregatesRefreshedAt: null, updatedAt: null, ready: false,
};
const RealtimeContext = createContext<RealtimeState>(initial);

interface VersionMessage {
  type: string;
  salesSyncedAt?: string | null;
  aggregatesRefreshedAt?: string | null;
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<RealtimeState>(initial);
  const socket = useRef<WebSocket | null>(null);
  const attempt = useRef(0);

  useEffect(() => {
    let stopped = false;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let pollTimer: ReturnType<typeof setInterval> | null = null;

    const apply = (msg: VersionMessage) =>
      setState(s => {
        const sales = msg.salesSyncedAt ?? s.salesSyncedAt;
        const aggregates = msg.aggregatesRefreshedAt ?? s.aggregatesRefreshedAt;
        const changed = sales !== s.salesSyncedAt || aggregates !== s.aggregatesRefreshedAt;
        if (!changed) return s.ready ? s : { ...s, ready: true };
        return {
          ...s, salesSyncedAt: sales, aggregatesRefreshedAt: aggregates, ready: true,
          // the first version is not an update
          updatedAt: s.ready ? Date.now() : s.updatedAt,
        };
      });

    const poll = async () => {
      try {
        const res = await fetch('/api/realtime/version', { cache: 'no-store' });
        if (res.ok) apply(await res.json());
      } catch {
        // offline as well; try again on the next tick
      }
    };
    const startPolling = () => {
      if (pollTimer) return;
      poll();
      pollTimer = setInterval(poll, FALLBACK_POLL_MS);
    };
    const stopPolling = () => {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = null;
    };

    const connect = () => {
      if (stopped) return;
      setState(s => (s.status === 'live' ? s : { ...s, status: 'connecting' }));
      let ws: WebSocket;
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        scheduleReconnect();
        return;
      }
      socket.current = ws;
      ws.onopen = () => {
        attempt.current = 0;
        stopPolling();
        setState(s => ({ ...s, status: 'live' }));
      };
      ws.onmessage = event => {
        try {
          const msg = JSON.parse(event.data) as VersionMessage;
          if (msg.type === 'hello' || msg.type === 'update') apply(msg);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onclose = () => {
        if (socket.current === ws) socket.current = null;
        if (stopped) return;
        setState(s => ({ ...s, status: 'offline' }));
        startPolling();
        scheduleReconnect();
      };
      ws.onerror = () => ws.close();
    };

    const scheduleReconnect = () => {
      if (stopped || reconnectTimer) return;
      const delay = BACKOFF_MS[Math.min(attempt.current, BACKOFF_MS.length - 1)];
      attempt.current += 1;
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        connect();
      }, delay);
    };

    // reconnect at once when the tab or the network comes back
    const wake = () => {
      if (document.visibilityState !== 'visible' || socket.current) return;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
      attempt.current = 0;
      connect();
    };

    const readyTimer = setTimeout(() => setState(s => (s.ready ? s : { ...s, ready: true })), READY_TIMEOUT_MS);
    connect();
    document.addEventListener('visibilitychange', wake);
    window.addEventListener('online', wake);
    return () => {
      stopped = true;
      clearTimeout(readyTimer);
      document.removeEventListener('visibilitychange', wake);
      window.removeEventListener('online', wake);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      stopPolling();
      socket.current?.close();
    };
  }, []);

  const value = useMemo(() => state, [state]);
  return <RealtimeContext.Provider value={value}>{children}</RealtimeContext.Provider>;
}

export function useRealtime(): RealtimeState {
  return useContext(RealtimeContext);
}

/** Status pill shown in page headers instead of a refresh button. */
export function RealtimeIndicator({ className = '' }: { className?: string }) {
  const { status, salesSyncedAt } = useRealtime();
  const synced = salesSyncedAt
    ? new Date(salesSyncedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
    : null;
  const tone = status === 'live'
    ? { dot: 'bg-emerald-500', ring: 'bg-emerald-400', text: 'text-emerald-700', label: 'Live' }
    : status === 'connecting'
    ? { dot: 'bg-amber-400', ring: 'bg-amber-300', text: 'text-amber-700', label: 'Connecting' }
    : { dot: 'bg-slate-400', ring: '', text: 'text-slate-500', label: 'Reconnecting' };
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs ${className}`}
      title={status === 'live'
        ? 'Connected: data updates automatically after every sync'
        : 'Realtime connection lost: retrying, data still updates every minute'}
    >
      <span className="relative flex h-2 w-2">
        {tone.ring && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${tone.ring}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${tone.dot}`} />
      </span>
      <span className={`font-semibold ${tone.text}`}>{tone.label}</span>
      {synced && <span className="hidden text-slate-500 sm:inline">· synced {synced}</span>}
    </span>
  );
}
