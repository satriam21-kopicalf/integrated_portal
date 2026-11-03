// Monitoring Product / Monitoring Outlet (integrated_portal_be app/visit_forms.py): types, labels and helpers shared by
// the form (PIC) and the monitoring pages (management).

import { lang, numberLocale, tr } from "@/lib/i18n";

export type VisitFormKey = "product" | "outlet" | "wwwr";  // wwwr: the SWAT audit (Product + Outlet in one form)
export type Rating = "UNDER" | "MEET" | "EXCEED";
/** Rating Outlet items carry the outlet's stars on a platform (2026-10-21): Google automatic, the delivery apps typed */
export type Platform = "google" | "gofood" | "grabfood" | "shopeefood";
/** One item (2026-10-27): required = it must be rated before sending (requiredFor: only at the outlets of these branch
 * groups, e.g. Beans Specialty at CTGP and CCI); note / photo = what a rated required item needs. An optional item may be
 * skipped and needs neither. labelEn = the English text (the UI shows the one of its language). */
export type Evidence = "required" | "optional";
export type Item = { key: string; no: number; label: string; labelEn?: string; kind: "rating" | "text"; platform?: Platform;
  required?: boolean; requiredFor?: string[]; note?: Evidence; photo?: Evidence;
  /** asked only at the outlets of these branch groups (2026-11-02); the others do not see it */ onlyFor?: string[];
  /** "g": the PIC also types the stock in grams, net weight (Stock Preparation, Espresso and Beans, 2026-10-28) */
  qty?: "g";
  /** Travel Path (Outlet Cleanliness, 2026-10-30): the photo points, the standard to see, the category */
  detail?: string; standard?: string; category?: "Kritikal" | "Mayor" | "Minor"; categoryEn?: string;
  /** the photo points and the standard in English (2026-11-02) */ detailEn?: string; standardEn?: string };
/** Google Maps figure of the outlet (Aggregator → Google Maps) */
export type AutoStars = { stars: number; reviews: number | null; source: "google"; fetchedAt: string | null; mapsUri?: string | null };
/** retired: a list no longer asked (2026-10-30), shown only in the visits that rated it */
export type Section = { key: string; title: string; titleEn?: string; items: Item[]; retired?: boolean };
export type Group = { key: string; title: string; titleEn?: string; subtitle: string; subtitleEn?: string; sections: Section[] };
export type Definition = { title: string; titleEn?: string; groups: Group[] };

/** A label / title / subtitle of the form in the UI language: the English text (…En) or the Indonesian one. */
export function tl(o: object, field: "label" | "title" | "subtitle" | "section" | "detail" | "standard" = "label"): string {
  const r = o as Record<string, unknown>;
  const id = typeof r[field] === "string" ? (r[field] as string) : "";
  const en = r[`${field}En`];
  return lang() === "id" ? id : (typeof en === "string" && en) || id;
}

/** Must the item be rated before sending, at an outlet of this branch group (CCI, CTG, CTGP …)? */
/** Is the item asked at an outlet of this branch group? (an outlet without a group is asked everything) */
export const appliesTo = (i: Item, group?: string | null) => !i.onlyFor?.length || !group || i.onlyFor.includes(group);
export const isRequired = (i: Item, group?: string | null) => appliesTo(i, group) && ((i.required ?? true) || (!!group && (i.requiredFor ?? []).includes(group)));
/** The definition as an outlet of this branch group is asked: its items only, empty sections left out. */
export const forGroup = (d: Definition, group?: string | null): Definition => ({ ...d,
  groups: d.groups.map((g) => ({ ...g, sections: g.sections.map((s) => ({ ...s, items: s.items.filter((i) => appliesTo(i, group)) })).filter((s) => s.items.length) }))
    .filter((g) => g.sections.length) });
/** What a rated item needs at this outlet: a required item its note / photo (both unless the item says otherwise). */
export const evidenceOf = (i: Item, group?: string | null) => {
  const req = isRequired(i, group) && !i.platform;
  return { note: req && (i.note ?? "required") === "required", photo: req && (i.photo ?? "required") === "required", qty: req && !!i.qty };
};
/** rating null = cleared (tapping the chosen rating again); qty = grams (net weight) */
export type Answer = { rating?: Rating | null; note?: string; qty?: number | null; stars?: number | null; reviews?: number | null; source?: "google" | "manual"; fetchedAt?: string | null;
  /** WW-WR: the member of the team who filled it */ by?: string };
