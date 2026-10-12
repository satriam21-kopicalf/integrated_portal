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
  source: string;
  counted_at: string | null;
  counted_by_name: string | null;
  flags: string[];
  recount_of: number | null;
  is_current: boolean;
  note: string | null;
};

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
  is_late: boolean;
  outside_radius: boolean;
  reviewed_at: string | null;
  reviewed_by_name: string | null;
  review_note: string | null;
  note: string | null;
  lines: CountLine[];
  photos: CountPhoto[];
  photo_todo: { areas: string[]; items: string[] };
  progress: { lines: number; counted: number; flagged: number };
};

export type TodayCount = {
  count_type: string;
  name: string;
  frequency?: string;
  esb_purpose?: string | null;
  window_start: string | null;
  window_end: string | null;
  window_state: "UPCOMING" | "OPEN" | "LATE" | null;
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
  upcoming: { date: string; count_type: string; name: string; window_start: string; window_end: string }[];
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

export const COUNT_TYPE_LABEL: Record<string, () => string> = {
  DAILY_PACKAGING: () => tr("Daily packaging"),
  WEEKLY_RAW: () => tr("Weekly raw material"),
  MONTHLY_RAW: () => tr("Monthly raw material"),
  ADHOC: () => tr("Ad hoc count"),
};
export const countTypeLabel = (code: string, fallback?: string) => COUNT_TYPE_LABEL[code]?.() ?? fallback ?? code;

/** Current position for the evidence (null when not allowed or not available within 8 s). */
export function getPosition(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: Number(p.coords.latitude.toFixed(6)), lng: Number(p.coords.longitude.toFixed(6)) }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  });
}

/** "1.5" / "1,5" / "" -> number string or null; NaN -> undefined (invalid). */
export function parseQty(v: string): string | null | undefined {
  const s = v.trim().replace(",", ".");
  if (s === "") return null;
  return /^\d+(\.\d+)?$/.test(s) ? s : undefined;
}

export const fmtQty = (v: string | number | null | undefined) =>
  v === null || v === undefined || v === "" ? "" : Number(v).toLocaleString("en-US", { maximumFractionDigits: 3 }).replace(/,/g, "");
