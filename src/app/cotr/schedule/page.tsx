"use client";

// Monitoring COTR → Master Schedule (page cotr.schedule, backend migration 052): the shift templates and the weekly
// roster of the drivers (a shift, off, leave or sick per day), the attendance against the check in of the driver
// app and a recap per driver — the administrative reference of the incentives.

import { ChevronLeft, ChevronRight, Copy, RefreshCw, Save } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorState, Field, Page, Panel, Select, Tone, cx, theadClass, useToast } from "@/so/ui";
import { Segmented } from "@/so/ui/Simple";
import { call } from "@/so/features/checkin/checkin";
import { Pool } from "@/cotr/types";
import { MasterTable, useMaster } from "@/cotr/ui";
import { locale, tr } from "@/lib/i18n";

type Status = "work" | "off" | "leave" | "sick";
type Attendance = "on_time" | "late" | "absent" | "planned" | "unscheduled" | "off" | "leave" | "sick" | "none";
type Template = { code: string; name: string; start_time: string; end_time: string; break_min: number; grace_min: number; color: string | null; is_active: boolean; sort: number; pay_rate?: number | null };
type Cell = { driver: string; day: string; status: Status | null; template: string | null; pool: string | null; note: string | null; started: string | null; ended: string | null; attendance: Attendance };
type Recap = { driver: string; scheduled: number; worked: number; on_time: number; late: number; absent: number; off: number; leave: number; sick: number; unscheduled: number; pay?: number };
const rupiah = (n: number) => `Rp ${Math.round(n).toLocaleString("id-ID")}`;
type Roster = { from: string; to: string; templates: Template[]; drivers: { code: string; name: string; pool_code: string | null }[]; cells: Cell[]; recap: Recap[] };
type Edit = { status: Status | null; template: string | null };

const ATT: Record<Attendance, { label: () => string; tone: Tone } | null> = {
  on_time: { label: () => tr("On time"), tone: "green" }, late: { label: () => tr("Late"), tone: "amber" },
  absent: { label: () => tr("Absent"), tone: "red" }, unscheduled: { label: () => tr("Unscheduled"), tone: "violet" },
  planned: null, off: null, leave: null, sick: null, none: null,
};
const OTHER: Record<Exclude<Status, "work">, () => string> = { off: () => tr("Off"), leave: () => tr("Leave"), sick: () => tr("Sick") };
const TEMPLATE_TONE: Record<string, string> = {
  amber: "bg-amber-50 text-amber-800 border-amber-200", blue: "bg-blue-50 text-blue-800 border-blue-200",
  violet: "bg-violet-50 text-violet-800 border-violet-200", green: "bg-emerald-50 text-emerald-800 border-emerald-200",
  cyan: "bg-cyan-50 text-cyan-800 border-cyan-200", red: "bg-red-50 text-red-800 border-red-200",
};

const iso = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (day: string, n: number) => iso(new Date(Date.parse(`${day}T00:00:00Z`) + n * 864e5));
function mondayOf(day: string) {
  const w = new Date(`${day}T00:00:00Z`).getUTCDay();
  return addDays(day, -((w + 6) % 7));
}

export default function CotrSchedulePage() {
  const [tab, setTab] = useState<"roster" | "templates">("roster");
  return (
    <Page title={tr("Master Schedule")} subtitle={tr("Shifts of the drivers per day, attendance against the check in, and the recap for the incentives")}>
      <Segmented label={tr("Section")} value={tab} onChange={setTab} options={[{ value: "roster", label: tr("Roster") }, { value: "templates", label: tr("Shift templates") }]} />
      {tab === "roster" ? <RosterView /> : <TemplatesView />}
    </Page>
  );
}

