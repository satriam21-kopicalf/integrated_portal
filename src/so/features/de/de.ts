// Damaged Equipment (integrated_portal_be app/damaged_equipment.py): types, labels and helpers shared by the form (PIC),
// the monitoring (Maintenance / procurement team) and the public share page.

import { tr } from "@/lib/i18n";
import type { Tone } from "@/so/ui";

export type Kind = "REPAIR" | "PROCUREMENT";
export type Status = "DRAFT" | "PENDING" | "VALIDATION" | "REVIEW" | "ON_HOLD" | "ACCEPTED" | "IN_PROGRESS" | "HANDOVER" | "DONE" | "REJECTED";
export type Urgency = "CRITICAL" | "HIGH" | "NORMAL" | "LOW" | "PLANNED";
export type Category = { id: number; group: string; name: string; defaultUrgency: Urgency; examples: string[]; sort: number; isActive: boolean;
  /** branch groups (ids) the category is offered to; [] = every branch */ branchGroups: string[] };
export type Item = { id?: number; categoryId: number; group?: string; category?: string; name: string; qty: number; location: string | null;
  urgency: Urgency; note: string | null };
export type Media = { id: string; kind: "PHOTO" | "VIDEO" | "AFTER" | "INVOICE" | "MONITOR" | "HANDOVER"; mime: string; bytes: number; fileName: string | null;
  takenAt: string | null; uploadedAt: string; uploadedBy: string | null; note?: string | null; byTechnician?: boolean };
export type DeEvent = { id: number; at: string; actor: string | null; kind: "SUBMIT" | "STATUS" | "ASSIGN" | "RELEASE" | "SWAP" | "COST" | "NOTE" | "DUPLICATE" | "WORK" | "TARGET" | "HANDOVER";
  from: Status | null; to: Status | null; note: string | null; details: Record<string, unknown> };
export type Assignment = { id: number; technicianId: number; name: string; kind: string; company: string | null; phone: string | null;
  scheduledFor: string | null; status: "ACTIVE" | "RELEASED" | "DONE"; note: string | null; assignedAt: string; assignedBy: string | null;
  releasedAt: string | null; releasedNote: string | null };
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
  signature: { name: string | null; signedAt: string | null } | null; estCost: number | null; actualCost: number | null; vendor: string | null;
  duplicateOf: { id: string; number: string | null } | null; createdAt: string; updatedAt: string; submittedAt: string | null; closedAt: string | null;
  items?: Item[]; media?: Media[]; events?: DeEvent[]; assignments?: Assignment[]; tracker?: Tracker; technicians?: string[];
  lastNote?: DeEvent | null; openInBranch?: Request[]; related?: Request[]; allowed?: Status[]; shareUrl?: string | null;
  workLinks?: WorkLink[]; mode?: Mode | null; handover?: Handover | null; costItems?: CostItem[]; labor?: Labor[];
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
export type CostItem = { id: number; kind: CostKind; description: string; qty: number; estAmount: number | null; actualAmount: number | null; by: string | null; at: string };
/** the labour of a technician: rate × units from the time worked, or the team's adjustment */
export type Labor = { assignmentId: number; technician: string; kind: "INTERNAL" | "VENDOR"; company: string | null; status: string; wageType: WageType;
  rate: number; hours: number; units: number; unit: string; computed: number; adjust: number | null; note: string | null; amount: number };
export type FormState = { user: { id: string; name: string }; branches: Branch[]; categories: Category[]; requests: Request[];
  /** the branch group of each branch (categories can be limited to groups) */ branchGroups: Record<string, string | null>;
  limits: { photos: number; videoBytes: number; items: number } };

export const KIND_LABEL: Record<Kind, () => string> = {
  REPAIR: () => "Maintenance", PROCUREMENT: () => tr("Procurement (Decoration & Tools)"),
};
export const STATUS_LABEL: Record<Status, () => string> = {
  DRAFT: () => tr("Draft"), PENDING: () => "Pending", VALIDATION: () => tr("Validation"), REVIEW: () => "Review", ON_HOLD: () => "On hold",
  ACCEPTED: () => "Accept", IN_PROGRESS: () => tr("In progress"), HANDOVER: () => tr("Handover"), DONE: () => "Done", REJECTED: () => "Reject",
};
export const STATUS_TONE: Record<Status, Tone> = {
  DRAFT: "slate", PENDING: "slate", VALIDATION: "blue", REVIEW: "violet", ON_HOLD: "amber", ACCEPTED: "blue", IN_PROGRESS: "blue",
  HANDOVER: "cyan", DONE: "green", REJECTED: "red",
};
/** the steps every request goes through (on hold and reject are side ways) */
export const STEPS: Status[] = ["PENDING", "VALIDATION", "REVIEW", "ACCEPTED", "IN_PROGRESS", "HANDOVER", "DONE"];
export const OPEN: Status[] = ["PENDING", "VALIDATION", "REVIEW", "ON_HOLD", "ACCEPTED", "IN_PROGRESS", "HANDOVER"];
export const URGENCIES: Urgency[] = ["CRITICAL", "HIGH", "NORMAL", "LOW", "PLANNED"];
export const URGENCY_LABEL: Record<Urgency, () => string> = {
  CRITICAL: () => tr("Critical"), HIGH: () => tr("High"), NORMAL: () => "Normal", LOW: () => tr("Low"), PLANNED: () => tr("Planned"),
};
export const URGENCY_TONE: Record<Urgency, Tone> = { CRITICAL: "red", HIGH: "amber", NORMAL: "blue", LOW: "slate", PLANNED: "violet" };
export const CAUSES: { value: string; label: () => string }[] = [
  { value: "WEAR", label: () => tr("Normal wear") }, { value: "MISUSE", label: () => tr("Wrong use") },
  { value: "AGE", label: () => tr("Age of the item") }, { value: "OTHER", label: () => tr("Other") },
];

/** 5.2 h → "5.2 jam", 50 h → "2.1 hari" */
export function fmtHours(h: number | null | undefined): string {
  if (h === null || h === undefined) return "—";
  if (h <= 0) return tr("{0} min", 0);
  if (h < 1 / 60) return `< ${tr("{0} min", 1)}`;
  if (h < 1) return tr("{0} min", Math.round(h * 60));
  return h < 48 ? tr("{0} h", h.toFixed(1)) : tr("{0} days", (h / 24).toFixed(1));
}
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

export async function download(url: string, name: string) {
  const res = await fetch(url, { credentials: "same-origin" });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error(body?.error ?? body?.detail ?? tr("The file could not be downloaded"));
  }
  const href = URL.createObjectURL(await res.blob());
  Object.assign(document.createElement("a"), { href, download: name }).click();
  URL.revokeObjectURL(href);
}
