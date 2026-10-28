// Stock opname types and helpers (06.9); same file in the Outlet and Warehouse apps until @kopicalf/ui is extracted.

import { tr } from "@/lib/i18n";

export type CountStatus = "IN_PROGRESS" | "SUBMITTED" | "RECOUNT_REQUESTED" | "APPROVED" | "CANCELLED" | "EXPORTED";

export type CountLine = {
  id: number;
  item_id: string;
  item_code: string;
  item_name: string;
  area: string;
  sort: number;
  base_uom: string;
  pack_uom: string | null;
  pack_factor: string | null;
  esb_uom: string | null;
  esb_factor: string | null;
  photo_required: boolean;
  qty_pack: string | null;
  qty_loose: string | null;
  qty_base: string | null;
  /** grams (base unit) from the WIP counted in this count, added to qty_base in the ESB export */
  qty_wip?: string;
  source: string;
  counted_at: string | null;
  counted_by_name: string | null;
  flags: string[];
  recount_of: number | null;
  is_current: boolean;
  note: string | null;
  /** roasted date (HUB CK counts) / expired date (HUB WH counts), YYYY-MM-DD */
  roasted_date?: string | null;
  expired_date?: string | null;
  /** several dates of the item (2026-10-28), each with its quantity in the line unit; 2+ = the line counts their sum */
  date_batches?: DateBatch[];
  /** the date asked on this line: its item group's setting, else the count's (null = no date) */
  date_field?: DateField | null;
};
export type DateField = "roasted_date" | "expired_date";
export type DateBatch = { date: string | null; qty: string | null };
export const DATE_FIELD_LABEL: Record<DateField, () => string> = { roasted_date: () => tr("Roasted date"), expired_date: () => tr("Expired date") };
/** The date asked on a line (item group → count type → facility default); always optional. */
export const lineDateField = (l: Pick<CountLine, "date_field">, count: { date_field?: DateField | null }): DateField | null =>
  (l.date_field !== undefined ? l.date_field : count.date_field) ?? null;

export type CountPhoto = {
  id: string;
  subject: string;
  sha256: string;
  bytes: number;
  lat: string | null;
  lng: string | null;
  taken_at: string | null;
  uploaded_at: string;
  uploaded_by: string;
  uploaded_by_name: string | null;
};

export type Count = {
  /** the date asked per item: HUB CK → roasted date, HUB WH → expired date, other facilities none */
  date_field?: DateField | null;
  id: string;
  number: string;
  facility_id: string;
  facility_code: string;
  facility_name: string;
  count_type: string;
  count_type_name: string;
  business_date: string;
  status: CountStatus;
  window_end_at: string | null;
  started_at: string;
  started_by_name: string | null;
  start_distance_m: number | null;
  submitted_at: string | null;
  submit_distance_m: number | null;
  /** positions of the counter (06.9 §12.15): GPS accuracy in m and when the device took them */
  start_lat?: number | null;
  start_lng?: number | null;
  start_accuracy_m?: number | string | null;
  start_located_at?: string | null;
  submit_lat?: number | null;
  submit_lng?: number | null;
  submit_accuracy_m?: number | string | null;
  submit_located_at?: string | null;
  /** start position less precise than 100 m (weak GPS) */
  low_accuracy?: boolean;
  facility_lat?: number | string | null;
  facility_lng?: number | string | null;
  facility_radius_m?: number | null;
  is_late: boolean;
  outside_radius: boolean;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  review_note: string | null;
  note: string | null;
  /** CREW = counted by the branch; COST_CONTROL = entered by Cost Control on the form; IMPORT = from a file (D-56) */
  entry_source?: "CREW" | "COST_CONTROL" | "IMPORT";
  source_ref?: string | null;
  lines: CountLine[];
  photos: CountPhoto[];
  /** evidence documents (PDF, Excel …; 2026-10-21, optional, up to 15) */
  files?: CountFile[];
  photo_todo: { areas: string[]; items: string[] };
  progress: { lines: number; counted: number; flagged: number };
  wip?: CountWip;
  /** the crew's signature of the latest submit (06.9 §12.16, D-62; optional) */
  signature?: { id: string; name: string | null; signed_at: string; signed_by_name: string | null } | null;
};

export type CountFile = {
  id: string; file_name: string; mime: string; bytes: number; sha256: string; uploaded_at: string;
  uploaded_by: string; uploaded_by_name: string | null;
};

export type TodayCount = {
  count_type: string;
  name: string;
  frequency?: string;
  esb_purpose?: string | null;
  window_start: string | null;
  window_end: string | null;
  window_state: "UPCOMING" | "OPEN" | "LATE" | null;
  /** a count may stay open several days: due on period_start, window closes on period_end */
  period_start?: string;
  period_end?: string;
  items: number | null;
  areas: string[];
  last: { business_date: string; status: string } | null;
  session: { id: string; number: string; status: CountStatus; is_late: boolean; started_at: string; submitted_at: string | null } | null;
};

export type TodayFacility = {
  facility: { id: string; code: string; name: string; facility_type: string; latitude: string | null; longitude: string | null; checkin_radius_m: number; timezone: string };
  business_date: string;
  server_time: string;
  counts: TodayCount[];
  upcoming: { date: string; period_end?: string; count_type: string; name: string; window_start: string; window_end: string; items?: number; areas?: string[] }[];
};

