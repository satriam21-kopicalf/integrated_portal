"use client";

// Monitoring Armada - Driver → HRMS Attendance (stage 3, 2026-11-23): the punch-in / out of every COTR employee in the
// HRMS attendance app beside the shift of the driver app, per pool. At the pool = the HRMS geofence; the distance to the
// point of Master Pool is shown so a wrong pool point shows up. /api/cotr/attendance (app/cotr_attendance.py).

import { useEffect, useMemo, useState } from "react";
import { Fingerprint } from "lucide-react";
import { Empty, ErrorState, cx, usePaged } from "@/so/ui";
import { CardFooter, Lozenge, Person, QuickChips, jHeadRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { COTR_PAGE, CotrPager } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

type Row = { code: string; name: string; nickname: string | null; pool: string; poolName: string; fleet: string | null; position: string | null; linked: boolean;
  punchIn: string | null; punchOut: string | null; late: number; faceOk: boolean | null; meters: number | null; atPool: boolean | null; nearPool: boolean | null;
  shift: "open" | "closed" | null; shiftAt: string | null };
type Data = { day: string; rows: Row[]; summary: { people: number; linked: number; punched: number; atPool: number; late: number; shiftNoPunch: number; punchNoShift: number } };
type Show = "all" | "in" | "out" | "noshift" | "away";

const SHOW: Record<Show, (r: Row) => boolean> = {
  all: () => true, in: (r) => !!r.punchIn, out: (r) => !r.punchIn, noshift: (r) => !!r.punchIn && !r.shift, away: (r) => !!r.punchIn && r.atPool === false,
};

export function CotrAttendance({ day, pool, q }: { day: string; pool: string; q: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [show, setShow] = useState<Show>("all");
  useEffect(() => {
    let alive = true;
    setData(null); setError(null);
    call<Data>(`/api/cotr/attendance?day=${day}${pool ? `&pool=${encodeURIComponent(pool)}` : ""}`)
      .then((r) => { if (alive) setData(r); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [day, pool]);
  const words = q.trim().toLowerCase();
  const base = useMemo(() => (data?.rows ?? []).filter((r) => !words || `${r.name} ${r.nickname ?? ""} ${r.code} ${r.fleet ?? ""}`.toLowerCase().includes(words)), [data, words]);
  const rows = base.filter(SHOW[show]);
  const paged = usePaged(rows, `${day}|${pool}|${show}|${words}`, COTR_PAGE);
  const n = (s: Show) => (data ? base.filter(SHOW[s]).length : null);
  if (error) return <div className="p-4"><ErrorState message={error} /></div>;
  return (
    <>
      <div className="border-b border-[color:var(--j-DCDFE4)] px-4 py-3 sm:px-5">
        <QuickChips label={tr("Attendance")} value={show} onChange={setShow} items={[
          { key: "all" as Show, label: tr("All"), count: n("all") },
          { key: "in" as Show, label: tr("Punched in"), dot: "bg-emerald-500", count: n("in") },
          { key: "out" as Show, label: tr("Not punched in"), dot: "bg-neutral-400", count: n("out") },
          { key: "noshift" as Show, label: tr("Punched, no shift"), dot: "bg-amber-500", count: n("noshift") },
          { key: "away" as Show, label: tr("Outside the pool"), dot: "bg-red-500", count: n("away") }]} />
        {data && <p className="mt-2 text-xs text-[color:var(--j-626F86)]">{tr("{0} of {1} employees linked to HRMS · {2} punched in", data.summary.linked, data.summary.people, data.summary.punched)}</p>}
      </div>
      {!data ? <div className="p-4"><div className="skeleton h-48 rounded-[3px]" /></div> : rows.length === 0 ? (
        <Empty icon={<Fingerprint size={28} />} title={tr("No one matches")} />
      ) : (
        <div className="overflow-x-auto">
          <table className={cx(jTable, "m-cards min-w-[760px]")}>
            <thead><tr className={jHeadRow}><th className={jTh}>{tr("Employee")}</th><th className={jTh}>{tr("Pool / HUB")}</th><th className={jTh}>{tr("Punch in")}</th>
              <th className={jTh}>{tr("Punch out")}</th><th className={jTh}>{tr("Place")}</th><th className={jTh}>{tr("Driver app shift")}</th></tr></thead>
            <tbody>
              {paged.rows.map((r) => (
                <tr key={r.code} className="border-b border-[color:var(--j-F1F2F4)]">
                  <td className={jTd} data-label={tr("Employee")}><Person name={r.name} sub={[r.position, r.fleet].filter(Boolean).join(" · ") || r.code} /></td>
                  <td className={cx(jTd, "text-[color:var(--j-44546F)]")} data-label={tr("Pool / HUB")}>{r.poolName}</td>
                  <td className={jTd} data-label={tr("Punch in")}>
                    {!r.linked ? <Lozenge tone="grey">{tr("Not linked to HRMS")}</Lozenge> : r.punchIn ? (
                      <span className="tabular-nums">{r.punchIn} {r.late > 0 && <Lozenge tone="amber">{tr("Late {0} min", r.late)}</Lozenge>}</span>
                    ) : <Lozenge tone="red">{tr("Not punched in")}</Lozenge>}
                  </td>
                  <td className={cx(jTd, "tabular-nums")} data-label={tr("Punch out")}>{r.punchOut ?? "—"}</td>
                  <td className={jTd} data-label={tr("Place")}>
                    {r.punchIn ? <span className="flex flex-wrap items-center gap-1.5">
                      {r.atPool === null ? <Lozenge tone="grey">{tr("Unknown")}</Lozenge> : r.atPool ? <Lozenge tone="green">{tr("At the site")}</Lozenge> : <Lozenge tone="red">{tr("Outside")}</Lozenge>}
                      {r.meters !== null && <span className={cx("text-[11px]", r.nearPool === false ? "text-amber-700" : "text-[color:var(--j-626F86)]")}
                        title={tr("Distance to the point of the pool in Master Pool")}>{tr("{0} m from the pool point", r.meters)}</span>}
                    </span> : "—"}
                  </td>
                  <td className={jTd} data-label={tr("Driver app shift")}>
                    {r.shift === "open" ? <Lozenge tone="green">{tr("On the road")}</Lozenge> : r.shift === "closed" ? <Lozenge tone="grey">{tr("Shift ended")}</Lozenge>
                      : r.punchIn ? <Lozenge tone="amber">{tr("No shift yet")}</Lozenge> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {data && <CardFooter><span>{tr("{0} of {1} shown", rows.length, base.length)}</span><CotrPager paged={paged} /></CardFooter>}
    </>
  );
}
