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

/** The modules of Aggregator Insight still to come (stage 2 onwards): shown as Coming Soon. */
export const MODULES: Record<string, { title: () => string; text: () => string }> = {
  reviews: { title: () => tr("Reviews & Rating"), text: () => tr("The reviews of the customers: low ratings, replied or not, tags and the rating trend.") },
  complaints: { title: () => tr("Complaints"), text: () => tr("Complaint tickets from chat and the delivery apps, with response and resolution times.") },
  void: { title: () => tr("Void Order"), text: () => tr("Voids from ESB and the manual voids the team enters, matched per order.") },
  menu: { title: () => tr("Price & Menu"), text: () => tr("Prices that differ between outlets, items not uniform, the checklist of a new outlet.") },
  reports: { title: () => tr("Reports"), text: () => tr("Every report as Excel per period, a summary sheet first.") },
};

/** "2 h ago" from an ISO time */
export function ago(iso: string | null): string {
  if (!iso) return "—";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 60) return tr("{0} min ago", m);
  if (m < 48 * 60) return tr("{0} h ago", Math.round(m / 60));
  return tr("{0} days ago", Math.round(m / 1440));
}

export const WEEKDAYS = () => [tr("Mon"), tr("Tue"), tr("Wed"), tr("Thu"), tr("Fri"), tr("Sat"), tr("Sun")];
