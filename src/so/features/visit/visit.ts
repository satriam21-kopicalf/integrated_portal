// Monitoring Product / Monitoring Outlet (integrated_portal_be app/visit_forms.py): types, labels and helpers shared by
// the form (PIC) and the monitoring pages (management).

import { tr } from "@/lib/i18n";

export type VisitFormKey = "product" | "outlet";
export type Rating = "UNDER" | "MEET" | "EXCEED";
/** Rating Outlet items carry the outlet's stars on a platform (2026-10-21): Google automatic, the delivery apps typed */
export type Platform = "google" | "gofood" | "grabfood" | "shopeefood";
export type Item = { key: string; no: number; label: string; kind: "rating" | "text"; platform?: Platform };
/** Google Maps figure of the outlet (Rating & Review → Google Maps) */
export type AutoStars = { stars: number; reviews: number | null; source: "google"; fetchedAt: string | null; mapsUri?: string | null };
export type Section = { key: string; title: string; items: Item[] };
export type Group = { key: string; title: string; subtitle: string; sections: Section[] };
export type Definition = { title: string; groups: Group[] };
/** rating null = cleared (tapping the chosen rating again) */
export type Answer = { rating?: Rating | null; note?: string; stars?: number | null; reviews?: number | null; source?: "google" | "manual"; fetchedAt?: string | null };
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
  /** draft only: the current Google Maps figure per item (kept in the answers at sending) */
  auto?: Record<string, AutoStars | null>;
};

export const PLATFORM_LABEL: Record<Platform, string> = { google: "Google Maps", gofood: "GoFood", grabfood: "GrabFood", shopeefood: "ShopeeFood" };
/** 4.6 → "4.6" (as the platforms show it) */
export const fmtStars = (n: number) => n.toFixed(1);
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

/** Items that block the submit: UNDER without a note or a photo (same rule as the server). Unrated items do not block
 * since 2026-10-21; they are listed (need "rating") so the PIC sees them. */
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
