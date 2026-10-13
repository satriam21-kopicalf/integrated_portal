"use client";

// What the crew sees while no count is due (2026-10-13): the next stock opname Cost Control scheduled (dates, WIB
// window, a countdown, what the list holds), a short preparation checklist with a camera & location check (photos are
// camera-only), and the schedule of the next two weeks.

import { CalendarClock, CalendarDays, Camera, CheckCircle2, Hourglass, Layers, MapPin, Scale, XCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, cx } from "@/so/ui";
import { type TodayFacility, countTypeLabel, getPosition } from "@/so/lib/counts";
import { periodText, wibAt } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";

type Upcoming = TodayFacility["upcoming"][number];

function useNow(ms = 30_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/** "2 days 9 hours" / "3 hours 20 minutes" / "12 minutes" until `to`. */
function until(to: Date, now: number): string {
  const min = Math.max(0, Math.round((to.getTime() - now) / 60_000));
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  if (d > 0) return h ? tr("{0} days {1} hours", d, h) : tr("{0} days", d);
  if (h > 0) return m ? tr("{0} hours {1} minutes", h, m) : tr("{0} hours", h);
  return tr("{0} minutes", m);
}

type Check = "idle" | "busy" | "ok" | "fail";

function DeviceCheck() {
  const [camera, setCamera] = useState<Check>("idle");
  const [location, setLocation] = useState<Check>("idle");
  const run = async () => {
    setCamera("busy");
    setLocation("busy");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      s.getTracks().forEach((t) => t.stop());
      setCamera("ok");
    } catch {
      setCamera("fail");
    }
    setLocation((await getPosition()) ? "ok" : "fail");
  };
  const mark = (c: Check) => c === "ok" ? <CheckCircle2 size={15} className="text-emerald-600" /> : c === "fail" ? <XCircle size={15} className="text-red-600" /> : null;
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button variant="secondary" size="sm" loading={camera === "busy"} onClick={run}><Camera size={14} /> {tr("Check camera & location")}</Button>
      {camera !== "idle" && camera !== "busy" && <span className="inline-flex items-center gap-1 text-xs text-slate-600">{mark(camera)} {tr("Camera")}</span>}
      {location !== "idle" && location !== "busy" && <span className="inline-flex items-center gap-1 text-xs text-slate-600">{mark(location)} {tr("Location")}</span>}
      {(camera === "fail" || location === "fail") && (
        <span className="w-full text-xs text-red-700">{tr("Allow the camera and location for this site in the browser settings (padlock in the address bar), then check again.")}</span>
      )}
    </div>
  );
}

export default function NextCount({ upcoming }: { upcoming: Upcoming[] }) {
  const now = useNow();
  if (upcoming.length === 0) {
    return (
      <div className="px-4 py-6 text-center text-sm text-slate-500 sm:px-5">
        <CalendarDays size={24} className="mx-auto mb-2 text-slate-300" />
        {tr("No stock opname is scheduled in the next 14 days. Cost Control sets the schedule.")}
      </div>
    );
  }
  const next = upcoming[0];
  const opens = wibAt(next.date, next.window_start);
  const rest = upcoming.slice(1);
  return (
    <div className="space-y-4 px-4 py-4 sm:px-5">
      <div className="overflow-hidden rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white">
        <div className="flex flex-wrap items-start gap-3 p-4">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white"><CalendarClock size={20} /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">{tr("Next stock opname")}</p>
            <p className="text-base font-semibold text-slate-900">{countTypeLabel(next.count_type, next.name)}</p>
            <p className="mt-0.5 text-sm text-slate-700">{periodText(next.date, next.period_end, next.window_start, next.window_end)}</p>
          </div>
          <Badge tone="blue" icon={<Hourglass size={11} />}>{tr("Opens in {0}", until(opens, now))}</Badge>
        </div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 border-t border-blue-100 bg-white/60 px-4 py-3 text-xs sm:grid-cols-3">
          <div><dt className="text-slate-400">{tr("Window opens")}</dt><dd className="font-medium text-slate-800">{periodText(next.date, null, next.window_start)}</dd></div>
          <div><dt className="text-slate-400">{tr("Window closes")}</dt><dd className="font-medium text-slate-800">{periodText(next.period_end ?? next.date, null, next.window_end)}</dd></div>
          <div className="col-span-2 sm:col-span-1"><dt className="flex items-center gap-1 text-slate-400"><Layers size={12} /> {tr("Items")}</dt>
            <dd className="font-medium text-slate-800">{next.items !== undefined ? tr("{0} items · {1} areas", next.items, next.areas?.length ?? 0) : "—"}</dd></div>
        </dl>
        {next.areas && next.areas.length > 0 && <p className="px-4 pb-3 text-[11px] text-slate-500">{tr("Areas")}: {next.areas.join(" · ")}</p>}
      </div>

      <div className="rounded-xl border border-slate-200 p-4">
        <p className="mb-2 text-sm font-semibold text-slate-900">{tr("Get ready")}</p>
        <ul className="mb-3 space-y-1.5 text-sm text-slate-700">
          <li className="flex gap-2"><MapPin size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />{tr("Be at the branch when the window opens; the location is recorded when you start and submit.")}</li>
          <li className="flex gap-2"><Camera size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />{tr("Photos are taken with the camera only (no gallery). Allow the camera now so the count goes smoothly.")}</li>
          <li className="flex gap-2"><Scale size={15} className="mt-0.5 flex-shrink-0 text-slate-400" />{tr("Have a scale ready: premix, creams and sauces are entered in grams.")}</li>
        </ul>
        <DeviceCheck />
      </div>

      {rest.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400"><CalendarDays size={12} /> {tr("Next 14 days")}</p>
          <ul className="space-y-1.5">
            {rest.map((u) => (
              <li key={`${u.date}:${u.count_type}`} className={cx("flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm")}>
                <span className="font-medium text-slate-800">{countTypeLabel(u.count_type, u.name)}</span>
                <span className="text-xs text-slate-500">{periodText(u.date, u.period_end, u.window_start, u.window_end)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
