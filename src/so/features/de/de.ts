// Maintenance and Procurement (integrated_portal_be app/damaged_equipment.py): types, labels and helpers shared by the two
// forms (PIC), the monitoring (one page, a tab per form) and the public share page. 2026-11-16 (migration 114): each form
// has its categories and flow; the urgency comes from the impact / reason and the branch's sales tier (priority()).

import { useEffect, useRef } from "react";
import { downloadFile } from "@/lib/download-progress";
import { tr } from "@/lib/i18n";
import type { Tone } from "@/so/ui";

export type Kind = "REPAIR" | "PROCUREMENT";
export type Status = "DRAFT" | "PENDING" | "ON_HOLD" | "ACCEPTED" | "IN_PROGRESS" | "ORDERED" | "HANDOVER" | "DONE" | "REJECTED";
export type Impact = "STOPS" | "DEGRADED" | "MINOR";
export type Reason = "REPLACE" | "CAPACITY" | "OTHER";
export type Tier = "A" | "B" | "C";
export type Urgency = "CRITICAL" | "HIGH" | "NORMAL" | "LOW" | "PLANNED";
export type Category = { id: number; kind?: Kind; group: string; name: string; defaultUrgency: Urgency; examples: string[]; sort: number; isActive: boolean;
  /** branch groups (ids) the category is offered to; [] = every branch */ branchGroups: string[] };
export type Item = { id?: number; categoryId: number; group?: string; category?: string; name: string; qty: number; location: string | null;
  urgency: Urgency; note: string | null };
export type Media = { id: string; kind: "PHOTO" | "VIDEO" | "AFTER" | "INVOICE" | "MONITOR" | "HANDOVER"; mime: string; bytes: number; fileName: string | null;
  takenAt: string | null; uploadedAt: string; uploadedBy: string | null; note?: string | null; byTechnician?: boolean };
export type DeEvent = { id: number; at: string; actor: string | null; kind: "SUBMIT" | "STATUS" | "ASSIGN" | "RELEASE" | "SWAP" | "COST" | "NOTE" | "DUPLICATE" | "WORK" | "TARGET" | "HANDOVER";
  from: Status | null; to: Status | null; note: string | null; details: Record<string, unknown> };
export type Assignment = { id: number; technicianId: number; name: string; kind: string; company: string | null; phone: string | null;
  scheduledFor: string | null; status: "ACTIVE" | "RELEASED" | "DONE"; note: string | null; assignedAt: string; assignedBy: string | null;
  releasedAt: string | null; releasedNote: string | null; bank?: string | null; accountNo?: string | null; accountName?: string | null };
export type Tracker = { stages: { status: Status; label: string; hours: number }[]; totalHours: number | null; holdHours: number;
  workHours: number | null; slaHours: number | null; overdue: boolean; progress: number;
  /** due time: the team's adjusted target, else from the urgency */ dueAt?: string | null; targetAdjusted?: boolean; late?: boolean };
export type Mode = "INTERNAL" | "VENDOR";
export type Handover = { requestedAt: string | null; at: string | null; note: string | null; distanceM: number | null; outsideRadius: boolean | null;
  picName: string | null; hasPicSign: boolean | null; vendorName: string | null; hasVendorSign: boolean | null; approvedBy: string | null };