export const STATUS: Record<string, { tone: "slate" | "blue" | "amber" | "green" | "red" | "violet"; label: () => string }> = {
  NOT_STARTED: { tone: "slate", label: () => tr("Not started") },
  MISSED: { tone: "red", label: () => tr("Missed") },
  IN_PROGRESS: { tone: "blue", label: () => tr("In progress") },
  SUBMITTED: { tone: "violet", label: () => tr("Submitted") },
  RECOUNT_REQUESTED: { tone: "amber", label: () => tr("Recount requested") },
  APPROVED: { tone: "green", label: () => tr("Approved") },
  CANCELLED: { tone: "slate", label: () => tr("Cancelled") },
  EXPORTED: { tone: "green", label: () => tr("Exported") },
};

export const ENTRY_SOURCE: Record<string, () => string> = {
  CREW: () => tr("Counted by the branch"),
  COST_CONTROL: () => tr("Entered by Cost Control"),
  IMPORT: () => tr("Imported by Cost Control"),
};

export const COUNT_TYPE_LABEL: Record<string, () => string> = {
  DAILY_PACKAGING: () => tr("Daily packaging"),
  WEEKLY_RAW: () => tr("Weekly raw material"),
  MONTHLY_RAW: () => tr("Monthly raw material"),
  ADHOC: () => tr("Ad hoc count"),
};
/** Names given by Cost Control (Count types page), loaded once by the stock-opname layouts (CountTypeNames). */
const NAMES: Record<string, string> = {};
/** Names the count types were created with: still shown translated until Cost Control renames them. */
const SEED_NAMES = new Set(["Daily packaging count", "Weekly raw material count", "Monthly raw material count", "Ad hoc count (audit, handover)"]);

export function setCountTypeNames(types: { code: string; name: string }[]) {
  for (const t of types) {
    if (SEED_NAMES.has(t.name)) delete NAMES[t.code];
    else NAMES[t.code] = t.name;
  }
}

export const countTypeLabel = (code: string, fallback?: string) => NAMES[code] ?? COUNT_TYPE_LABEL[code]?.() ?? fallback ?? code;

/** A GPS position: accuracy in metres (68% radius reported by the device) and when the device took it. */
export type Fix = { lat: number; lng: number; accuracy: number; at: string };
export type LocateError = "denied" | "unavailable" | "timeout";

const toFix = (p: GeolocationPosition): Fix => ({
  lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)),
  accuracy: Math.round(p.coords.accuracy * 10) / 10, at: new Date(p.timestamp).toISOString(),
});

/** A fresh, precise position for the start / submit of a count (06.9 §12.15): never the device's cached position;
 * keeps listening until the accuracy is within `goodM` or `waitMs` has passed, then takes the best fix it got.
 * `onFix` reports every improvement (the screen shows "±12 m"). */
export function locate(onFix?: (f: Fix) => void, goodM = 30, waitMs = 20_000): Promise<{ fix: Fix | null; error: LocateError | null }> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve({ fix: null, error: "unavailable" });
    let best: Fix | null = null;
    let done = false;
    const finish = (error: LocateError | null) => {
      if (done) return;
      done = true;
      navigator.geolocation.clearWatch(watch);
      clearTimeout(timer);
      resolve({ fix: best, error: best ? null : error });
    };
    const watch = navigator.geolocation.watchPosition(
      (p) => {
        const f = toFix(p);
        if (!best || f.accuracy < best.accuracy) {
          best = f;
          onFix?.(f);
        }
        if (f.accuracy <= goodM) finish(null);
      },
      (e) => finish(e.code === e.PERMISSION_DENIED ? "denied" : e.code === e.TIMEOUT ? "timeout" : "unavailable"),
      { enableHighAccuracy: true, timeout: waitMs, maximumAge: 0 },
    );
    const timer = setTimeout(() => finish("timeout"), waitMs);
  });
}

/** Quick current position (photo stamp, device check): null when not allowed or not available within 8 s. */
export function getPosition(): Promise<Fix | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition((p) => resolve(toFix(p)), () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 10_000 });
  });
}

/** Google Maps link of a position. */
export const mapsUrl = (lat: number | string, lng: number | string) => `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;

/** "1.5" / "1,5" / "" -> number string or null; NaN -> undefined (invalid). */
export function parseQty(v: string): string | null | undefined {
  const s = v.trim().replace(",", ".");
  if (s === "") return null;
  return /^\d+(\.\d+)?$/.test(s) ? s : undefined;
}

export const fmtQty = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 3 }).replace(/,/g, "");

/** WIP section of a count (premix counted in pail / teko / gram, exploded into the ingredient lines, D-34). */
export type WipRecipe = {
  id: string; code: string; name: string; version_id: string; version_no: number; batch: number;
  units: { uom: string; grams: number }[];
  /** the unit the count asks for: Porsi, Pcs … or Gram (weighed premix) */
  count_uom?: string;
  components: { item_id: string | null; name: string; is_stock: boolean; per_gram: number }[];
};
export type WipLine = {
  id: number; recipe_id: string; code: string; name: string; version_no: number; uom: string; qty: number; qty_base: number;
  exploded: { item_id: string | null; name: string; is_stock: boolean; qty_base: string }[];
  counted_at: string; counted_by_name: string | null;
};
export type CountWip = { enabled: boolean; recipes: WipRecipe[]; lines: WipLine[] };
