"use client";

// Monitoring COTR → Master Schedule (page cotr.schedule, backend migration 052): the shift templates and the weekly
// roster of the drivers (a shift, off, leave or sick per day), the attendance against the check in of the driver
// app and a recap per driver — the administrative reference of the incentives.

import { CalendarDays, ChevronLeft, ChevronRight, Copy, Save, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, ErrorState, Page, Panel, Select, Tone, cx, inputClass, theadClass, useToast } from "@/so/ui";
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
type Roster = { from: string; to: string; templates: Template[]; drivers: { code: string; name: string; nickname?: string | null; department?: string | null; pool_code: string | null }[]; cells: Cell[]; recap: Recap[] };
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
  const [today] = useState(() => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10));
  const [week, setWeek] = useState(() => mondayOf(today));
  const [pool, setPool] = useState("");
  const [data, setData] = useState<Roster | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  // phones: one day at a time; desktop: the week grid (both can be switched)
  const [mode, setMode] = useState<"day" | "week">("week");
  useEffect(() => { if (window.matchMedia("(max-width: 1023.98px)").matches) setMode("day"); }, []);
  const [day, setDay] = useState(today);
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(week, i)), [week]);
  const shownDay = days.includes(day) ? day : days[0];

  useEffect(() => {
    let alive = true;
    setError(null);
    call<Roster>(`/api/cotr/schedule?dateFrom=${week}&dateTo=${addDays(week, 6)}${pool ? `&pool=${encodeURIComponent(pool)}` : ""}`)
      .then((d) => { if (alive) { setData(d); setEdits({}); } }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [week, pool, tick]);

  const cellOf = (driver: string, d: string) => data?.cells.find((c) => c.driver === driver && c.day === d);
  const valueOf = (driver: string, d: string): Edit => edits[`${driver}|${d}`] ?? { status: cellOf(driver, d)?.status ?? null, template: cellOf(driver, d)?.template ?? null };
  const keyOf = (e: Edit) => (e.status === "work" ? e.template ?? "" : e.status ? `@${e.status}` : "");
  const setCell = (driver: string, d: string, v: string) => {
    const e: Edit = v === "" ? { status: null, template: null } : v.startsWith("@") ? { status: v.slice(1) as Status, template: null } : { status: "work", template: v };
    setEdits((x) => ({ ...x, [`${driver}|${d}`]: e }));
  };
  const dirty = Object.keys(edits).length;
  const departments = useMemo(() => [...new Set((data?.drivers ?? []).map((d) => d.department).filter(Boolean) as string[])].sort(), [data]);
  const people = useMemo(() => (data?.drivers ?? []).filter((d) => (!dept || d.department === dept)
    && (!q || `${d.name} ${d.nickname ?? ""} ${d.code}`.toLowerCase().includes(q.toLowerCase()))), [data, dept, q]);

  const save = async () => {
    setBusy(true);
    try {
      const entries = Object.entries(edits).map(([k, e]) => { const [driver, d] = k.split("|"); return { driver, day: d, status: e.status, template: e.template, pool: data?.drivers.find((x) => x.code === driver)?.pool_code ?? null }; });
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
  const choices = [...templates.map((t) => ({ key: t.code, label: t.code, title: `${t.name} ${t.start_time}–${t.end_time}`, tone: TEMPLATE_TONE[t.color ?? ""] ?? "bg-slate-50 text-slate-700 border-slate-200" })),
    ...(Object.keys(OTHER) as (keyof typeof OTHER)[]).map((s) => ({ key: `@${s}`, label: OTHER[s](), title: OTHER[s](), tone: "bg-slate-100 text-slate-600 border-slate-200" }))];
  const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions) => new Date(`${d}T00:00:00Z`).toLocaleDateString(locale(), { ...opts, timeZone: "UTC" });
  const filled = (d: string) => people.filter((p) => valueOf(p.code, d).status).length;
  const recap = (code: string) => data?.recap.find((r) => r.driver === code);
  const sum = data ? people.reduce((a, p) => { const r = recap(p.code); return { scheduled: a.scheduled + (r?.scheduled ?? 0), worked: a.worked + (r?.worked ?? 0), late: a.late + (r?.late ?? 0), pay: a.pay + (r?.pay ?? 0) }; }, { scheduled: 0, worked: 0, late: 0, pay: 0 }) : null;

  return (
    <>
      <Panel title={tr("Roster")} description={tr("Choose a shift, off, leave or sick for every person and day; the attendance follows the check in of the driver app")}
        actions={<Button size="sm" variant="secondary" disabled={busy} onClick={() => void copyLastWeek()}><Copy size={14} /> <span className="hidden sm:inline">{tr("Copy last week")}</span></Button>}
        toolbar={
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center rounded-xl border border-slate-200 bg-white">
                <button type="button" aria-label={tr("Previous week")} onClick={() => setWeek(addDays(week, -7))} className="rounded-l-xl p-2.5 text-slate-500 hover:bg-slate-50"><ChevronLeft size={16} /></button>
                <span className="min-w-[9.5rem] px-1 text-center text-sm font-semibold tabular-nums text-slate-800">{dayLabel(week, { day: "numeric", month: "short" })} – {dayLabel(addDays(week, 6), { day: "numeric", month: "short" })}</span>
                <button type="button" aria-label={tr("Next week")} onClick={() => setWeek(addDays(week, 7))} className="rounded-r-xl p-2.5 text-slate-500 hover:bg-slate-50"><ChevronRight size={16} /></button>
              </div>
              {week !== mondayOf(today) && <Button size="sm" variant="ghost" onClick={() => { setWeek(mondayOf(today)); setDay(today); }}>{tr("This week")}</Button>}
              <Select value={pool} onChange={(e) => setPool(e.target.value)} aria-label={tr("Pool / HUB")} className="h-10 w-auto min-w-[10rem] flex-1 sm:flex-none">
                <option value="">{tr("All pools")}</option>{(pools.rows ?? []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
              </Select>
              <div role="radiogroup" aria-label={tr("View")} className="ml-auto flex rounded-xl bg-slate-100 p-1">
                {(["day", "week"] as const).map((m) => (
                  <button key={m} type="button" role="radio" aria-checked={mode === m} onClick={() => setMode(m)}
                    className={cx("rounded-lg px-3 py-1.5 text-xs font-semibold", mode === m ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>
                    {m === "day" ? tr("Per day") : tr("Weekly")}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-0 flex-1 basis-48">
                <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search name or nickname")} className={cx(inputClass, "h-10 pl-9")} />
              </div>
              {departments.length > 1 && (
                <Select value={dept} onChange={(e) => setDept(e.target.value)} aria-label={tr("Department")} className="h-10 w-auto">
                  <option value="">{tr("All departments")}</option>{departments.map((d) => <option key={d} value={d}>{d}</option>)}
                </Select>
              )}
            </div>
          </div>
        }>
        {error ? <ErrorState message={error} onRetry={() => setTick((t) => t + 1)} /> : !data ? <div className="skeleton m-4 h-40 rounded-xl" /> : people.length === 0 ? (
          <Empty icon={<CalendarDays size={26} />} title={data.drivers.length ? tr("No one matches") : tr("No drivers in this pool")} />
        ) : mode === "day" ? (
          <div>
            {/* the days of the week: tap one to fill it */}
            <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-3 py-3 [scrollbar-width:none]">
              {days.map((d) => {
                const on = d === shownDay;
                const n = filled(d);
                return (
                  <button key={d} type="button" onClick={() => setDay(d)} aria-pressed={on}
                    className={cx("flex min-w-[3.6rem] flex-shrink-0 flex-col items-center rounded-xl border px-2 py-1.5",
                      on ? "border-blue-600 bg-blue-600 text-white" : d === today ? "border-blue-200 bg-blue-50 text-blue-800" : "border-slate-200 bg-white text-slate-700")}>
                    <span className="text-[10px] font-semibold uppercase">{dayLabel(d, { weekday: "short" })}</span>
                    <span className="text-lg font-bold leading-tight tabular-nums">{dayLabel(d, { day: "numeric" })}</span>
                    <span className={cx("text-[10px] tabular-nums", on ? "text-white/80" : "text-slate-400")}>{n}/{people.length}</span>
                  </button>
                );
              })}
            </div>
            <ul className="divide-y divide-slate-100">
              {people.map((p) => {
                const v = valueOf(p.code, shownDay);
                const c = cellOf(p.code, shownDay);
                const att = c ? ATT[c.attendance] : null;
                const changed = `${p.code}|${shownDay}` in edits;
                return (
                  <li key={p.code} className={cx("px-4 py-3", changed && "bg-blue-50/40")}>
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">{initials(p.nickname || p.name)}</span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                        <p className="truncate text-[11px] text-slate-500">{[p.nickname, p.department, p.pool_code].filter(Boolean).join(" · ")}</p>
                      </div>
                      {att && !changed && <Badge tone={att.tone}>{att.label()}{c?.started ? ` ${c.started}` : ""}</Badge>}
                    </div>
                    <div className="mt-2 flex gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none]">
                      {choices.map((o) => {
                        const on = keyOf(v) === o.key;
                        return (
                          <button key={o.key} type="button" title={o.title} onClick={() => setCell(p.code, shownDay, on ? "" : o.key)}
                            className={cx("h-9 min-w-[3rem] flex-shrink-0 rounded-lg border px-2.5 text-xs font-semibold transition",
                              on ? cx(o.tone, "ring-2 ring-blue-600") : "border-slate-200 bg-white text-slate-500 hover:border-slate-300")}>{o.label}</button>
                        );
                      })}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className={theadClass}>
                <tr><th className="sticky left-0 z-[1] bg-slate-50 px-3 py-2">{tr("Name")}</th>
                  {days.map((d) => <th key={d} className={cx("px-2 py-2 text-center", d === today && "bg-blue-50 text-blue-800")}>{dayLabel(d, { weekday: "short", day: "numeric" })}</th>)}
                  <th className="px-2 py-2 text-center">{tr("Whole week")}</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {people.map((p) => (
                  <tr key={p.code}>
                    <td className="sticky left-0 z-[1] bg-white px-3 py-2"><span className="block font-medium text-slate-900">{p.name}</span><span className="text-[11px] text-slate-400">{[p.nickname, p.department].filter(Boolean).join(" · ") || p.code}</span></td>
                    {days.map((d) => {
                      const v = valueOf(p.code, d);
                      const c = cellOf(p.code, d);
                      const t = templates.find((x) => x.code === v.template);
                      const att = c ? ATT[c.attendance] : null;
                      const changed = `${p.code}|${d}` in edits;
                      return (
                        <td key={d} className={cx("px-1.5 py-1.5 align-top", d === today && "bg-blue-50/40")}>
                          <select value={keyOf(v)} onChange={(e) => setCell(p.code, d, e.target.value)} aria-label={`${p.name} ${d}`}
                            className={cx("h-8 w-full rounded-lg border px-1.5 text-xs font-semibold outline-none", t ? TEMPLATE_TONE[t.color ?? ""] ?? "border-slate-200 bg-slate-50" : v.status ? "border-slate-200 bg-slate-100 text-slate-500" : "border-dashed border-slate-200 text-slate-400", changed && "ring-2 ring-blue-300")}>
                            <option value="">—</option>
                            {templates.map((x) => <option key={x.code} value={x.code}>{x.code} · {x.start_time}–{x.end_time}</option>)}
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
                      <select value="" onChange={(e) => e.target.value !== "#" && days.forEach((d) => setCell(p.code, d, e.target.value))} aria-label={tr("Whole week")} className="h-8 w-full rounded-lg border border-slate-200 px-1.5 text-xs text-slate-500 outline-none">
                        <option value="#">{tr("Fill…")}</option>
                        {templates.map((x) => <option key={x.code} value={x.code}>{x.code} · {x.name}</option>)}
                        <option value="@off">{tr("Off")}</option><option value="">{tr("Clear")}</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {/* the legend of the shifts */}
        {templates.length > 0 && (
          <div className="flex flex-wrap gap-1.5 border-t border-slate-100 px-4 py-2.5 text-[11px] text-slate-500">
            {templates.map((t) => <span key={t.code} className={cx("rounded-md border px-1.5 py-0.5", TEMPLATE_TONE[t.color ?? ""] ?? "border-slate-200")}><b>{t.code}</b> {t.name} {t.start_time}–{t.end_time}{t.pay_rate != null ? ` · ${rupiah(Number(t.pay_rate))}` : ""}</span>)}
          </div>
        )}
      </Panel>

      {dirty > 0 && (
        <div className="action-bar sticky bottom-0 z-20 -mx-4 -mb-4 flex items-center gap-3 border-t border-slate-200 bg-white/95 px-4 pt-3 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <p className="min-w-0 flex-1 text-xs text-slate-600">{tr("{0} changes not saved yet", dirty)}</p>
          <Button variant="ghost" size="sm" onClick={() => setEdits({})}>{tr("Undo")}</Button>
          <Button loading={busy} onClick={() => void save()}><Save size={15} /> {tr("Save ({0})", dirty)}</Button>
        </div>
      )}

      {data && people.length > 0 && sum && (
        <Panel title={tr("Recap of the week")} description={tr("Days scheduled and worked, on time, late and absent, base pay: the reference of the incentives")}>
          <div className="grid grid-cols-2 gap-px border-b border-slate-100 bg-slate-100 sm:grid-cols-4">
            {([[tr("Scheduled"), sum.scheduled], [tr("Worked"), sum.worked], [tr("Late"), sum.late], [tr("Base pay"), rupiah(sum.pay)]] as [string, string | number][]).map(([k, v]) => (
              <div key={k} className="bg-white px-4 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{k}</p><p className="text-lg font-semibold tabular-nums text-slate-900">{v}</p></div>
            ))}
          </div>
          <table className="m-cards w-full text-sm">
            <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Name")}</th>
              {[tr("Scheduled"), tr("Worked"), tr("On time"), tr("Late"), tr("Absent"), tr("Off"), tr("Leave"), tr("Sick"), tr("Base pay")].map((h) => <th key={h} className="px-3 py-2.5 text-right">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100">
              {people.map((p) => { const r = recap(p.code); return (
                <tr key={p.code}><td className="px-4 py-2"><span className="font-medium text-slate-900">{p.name}</span>{p.department && <span className="block text-[11px] text-slate-400">{p.department}</span>}</td>
                  {(["scheduled", "worked", "on_time", "late", "absent", "off", "leave", "sick"] as const).map((k) => (
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

const initials = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

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
