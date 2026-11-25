// Aggregator Insight (2026-11-24, integrated_portal_be app/aggregator.py, migration 139): the shapes of the API and the
// modules of the menu. BotFood is a signal: when a status differs the team checks the merchant account.

import { tr } from "@/lib/i18n";

export type Pull = { startedAt: string | null; finishedAt: string | null; rows: number | null; error: string | null };
export type Status = {
  configured: boolean; pulls: Record<string, Pull>; channels: number; open: number;
  syncedOldest: string | null; syncedMedian: string | null; syncedNewest: string | null;
  items: number; outOfStock: number; reviews: number; reviewsFrom: string | null; unmapped: number; backfillDay: string | null;
};
export type Slot = { code: string; label: string; sort: number; active: boolean };
export type Assigned = { userId: string | null; name: string | null; source: "template" | "exception"; note?: string | null; weekdays?: number[] | null };
export type OutletRow = { branchCode: string; branchName: string; slots: Record<string, Assigned> };
export type Handle = { date: string; slots: Slot[]; outlets: OutletRow[] };
export type Member = { id: string; name: string; jobTitle: string | null; hrmsLinked: boolean };

export const WEEKDAYS = () => [tr("Mon"), tr("Tue"), tr("Wed"), tr("Thu"), tr("Fri"), tr("Sat"), tr("Sun")];
