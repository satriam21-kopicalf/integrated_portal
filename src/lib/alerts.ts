"use client";

// The alerts of the notification bell (Cost Control, 2026-11-13; integrated_portal_be app/alerts.py, migration 098):
// read once for the whole page — the bell sits in the desktop sidebar and in the phone app bar, both mounted — every
// POLL_MS while the tab is visible, and again when it comes back to the front.

import { useEffect, useState } from "react";
import { call } from "@/so/features/checkin/checkin";

export type Alert = {
  id: number; kind: string; severity: "high" | "warn" | "info"; title: string; body: string | null; link: string | null;
  branch: string | null; doc: string | null; at: string; read: boolean;
};
type State = { unread: number; data: Alert[] };

const POLL_MS = 60_000;
let state: State = { unread: 0, data: [] };
const listeners = new Set<(s: State) => void>();
let timer: ReturnType<typeof setInterval> | null = null;

const emit = (s: State) => { state = s; listeners.forEach((l) => l(s)); };

export async function refreshAlerts(): Promise<void> {
  try { emit(await call<State>("/api/alerts")); } catch { /* no access or offline: the bell stays as it was */ }
}

const onVisible = () => { if (!document.hidden) void refreshAlerts(); };

function start() {
  void refreshAlerts();
  timer = setInterval(() => { if (!document.hidden) void refreshAlerts(); }, POLL_MS);
  document.addEventListener("visibilitychange", onVisible);
}

function stop() {
  if (timer) clearInterval(timer);
  timer = null;
  document.removeEventListener("visibilitychange", onVisible);
}

/** The alerts of the signed-in user (`enabled`: the account opens Good Receipt or COGS & Usage). */
export function useAlerts(enabled: boolean): State {
  const [s, setS] = useState<State>(state);
  useEffect(() => {
    if (!enabled) return;
    listeners.add(setS);
    if (listeners.size === 1) start();
    else setS(state);
    return () => { listeners.delete(setS); if (!listeners.size) stop(); };
  }, [enabled]);
  return enabled ? s : { unread: 0, data: [] };
}

/** Mark alerts read (ids, or every one); the bell updates at once. */
export async function markAlertsRead(ids: number[] | "all"): Promise<void> {
  const all = ids === "all";
  const set = new Set(all ? [] : ids);
  const data = state.data.map((a) => (all || set.has(a.id) ? { ...a, read: true } : a));
  emit({ unread: all ? 0 : Math.max(0, state.unread - state.data.filter((a) => !a.read && set.has(a.id)).length), data });
  try { await call("/api/alerts/read", { method: "POST", json: all ? { all: true } : { ids } }); } catch { void refreshAlerts(); }
}
