// Form → Pengajuan and Monitoring → Pengajuan (integrated_portal_be app/pengajuan.py): types, labels and helpers shared
// by the outlet form and the monitoring of Operations and Finance.

import { serverMsg, tr } from "@/lib/i18n";
import type { Tone } from "@/so/ui";

export type Status = "DRAFT" | "SUBMITTED" | "REVISION" | "VERIFIED" | "APPROVED" | "PAID" | "REJECTED";
export type FileKind = "LINE" | "INCOME" | "OTHER" | "PAYMENT";
export type Barista = { name: string; userId?: string };
export type Line = { id?: number; spentOn: string | null; category: string; categoryLabel?: string; description: string; amount: number | null;
  review?: "OK" | "REJECTED"; reviewNote?: string | null; reviewedBy?: string | null; key?: string };
export type PgFile = { id: string; lineId: number | null; kind: FileKind; docType: string; mime: string; bytes: number; fileName: string | null;
  uploadedAt: string; uploadedBy: string | null; /** numbers of other pengajuan with the same file */ usedIn: string[] };
export type PgEvent = { at: string; actor: string | null; kind: "SUBMIT" | "STATUS" | "LINE" | "NOTE"; from: Status | null; to: Status | null;
  note: string | null; details: Record<string, unknown> };
export type Pengajuan = {
  id: string; number: string | null; status: Status; statusLabel: string; userId: string; username: string; name: string;
  branchCode: string; branchName: string; baristas: Barista[]; periodFrom: string | null; periodTo: string | null;
  openingBalance: number | null; openingExpected: number | null; openingNote: string | null; incomeAmount: number | null; incomeNote: string | null;
  totalOut: number | null; closingBalance: number | null; note: string | null; approvedAmount: number | null; paidAmount: number | null;
  paidOn: string | null; paidNote: string | null; createdAt: string; updatedAt: string; submittedAt: string | null; firstSubmittedAt: string | null;
  verifiedAt: string | null; verifiedBy: string | null; approvedAt: string | null; approvedBy: string | null; paidAt: string | null; paidBy: string | null;
  closedAt: string | null;
  lines?: Line[]; files?: PgFile[]; events?: PgEvent[]; missing?: string[]; fileCount?: number; reusedFiles?: number;
  /** monitoring: what the signed-in checker may do now */
  can?: { next: Status[]; reviewLines: boolean; payment: boolean; perms: string[] };
};
export type FormState = { user: { id: string; username: string; name: string }; branches: { code: string; name: string }[];
  requests: Pengajuan[]; categories: Record<string, string>; docTypes: Record<string, string>; baristas: Record<string, { id: string; name: string }[]> };

export const STATUS_LABEL: Record<Status, () => string> = {
  DRAFT: () => tr("Draft"), SUBMITTED: () => tr("Waiting for verification"), REVISION: () => tr("Revision"), VERIFIED: () => tr("Waiting for approval"),
  APPROVED: () => tr("Waiting for payment"), PAID: () => tr("Paid"), REJECTED: () => tr("Rejected"),
};
export const STATUS_TONE: Record<Status, Tone> = { DRAFT: "slate", SUBMITTED: "blue", REVISION: "amber", VERIFIED: "violet", APPROVED: "cyan", PAID: "green", REJECTED: "red" };
export const STEPS: Status[] = ["SUBMITTED", "VERIFIED", "APPROVED", "PAID"];
export const OPEN: Status[] = ["SUBMITTED", "REVISION", "VERIFIED", "APPROVED"];
/** The action button of each next status */
export const ACTION_LABEL: Partial<Record<Status, () => string>> = {
  VERIFIED: () => tr("Verify"), APPROVED: () => tr("Approve"), PAID: () => tr("Record payment"), REVISION: () => tr("Send back for revision"), REJECTED: () => tr("Reject"),
};
export const CATEGORY_LABEL: Record<string, () => string> = {
  RAW: () => tr("Raw materials"), OPERATIONAL: () => tr("Outlet operations"), GAS_WATER: () => tr("Gas & gallon water"),
  TRANSPORT: () => tr("Transport & delivery"), CLEANING: () => tr("Cleaning & stationery"), REPAIR: () => tr("Small repairs"),
  PARKING: () => tr("Parking & security"), MEAL: () => tr("Meals"), OTHER: () => tr("Other"),
};
export const DOC_LABEL: Record<string, () => string> = {
  NOTA: () => "Nota", KWITANSI: () => tr("Kwitansi (receipt)"), INVOICE: () => "Invoice", STRUK: () => tr("Struk (till slip)"),
  TRANSFER: () => tr("Transfer proof"), FOTO: () => tr("Photo of the goods"), OTHER: () => tr("Other"),
};
export const categoryLabel = (c: string) => (CATEGORY_LABEL[c] ?? (() => c))();
export const docLabel = (d: string) => (DOC_LABEL[d] ?? (() => d))();

export const fileUrl = (id: string) => `/api/pengajuan/files/${id}`;
export const fmtRp = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `Rp ${Math.round(v).toLocaleString("id-ID")}`);
/** "125.000" / "125000" / "Rp 125.000" → 125000 (whole rupiah); "" → null */
export function parseRp(text: string): number | null {
  const neg = /^\s*-/.test(text);
  const digits = text.replace(/\D/g, "");
  if (!digits) return null;
  return (neg ? -1 : 1) * Number(digits);
}
export const typeRp = (v: number | null | undefined) => (v === null || v === undefined ? "" : `${v < 0 ? "-" : ""}${Math.abs(Math.round(v)).toLocaleString("id-ID")}`);
export const MAX_FILE_MB = 10;

/** The expenses accepted (not rejected by a checker). */
export const acceptedTotal = (lines: Line[]) => lines.filter((l) => l.review !== "REJECTED").reduce((a, l) => a + (l.amount ?? 0), 0);

/** Upload one file (raw body), as the Damaged Equipment invoices. */
export async function upload<T>(url: string, file: File): Promise<T> {
  if (file.size > MAX_FILE_MB * 1048576) throw new Error(tr("Attachments are at most {0} MB", MAX_FILE_MB));
  const res = await fetch(url, { method: "POST", body: file, headers: { "content-type": file.type || "application/octet-stream" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(serverMsg(body.error) || tr("Request failed ({0})", res.status));
  return body as T;
}
