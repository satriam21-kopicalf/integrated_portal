// Waste (integrated_portal_be app/waste.py, migrations 040-041): types and labels of the input, the monitor and the review.

import { tr } from "@/lib/i18n";

export type Scope = "waste" | "usage" | "premix";
export type Status = "submitted" | "approved" | "rejected";
/** a premix: the units of the stock opname WIP (grams of one unit; `unit` = the count unit) and its ingredients */
export type PremixUnit = { uom: string; grams: number };
export type Ingredient = { code: string | null; name: string; isStock: boolean; perGram: number };
export type WasteItem = { code: string; name: string; unit: string; type?: string; units?: PremixUnit[]; components?: Ingredient[] };
export type Entry = {
  id: string; userId: string; username: string; name: string; branchCode: string; branchName: string; businessDate: string;
  scope: Scope; itemCode: string; itemName: string; unit: string; qty: number; category: string; note: string | null;
  productionDate?: string | null; expiredDate?: string | null;
  /** premix (migration 044): grams of the WIP and of every ingredient, rounded up */
  grams?: number | null; ingredients?: { code: string | null; name: string; isStock: boolean; grams: number }[] | null;
  photoTakenAt: string | null; latitude: number | null; longitude: number | null; status: Status;
  review: { note: string | null; by: string | null; at: string | null } | null; createdAt: string;
};
export type FormData = {
  branches: { code: string; name: string }[]; days: { from: string; to: string };
  items: Record<Scope, WasteItem[]>; categories: string[]; data: Entry[];
  usage?: Record<string, number>; noWaste?: { by: string; at: string } | null;
};
export type DailyCell = { date: string; entries: number; noWaste: boolean; usage: number; reported: boolean };
export type DailyData = {
  period: { from: string; to: string }; dates: string[]; lastDate: string | null; missingLast: { code: string; name: string }[];
  branches: { code: string; name: string; days: DailyCell[]; reported: number; missing: number; usageDays: number }[];
};
export type UsageRow = { branchCode: string; branchName: string; businessDate: string; itemCode: string; itemName: string; unit: string; qty: number; by: string; updatedAt: string };
export type MonitorData = {
  period: { from: string; to: string }; categories: string[]; data: Entry[]; truncated: boolean;
  summary: { entries: number; branches: number; items: number; people: number; submitted: number; approved: number; rejected: number };
  byItem: { scope: Scope; code: string; name: string; unit: string; qty: number; entries: number; branches: number }[];
  byBranch: { code: string; name: string; entries: number; submitted: number; days: number; last_at: string | null }[];
  byCategory: { name: string; entries: number }[];
};

export const SCOPES: Scope[] = ["waste", "usage", "premix"];
// Usage Management is the daily list (PUT /api/waste/usage), not a single entry
export const ENTRY_SCOPES: Scope[] = ["waste", "premix"];
export const scopeLabel = (s: Scope) => ({ waste: tr("Waste"), usage: tr("Usage Management"), premix: tr("Premix") })[s];
export const statusLabel = (s: Status) => ({ submitted: tr("Waiting review"), approved: tr("Approved"), rejected: tr("Rejected") })[s];
export const statusTone = (s: Status) => ({ submitted: "amber", approved: "green", rejected: "red" } as const)[s];
export const photoUrl = (id: string) => `/api/waste/entries/${id}/photo`;
export const isGram = (uom: string) => uom.toLowerCase() === "gram";
export const unitText = (uom: string) => (isGram(uom) ? "g" : uom);
/** grams of `qty` `uom` of a premix (stock opname WIP), and per ingredient rounded up as the premix calculator */
export const explodePremix = (item: WasteItem, uom: string, qty: number) => {
  const unit = item.units?.find((u) => u.uom === uom) ?? { uom, grams: 1 };
  const grams = qty * unit.grams;
  return { grams, ingredients: (item.components ?? []).map((c) => ({ ...c, grams: grams > 0 ? Math.ceil(grams * c.perGram - 0.001) : 0 })) };
};
export const fmtQty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });
