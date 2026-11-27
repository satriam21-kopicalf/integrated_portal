// Building & Renovation projects (backend app/building_project.py, migration 164).
import { tr } from "@/lib/i18n";

export type Kind = "NEW_OUTLET" | "RENOVATION" | "MAINTENANCE";
export type Status = "PLANNING" | "IN_PROGRESS" | "HANDOVER" | "DONE" | "ON_HOLD" | "CANCELLED";
export type RabStatus = "DRAFT" | "SUBMITTED" | "APPROVED";
export type LineKind = "MATERIAL" | "LABOUR" | "OTHER";

export type Project = {
  id: string; number: string; kind: Kind; kindLabel: string; name: string; branchCode: string | null; branchName: string | null; locationName: string | null;
  address: string | null; city: string | null; areaM2: number | null; businessUnit: string | null; picName: string | null; contractor: string | null;
  planStart: string | null; planEnd: string | null; actualStart: string | null; actualEnd: string | null; budget: number | null;
  status: Status; statusLabel: string; next: Status[]; rabStatus: RabStatus; rabStatusLabel: string; rabVersion: number; note: string | null;
  createdBy: string | null; createdAt: string; updatedAt: string; updatedBy: string | null; rabTotal: number | null; actualTotal: number | null; progress: number | null; late: boolean;
};
export type Section = { id: number; name: string; sort: number; total: number; actual: number; lines: number };
export type Line = { id: number; sectionId: number; sort: number; kind: LineKind; kindLabel: string; materialId: number | null; description: string; spec: string | null;
  unit: string | null; qty: number; unitPrice: number; amount: number; priceOn: string | null; catalogPrice: number | null; catalogOn: string | null;
  vendorId: number | null; vendor: string | null; note: string | null; actualQty: number | null; actualAmount: number | null; updatedBy: string | null };
export type Stage = { id: number; name: string; sort: number; weight: number; planStart: string | null; planEnd: string | null; progress: number; doneOn: string | null; late: boolean };
export type Report = { id: number; stageId: number | null; stage: string | null; progress: number | null; note: string | null; reportedOn: string; by: string | null; at: string; photos: string[] };
export type Full = Project & { sections: Section[]; lines: Line[]; kinds: Record<LineKind, number>; bought: number; stages: Stage[]; reports: Report[];
  versions: { version: number; total: number; by: string | null; at: string; note: string | null }[]; plannedToday: number;
  curve: { day: string; plan: number; actual: number | null }[]; canApprove: boolean; approvers?: string[] };

export const KIND_LABEL: Record<Kind, () => string> = { NEW_OUTLET: () => tr("New outlet"), RENOVATION: () => tr("Renovation"), MAINTENANCE: () => tr("Major maintenance") };
export const STATUS_LABEL: Record<Status, () => string> = { PLANNING: () => tr("Planning"), IN_PROGRESS: () => tr("In progress"), HANDOVER: () => tr("Handover"),
  DONE: () => tr("Done"), ON_HOLD: () => tr("On hold"), CANCELLED: () => tr("Cancelled") };
export const STATUS_TONE: Record<Status, "slate" | "blue" | "amber" | "green" | "red" | "violet"> = { PLANNING: "slate", IN_PROGRESS: "blue", HANDOVER: "violet",
  DONE: "green", ON_HOLD: "amber", CANCELLED: "red" };
export const RAB_LABEL: Record<RabStatus, () => string> = { DRAFT: () => tr("RAB draft"), SUBMITTED: () => tr("RAB awaiting approval"), APPROVED: () => tr("RAB approved") };
export const RAB_TONE: Record<RabStatus, "slate" | "amber" | "green"> = { DRAFT: "slate", SUBMITTED: "amber", APPROVED: "green" };
export const LINE_KIND_LABEL: Record<LineKind, () => string> = { MATERIAL: () => tr("Material"), LABOUR: () => tr("Labour"), OTHER: () => tr("Other") };

export const rp = (n: number | null | undefined) => (n == null ? "—" : `Rp ${Math.round(n).toLocaleString("id-ID")}`);
export const num = (n: number | null | undefined, d = 2) => (n == null ? "—" : n.toLocaleString("id-ID", { maximumFractionDigits: d }));
export const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
export const placeOf = (p: Pick<Project, "branchName" | "branchCode" | "locationName" | "city">) =>
  [p.branchName ?? p.branchCode ?? p.locationName, p.city].filter(Boolean).join(" · ") || "—";