/** 1250.5 → "1,250.5 g" in the UI language */
export const fmtGrams = (n: number) => `${n.toLocaleString(numberLocale(), { maximumFractionDigits: 1 })} g`;
/** "note+qty" → "note + grams" (what a rated item still needs) */
export const needLabel = (what: string) => what.split("+").map((w) => ({ note: tr("note"), photo: tr("photo"), qty: tr("grams") })[w] ?? w).join(" + ");
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
  /** the outlet's branch group: which items are required (2026-10-27) */
  branchGroup?: string | null;
  /** WW-WR: the audit of the visit */
  audit?: AuditTeam | null;
};
export type Person = { id: string; name: string; username?: string; jobTitle?: string | null };
/** WW-WR evaluation (migration 065): what to do, who of the team handles it, by when; marked done after sending */
export type ActionPlan = { id: string; title: string; detail: string | null; assigneeId: string | null; assignee: string | null; dueOn: string | null;
  status: "open" | "done"; doneAt: string | null; doneNote: string | null; doneBy: string | null };
export type Evaluation = { summary: string | null; revisitOn: string | null; revisitNote: string | null; completedAt: string | null; actions: ActionPlan[]; shareToken?: string };
export type AuditTeam = { id: string; day: string; lead: Person; members: Person[]; note?: string | null; status?: AuditStatus } & Partial<Evaluation>;
/** follow_up: sent, the action plans and the revisit still open; completed: the lead closed the revisit */
export type AuditStatus = "scheduled" | "in_progress" | "follow_up" | "completed" | "cancelled";
/** One WW-WR audit as the schedule lists it (integrated_portal_be app/wwwr.py) */
export type Audit = { id: string; branchCode: string; branchName: string; day: string; lead: Person; members: Person[]; note: string | null;
  status: AuditStatus; visitId: string | null; submittedAt: string | null; counts: Counts | null; score?: number | null } & Evaluation;
export const sentAudit = (s: AuditStatus | undefined) => s === "follow_up" || s === "completed";
export type WwwrState = { definition: Definition; user: { id: string; username: string; name: string }; audits: Audit[] };

export const PLATFORM_LABEL: Record<Platform, string> = { google: "Google Maps", gofood: "GoFood", grabfood: "GrabFood", shopeefood: "ShopeeFood" };
/** 4.6 → "4.6" (as the platforms show it) */
export const fmtStars = (n: number) => n.toFixed(1);
export type Branch = { code: string; name: string; latitude: number | null; longitude: number | null; radius_m: number | null };
export type FormState = { definition: Definition; user: { id: string; username: string; name: string }; branches: Branch[]; drafts: Visit[]; recent: Visit[];
  /** branches already sent today: one visit per branch per day, the next one tomorrow */ today: Record<string, { id: string; submittedAt: string }> };

export const RATINGS: Rating[] = ["UNDER", "MEET", "EXCEED"];
export const RATING_STYLE: Record<Rating, { on: string; text: string; dot: string; bar: string }> = {
  UNDER: { on: "border-red-500 bg-red-500 text-white", text: "text-red-700", dot: "bg-red-500", bar: "bg-red-500" },
  MEET: { on: "border-brand-600 bg-brand-600 text-white", text: "text-brand-700", dot: "bg-brand-600", bar: "bg-brand-500" },
  EXCEED: { on: "border-emerald-600 bg-emerald-600 text-white", text: "text-emerald-700", dot: "bg-emerald-500", bar: "bg-emerald-500" },
};
export const ratingLabel = (r: Rating) => ({ UNDER: tr("Under"), MEET: tr("Meet"), EXCEED: tr("Exceed") })[r];

export const visitPhotoUrl = (id: string) => `/api/visit-photos/${id}`;
export const visitSignatureUrl = (visitId: string) => `/api/visit-signatures/${visitId}`;
export const allItems = (d: Definition) => d.groups.flatMap((g) => g.sections.filter((s) => !s.retired).flatMap((s) => s.items.map((i) => ({ ...i, group: g.key, section: s.title, sectionEn: s.titleEn, sectionKey: s.key }))));

/** What the PIC still has to do (same rules as the server, 2026-10-27). need "rating": a required item not rated (blocks);
 * "evidence": a rated required item without its note / photo (blocks; `what` says which); "optional": an optional item
 * not rated (does not block, listed so the PIC sees it). */
export function missingOf(d: Definition, answers: Record<string, Answer>, photos: VisitPhoto[], group?: string | null) {
  const withPhoto = new Set(photos.map((p) => p.item));
  return allItems(d).filter((i) => i.kind === "rating").map((i) => {
    const a = answers[i.key] ?? {};
    if (!a.rating) return { item: i, need: (isRequired(i, group) ? "rating" : "optional") as "rating" | "optional", what: "" };
    const ev = evidenceOf(i, group);
    const what = [ev.note && !a.note ? "note" : "", ev.photo && !withPhoto.has(i.key) ? "photo" : "", ev.qty && a.qty == null ? "qty" : ""].filter(Boolean).join("+");
    return what ? { item: i, need: "evidence" as const, what } : null;
  }).filter((x): x is NonNullable<typeof x> => !!x);
}

/** Score colour: green from 90 %, amber from 75 %, red below. */
export const scoreTone = (s: number | null) => s === null ? "text-neutral-400" : s >= 90 ? "text-emerald-600" : s >= 75 ? "text-amber-600" : "text-red-600";