function RosterView() {
  const toast = useToast();
  const pools = useMaster<Pool>("pools");
  const [week, setWeek] = useState(() => mondayOf(new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10)));
  const [pool, setPool] = useState("");
  const [data, setData] = useState<Roster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);

  useEffect(() => {
    let alive = true;
    setError(null);
    call<Roster>(`/api/cotr/schedule?dateFrom=${week}&dateTo=${addDays(week, 6)}${pool ? `&pool=${encodeURIComponent(pool)}` : ""}`)
      .then((d) => { if (alive) { setData(d); setEdits({}); } }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [week, pool, tick]);

  const cellOf = (driver: string, day: string) => data?.cells.find((c) => c.driver === driver && c.day === day);
  const valueOf = (driver: string, day: string): Edit => edits[`${driver}|${day}`] ?? { status: cellOf(driver, day)?.status ?? null, template: cellOf(driver, day)?.template ?? null };
  const setCell = (driver: string, day: string, v: string) => {
    const e: Edit = v === "" ? { status: null, template: null } : v.startsWith("@") ? { status: v.slice(1) as Status, template: null } : { status: "work", template: v };
    setEdits((x) => ({ ...x, [`${driver}|${day}`]: e }));
  };
  const fillRow = (driver: string, v: string) => days.forEach((d) => setCell(driver, d, v));
  const dirty = Object.keys(edits).length;

  const save = async () => {
    setBusy(true);
    try {
      const entries = Object.entries(edits).map(([k, e]) => { const [driver, day] = k.split("|"); return { driver, day, status: e.status, template: e.template, pool: data?.drivers.find((d) => d.code === driver)?.pool_code ?? null }; });
      await call("/api/cotr/schedule", { method: "PUT", json: { entries } });
      toast(tr("Saved"));
      setTick((t) => t + 1);
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const copyLastWeek = async () => {
    if (!window.confirm(tr("Copy the roster of last week to this week? The cells of this week are overwritten."))) return;
    setBusy(true);
    try {
      const drivers = pool ? data?.drivers.map((d) => d.code) : undefined;
      const r = await call<{ copied: number }>("/api/cotr/schedule/copy", { method: "POST", json: { source: addDays(week, -7), target: week, days: 7, drivers } });
      toast(tr("{0} cells copied", r.copied));
      setTick((t) => t + 1);
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };

  const templates = (data?.templates ?? []).filter((t) => t.is_active);
  const label = (day: string) => new Date(`${day}T00:00:00Z`).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const recap = (code: string) => data?.recap.find((r) => r.driver === code);

  return (
    <>
      <Panel title={tr("Weekly roster")} description={tr("Choose a shift, off, leave or sick for every driver and day; the attendance follows the check in of the driver app")}
        actions={<div className="flex gap-2">
          <Button size="sm" variant="secondary" disabled={busy} onClick={() => void copyLastWeek()}><Copy size={14} /> {tr("Copy last week")}</Button>
          <Button size="sm" loading={busy} disabled={!dirty} onClick={() => void save()}><Save size={14} /> {dirty ? tr("Save ({0})", dirty) : tr("Save")}</Button>
        </div>}
        toolbar={<div className="flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" aria-label={tr("Previous week")} onClick={() => setWeek(addDays(week, -7))}><ChevronLeft size={16} /></Button>
            <span className="min-w-[11rem] text-center text-sm font-medium">{label(week)} – {label(addDays(week, 6))}</span>
            <Button size="sm" variant="ghost" aria-label={tr("Next week")} onClick={() => setWeek(addDays(week, 7))}><ChevronRight size={16} /></Button>
          </div>
          <Field label={tr("Pool / HUB")} className="w-48"><Select value={pool} onChange={(e) => setPool(e.target.value)}><option value="">{tr("All pools")}</option>{(pools.rows ?? []).filter((p) => p.kind !== "storage").map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}</Select></Field>
          <Button variant="secondary" onClick={() => setTick((t) => t + 1)}><RefreshCw size={15} /> {tr("Refresh")}</Button>
        </div>}>
        {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} /> : !data ? <div className="skeleton m-4 h-40 rounded-xl" /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className={theadClass}>
                <tr><th className="sticky left-0 bg-slate-50 px-3 py-2">{tr("Driver")}</th>{days.map((d) => <th key={d} className="px-2 py-2 text-center">{label(d)}</th>)}<th className="px-2 py-2 text-center">{tr("Whole week")}</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {data.drivers.map((dr) => (
                  <tr key={dr.code}>
                    <td className="sticky left-0 bg-white px-3 py-2"><span className="block font-medium text-slate-900">{dr.name}</span><span className="text-[11px] text-slate-400">{dr.code}{dr.pool_code ? ` · ${dr.pool_code}` : ""}</span></td>
                    {days.map((d) => {
                      const v = valueOf(dr.code, d);
                      const c = cellOf(dr.code, d);
                      const t = templates.find((x) => x.code === v.template);
                      const att = c ? ATT[c.attendance] : null;
                      const changed = `${dr.code}|${d}` in edits;
                      return (
                        <td key={d} className="px-1.5 py-1.5 align-top">
                          <select value={v.status === "work" ? v.template ?? "" : v.status ? `@${v.status}` : ""} onChange={(e) => setCell(dr.code, d, e.target.value)}
                            aria-label={`${dr.name} ${d}`}
                            className={cx("h-8 w-full rounded-lg border px-1.5 text-xs outline-none", t ? TEMPLATE_TONE[t.color ?? ""] ?? "border-slate-200 bg-slate-50" : v.status ? "border-slate-200 bg-slate-100 text-slate-500" : "border-dashed border-slate-200 text-slate-400", changed && "ring-2 ring-blue-300")}>
                            <option value="">—</option>
                            {templates.map((x) => <option key={x.code} value={x.code}>{x.name} {x.start_time}–{x.end_time}</option>)}
                            {(Object.keys(OTHER) as (keyof typeof OTHER)[]).map((s) => <option key={s} value={`@${s}`}>{OTHER[s]()}</option>)}
                          </select>
                          {(att || c?.started) && !changed && (
                            <div className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-slate-500">
                              {att && <Badge tone={att.tone}>{att.label()}</Badge>}
                              {c?.started && <span className="tabular-nums">{c.started}{c.ended ? `–${c.ended}` : ""}</span>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                    <td className="px-1.5 py-1.5 align-top">
                      <select value="" onChange={(e) => e.target.value !== "#" && fillRow(dr.code, e.target.value)} aria-label={tr("Whole week")} className="h-8 w-full rounded-lg border border-slate-200 px-1.5 text-xs text-slate-500 outline-none">
                        <option value="#">{tr("Fill…")}</option>
                        {templates.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                        <option value="@off">{tr("Off")}</option><option value="">{tr("Clear")}</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {data.drivers.length === 0 && <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400">{tr("No drivers in this pool")}</td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {data && data.drivers.length > 0 && (
        <Panel title={tr("Recap of the week")} description={tr("Days scheduled and worked, on time, late and absent: the reference of the incentives")}>
          <table className="w-full text-sm">
            <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Driver")}</th>
              {[tr("Scheduled"), tr("Worked"), tr("On time"), tr("Late"), tr("Absent"), tr("Off"), tr("Leave"), tr("Sick"), tr("Unscheduled"), tr("Base pay")].map((h) => <th key={h} className="px-3 py-2.5 text-right">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {data.drivers.map((dr) => { const r = recap(dr.code); return (
                <tr key={dr.code}><td className="px-4 py-2">{dr.name}</td>
                  {(["scheduled", "worked", "on_time", "late", "absent", "off", "leave", "sick", "unscheduled"] as const).map((k) => (
                    <td key={k} className={cx("px-3 py-2 text-right tabular-nums", k === "late" && r?.late ? "text-amber-700" : k === "absent" && r?.absent ? "text-red-700" : "")}>{r?.[k] ?? 0}</td>
                  ))}<td className="px-3 py-2 text-right font-semibold tabular-nums">{r?.pay ? rupiah(r.pay) : "—"}</td></tr>
              ); })}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}

function TemplatesView() {
  const master = useMaster<Template>("shift-templates");
  return (
    <MasterTable noun={tr("shift")} title={tr("Shift templates")} master={master}
      description={tr("The working hours of a shift; a check in later than the start plus the tolerance is late")}
      blank={(): Partial<Template> => ({ code: "", name: "", start_time: "06:00", end_time: "14:00", break_min: 60, grace_min: 15, color: "blue", is_active: true, sort: 0 })}
      columns={[
        { label: tr("Shift"), render: (t) => <><span className="block font-medium text-slate-900">{t.name}</span><span className="text-[11px] text-slate-400">{t.code}</span></> },
        { label: tr("Hours"), render: (t) => <span className={cx("rounded-md border px-2 py-0.5 text-xs tabular-nums", TEMPLATE_TONE[t.color ?? ""] ?? "border-slate-200")}>{t.start_time}–{t.end_time}</span> },
        { label: tr("Break"), render: (t) => `${t.break_min} ${tr("min")}` },
        { label: tr("Tolerance"), render: (t) => `${t.grace_min} ${tr("min")}` },
        { label: tr("Day rate"), render: (t) => t.pay_rate != null ? <span className="tabular-nums">{rupiah(Number(t.pay_rate))}</span> : <span className="text-slate-400">—</span> },
        { label: tr("Status"), render: (t) => t.is_active ? <Badge tone="green" dot>{tr("Active")}</Badge> : <Badge tone="slate">{tr("Inactive")}</Badge> },
      ]}
      fields={[
        { key: "code", label: tr("Code"), required: true, placeholder: "PAGI" },
        { key: "name", label: tr("Name"), required: true },
        { key: "start_time", label: tr("Starts"), type: "time", required: true },
        { key: "end_time", label: tr("Ends"), type: "time", required: true },
        { key: "break_min", label: tr("Break (minutes)"), type: "number" },
        { key: "grace_min", label: tr("Late tolerance (minutes)"), type: "number" },
        { key: "pay_rate", label: tr("Day rate (Rp)"), type: "number", hint: tr("Base pay of one day worked on this shift (N 85.000, H 75.000, LS 150.000 on the payroll sheets)") },
        { key: "color", label: tr("Color"), type: "select", options: Object.keys(TEMPLATE_TONE).map((c) => ({ value: c, label: c })) },
        { key: "sort", label: tr("Order"), type: "number" },
        { key: "is_active", label: tr("Active"), type: "bool" },
      ]} />
  );
}
