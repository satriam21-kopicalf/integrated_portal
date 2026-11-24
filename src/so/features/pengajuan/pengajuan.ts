// Form → Pengajuan and Monitoring → Pengajuan (integrated_portal_be app/pengajuan.py): types, labels and helpers shared
// by the outlet form and the monitoring of Operations and Finance.

import { serverMsg, tr } from "@/lib/i18n";
import type { Tone } from "@/so/ui";

/** 2026-11-24 (backend migration 144): Pending → Approved → In Progress (PAID: money out, proof awaited) → Verifikasi → Done */
export type Status = "DRAFT" | "SUBMITTED" | "REVISION" | "APPROVED" | "PAID" | "VERIFYING" | "DONE" | "REJECTED" | "CANCELLED";
/** the rules of a kind, set by Finance (backend app/fund_lifecycle.py) */
export type Rule = { proofAfter: boolean; proofDays: number; proofDocs: string[]; vendor: boolean };
export type Kind = "PETTY_CASH" | "EMERGENCY" | "MARKETING" | "EVENT" | "BILL" | "PERSONAL" | "MAINTENANCE" | "PROCUREMENT";
/** the lists of the personal form, set by management (migration 124) */
export type OptionList = "PURPOSE" | "TRANSACTION" | "PROJECT" | "ACCOUNT";
export type PurposeSettings = { receipt?: boolean; outlet?: boolean; deptPlafon?: boolean; type?: "ADVANCE" | "SETTLEMENT" | null };
export type FundOption = { id: number; list: OptionList; name: string; isActive: boolean; sort: number; settings: PurposeSettings };
export type Advance = { id: string; number: string; paidAmount: number | null; paidOn: string | null; purpose: string | null };
export type Action = "APPROVE" | "REVISION" | "REJECTED" | "PAID" | "CANCELLED";
export type Step = { position: number; label: string; type: "APPROVE" | "PAY"; users: string[] };
export type FileKind = "LINE" | "INCOME" | "OTHER" | "PAYMENT" | "REFUND" | "PROOF" | "TOPUP";
export type Barista = { name: string; userId?: string };
export type Line = { id?: number; spentOn: string | null; category: string; categoryLabel?: string; description: string; amount: number | null;
  review?: "OK" | "REJECTED"; reviewNote?: string | null; reviewedBy?: string | null; key?: string };
export type PgFile = { id: string; lineId: number | null; kind: FileKind; docType: string; mime: string; bytes: number; fileName: string | null;
  uploadedAt: string; uploadedBy: string | null; /** numbers of other pengajuan with the same file */ usedIn: string[] };
export type PgEvent = { at: string; actor: string | null; kind: "SUBMIT" | "STATUS" | "LINE" | "NOTE" | "REFUND" | "PROOF" | "VERIFY"; from: Status | null; to: Status | null;
  note: string | null; details: Record<string, unknown> };
