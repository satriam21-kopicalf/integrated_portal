// Damaged Equipment (integrated_portal_be app/damaged_equipment.py): types, labels and helpers shared by the form (PIC),
// the monitoring (Maintenance / procurement team) and the public share page.

import { tr } from "@/lib/i18n";
import type { Tone } from "@/so/ui";

export type Kind = "REPAIR" | "PROCUREMENT";
export type Status = "DRAFT" | "PENDING" | "VALIDATION" | "REVIEW" | "ON_HOLD" | "ACCEPTED" | "IN_PROGRESS" | "DONE" | "REJECTED";
export type Urgency = "CRITICAL" | "HIGH" | "NORMAL" | "LOW" | "PLANNED";
export type Category = { id: number; group: string; name: string; defaultUrgency: Urgency; examples: string[]; sort: number; isActive: boolean };
export type Item = { id?: number; categoryId: number; group?: string; category?: string; name: string; qty: number; location: string | null;
  urgency: Urgency; note: string | null };
export type Media = { id: string; kind: "PHOTO" | "VIDEO" | "AFTER"; mime: string; bytes: number; fileName: string | null;
  takenAt: string | null; uploadedAt: string; uploadedBy: string | null };
export type DeEvent = { id: number; at: string; actor: string | null; kind: "SUBMIT" | "STATUS" | "ASSIGN" | "RELEASE" | "SWAP" | "COST" | "NOTE" | "DUPLICATE";
  from: Status | null; to: Status | null; note: string | null; details: Record<string, unknown> };
export type Assignment = { id: number; technicianId: number; name: string; kind: string; company: string | null; phone: string | null;
  scheduledFor: string | null; status: "ACTIVE" | "RELEASED" | "DONE"; note: string | null; assignedAt: string; assignedBy: string | null;
  releasedAt: string | null; releasedNote: string | null };
export type Tracker = { stages: { status: Status; label: string; hours: number }[]; totalHours: number | null; holdHours: number;
  workHours: number | null; slaHours: number | null; overdue: boolean; progress: number };
export type Request = {
  id: string; number: string | null; kind: Kind; kindLabel: string; status: Status; statusLabel: string; holdFrom: Status | null;
  userId?: string; username: string; picName: string; branchCode: string; branchName: string; analysis: string | null; cause: string | null;
  urgency: Urgency; urgencyLabel: string; distanceM: number | null; outsideRadius: boolean;
  signature: { name: string | null; signedAt: string | null } | null; estCost: number | null; actualCost: number | null; vendor: string | null;
  duplicateOf: { id: string; number: string | null } | null; createdAt: string; updatedAt: string; submittedAt: string | null; closedAt: string | null;
  items?: Item[]; media?: Media[]; events?: DeEvent[]; assignments?: Assignment[]; tracker?: Tracker; technicians?: string[];
  lastNote?: DeEvent | null; openInBranch?: Request[]; related?: Request[]; allowed?: Status[]; shareUrl?: string | null;
};
export type Technician = { id: number; name: string; kind: "INTERNAL" | "VENDOR"; company: string | null; skills: string[]; city: string | null;
  phone: string | null; notes: string | null; isActive: boolean; activeJobs: number; doneJobs: number;
  jobs: { requestId: string; number: string; branchName: string; urgency: Urgency; status: Status; scheduledFor: string | null }[] };
export type Branch = { code: string; name: string };
export type FormState = { user: { id: string; name: string }; branches: Branch[]; categories: Category[]; requests: Request[];
  limits: { photos: number; videoBytes: number; items: number } };

export const KIND_LABEL: Record<Kind, () => string> = {
  REPAIR: () => tr("Repair (Building & Tools)"), PROCUREMENT: () => tr("Procurement (Decoration & Tools)"),
};
export const STATUS_LABEL: Record<Status, () => string> = {
  DRAFT: () => tr("Draft"), PENDING: () => "Pending", VALIDATION: () => tr("Validation"), REVIEW: () => "Review", ON_HOLD: () => "On hold",
  ACCEPTED: () => "Accept", IN_PROGRESS: () => tr("In progress"), DONE: () => "Done", REJECTED: () => "Reject",
};
export const STATUS_TONE: Record<Status, Tone> = {
  DRAFT: "slate", PENDING: "slate", VALIDATION: "blue", REVIEW: "violet", ON_HOLD: "amber", ACCEPTED: "blue", IN_PROGRESS: "blue",
  DONE: "green", REJECTED: "red",
};
/** the steps every request goes through (on hold and reject are side ways) */
export const STEPS: Status[] = ["PENDING", "VALIDATION", "REVIEW", "ACCEPTED", "IN_PROGRESS", "DONE"];
export const OPEN: Status[] = ["PENDING", "VALIDATION", "REVIEW", "ON_HOLD", "ACCEPTED", "IN_PROGRESS"];
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
export type MediaUrls = { media: (id: string) => string; signature: (requestId: string) => string; pdf: (requestId: string) => string };
export const PORTAL_URLS: MediaUrls = {
  media: (id) => `/api/de/media/${id}`, signature: (rid) => `/api/de/requests/${rid}/signature`, pdf: (rid) => `/api/de/requests/${rid}/pdf`,
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