export type Request = {
  id: string; number: string | null; kind: Kind; kindLabel: string; status: Status; statusLabel: string; holdFrom: Status | null;
  userId?: string; username: string; picName: string; branchCode: string; branchName: string; analysis: string | null; cause: string | null;
  urgency: Urgency; urgencyLabel: string; distanceM: number | null; outsideRadius: boolean;
  /** Maintenance: impact on the outlet; Procurement: why it is bought; tier: the branch's sales tier (A top 20 %) */
  impact?: Impact | null; reason?: Reason | null; tier?: Tier | null; orderedAt?: string | null;
  signature: { name: string | null; signedAt: string | null } | null; estCost: number | null; actualCost: number | null; vendor: string | null;
  duplicateOf: { id: string; number: string | null } | null; createdAt: string; updatedAt: string; submittedAt: string | null; closedAt: string | null;
  items?: Item[]; media?: Media[]; events?: DeEvent[]; assignments?: Assignment[]; tracker?: Tracker; technicians?: string[];
  lastNote?: DeEvent | null; openInBranch?: Request[]; related?: Request[]; allowed?: Status[];
  /** Review → Accept: the approval step waiting (set by management, 2026-10-29); null when the kind has no step */
  approval?: { position: number; total: number; label: string; users: string[]; userIds: string[]; steps: { label: string; users: string[] }[] } | null; shareUrl?: string | null;
  workLinks?: WorkLink[]; mode?: Mode | null; handover?: Handover | null; costItems?: CostItem[]; transactionOptions?: TransactionOption[]; labor?: Labor[];
  /** the request's money in Fund Request (Finance, 2026-11-21); null until the team asks for it */
  fund?: Fund | null;
  /** the technicians' Cash in Advance (migration 143) and the account types of Fund Request */
  advances?: import("./DeAdvance").Advance[]; accountTypes?: { id: number; name: string }[];
  target?: { at: string; note: string | null; by: string | null; setAt: string | null; changes: number } | null;
};
/** the photo link of a technician (no sign-in, 1 hour): OPEN, SENT (photos sent), EXPIRED or CLOSED (replaced / work stopped) */
export type WorkLink = { id: number; token: string; url?: string; technician: string; createdBy: string | null; createdAt: string; expiresAt: string;
  submittedAt: string | null; note: string | null; photos: number; state: "OPEN" | "SENT" | "EXPIRED" | "CLOSED" };
/** what the technician sees on the link */
export type WorkView = { number: string; kind: Kind; kindLabel: string; branchCode: string; branchName: string; analysis: string | null;
  technician: string; items: Item[]; expiresAt: string; submittedAt: string | null; note: string | null; photos: { id: string; takenAt: string }[]; max: number };
export const workUrl = (l: WorkLink) => l.url ?? `${typeof window === "undefined" ? "" : window.location.origin}/share/de-work/${l.token}`;
export type Technician = { id: number; name: string; kind: "INTERNAL" | "VENDOR"; company: string | null; skills: string[]; city: string | null;
  phone: string | null; notes: string | null; isActive: boolean; activeJobs: number; doneJobs: number;
  wageType: WageType; wageAmount: number | null;
  jobs: { requestId: string; number: string; branchName: string; urgency: Urgency; status: Status; scheduledFor: string | null }[] };
export type Branch = { code: string; name: string };
export type WageType = "HOURLY" | "DAILY" | "WEEKLY" | "MONTHLY" | "PER_JOB";
export const WAGE_TYPES: WageType[] = ["HOURLY", "DAILY", "WEEKLY", "MONTHLY", "PER_JOB"];
export const WAGE_LABEL: Record<WageType, () => string> = {
  HOURLY: () => tr("Hourly"), DAILY: () => tr("Daily"), WEEKLY: () => tr("Weekly"), MONTHLY: () => tr("Monthly"), PER_JOB: () => tr("Per job"),
};
/** "/ hour", "/ day" … after an amount */
export const WAGE_PER: Record<WageType, () => string> = {
  HOURLY: () => tr("hour"), DAILY: () => tr("day"), WEEKLY: () => tr("week"), MONTHLY: () => tr("month"), PER_JOB: () => tr("job"),
};
/** pay of a month: 8 h × 26 days, 26 days, 52/12 weeks; per job has none */
export const monthlyPay = (t: { wageType: WageType; wageAmount: number | null }) =>
  !t.wageAmount ? 0 : ({ HOURLY: t.wageAmount * 8 * 26, DAILY: t.wageAmount * 26, WEEKLY: (t.wageAmount * 52) / 12, MONTHLY: t.wageAmount, PER_JOB: 0 })[t.wageType];
export type CostKind = "MATERIAL" | "SERVICE" | "TRANSPORT" | "OTHER";
export const COST_KIND_LABEL: Record<CostKind, () => string> = {
  MATERIAL: () => tr("Material / parts"), SERVICE: () => tr("Service"), TRANSPORT: () => tr("Transport"), OTHER: () => tr("Other"),
};
export type CostItem = { id: number; kind: CostKind; transactionId: number | null; transactionName: string | null; description: string; qty: number;
  estAmount: number | null; actualAmount: number | null; by: string | null; at: string };
/** A Jenis Transaksi of Fund Request: the category of a cost line (migration 142). */
export type TransactionOption = { id: number; name: string };
/** the labour of a technician: rate × units from the time worked, or the team's adjustment */
export type Labor = { assignmentId: number; technician: string; kind: "INTERNAL" | "VENDOR"; company: string | null; status: string; wageType: WageType;
  rate: number; hours: number; units: number; unit: string; computed: number; adjust: number | null; note: string | null; amount: number };
