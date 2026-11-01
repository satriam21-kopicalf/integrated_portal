"use client";

// Monitoring COTR → Driver Check In (page cotr.check-in, prototype 2026-11-01): the check-ins the drivers send from
// fe-calfontheroad (start of the shift, reload at the pool, end of the shift) with photo, location and the stock carried.

import { Camera, CameraOff, LogIn, LogOut, MapPin, RefreshCw, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Page, Panel, theadClass } from "@/so/ui";
import { Segmented } from "@/so/ui/Simple";
import { Stat, StatStrip } from "@/so/ui/StatStrip";
import { CHECK_INS, DRIVERS, CheckIn, driverName, poolName } from "@/cotr/mock";
import { PrototypeNote } from "@/cotr/ui";
import { locale, tr } from "@/lib/i18n";

const KIND: Record<CheckIn["kind"], { label: () => string; tone: "blue" | "violet" | "slate"; icon: typeof LogIn }> = {
  start: { label: () => tr("Start of shift"), tone: "blue", icon: LogIn },
  reload: { label: () => tr("Reload"), tone: "violet", icon: RefreshCw },
  end: { label: () => tr("End of shift"), tone: "slate", icon: LogOut },
};

const time = (iso: string) => new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" });

export default function CotrCheckInPage() {
  const [kind, setKind] = useState<"all" | CheckIn["kind"]>("all");
  const rows = useMemo(() => CHECK_INS.filter((c) => kind === "all" || c.kind === kind).sort((a, b) => b.at.localeCompare(a.at)), [kind]);
  const active = DRIVERS.filter((d) => d.status === "active");
  const started = new Set(CHECK_INS.filter((c) => c.kind === "start").map((c) => c.driver));
  const issues = CHECK_INS.filter((c) => !c.photo || c.note).length;

  return (
    <Page title={tr("Driver Check In")} subtitle={tr("Start, reload and end of shift of every COTR driver · today")}
      stats={
        <StatStrip label={tr("Summary")}>
          <Stat label={tr("Drivers checked in")} icon={<LogIn size={16} />} value={`${started.size} / ${active.length}`} />
          <Stat label={tr("Reloads")} icon={<RefreshCw size={16} />} value={CHECK_INS.filter((c) => c.kind === "reload").length} />
          <Stat label={tr("Shifts ended")} icon={<LogOut size={16} />} value={CHECK_INS.filter((c) => c.kind === "end").length} />
          <Stat label={tr("Needs attention")} icon={<CameraOff size={16} />} value={issues} />
        </StatStrip>
      }>
      <PrototypeNote />
      <Panel title={tr("Check-ins")} toolbar={
        <Segmented label={tr("Type")} value={kind} onChange={setKind} options={[
          { value: "all", label: tr("All") }, { value: "start", label: KIND.start.label() },
          { value: "reload", label: KIND.reload.label() }, { value: "end", label: KIND.end.label() },
        ]} />
      }>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className={theadClass}>
              <tr>
                <th className="px-4 py-2.5">{tr("Time")}</th><th className="px-4 py-2.5">{tr("Driver")}</th>
                <th className="px-4 py-2.5">{tr("Type")}</th><th className="px-4 py-2.5">{tr("Pool / fleet")}</th>
                <th className="px-4 py-2.5">{tr("Location")}</th><th className="px-4 py-2.5 text-right">{tr("Stock carried")}</th>
                <th className="px-4 py-2.5">{tr("Photo")}</th><th className="px-4 py-2.5">{tr("Note")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((c) => {
                const k = KIND[c.kind];
                return (
                  <tr key={c.id} className="hover:bg-slate-50/70">
                    <td className="whitespace-nowrap px-4 py-2.5 font-medium tabular-nums">{time(c.at)}</td>
                    <td className="px-4 py-2.5"><span className="block font-medium text-slate-900">{driverName(c.driver)}</span><span className="text-[11px] text-slate-400">{c.driver}</span></td>
                    <td className="px-4 py-2.5"><Badge tone={k.tone} icon={<k.icon size={11} />}>{k.label()}</Badge></td>
                    <td className="px-4 py-2.5"><span className="block">{poolName(c.pool)}</span><span className="inline-flex items-center gap-1 text-[11px] text-slate-400"><Truck size={11} />{c.fleet}</span></td>
                    <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1 text-slate-600"><MapPin size={13} />{c.location}</span></td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{c.stock} {tr("cups")}</td>
                    <td className="px-4 py-2.5">{c.photo ? <Badge tone="green" icon={<Camera size={11} />}>{tr("Yes")}</Badge> : <Badge tone="red" icon={<CameraOff size={11} />}>{tr("Missing")}</Badge>}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{c.note ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Panel>
    </Page>
  );
}
