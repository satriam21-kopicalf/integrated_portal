// Waste (integrated_portal_be app/waste.py, migrations 040-041): types and labels of the input, the monitor and the review.

import { tr } from "@/lib/i18n";

export type Scope = "waste" | "usage" | "premix";
export type PriceSource = "pricelist" | "esb" | "mixed" | "partial" | "none";
export const PRICE_SOURCE: Record<PriceSource, () => string> = {
  pricelist: () => tr("Pricelist"), esb: () => tr("ESB HPP"), mixed: () => tr("Pricelist + ESB HPP"),
  partial: () => tr("Some ingredients without a price"), none: () => tr("No price yet"),
};
export const fmtRp = (v: number | null | undefined) => (v == null ? "—" : `Rp ${Math.round(v).toLocaleString("id-ID")}`);
export type Status = "submitted" | "investigating" | "approved" | "rejected";
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
  /** migration 055: signed before submitting, the investigation the entry is part of */
  signed?: boolean; investigationId?: string | null;
  /** value in Rp (2026-11-05): Pricelist of the day, else the ESB HPP; null = no price */
  value?: number | null; unitPrice?: number | null; priceSource?: PriceSource;
};
export type FormData = {
  branches: { code: string; name: string }[]; days: { from: string; to: string };
  items: Record<Scope, WasteItem[]>; categories: string[]; usageCategories?: string[]; data: Entry[];
  usage?: Record<string, number>;
  /** migration 045: category, reason and whether a photo is saved, per Usage Management SKU */
  usageDetail?: Record<string, { qty: number; category: string | null; note: string | null; hasPhoto: boolean }>;
  noWaste?: { by: string; at: string } | null;
};
export type DailyCell = { date: string; entries: number; noWaste: boolean; usage: number; reported: boolean };
export type DailyData = {
  period: { from: string; to: string }; dates: string[]; lastDate: string | null; missingLast: { code: string; name: string }[];
  branches: { code: string; name: string; days: DailyCell[]; reported: number; missing: number; usageDays: number }[];
};
export type UsageRow = { branchCode: string; branchName: string; businessDate: string; itemCode: string; itemName: string; unit: string; qty: number; by: string; updatedAt: string;
  category?: string | null; note?: string | null; hasPhoto?: boolean };
export type MonitorData = {
  period: { from: string; to: string }; categories: string[]; data: Entry[]; truncated: boolean;
  summary: { entries: number; branches: number; items: number; people: number; submitted: number; investigating?: number; approved: number; rejected: number; value?: number; unpriced?: number };
  byItem: { scope: Scope; code: string; name: string; unit: string; qty: number; entries: number; branches: number; value?: number }[];
  byBranch: { code: string; name: string; entries: number; submitted: number; days: number; last_at: string | null; value?: number }[];
  byCategory: { name: string; entries: number }[];
};

export const SCOPES: Scope[] = ["waste", "usage", "premix"];
// Usage Management is the daily list (PUT /api/waste/usage), not a single entry
export const ENTRY_SCOPES: Scope[] = ["waste", "premix"];
export const scopeLabel = (s: Scope) => ({ waste: tr("Waste"), usage: tr("Usage Management"), premix: tr("Premix") })[s];
export const statusLabel = (s: Status) => ({ submitted: tr("Waiting review"), investigating: tr("Investigating"), approved: tr("Approved"), rejected: tr("Rejected") })[s];
export const statusTone = (s: Status) => ({ submitted: "amber", investigating: "violet", approved: "green", rejected: "red" } as const)[s];
export const signatureUrl = (id: string) => `/api/waste/entries/${id}/signature`;
export const usagePhotoUrl = (branch: string, day: string, item: string) =>
  `/api/waste/usage/${encodeURIComponent(branch)}/${day}/${encodeURIComponent(item)}/photo`;
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

/** An investigation of waste (migration 055): the form FM-QAQC-03 "Investigasi Komplain & Waste". */
export type Check = { checked: boolean; finding: string };
export type Report = {
  date: string; incident: "waste" | "complaint" | "both"; source: string | null; wasteKinds: string[]; categories?: string[];
  object: string; qty: string; batch: string | null; incidentAt: string; outlet: string; pic: string; chronology: string;
  checks: Record<string, Check>; rootCause: string; corrective: string; preventive: string;
};
export type Signer = "made" | "checked" | "approved";
export type Signature = { name: string; role: string; image: string | null; at: string };
export type Investigation = {
  id: string; reportNo: number; branchCode: string; branchName: string; status: "open" | "closed"; report: Report;
  signatures: Partial<Record<Signer, Signature>>; createdBy: string; createdAt: string; updatedBy: string | null; updatedAt: string;
  entries: Entry[] | number;
};
export const SOURCES = ["On-Site/Langsung", "Media Sosial/Online", "Whatsapp/Telepon"];
export const WASTE_KINDS = ["Packaging rusak", "Bahan Baku Expired", "Premix Tumpah", "Premix Expired", "Sisa Produk tidak terjual",
  "QC kondimen food", "QC kondimen beverage", "Kontaminasi/kerusakan fisik", "Kontaminasi/kerusakan kimia", "Kontaminasi/kerusakan biologi"];
export const CHECKS = ["Kualitas Bahan Baku (Supplier)", "Suhu Penyimpanan (Chiller/Freezer)", "Kepatuhan SOP / Resep",
  "Higienitas Staff (menggunakan APD) & Sanitasi Area", "Batas Kadaluwarsa / Metode FIFO", "Faktor Lain (Listrik padam, human error, dll)"];
export const SIGNERS: { key: Signer; title: string; role: string }[] = [
  { key: "made", title: "Dibuat Oleh", role: "Quality Assurance" },
  { key: "checked", title: "Diperiksa Oleh", role: "PIC/Leader Outlet" },
  { key: "approved", title: "Diketahui & Disetujui Oleh", role: "Manager Operasional" },
];
