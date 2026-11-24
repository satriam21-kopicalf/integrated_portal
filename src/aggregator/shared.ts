// Aggregator Insight (2026-11-24, integrated_portal_be app/aggregator.py, migration 139): the shapes of the API and the
// modules of the menu. BotFood is a signal: when a status differs the team checks the merchant account.

import { tr } from "@/lib/i18n";

export type Pull = { startedAt: string | null; finishedAt: string | null; rows: number | null; error: string | null };
export type Status = {
  configured: boolean; pulls: Record<string, Pull>; channels: number; open: number;
  syncedOldest: string | null; syncedMedian: string | null; syncedNewest: string | null;
  items: number; outOfStock: number; reviews: number; reviewsFrom: string | null; unmapped: number; backfillDay: string | null;
  /** set by the page: BotFood read the platforms more than 3 hours ago (median) */ stale?: boolean;
};
export type Slot = { code: string; label: string; sort: number; active: boolean };
export type Assigned = { userId: string | null; name: string | null; source: "template" | "exception"; note?: string | null; weekdays?: number[] | null };
export type OutletRow = { branchCode: string; branchName: string; slots: Record<string, Assigned> };
export type Handle = { date: string; slots: Slot[]; outlets: OutletRow[] };
export type Member = { id: string; name: string; jobTitle: string | null; hrmsLinked: boolean };

/** "2 h ago" from an ISO time */
export function ago(iso: string | null): string {
  if (!iso) return "—";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return tr("{0} min ago", m);
  if (m < 48 * 60) return tr("{0} h ago", Math.round(m / 60));
  return tr("{0} days ago", Math.round(m / 1440));
}

export const WEEKDAYS = () => [tr("Mon"), tr("Tue"), tr("Wed"), tr("Thu"), tr("Fri"), tr("Sat"), tr("Sun")];
