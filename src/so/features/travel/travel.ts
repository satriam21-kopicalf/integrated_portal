// Travel Path (integrated_portal_be app/travel_path.py): types and helpers.

import { lang, tr } from "@/lib/i18n";
import type { Definition, Item } from "@/so/features/visit/visit";

export type Rating = "OK" | "NOK" | "NA";
export type Answer = { rating?: Rating | null; note?: string | null; fix?: string | null; by?: string };
export type Counts = { ok: number; nok: number; na: number; critical: number; done: number; total: number; score: number | null; band: Band | null };
export type Band = "standard" | "repair" | "failed";
export type TravelPhoto = { id: string; item: string; kind: "MAIN" | "AFTER"; takenAt: string | null; uploadedAt: string; distanceM: number | null; outsideRadius: boolean };
export type Report = { id: string; branchCode: string; branchName: string; branchGroup: string | null; day: string; session: string; sessionLabel: string;
  status: "DRAFT" | "SUBMITTED"; crew: string | null; supervisor: string | null; startedBy: string; startedAt: string; updatedAt: string;
  submittedBy: string | null; submittedAt: string | null; windowEnd: string | null; late: boolean; reportLate: boolean; counts: Counts | null;
  score: number | null; band: Band | null; distanceM: number | null; outsideRadius: boolean; photoCount: number };
export type Finding = { id: string; reportId: string; branchCode: string; branchName: string; day: string; session: string; itemKey: string; label: string;
  zone: string | null; category: string | null; note: string | null; dueAt: string | null; status: "OPEN" | "FIXED"; overdue: boolean; fixedLate: boolean;
  fixNote: string | null; fixedBy: string | null; fixedAt: string | null; reopenedNote: string | null; reopenedBy: string | null; reopenedAt: string | null;
  createdAt: string; photos: { MAIN?: string[]; AFTER?: string[] } };
export type FullReport = Report & { answers: Record<string, Answer>; photos: TravelPhoto[]; definition: Definition; needSupervisor: boolean;
  findings?: Finding[]; text?: string };
export type Session = { key: string; label: string; labelEn: string; from: string; to: string; fromText: string; toText: string;
  state: "done" | "open" | "late" | "early"; report: Report | null };
export type State = { branches: { code: string; name: string; group: string | null }[]; branch: string | null; day?: string; sessions?: Session[]; areas?: number;
  recent?: Report[]; findings?: Finding[]; settings: { reportMinutes: number; criticalCap: number; standard: number; pass: number } };

export const photoUrl = (id: string) => `/api/travel-photos/${id}`;
export const sessionName = (s: { label: string; labelEn?: string }) => (lang() === "id" ? s.label : s.labelEn || s.label);
export const ratingText = (r: Rating) => ({ OK: tr("Meets the standard"), NOK: tr("Does not meet"), NA: "N/A" })[r];
export const bandText = (b: Band) => ({ standard: tr("Standard"), repair: tr("Needs repair"), failed: tr("Not passed") })[b];
export const bandClass = (b: Band | null) => (b === "standard" ? "bg-emerald-50 text-emerald-700" : b === "repair" ? "bg-amber-50 text-amber-800" : b === "failed" ? "bg-red-50 text-red-700" : "bg-neutral-100 text-neutral-600");
export const categoryText = (c: string | null) => (lang() === "id" || !c ? c : ({ Kritikal: "Critical", Mayor: "Major", Minor: "Minor" } as Record<string, string>)[c] ?? c);
export const categoryClass = (c: string | null | undefined) => (c === "Kritikal" ? "bg-red-600 text-white" : c === "Mayor" ? "bg-amber-100 text-amber-800" : "bg-neutral-100 text-neutral-600");

/** What an area still needs (same rules as the server). */
export function gapsOf(i: Item, a: Answer | undefined, photos: TravelPhoto[]): string[] {
  const r = a?.rating;
  if (!r) return (i.required ?? true) ? ["rating"] : [];
  const out: string[] = [];
  const note = (a?.note ?? "").trim();
  if (((r === "NOK" || r === "NA") && note.length < 3) || (r === "OK" && i.note === "required" && !note)) out.push("note");
  if (r !== "NA" && !photos.some((p) => p.item === i.key && p.kind === "MAIN") && ((i.photo ?? "required") === "required" || r === "NOK")) out.push("photo");
  return out;
}
