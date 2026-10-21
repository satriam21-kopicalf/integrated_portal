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
  return (
    <p className="text-right text-xl font-semibold leading-tight tabular-nums text-slate-900 sm:text-2xl" aria-label={`${clockText(now)} ${TZ_LABEL}`}>
      {clockText(now)}<span className="ml-1 text-xs font-medium text-slate-400">{TZ_LABEL}</span>
    </p>
  );
}