export type FormState = { user: { id: string; name: string }; branches: Branch[]; categories: Category[]; requests: Request[];
  /** the branch group of each branch (categories can be limited to groups) */ branchGroups: Record<string, string | null>;
  /** merchandise of the ESB menu (MERCH; a T-shirt takes a size of MERCH SIZE), picked in the category group Merchandise */
  merchandise?: { items: { name: string; sized: boolean }[]; sizes: string[] };
  limits: { photos: number; videoBytes: number; items: number };
  /** the sales tier of each branch of the user and the priority matrix (impact / reason × tier → urgency) */
  tiers?: Record<string, Tier>; priority?: Record<string, Record<Tier, Urgency>> };

export const KIND_LABEL: Record<Kind, () => string> = { REPAIR: () => "Maintenance", PROCUREMENT: () => "Procurement" };
export const STATUS_LABEL: Record<Status, () => string> = {
  DRAFT: () => tr("Draft"), PENDING: () => tr("Submitted"), ON_HOLD: () => "On hold", ACCEPTED: () => tr("Approved"),
  IN_PROGRESS: () => tr("In Progress"), ORDERED: () => tr("Ordered"), HANDOVER: () => tr("Handover"), DONE: () => tr("Done"), REJECTED: () => tr("Rejected"),
};
/** Procurement flow (2026-11-18): Submitted → Approved → In Progress & Order → Received → Done */
const PROCUREMENT_LABEL: Partial<Record<Status, () => string>> = { ORDERED: () => tr("In Progress & Order"), HANDOVER: () => tr("Received") };
export const statusLabel = (kind: Kind, s: Status) => ((kind === "PROCUREMENT" && PROCUREMENT_LABEL[s]) || STATUS_LABEL[s])();
export const STATUS_TONE: Record<Status, Tone> = {
  DRAFT: "slate", PENDING: "slate", ON_HOLD: "amber", ACCEPTED: "blue", IN_PROGRESS: "blue", ORDERED: "violet",
  HANDOVER: "cyan", DONE: "green", REJECTED: "red",
};
/** the steps of each form (on hold and reject are side ways) */
export const STEPS_OF: Record<Kind, Status[]> = {
  REPAIR: ["PENDING", "ACCEPTED", "IN_PROGRESS", "HANDOVER", "DONE"],
  PROCUREMENT: ["PENDING", "ACCEPTED", "ORDERED", "HANDOVER", "DONE"],
};
export const STEPS: Status[] = STEPS_OF.REPAIR;
export const OPEN: Status[] = ["PENDING", "ON_HOLD", "ACCEPTED", "IN_PROGRESS", "ORDERED", "HANDOVER"];
export const IMPACTS: { value: Impact; label: () => string; hint: () => string }[] = [
  { value: "STOPS", label: () => tr("Stops sales"), hint: () => tr("The outlet cannot sell (main machine dead, cannot open)") },
  { value: "DEGRADED", label: () => tr("Disturbs work"), hint: () => tr("It runs, but slower or only partly") },
  { value: "MINOR", label: () => tr("Does not disturb"), hint: () => tr("Looks or comfort; sales go on as usual") },
];
export const REASONS: { value: Reason; label: () => string; hint: () => string }[] = [
  { value: "REPLACE", label: () => tr("Replace a broken tool"), hint: () => tr("The old one cannot be repaired any more") },
  { value: "CAPACITY", label: () => tr("Add capacity"), hint: () => tr("More of it is needed for the sales") },
  { value: "OTHER", label: () => tr("Decoration & other"), hint: () => tr("Looks, merchandise, new things") },
];
export const TIER_LABEL: Record<Tier, () => string> = {
  A: () => tr("Tier A · top 20% sales"), B: () => tr("Tier B · middle sales"), C: () => tr("Tier C · bottom 20% sales"),
};
export const URGENCIES: Urgency[] = ["CRITICAL", "HIGH", "NORMAL", "LOW", "PLANNED"];
export const URGENCY_LABEL: Record<Urgency, () => string> = {
  CRITICAL: () => tr("Critical"), HIGH: () => tr("High"), NORMAL: () => "Normal", LOW: () => tr("Low"), PLANNED: () => tr("Planned"),
};
export const URGENCY_TONE: Record<Urgency, Tone> = { CRITICAL: "red", HIGH: "amber", NORMAL: "blue", LOW: "slate", PLANNED: "violet" };
export const CAUSES: { value: string; label: () => string }[] = [
  { value: "WEAR", label: () => tr("Normal Wear") }, { value: "MISUSE", label: () => tr("Wrong Use") },
  { value: "AGE", label: () => tr("Age of the Item") }, { value: "OTHER", label: () => tr("Other") },
];

