"use client";

// The live clock of the forms (stock opname, PIC Check In, Monitoring Outlet / Product, 2026-10-21): WIB, 24 h with
// seconds and colons whatever the language ("11:33:35 WIB"), ticking every second.

import { useEffect, useState } from "react";
import { TZ, TZ_LABEL } from "@/so/lib/wib";

const FMT = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });

/** "11:33:35" in WIB. */
export const clockText = (d: Date) => FMT.format(d);

export default function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!now) return null;
  // phones / tablets: a pill under the title; desktop: the large clock on the right
  return (
    <p className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-sm font-semibold tabular-nums text-slate-900 shadow-sm ring-1 ring-slate-200/80 lg:bg-transparent lg:p-0 lg:text-2xl lg:shadow-none lg:ring-0"
      aria-label={`${clockText(now)} ${TZ_LABEL}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 lg:hidden" aria-hidden />
      {clockText(now)}<span className="text-[11px] font-medium text-slate-400 lg:text-xs">{TZ_LABEL}</span>
    </p>
  );
}
