// Waste (integrated_portal_be app/waste.py, migration 040): types and labels of the input, the monitor and the review.

import { tr } from "@/lib/i18n";

export type Scope = "waste" | "usage" | "premix";
export type Status = "submitted" | "approved" | "rejected";
export type WasteItem = { code: string; name: string; unit: string; type?: string };
export type Entry = {
  id: string; userId: string; username: string; name: string; branchCode: string; branchName: string; businessDate: string;
  scope: Scope; itemCode: string; itemName: string; unit: string; qty: number; category: string; note: string | null;
  photoTakenAt: string | null; latitude: number | null; longitude: number | null; status: Status;
  review: { note: string | null; by: string | null; at: string | null } | null; createdAt: string;
};
export type FormData = {
  branches: { code: string; name: string }[]; days: { from: string; to: string };
  items: Record<Scope, WasteItem[]>; categories: string[]; data: Entry[];
};
export type MonitorData = {
  period: { from: string; to: string }; categories: string[]; data: Entry[]; truncated: boolean;
  summary: { entries: number; branches: number; items: number; people: number; submitted: number; approved: number; rejected: number };
  byItem: { scope: Scope; code: string; name: string; unit: string; qty: number; entries: number; branches: number }[];
  byBranch: { code: string; name: string; entries: number; submitted: number; days: number; last_at: string | null }[];
  byCategory: { name: string; entries: number }[];
};

export const SCOPES: Scope[] = ["waste", "usage", "premix"];
export const scopeLabel = (s: Scope) => ({ waste: tr("Waste"), usage: tr("Usage Management"), premix: tr("Premix") })[s];
export const statusLabel = (s: Status) => ({ submitted: tr("Waiting review"), approved: tr("Approved"), rejected: tr("Rejected") })[s];
export const statusTone = (s: Status) => ({ submitted: "amber", approved: "green", rejected: "red" } as const)[s];
export const photoUrl = (id: string) => `/api/waste/entries/${id}/photo`;
export const fmtQty = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 3 });
