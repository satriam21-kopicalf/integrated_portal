// Monitoring Product / Monitoring Outlet (integrated_portal_be app/visit_forms.py): types, labels and helpers shared by
// the form (PIC) and the monitoring pages (management).

import { tr } from "@/lib/i18n";

export type VisitFormKey = "product" | "outlet";
export type Rating = "UNDER" | "MEET" | "EXCEED";
export type Item = { key: string; no: number; label: string; kind: "rating" | "text" };
export type Section = { key: string; title: string; items: Item[] };
export type Group = { key: string; title: string; subtitle: string; sections: Section[] };
export type Definition = { title: string; groups: Group[] };
export type Answer = { rating?: Rating; note?: string };
export type Counts = { under: number; meet: number; exceed: number; rated: number; total: number; score: number | null };
export type VisitPhoto = { id: string; item: string; takenAt: string | null; uploadedAt: string; latitude: number | null; longitude: number | null;
  distanceM: number | null; outsideRadius: boolean };
export type Visit = {
  id: string; form: VisitFormKey; status: "DRAFT" | "SUBMITTED"; userId: string; username: string; name: string;
  branchCode: string; branchName: string; startedAt: string; updatedAt: string; submittedAt: string | null;
  counts: Counts; score: number | null; latitude: number | null; longitude: number | null; accuracyM: number | null;
  outletLatitude: number | null; outletLongitude: number | null; radiusM: number | null; distanceM: number | null;
  outsideRadius: boolean; lowAccuracy: boolean;
  /** optional signature at sending (2026-10-21) */
  signature?: { name: string | null; signedAt: string | null } | null;
  answers?: Record<string, Answer>; photos?: VisitPhoto[]; photoCount?: number;
};
export type Branch = { code: string; name: string; latitude: number | null; longitude: number | null; radius_m: number | null };
export type FormState = { definition: Definition; user: { id: string; username: string; name: string }; branches: Branch[]; drafts: Visit[]; recent: Visit[] };

export const RATINGS: Rating[] = ["UNDER", "MEET", "EXCEED"];
export const RATING_STYLE: Record<Rating, { on: string; text: string; dot: string; bar: string }> = {
  UNDER: { on: "border-red-500 bg-red-500 text-white", text: "text-red-700", dot: "bg-red-500", bar: "bg-red-500" },
  MEET: { on: "border-blue-600 bg-blue-600 text-white", text: "text-blue-700", dot: "bg-blue-600", bar: "bg-blue-500" },
  EXCEED: { on: "border-emerald-600 bg-emerald-600 text-white", text: "text-emerald-700", dot: "bg-emerald-500", bar: "bg-emerald-500" },
};
export const ratingLabel = (r: Rating) => ({ UNDER: tr("Under"), MEET: tr("Meet"), EXCEED: tr("Exceed") })[r];

export const visitPhotoUrl = (id: string) => `/api/visit-photos/${id}`;
export const visitSignatureUrl = (visitId: string) => `/api/visit-signatures/${visitId}`;
export const allItems = (d: Definition) => d.groups.flatMap((g) => g.sections.flatMap((s) => s.items.map((i) => ({ ...i, group: g.key, section: s.title, sectionKey: s.key }))));

/** Items that block the submit: unrated, and UNDER without a note or a photo (same rule as the server). */
export function missingOf(d: Definition, answers: Record<string, Answer>, photos: VisitPhoto[]) {
  const withPhoto = new Set(photos.map((p) => p.item));
  return allItems(d).filter((i) => i.kind === "rating").map((i) => {
    const a = answers[i.key] ?? {};
    if (!a.rating) return { item: i, need: "rating" as const };
    if (a.rating === "UNDER" && (!a.note || !withPhoto.has(i.key))) return { item: i, need: "evidence" as const };
    return null;
  }).filter((x): x is NonNullable<typeof x> => !!x);
}

/** Score colour: green from 90 %, amber from 75 %, red below. */
export const scoreTone = (s: number | null) => s === null ? "text-slate-400" : s >= 90 ? "text-emerald-600" : s >= 75 ? "text-amber-600" : "text-red-600";