/** 5.2 h → "5.2 jam", 50 h → "2.1 hari" */
export function fmtHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  if (h <= 0) return tr("{0} min", 0);
  if (h < 1 / 60) return `< ${tr("{0} min", 1)}`;
  if (h < 1) return tr("{0} min", Math.round(h * 60));
  return h < 48 ? tr("{0} h", h.toFixed(1)) : tr("{0} days", (h / 24).toFixed(1));
}
/** a Fund Request of the request (kind MAINTENANCE / PROCUREMENT) and the top-ups of its settlement at Done */
export type Fund = {
  id: string; number: string; status: "SUBMITTED" | "REVISION" | "APPROVED" | "PAID" | "REJECTED"; statusLabel: string;
  requestedAmount: number | null; approvedAmount: number | null; paidAmount: number | null; paidOn: string | null;
  payeeBank: string | null; payeeAccount: string | null; payeeName: string | null; approvalStep: number; step: string | null;
  refundAmount: number | null; refundedAt: string | null;
  topUps: { id: string; number: string; status: string; statusLabel: string; amount: number | null }[];
};
/** the work of a request with a cost starts once Finance approved its fund (backend app/de_funds.py gate) */
export const fundCleared = (r: { estCost: number | null; fund?: Fund | null }) =>
  !(r.estCost ?? 0) || r.fund?.status === "APPROVED" || r.fund?.status === "PAID";

export const fmtRp = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `Rp ${Math.round(v).toLocaleString("id-ID")}`);
export const fmtMb = (bytes: number) => `${(bytes / 1048576).toFixed(1)} MB`;

/** the files of a request: signed-in (own or team) or through a share token */
/** handover: the signatures at the handover (signed-in only; the share link shows the names) */
export type MediaUrls = { media: (id: string) => string; signature: (requestId: string) => string; pdf: (requestId: string) => string;
  handover?: (requestId: string, who: "pic" | "vendor") => string; final?: (requestId: string) => string };
export const PORTAL_URLS: MediaUrls = {
  media: (id) => `/api/de/media/${id}`, signature: (rid) => `/api/de/requests/${rid}/signature`, pdf: (rid) => `/api/de/requests/${rid}/pdf`,
  handover: (rid, who) => `/api/de/requests/${rid}/handover-signature/${who}`, final: (rid) => `/api/de/requests/${rid}/final`,
};
export const shareUrls = (token: string): MediaUrls => ({
  media: (id) => `/api/public/de/${token}/media/${id}`, signature: () => `/api/public/de/${token}/signature`, pdf: () => `/api/public/de/${token}/pdf`,
});

/** the same item already asked in an open request of the branch (number of that request) */
export function alreadyAsked(item: { categoryId: number; name: string }, open: Request[] | undefined): string | null {
  const n = item.name.trim().toLowerCase();
  if (!n) return null;
  for (const r of open ?? []) {
    if ((r.items ?? []).some((i) => i.categoryId === item.categoryId && i.name.trim().toLowerCase() === n)) return r.number ?? "draft";
  }
  return null;
}

/** Live (2026-11-17): calls `refresh` every `ms` while the page is visible and at once when it comes back (tab, focus),
 *  so photos, attachments and steps of the others show without a reload. Stops when `on` is false. */
export function useLive(refresh: () => unknown, ms = 15000, on = true) {
  const fn = useRef(refresh);
  useEffect(() => { fn.current = refresh; });
  useEffect(() => {
    if (!on) return;
    const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
    const tick = () => { if (visible()) void fn.current(); };
    const t = setInterval(tick, ms);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", tick); window.removeEventListener("focus", tick); };
  }, [ms, on]);
}

export async function download(url: string, name: string) {
  await downloadFile(name, (signal) => fetch(url, { credentials: "same-origin", signal }));
}