export type Pengajuan = {
  id: string; number: string | null; status: Status; statusLabel: string; userId: string; username: string; name: string;
  branchCode: string; branchName: string; baristas: Barista[]; periodFrom: string | null; periodTo: string | null;
  openingBalance: number | null; openingExpected: number | null; openingNote: string | null; incomeAmount: number | null; incomeNote: string | null;
  totalOut: number | null; closingBalance: number | null; note: string | null; approvedAmount: number | null; paidAmount: number | null;
  paidOn: string | null; paidNote: string | null; createdAt: string; updatedAt: string; submittedAt: string | null; firstSubmittedAt: string | null;
  approvedAt: string | null; approvedBy: string | null; paidAt: string | null; paidBy: string | null;
  closedAt: string | null; kind: Kind; kindLabel: string; approvalStep: number; requesterName: string | null; requesterPhone: string | null;
  payeeBank: string | null; payeeAccount: string | null; payeeName: string | null; purpose: string | null; neededOn: string | null;
  plafon: number | null; requestedAmount: number | null;
  /** personal (2026-11-20): identity from the account, the lists set by management, the Cash in Advance it settles */
  scope?: "OUTLET" | "PERSONAL" | "DE"; email?: string | null; department?: string | null; jobTitle?: string | null;
  purposeId?: number | null; transactionTypeId?: number | null; projectId?: number | null; accountTypeId?: number | null; settlesId?: string | null;
  purposeName?: string | null; transactionTypeName?: string | null; projectName?: string | null; accountTypeName?: string | null;
  settles?: { id: string; number: string; paidAmount: number | null; paidOn: string | null; diff: number; outcome: "PAY" | "RETURN" | "EVEN" } | null;
  /** the steps of its kind (full view); monitoring list: the step waiting and its approvers */
  steps?: Step[]; step?: { label: string; users: string[]; userIds: string[] } | null;
  /** petty cash: what the outlet bought itself in ESB (Simple Purchase) over the 13 weeks before the period end */
  purchaseRef?: { weeks: number; until: string; total: number; avgWeek: number; lastWeek: number; docs: number } | null;
  /** petty cash: the outlet's Simple Purchase documents of the period (reconciliation with the expenses) */
  purchaseDocs?: { from: string; to: string; total: number; docs: { number: string; date: string; supplier: string | null; total: number | null; status: string | null }[] } | null;
  /** monitoring list: the outlet's weekly Simple Purchase average and whether the amount is far above it */
  purchaseAvgWeek?: number | null; aboveRef?: boolean;
  /** asked by the Maintenance & Procurement team for a Damaged Equipment request (2026-11-21, backend app/de_funds.py) */
  deRequest?: { id: string; number: string | null; kind: "REPAIR" | "PROCUREMENT"; vendor: string | null; pic: string | null } | null;
  /** the money a Maintenance & Procurement fund gives back (spent less than paid) and Finance's confirmation */
  refundAmount?: number | null; refundedAt?: string | null; refundedBy?: string | null; refundedNote?: string | null;
  lines?: Line[]; files?: PgFile[]; events?: PgEvent[]; missing?: string[]; fileCount?: number; reusedFiles?: number;
  /** monitoring: what the signed-in checker may do now */
  can?: { next: Action[]; reviewLines: boolean; payment: boolean; refund?: boolean; verify?: boolean; step: string | null; stepUsers: string[] };
  /** after the money went out (migration 144): the proof, the amount spent, Finance's accepted amount and the difference */
  proofDueOn?: string | null; proofOverdue?: boolean; proofSubmittedAt?: string | null; actualAmount?: number | null; actualNote?: string | null;
  verifiedAmount?: number | null; verifiedNote?: string | null; verifiedAt?: string | null; verifiedBy?: string | null; doneAt?: string | null;
  topupAmount?: number | null; topupPaidAt?: string | null; /** accepted − paid */ difference?: number | null; /** what is still to settle */ outstanding?: number | null;
  payeeType?: "BANK" | "VA"; vaProvider?: string | null; invoiceNo?: string | null;
  rule?: Rule; proofMissing?: string[];
};
export type FormState = { user: { id: string; username: string; name: string }; branches: { code: string; name: string }[];
  requests: Pengajuan[]; categories: Record<string, string>; categoriesOf: Record<Kind, Record<string, string>>; kinds: Record<Kind, string>;
  neededOn: Partial<Record<Kind, string>>; receiptRequired: Kind[]; docTypes: Record<string, string>; baristas: Record<string, { id: string; name: string }[]>;
  profile: { email: string | null; name: string; department: string | null; jobTitle: string | null };
  options: Record<OptionList, FundOption[]>; outlets: { code: string; name: string }[]; advances: Advance[];
  lastPayee: { bank: string | null; account: string | null; name: string | null; accountTypeId: number | null };
  kindLabels?: Partial<Record<Kind, string>>; /** the titles of the lists, as management named them */ listNames?: Record<OptionList, string> };

export const STATUS_LABEL: Record<Status, () => string> = {
  DRAFT: () => tr("Draft"), SUBMITTED: () => tr("Pending"), REVISION: () => tr("Revision"),
  APPROVED: () => tr("Approved"), PAID: () => tr("In Progress"), VERIFYING: () => tr("Verifying"),
  DONE: () => tr("Done"), REJECTED: () => tr("Rejected"), CANCELLED: () => tr("Cancelled"),
};
export const STATUS_TONE: Record<Status, Tone> = { DRAFT: "slate", SUBMITTED: "blue", REVISION: "amber", APPROVED: "cyan", PAID: "violet",
  VERIFYING: "amber", DONE: "green", REJECTED: "red", CANCELLED: "slate" };
