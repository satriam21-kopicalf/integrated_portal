// Stock opname runs on Western Indonesia Time (WIB, Asia/Jakarta) for every outlet, hub and kitchen, the same as the
// kopicalf schedule (setup.SCHEDULE_TZ). Dates and times on the SO screens are shown in WIB whatever time zone the
// phone or computer is set to.

import { locale } from "@/lib/i18n";

export const TZ = "Asia/Jakarta";
export const TZ_LABEL = "WIB";

/** YYYY-MM-DD of `d` (default now) in WIB. */
export function wibDate(d: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** First day of the current WIB month as a local Date (for month pickers / calendars). */
export function wibMonthStart(): Date {
  const [y, m] = wibDate().split("-").map(Number);
  return new Date(y, m - 1, 1);
}

/** "14:05 WIB" */
export function wibClock(d: Date = new Date()): string {
  return `${d.toLocaleTimeString(locale(), { timeZone: TZ, hour: "2-digit", minute: "2-digit" })} ${TZ_LABEL}`;
}

/** A timestamp with date and time in WIB: "13 Okt 2026, 07.42 WIB". */
export function wibDateTime(v: string | null | undefined): string {
  return v ? `${new Date(v).toLocaleString(locale(), { timeZone: TZ, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })} ${TZ_LABEL}` : "—";
}

/** The date of a timestamp in WIB: "13 Okt 2026". */
export function wibDay(v: string | null | undefined): string {
  return v ? new Date(v).toLocaleDateString(locale(), { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" }) : "—";
}

/** A count window "07:00–08:00 WIB". */
export function windowText(start?: string | null, end?: string | null): string {
  if (!start) return "";
  return `${start}${end ? `–${end}` : ""} ${TZ_LABEL}`;
}
