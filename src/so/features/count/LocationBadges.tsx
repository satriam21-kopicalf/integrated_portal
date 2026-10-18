"use client";

// Where a count was started, for Cost Control (06.9 §12.15): outside the radius, weak GPS fix, facility without
// coordinates, and the distance with its accuracy.

import { MapPin, MapPinOff, SignalLow } from "lucide-react";
import { Badge } from "@/so/ui";
import { tr } from "@/lib/i18n";

export type LocationFacts = {
  outside_radius?: boolean;
  low_accuracy?: boolean;
  /** the facility has coordinates (else the distance cannot be checked) */
  facility_located?: boolean;
  start_distance_m?: number | null;
  start_accuracy_m?: number | string | null;
  entry_source?: string;
};

export const metres = (v: number | string | null | undefined) => (v === null || v === undefined ? null : Math.round(Number(v)));

/** "120 m ±15" */
export function distanceText(d: number | null | undefined, acc: number | string | null | undefined): string | null {
  if (d === null || d === undefined) return null;
  const a = metres(acc);
  return a === null ? `${d} m` : `${d} m ±${a}`;
}

export default function LocationBadges({ s, showDistance = true }: { s: LocationFacts; showDistance?: boolean }) {
  if (s.entry_source && s.entry_source !== "CREW") return null; // entered by Cost Control: no position
  const dist = showDistance ? distanceText(s.start_distance_m, s.start_accuracy_m) : null;
  return (
    <>
      {s.outside_radius && <Badge tone="amber" icon={<MapPin size={11} />}>{tr("Outside radius")}</Badge>}
      {s.low_accuracy && <Badge tone="slate" icon={<SignalLow size={11} />}>{tr("Low GPS accuracy")}</Badge>}
      {s.facility_located === false && <Badge tone="slate" icon={<MapPinOff size={11} />}>{tr("Outlet has no coordinates")}</Badge>}
      {dist && <span className="text-[11px] tabular-nums text-slate-500">{dist}</span>}
    </>
  );
}