export const OPEN: Status[] = ["SUBMITTED", "REVISION", "APPROVED", "PAID", "VERIFYING"];
/** the money went out (In Progress, Verifikasi or Done) */
export const PAID_OUT: Status[] = ["PAID", "VERIFYING", "DONE"];
export const ACTION_LABEL: Record<Action, () => string> = {
  APPROVE: () => tr("Approve"), PAID: () => tr("Record payment"), REVISION: () => tr("Send back for revision"), REJECTED: () => tr("Reject"),
  CANCELLED: () => tr("Cancel request"),
};
export const KINDS: Kind[] = ["PETTY_CASH", "EMERGENCY", "MARKETING", "EVENT", "BILL"];
/** asked from a Maintenance & Procurement request by the team, never from the outlet form */
export const DE_KINDS: Kind[] = ["MAINTENANCE", "PROCUREMENT"];
export const KIND_LABEL: Record<Kind, () => string> = {
  PETTY_CASH: () => tr("Weekly Petty Cash"), EMERGENCY: () => tr("Emergency Purchase"), MARKETING: () => tr("Marketing & Promo"),
  EVENT: () => tr("Event & Bazaar"), BILL: () => tr("Outlet Bills"), PERSONAL: () => tr("Personal Request"),
  MAINTENANCE: () => tr("Maintenance"), PROCUREMENT: () => tr("Procurement"),
};
/** the names management gave the outlet kinds (2026-11-20, backend migration 127), set from every answer that carries them */
let kindNames: Partial<Record<Kind, string>> = {};
export const setKindLabels = (m: Partial<Record<Kind, string>> | undefined) => { if (m) kindNames = m; };
export const KIND_HINT: Record<Kind, () => string> = {
  PETTY_CASH: () => tr("Report of the week's petty cash and the top-up up to the plafon. No request, no transfer."),
  EMERGENCY: () => tr("Something urgent already bought with personal money (stock ran out, late supplier …)"),
  MARKETING: () => tr("Banners, flyers, vouchers, sampling for the outlet"),
  EVENT: () => tr("Booth, equipment, stock and crew of an event or bazaar"),
  BILL: () => tr("Electricity, water, internet, waste, security, rent"),
  PERSONAL: () => tr("Cash in advance, reimbursement, refund, department petty cash …"),
  MAINTENANCE: () => tr("The funds of a repair, asked by the Maintenance team from its request"),
  PROCUREMENT: () => tr("The funds of a purchase, asked by the Procurement team from its request"),
};
export const NEEDED_LABEL: Partial<Record<Kind, () => string>> = { MARKETING: () => tr("Date needed"), EVENT: () => tr("Event date"), BILL: () => tr("Due date") };
export const kindLabel = (k: Kind) => kindNames[k] || (KIND_LABEL[k]?.() ?? k);
/** the label of a request: a personal one shows its Keperluan Dana */
export const requestLabel = (p: Pick<Pengajuan, "kind" | "purposeName">) => (p.kind === "PERSONAL" && p.purposeName) || kindLabel(p.kind);
/** where a request belongs: the outlet, else the department of a personal one */
export const placeOf = (p: Pick<Pengajuan, "branchName" | "department" | "kind">) => p.branchName || (p.kind === "PERSONAL" ? p.department || tr("Personal") : "—");
export const CATEGORY_LABEL: Record<string, () => string> = {
  RAW: () => tr("Raw Materials"), OPERATIONAL: () => tr("Outlet operations"), GAS_WATER: () => tr("Gas & gallon water"),
  TRANSPORT: () => tr("Transport & delivery"), CLEANING: () => tr("Cleaning & stationery"), REPAIR: () => tr("Small repairs"),
  PARKING: () => tr("Parking & security"), MEAL: () => tr("Meals"), OTHER: () => tr("Other"),
  PACKAGING: () => tr("Packaging & cups"), ICE: () => tr("Ice cubes"), PRINT: () => tr("Printing (banner, flyer, menu)"), VOUCHER: () => tr("Vouchers & discounts"),
  SAMPLING: () => tr("Product sampling"), ADS: () => tr("Ads & endorsement"), MERCH: () => tr("Merchandise"), BOOTH: () => tr("Booth / venue rent"),
  EQUIPMENT: () => tr("Equipment rent"), STOCK: () => tr("Stock & products"), CREW: () => tr("Crew & meals"), DECOR: () => tr("Decoration"),
  ELECTRIC: () => tr("Electricity"), WATER: () => tr("Water (PDAM)"), INTERNET: () => tr("Internet & phone"), WASTE: () => tr("Waste collection"),
  SECURITY: () => tr("Security & neighbourhood"), RENT: () => tr("Venue rent"),
};
export const DOC_LABEL: Record<string, () => string> = {
  NOTA: () => tr("Bill (nota)"), KWITANSI: () => tr("Signed receipt (kwitansi)"), INVOICE: () => "Invoice", STRUK: () => tr("Till slip (struk)"),
  TRANSFER: () => tr("Transfer proof"), FOTO: () => tr("Photo of the goods"), QUOTE: () => tr("Price quotation"), OTHER: () => tr("Other"),
};
/** the category of a line: a Jenis Transaksi (TRX:<id>, Maintenance & Procurement) carries its name from the backend */
export const categoryLabel = (c: string, name?: string | null) => (CATEGORY_LABEL[c] ?? (() => name || c))();
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

/** Upload one file (raw body), as the Maintenance Request invoices. */
export async function upload<T>(url: string, file: File): Promise<T> {
  if (file.size > MAX_FILE_MB * 1048576) throw new Error(tr("Attachments are at most {0} MB", MAX_FILE_MB));
  const res = await fetch(url, { method: "POST", body: file, headers: { "content-type": file.type || "application/octet-stream" } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(serverMsg(body.error) || tr("Request failed ({0})", res.status));
  return body as T;
}
