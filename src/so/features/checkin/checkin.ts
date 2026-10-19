// PIC Check In (integrated_portal_be app/pic_checkin.py): types, the fetch helper of its endpoints (plain JSON, errors
// as {"error": "..."}) and the location rule shown before sending (the server applies the same rule).

import { useEffect, useRef } from "react";
import { serverMsg, tr } from "@/lib/i18n";

export type Branch = { code: string; name: string; latitude: number | null; longitude: number | null; radius_m: number | null };
export type CheckIn = {
  id: string; userId: string; username: string; name: string; role: string; branchCode: string; branchName: string;
  visitedAt: string; deviceTime: string | null; latitude: number; longitude: number; accuracyM: number | null;
  outletLatitude: number | null; outletLongitude: number | null; radiusM: number | null; distanceM: number | null;
  outsideRadius: boolean; lowAccuracy: boolean; outletLocated: boolean; faces: number; note: string | null;
  /** Monitoring only (the PIC's own list has none): signs of a faked position and the manager's review */
  riskLevel?: RiskLevel; riskSignals?: RiskSignal[]; review?: Review | null;
};
export type RiskLevel = "none" | "low" | "medium" | "high";
export type RiskSignal = { code: string; level: RiskLevel; text: string };
export type Review = { status: "valid" | "invalid"; note: string | null; by: string | null; at: string | null };
export const suspect = (c: CheckIn) => c.riskLevel === "high" || c.riskLevel === "medium";
export type FormData = { user: { id: string; username: string; name: string }; branches: Branch[]; recent: CheckIn[] };

export async function call<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(path, {
    ...rest, credentials: "same-origin",
    headers: json !== undefined ? { "content-type": "application/json" } : undefined,
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(serverMsg(body.error) || tr("Request failed ({0})", res.status));
  return body as T;
}

export const photoUrl = (id: string) => `/api/pic-check-in/${id}/photo`;

export function distanceM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const r = 6371000, rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad, dLng = (lng2 - lng1) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * r * Math.asin(Math.sqrt(h)));
}

/** Same rule as the server and the stock opname: outside when distance − min(accuracy, 100 m) > radius. */
export function judge(lat: number, lng: number, accuracy: number, b: Branch | undefined) {
  if (!b || b.latitude === null || b.longitude === null) return { distance: null, outside: false, located: false };
  const distance = distanceM(lat, lng, b.latitude, b.longitude);
  return { distance, outside: distance - Math.min(accuracy, 100) > (b.radius_m ?? 100), located: true };
}

export type GpsSample = { t: number; lat: number; lng: number; acc: number | null };

/** Every GPS reading while the form is open (the latest `max`), sent with the check-in: a real GPS always moves a
 * little, a fake GPS app often repeats the very same reading (integrated_portal_be app/pic_checkin.py assess). */
export function useGpsTrail(max = 30) {
  const trail = useRef<GpsSample[]>([]);
  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (p) => { trail.current = [...trail.current, { t: p.timestamp, lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }].slice(-max); },
      () => {}, { enableHighAccuracy: true, maximumAge: 0 });
    return () => navigator.geolocation.clearWatch(id);
  }, [max]);
  return trail;
}

/** What the browser says about the device: touch screen, automation (sent with the check-in). */
export function deviceSignals() {
  return { touch: typeof navigator !== "undefined" && navigator.maxTouchPoints > 0, webdriver: typeof navigator !== "undefined" && navigator.webdriver === true };
}
