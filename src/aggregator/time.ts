// The times of Aggregator Insight (2026-11-25): one way to write a day, a time and a duration on every page and in every
// Excel. All times are WIB; an outlet of another zone is marked next to its name.

import { locale, tr } from "@/lib/i18n";

const ZONE = "Asia/Jakarta";
const at = (day: string) => new Date(`${day}T12:00:00+07:00`);

/** "Rab, 25 Nov 2026" of a YYYY-MM-DD day */
export const fmtDay = (day: string, weekday = true) =>
  at(day).toLocaleDateString(locale(), { timeZone: ZONE, ...(weekday ? { weekday: "short" } : {}), day: "numeric", month: "short", year: "numeric" });
/** "25 Nov" */
export const fmtDayShort = (day: string) => at(day).toLocaleDateString(locale(), { timeZone: ZONE, day: "numeric", month: "short" });
/** the WIB day (YYYY-MM-DD) of a timestamp */
export const dayOf = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(iso));
/** "16:08" of a timestamp */
export const fmtClock = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { timeZone: ZONE, hour: "2-digit", minute: "2-digit" });
/** "25 Nov 2026, 16:08 WIB" */
export const fmtStamp = (iso: string | null | undefined) => (iso ? `${fmtDay(dayOf(iso), false)}, ${fmtClock(iso)} WIB` : "—");
/** "2026-11-25 16:08" for the Excel */
export const xlStamp = (iso: string | null | undefined) => (iso ? `${dayOf(iso)} ${fmtClock(iso)}` : null);

/** "45 m", "1 j 25 m", "2 hr 3 j" */
export function fmtSpan(min: number | null | undefined): string {
  if (min == null) return "—";
  const m = Math.round(min);
  if (m < 60) return tr("{0} m", m);
  if (m < 1440) return m % 60 ? tr("{0} h {1} m", Math.floor(m / 60), m % 60) : tr("{0} h", m / 60);
  const h = Math.round((m % 1440) / 60);
  return h ? tr("{0} d {1} h", Math.floor(m / 1440), h) : tr("{0} d", Math.floor(m / 1440));
}

/** "12 menit lalu", "3 jam lalu", "2 hari lalu" */
export function ago(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (m < 1) return tr("just now");
  if (m < 60) return tr("{0} min ago", m);
  if (m < 48 * 60) return tr("{0} h ago", Math.round(m / 60));
  return tr("{0} days ago", Math.round(m / 1440));
}

export const isoDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
export const daysAgo = (n: number) => isoDay(new Date(Date.now() - n * 86400_000));
/** "19 – 25 Nov 2026", "Rab, 25 Nov 2026" */
export function fmtPeriod(a: string, z: string): string {
  if (a === z) return fmtDay(a);
  return `${a.slice(0, 4) === z.slice(0, 4) ? fmtDayShort(a) : fmtDay(a, false)} – ${fmtDay(z, false)}`;
}

export const rp = (v: number | null | undefined) => (v == null ? "—" : `Rp ${Math.round(v).toLocaleString("id-ID")}`);
export const nf = (v: number | null | undefined, d = 0) => (v == null ? "—" : v.toLocaleString(locale() === "id-ID" ? "id-ID" : "en-US", { maximumFractionDigits: d }));
export const pct = (v: number | null | undefined, d = 1) => (v == null ? "—" : `${nf(v, d)}%`);
