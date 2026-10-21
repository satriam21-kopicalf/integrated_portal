"use client";

// Monitoring → Damaged Equipment (page mon.damaged-equipment): every request sent by the PICs for the Maintenance /
// procurement team. Status tabs and the Filters sheet narrow the table; the list can be grouped per branch or per PIC so
// the team sees at once what one outlet / PIC already asked. A request opens in a drawer: the PIC's data, the steps and
// time per stage, and the actions (next status with a note, technicians: assign / release / move to a priority request,
// cost, photos of the work done, notes, duplicate of another request). Technicians and categories are kept here too.

import { AlertTriangle, Boxes, Camera, ChevronDown, ChevronRight, Clock, Hammer, Plus, Save, Shuffle, Tags, Users, Wrench, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, Field, Input, Page, Panel, SkeletonRows, fmtNumber, inputClass, theadClass, useToast, PageNav, usePaged } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar, Period, PeriodField, SearchChoice, dmy, wibDay } from "@/so/ui/Filters";
import { FormCard, Segmented, Switch } from "@/so/ui/Simple";
import CameraCapture, { type Shot } from "@/so/features/count/CameraCapture";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import RequestView, { StatusBadge, UrgencyBadge } from "./RequestView";
import { DocActions } from "./DeForm";
import { type Category, type Request, type Status, type Technician, type Urgency, OPEN, PORTAL_URLS, STATUS_LABEL, URGENCIES, URGENCY_LABEL, fmtHours } from "./de";

type Result = { period: { from: string; to: string }; data: Request[]; categories: Category[]; technicians: Technician[] };
type F = { period: Period; kind: string; urgency: string; group: string; tech: string; overdue: boolean; by: "none" | "branch" | "pic" };
const NO_F = (): F => ({ period: { from: wibDay(-89), to: wibDay(0) }, kind: "", urgency: "", group: "", tech: "", overdue: false, by: "branch" });
const TABS: (Status | "")[] = ["", "PENDING", "VALIDATION", "REVIEW", "ON_HOLD", "ACCEPTED", "IN_PROGRESS", "DONE", "REJECTED"];
const OPEN_SET = new Set<Status>(OPEN);
const urgRank = (u: Urgency) => URGENCIES.indexOf(u);

export default function DeMonitor() {
  const [f, setF] = useState<F>(NO_F);
  const [status, setStatus] = useState<Status | "" | "OPEN">("OPEN");
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [masters, setMasters] = useState<"tech" | "cat" | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRes(await call<Result>(`/api/de/monitor?dateFrom=${f.period.from}&dateTo=${f.period.to}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [f.period]);
  useEffect(() => { void load(); }, [load]);

  const all = useMemo(() => res?.data ?? [], [res]);
  const base = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((r) => (!f.kind || r.kind === f.kind) && (!f.urgency || r.urgency === f.urgency) && (!f.overdue || r.tracker?.overdue)
      && (!f.group || (r.items ?? []).some((i) => i.group === f.group)) && (!f.tech || (r.technicians ?? []).includes(f.tech))
      && (!s || `${r.number} ${r.branchName} ${r.picName} ${(r.items ?? []).map((i) => i.name).join(" ")}`.toLowerCase().includes(s)));
  }, [all, f, search]);
  const count = (st: Status | "" | "OPEN") => base.filter((r) => !st || (st === "OPEN" ? OPEN_SET.has(r.status) : r.status === st)).length;
  const rows = useMemo(() => base.filter((r) => !status || (status === "OPEN" ? OPEN_SET.has(r.status) : r.status === status))
    .sort((a, b) => (OPEN_SET.has(b.status) ? 1 : 0) - (OPEN_SET.has(a.status) ? 1 : 0) || urgRank(a.urgency) - urgRank(b.urgency)
      || (a.submittedAt ?? "").localeCompare(b.submittedAt ?? "")), [base, status]);
  const paged = usePaged(rows, rows.length + search + JSON.stringify(f) + status);
  const openRows = all.filter((r) => OPEN_SET.has(r.status));
  const done = all.filter((r) => r.status === "DONE");
  const avgDone = done.length ? done.reduce((a, r) => a + (r.tracker?.workHours ?? 0), 0) / done.length : null;
  const groups = useMemo(() => [...new Set((res?.categories ?? []).map((c) => c.group))], [res]);

  const def = NO_F();
  const chips: ActiveFilter[] = [
    ...(f.period.from !== def.period.from || f.period.to !== def.period.to ? [{ key: "p", label: `${dmy(f.period.from)} – ${dmy(f.period.to)}`, onRemove: () => setF({ ...f, period: def.period }) }] : []),
    ...(f.kind ? [{ key: "k", label: f.kind === "REPAIR" ? tr("Repair") : tr("Procurement"), onRemove: () => setF({ ...f, kind: "" }) }] : []),
    ...(f.urgency ? [{ key: "u", label: URGENCY_LABEL[f.urgency as Urgency](), onRemove: () => setF({ ...f, urgency: "" }) }] : []),
    ...(f.group ? [{ key: "g", label: f.group, onRemove: () => setF({ ...f, group: "" }) }] : []),
    ...(f.tech ? [{ key: "t", label: f.tech, onRemove: () => setF({ ...f, tech: "" }) }] : []),
    ...(f.overdue ? [{ key: "o", label: tr("Past target"), onRemove: () => setF({ ...f, overdue: false }) }] : []),
  ];

  // grouped per branch / PIC: open requests first, the group with the most urgent request on top
  const grouped = useMemo(() => {
    if (f.by === "none") return null;
    const m = new Map<string, { key: string; title: string; sub: string; rows: Request[] }>();
    for (const r of rows) {
      const key = f.by === "branch" ? r.branchCode : r.username;
      const g = m.get(key) ?? { key, title: f.by === "branch" ? r.branchName : r.picName, sub: f.by === "branch" ? r.branchCode : `@${r.username}`, rows: [] };
      g.rows.push(r);
      m.set(key, g);
    }
    return [...m.values()].sort((a, b) => urgRank(a.rows[0].urgency) - urgRank(b.rows[0].urgency) || b.rows.length - a.rows.length);
  }, [rows, f.by]);

  return (
    <Page title={tr("Monitoring Damaged Equipment")} subtitle={`${dmy(f.period.from)} – ${dmy(f.period.to)} · ${tr("repair & procurement requests of every outlet")}`}
      actions={<div className="flex flex-wrap gap-2">
        <Button variant="secondary" onClick={() => setMasters("tech")}><Users size={16} /> {tr("Technicians")}</Button>
        <Button variant="secondary" onClick={() => setMasters("cat")}><Tags size={16} /> {tr("Categories")}</Button>
      </div>}
      stats={
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
          <Stat label={tr("Open")} emphasis icon={<Wrench size={13} />} value={res ? fmtNumber(openRows.length) : <StatSkeleton />}>
            {res && <p>{tr("{0} pending · {1} in progress", fmtNumber(openRows.filter((r) => r.status === "PENDING").length), fmtNumber(openRows.filter((r) => r.status === "IN_PROGRESS").length))}</p>}
          </Stat>
          <Stat label={tr("Critical")} icon={<AlertTriangle size={13} />} value={res ? <span className={openRows.some((r) => r.urgency === "CRITICAL") ? "text-red-600" : undefined}>{fmtNumber(openRows.filter((r) => r.urgency === "CRITICAL").length)}</span> : <StatSkeleton />}>
            {res && <p>{tr("open, operations affected")}</p>}
          </Stat>
          <Stat label={tr("Past target")} icon={<Clock size={13} />} onClick={res ? () => setF({ ...f, overdue: !f.overdue }) : undefined} active={f.overdue}
            value={res ? fmtNumber(openRows.filter((r) => r.tracker?.overdue).length) : <StatSkeleton />}>
            {res && <p>{tr("open longer than the urgency target")}</p>}
          </Stat>
          <Stat label={tr("Done")} icon={<Hammer size={13} />} value={res ? fmtNumber(done.length) : <StatSkeleton />}>
            {res && <p>{avgDone === null ? tr("in the period") : tr("average {0} to finish", fmtHours(avgDone))}</p>}
          </Stat>
        </StatStrip>
      }>
      <Panel toolbar={<>
        <div className="-mx-1 flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label={tr("Status")}>
          {(["OPEN", ...TABS] as (Status | "" | "OPEN")[]).map((t) => {
            const on = status === t;
            return (
              <button key={t || "all"} type="button" role="tab" aria-selected={on} onClick={() => setStatus(t)}
                className={cx("inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors", on ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100")}>
                {t === "OPEN" ? tr("Open") : t ? STATUS_LABEL[t]() : tr("All")}
                <span className={cx("tabular-nums", on ? "text-white/80" : "font-semibold text-slate-900")}>{fmtNumber(count(t))}</span>
              </button>
            );
          })}
        </div>
        <FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search number, outlet, PIC or item")} filters={chips}
          onOpen={() => setSheet(true)} onClear={() => setF({ ...NO_F(), by: f.by })}
          extra={<Segmented label={tr("Group")} value={f.by} onChange={(by) => setF({ ...f, by })}
            options={[{ value: "branch", label: tr("Per branch") }, { value: "pic", label: tr("Per PIC") }, { value: "none", label: tr("List") }]} />} />
      </>}
        footer={res && !grouped ? <><span>{tr("{0} of {1} shown", fmtNumber(rows.length), fmtNumber(all.length))}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : res && rows.length === 0 ? (
          <Empty icon={<Wrench size={28} />} title={all.length ? tr("Nothing matches the search or filters") : tr("No request yet")}>
            {!all.length && tr("Requests appear here as soon as the PICs send them from Form → Damaged Equipment.")}
          </Empty>
        ) : !res ? <table className="w-full"><tbody><SkeletonRows cols={6} /></tbody></table> : grouped ? (
          <ul className="divide-y divide-slate-200">
            {grouped.map((g) => <Group key={g.key} g={g} onOpen={setOpen} />)}
          </ul>
        ) : <RequestTable rows={paged.rows} onOpen={setOpen} />}
      </Panel>

      {sheet && <MonitorFilters value={f} groups={groups} technicians={(res?.technicians ?? []).map((t) => t.name)} onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
      {open && res && <TeamDrawer id={open} technicians={res.technicians} all={all} onOpen={setOpen} onClose={() => setOpen(null)} onChanged={load} />}
      {masters === "tech" && <TechniciansDrawer groups={groups} onClose={() => { setMasters(null); void load(); }} />}
      {masters === "cat" && <CategoriesDrawer onClose={() => { setMasters(null); void load(); }} />}
    </Page>
  );
}

function Group({ g, onOpen }: { g: { key: string; title: string; sub: string; rows: Request[] }; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  const live = g.rows.filter((r) => OPEN_SET.has(r.status)).length;
  return (
    <li>
      <button type="button" onClick={() => setOpen(!open)} className="flex w-full items-center gap-3 bg-slate-50/70 px-4 py-2.5 text-left hover:bg-slate-100/70">
        {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{g.title}</span>
          <span className="text-[11px] text-slate-500">{g.sub}</span></span>
        {live > 0 && <Badge tone="blue">{tr("{0} open", live)}</Badge>}
        <span className="text-xs tabular-nums text-slate-500">{tr("{0} requests", g.rows.length)}</span>
      </button>
      {open && <RequestTable rows={g.rows} onOpen={onOpen} />}
    </li>
  );
}

function RequestTable({ rows, onOpen }: { rows: Request[]; onOpen: (id: string) => void }) {
  return (
    <>
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((r) => (
          <li key={r.id}>
            <button type="button" onClick={() => onOpen(r.id)} className="w-full px-4 py-3 text-left hover:bg-slate-50">
              <span className="flex flex-wrap items-center gap-1.5"><span className="font-mono text-xs font-semibold text-slate-500">{r.number}</span><StatusBadge r={r} /><UrgencyBadge u={r.urgency} /></span>
              <span className="mt-1 block truncate text-sm font-medium text-slate-900">{r.branchName}</span>
              <span className="block truncate text-xs text-slate-500">{(r.items ?? []).map((i) => i.name).join(", ")}</span>
              <span className="mt-1 block text-[11px] text-slate-400">{r.picName} · {wibDateTime(r.submittedAt)}{r.tracker?.overdue ? ` · ${tr("past target")}` : ""}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[980px] text-sm">
          <thead className={theadClass}>
            <tr>
              <th className="px-4 py-2.5">{tr("Request")}</th><th className="px-4 py-2.5">{tr("Outlet & PIC")}</th><th className="px-4 py-2.5">{tr("Items")}</th>
              <th className="px-4 py-2.5">{tr("Status")}</th><th className="px-4 py-2.5">{tr("Time")}</th><th className="px-4 py-2.5">{tr("Technician")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} onClick={() => onOpen(r.id)} className="cursor-pointer hover:bg-slate-50/70">
                <td className="whitespace-nowrap px-4 py-2.5">
                  <span className="block font-mono text-xs font-semibold text-slate-700">{r.number}</span>
                  <span className="text-[11px] text-slate-500">{r.kind === "REPAIR" ? tr("Repair") : tr("Procurement")} · {wibDateTime(r.submittedAt)}</span>
                </td>
                <td className="max-w-[14rem] px-4 py-2.5"><span className="block truncate font-medium text-slate-900">{r.branchName}</span><span className="block truncate text-xs text-slate-500">{r.picName}</span></td>
                <td className="max-w-[16rem] px-4 py-2.5">
                  <span className="block truncate text-slate-800">{(r.items ?? []).map((i) => i.name).join(", ")}</span>
                  <span className="block truncate text-[11px] text-slate-500">{[...new Set((r.items ?? []).map((i) => i.category))].join(" · ")}</span>
                </td>
                <td className="px-4 py-2.5"><span className="flex flex-wrap gap-1"><StatusBadge r={r} /><UrgencyBadge u={r.urgency} /></span>
                  <span className="mt-1 block h-1 w-32 overflow-hidden rounded-full bg-slate-100"><span className={cx("block h-full rounded-full", r.status === "REJECTED" ? "bg-red-500" : r.status === "DONE" ? "bg-emerald-500" : "bg-blue-600")} style={{ width: `${r.status === "REJECTED" ? 100 : r.tracker?.progress ?? 0}%` }} /></span></td>
                <td className="whitespace-nowrap px-4 py-2.5 text-xs">
                  <span className={cx("block font-medium tabular-nums", r.tracker?.overdue ? "text-red-600" : "text-slate-800")}>{fmtHours(r.tracker?.workHours)}</span>
                  <span className="text-slate-400">{r.tracker?.slaHours ? tr("target {0}", fmtHours(r.tracker.slaHours)) : "—"}</span>
                </td>
                <td className="max-w-[10rem] px-4 py-2.5 text-xs text-slate-600"><span className="block truncate">{(r.technicians ?? []).join(", ") || "—"}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function MonitorFilters({ value, groups, technicians, onApply, onClose }: { value: F; groups: string[]; technicians: string[]; onApply: (v: F) => void; onClose: () => void }) {
  const [d, setD] = useState(value);
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD({ ...NO_F(), by: d.by })}>
      <FilterSection title={tr("Sent in")} hint={tr("Open requests are always shown")}><PeriodField value={d.period} onChange={(period) => setD({ ...d, period })} maxDays={366} /></FilterSection>
      <FilterSection title={tr("Type")}>
        <ChoiceGroup label="" value={d.kind} onChange={(v) => setD({ ...d, kind: v })}
          choices={[{ value: "", label: tr("All") }, { value: "REPAIR", label: tr("Repair") }, { value: "PROCUREMENT", label: tr("Procurement") }]} />
      </FilterSection>
      <FilterSection title={tr("Urgency")}>
        <ChoiceGroup label="" value={d.urgency} onChange={(v) => setD({ ...d, urgency: v })}
          choices={[{ value: "", label: tr("All") }, ...URGENCIES.map((u) => ({ value: u, label: URGENCY_LABEL[u]() }))]} />
      </FilterSection>
      <FilterSection title={tr("Category group")}>
        <ChoiceGroup label="" value={d.group} onChange={(v) => setD({ ...d, group: v })} choices={[{ value: "", label: tr("All") }, ...groups.map((g) => ({ value: g, label: g }))]} />
      </FilterSection>
      {technicians.length > 0 && (
        <FilterSection title={tr("Technician")}>
          <SearchChoice label="" anyLabel={tr("All technicians")} value={d.tech} onChange={(v) => setD({ ...d, tech: v })} placeholder={tr("Search technician")}
            options={technicians.map((t) => ({ value: t, label: t }))} />
        </FilterSection>
      )}
      <FilterSection title={tr("Target time")}>
        <Switch checked={d.overdue} onChange={(v) => setD({ ...d, overdue: v })} label={tr("Only requests past their target")} />
      </FilterSection>
    </FilterSheet>
  );
}

// ------------------------------------------------------------------------------------------------- one request (team)

function TeamDrawer({ id, technicians, all, onOpen, onClose, onChanged }: {
  id: string; technicians: Technician[]; all: Request[]; onOpen: (id: string) => void; onClose: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const [r, setR] = useState<Request | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [assign, setAssign] = useState({ technicianId: "", scheduledFor: "", note: "" });
  const [swap, setSwap] = useState<{ assignmentId: number; to: string; scheduledFor: string; note: string } | null>(null);
  const [release, setRelease] = useState<{ assignmentId: number; note: string } | null>(null);
  const [cost, setCost] = useState({ est: "", actual: "", vendor: "" });
  const [dup, setDup] = useState({ of: "", note: "" });
  const [camera, setCamera] = useState(false);

  const load = useCallback(async () => {
    try {
      const out = await call<Request>(`/api/de/monitor/${id}`);
      setR(out);
      setCost({ est: out.estCost?.toString() ?? "", actual: out.actualCost?.toString() ?? "", vendor: out.vendor ?? "" });
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);
  useEffect(() => { void load(); }, [load]);

  const act = async (path: string, json: unknown, ok: string, method = "POST") => {
    setBusy(true);
    try {
      const out = await call<Request>(path, { method, json });
      setR(out);
      toast(ok);
      onChanged();
      return true;
    } catch (e) {
      toast((e as Error).message, "error");
      return false;
    } finally {
      setBusy(false);
    }
  };
  const go = async (to: Status) => {
    if (await act(`/api/de/monitor/${id}/status`, { to, note: note || null }, tr("Status: {0}", STATUS_LABEL[to]()))) setNote("");
  };
  const addAfter = async (shot: Shot) => {
    try {
      await call(`/api/de/monitor/${id}/after-photos`, { method: "POST", json: { photo: shot.image, latitude: shot.lat, longitude: shot.lng, takenAt: shot.taken_at } });
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
      throw e;
    }
  };

  const active = (r?.assignments ?? []).filter((a) => a.status === "ACTIVE");
  const targets = all.filter((x) => x.id !== id && ["REVIEW", "ACCEPTED", "IN_PROGRESS", "ON_HOLD"].includes(x.status));
  const closed = r ? !OPEN_SET.has(r.status) : true;
  const noteNeeded = (to: Status) => to === "ON_HOLD" || to === "REJECTED";

  return (
    <Drawer open onClose={onClose} size="xl" icon={<Wrench size={18} />} title={r ? `${r.number} · ${r.branchName}` : tr("Request")}
      description={r ? `${r.kindLabel} · ${r.picName}` : undefined} focusFirstField={false} footer={r ? <DocActions r={r} /> : undefined}>
      {error ? <ErrorState message={error} /> : !r ? <div className="skeleton h-72 rounded-xl" /> : (
        <RequestView r={r} urls={PORTAL_URLS}>
          {!closed && (
            <FormCard title={tr("Next step")} hint={tr("A note is required to put on hold or reject; the PIC sees every note")}>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder={tr("Note / reason for the PIC")}
                className={cx(inputClass, "h-auto py-2 text-sm")} aria-label={tr("Note")} />
              <div className="flex flex-wrap gap-2">
                {(r.allowed ?? []).map((to) => (
                  <Button key={to} size="sm" variant={to === "REJECTED" ? "danger" : to === "ON_HOLD" ? "secondary" : "primary"} disabled={busy || (noteNeeded(to) && !note.trim())}
                    onClick={() => void go(to)}>{r.status === "ON_HOLD" && to === r.holdFrom ? tr("Resume: {0}", STATUS_LABEL[to]()) : STATUS_LABEL[to]()}</Button>
                ))}
                <Button size="sm" variant="ghost" disabled={busy || !note.trim()} onClick={async () => { if (await act(`/api/de/monitor/${id}/notes`, { note }, tr("Note added"))) setNote(""); }}>{tr("Note only")}</Button>
              </div>
            </FormCard>
          )}

          {!closed && (
            <FormCard title={tr("Technicians")} hint={tr("Assign after review; move a technician to a request that needs them first, with the reason")}>
              {active.length > 0 && (
                <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                  {active.map((a) => (
                    <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                      <span className="min-w-0 flex-1"><span className="block font-medium text-slate-900">{a.name}</span>
                        <span className="text-xs text-slate-500">{a.phone ?? ""}{a.scheduledFor ? ` · ${tr("scheduled {0}", a.scheduledFor)}` : ""}</span></span>
                      <Button size="sm" variant="secondary" onClick={() => setSwap({ assignmentId: a.id, to: "", scheduledFor: "", note: "" })}><Shuffle size={13} /> {tr("Move")}</Button>
                      <Button size="sm" variant="ghost" onClick={() => setRelease({ assignmentId: a.id, note: "" })}>{tr("Release")}</Button>
                    </li>
                  ))}
                </ul>
              )}
              {["REVIEW", "ACCEPTED", "IN_PROGRESS", "ON_HOLD"].includes(r.status) ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_9rem]">
                  <select value={assign.technicianId} onChange={(e) => setAssign({ ...assign, technicianId: e.target.value })} className={cx(inputClass, "h-10 text-sm")} aria-label={tr("Technician")}>
                    <option value="">{tr("Choose a technician")}</option>
                    {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}{t.kind === "VENDOR" && t.company ? ` (${t.company})` : ""} · {tr("{0} active jobs", t.activeJobs)}</option>)}
                  </select>
                  <input type="date" value={assign.scheduledFor} onChange={(e) => setAssign({ ...assign, scheduledFor: e.target.value })} className={cx(inputClass, "h-10 text-sm")} aria-label={tr("Scheduled for")} />
                  <input value={assign.note} onChange={(e) => setAssign({ ...assign, note: e.target.value })} maxLength={500} placeholder={tr("Note (optional)")} className={cx(inputClass, "h-10 text-sm sm:col-span-2")} />
                  <Button size="sm" className="sm:col-span-2 sm:justify-self-start" disabled={busy || !assign.technicianId}
                    onClick={async () => { if (await act(`/api/de/monitor/${id}/assignments`, { technicianId: Number(assign.technicianId), scheduledFor: assign.scheduledFor || null, note: assign.note || null }, tr("Technician assigned"))) setAssign({ technicianId: "", scheduledFor: "", note: "" }); }}>
                    <Plus size={14} /> {tr("Assign")}</Button>
                </div>
              ) : <p className="text-xs text-slate-500">{tr("Technicians are assigned once the request is in review.")}</p>}
              {technicians.length === 0 && <p className="text-xs text-amber-700">{tr("No technician yet: add them with the Technicians button.")}</p>}
            </FormCard>
          )}

          {["ACCEPTED", "IN_PROGRESS", "DONE"].includes(r.status) && (
            <FormCard title={tr("Photos of the work done")} hint={tr("At least one before Done")}>
              <Button size="sm" variant="secondary" onClick={() => setCamera(true)}><Camera size={14} /> {tr("Take photo")}</Button>
            </FormCard>
          )}

          <FormCard title={tr("Cost")} hint={tr("Estimate, actual and vendor (optional)")}>
            <div className="grid gap-2 sm:grid-cols-3">
              <Input inputMode="numeric" value={cost.est} onChange={(e) => setCost({ ...cost, est: e.target.value.replace(/[^0-9]/g, "") })} placeholder={tr("Estimated (Rp)")} aria-label={tr("Estimated cost")} />
              <Input inputMode="numeric" value={cost.actual} onChange={(e) => setCost({ ...cost, actual: e.target.value.replace(/[^0-9]/g, "") })} placeholder={tr("Actual (Rp)")} aria-label={tr("Actual cost")} />
              <Input value={cost.vendor} onChange={(e) => setCost({ ...cost, vendor: e.target.value })} maxLength={120} placeholder={tr("Vendor")} aria-label={tr("Vendor")} />
            </div>
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void act(`/api/de/monitor/${id}/cost`, { estCost: cost.est ? Number(cost.est) : null, actualCost: cost.actual ? Number(cost.actual) : null, vendor: cost.vendor || null }, tr("Cost saved"), "PUT")}>
              <Save size={14} /> {tr("Save cost")}</Button>
          </FormCard>

          {(r.related ?? []).length > 0 && (
            <FormCard title={tr("Other requests of this outlet / PIC ({0})", r.related!.length)} hint={tr("Check for double requests; mark this one as a duplicate if needed")}>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {r.related!.map((o) => (
                  <li key={o.id}>
                    <button type="button" onClick={() => onOpen(o.id)} className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-slate-50">
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-center gap-1.5 text-xs"><span className="font-mono font-semibold text-slate-600">{o.number}</span><StatusBadge r={o} /><span className="text-slate-500">{o.picName} · {wibDateTime(o.submittedAt)}</span></span>
                        <span className="mt-0.5 block truncate text-sm text-slate-800">{(o.items ?? []).map((i) => i.name).join(", ")}</span>
                      </span>
                      <ChevronRight size={15} className="mt-1 text-slate-300" />
                    </button>
                  </li>
                ))}
              </ul>
              {!closed && (
                <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
                  <select value={dup.of} onChange={(e) => setDup({ ...dup, of: e.target.value })} className={cx(inputClass, "h-9 text-sm")} aria-label={tr("Duplicate of")}>
                    <option value="">{tr("Duplicate of …")}</option>
                    {r.related!.filter((o) => o.status !== "REJECTED").map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}
                  </select>
                  <input value={dup.note} onChange={(e) => setDup({ ...dup, note: e.target.value })} maxLength={2000} placeholder={tr("Reason (required)")} className={cx(inputClass, "h-9 text-sm")} />
                  <Button size="sm" variant="danger" disabled={busy || !dup.of || !dup.note.trim()} onClick={() => void act(`/api/de/monitor/${id}/duplicate`, { ofId: dup.of, note: dup.note }, tr("Marked as duplicate"))}>{tr("Mark duplicate")}</Button>
                </div>
              )}
            </FormCard>
          )}
        </RequestView>
      )}
      <CameraCapture open={camera} title={tr("Work done")} branch={r?.branchName ?? ""} countNumber={r?.number ?? ""} onClose={() => setCamera(false)} onShot={addAfter} />
      {swap && r && (
        <Drawer open onClose={() => setSwap(null)} size="md" icon={<Shuffle size={18} />} title={tr("Move the technician")} description={tr("To a request that needs them first; this request waits for another technician")}
          footer={<><Button variant="secondary" onClick={() => setSwap(null)}>{tr("Cancel")}</Button>
            <Button disabled={busy || !swap.to || !swap.note.trim()} onClick={async () => {
              if (await act(`/api/de/assignments/${swap.assignmentId}/swap`, { toRequestId: swap.to, scheduledFor: swap.scheduledFor || null, note: swap.note }, tr("Technician moved"))) { setSwap(null); onOpen(swap.to); }
            }}><Shuffle size={15} /> {tr("Move")}</Button></>}>
          <div className="space-y-3">
            <Field label={tr("Priority request")} required>
              <select value={swap.to} onChange={(e) => setSwap({ ...swap, to: e.target.value })} className={cx(inputClass, "h-10 text-sm")}>
                <option value="">{tr("Choose the request")}</option>
                {targets.sort((a, b) => urgRank(a.urgency) - urgRank(b.urgency)).map((t) => <option key={t.id} value={t.id}>{t.number} · {t.branchName} · {URGENCY_LABEL[t.urgency]()} · {STATUS_LABEL[t.status]()}</option>)}
              </select>
            </Field>
            <Field label={tr("Scheduled for")}><Input type="date" value={swap.scheduledFor} onChange={(e) => setSwap({ ...swap, scheduledFor: e.target.value })} /></Field>
            <Field label={tr("Reason")} required><textarea value={swap.note} onChange={(e) => setSwap({ ...swap, note: e.target.value })} rows={3} maxLength={500} className={cx(inputClass, "h-auto py-2 text-sm")} /></Field>
          </div>
        </Drawer>
      )}
      {release && (
        <Drawer open onClose={() => setRelease(null)} size="sm" icon={<X size={18} />} title={tr("Release the technician")}
          footer={<><Button variant="secondary" onClick={() => setRelease(null)}>{tr("Cancel")}</Button>
            <Button variant="danger" disabled={busy || !release.note.trim()} onClick={async () => { if (await act(`/api/de/assignments/${release.assignmentId}/release`, { note: release.note }, tr("Technician released"))) setRelease(null); }}>{tr("Release")}</Button></>}>
          <Field label={tr("Reason")} required><textarea value={release.note} onChange={(e) => setRelease({ ...release, note: e.target.value })} rows={3} maxLength={500} className={cx(inputClass, "h-auto py-2 text-sm")} /></Field>
        </Drawer>
      )}
    </Drawer>
  );
}

// ------------------------------------------------------------------------------------------------- masters

function TechniciansDrawer({ groups, onClose }: { groups: string[]; onClose: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Technician[] | null>(null);
  const [edit, setEdit] = useState<Partial<Technician> | null>(null);
  const load = useCallback(async () => setRows(await call<Technician[]>("/api/de/technicians").catch(() => [])), []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => {
    if (!edit) return;
    try {
      const body = { name: edit.name ?? "", kind: edit.kind ?? "INTERNAL", company: edit.company ?? null, skills: edit.skills ?? [], city: edit.city ?? null,
        phone: edit.phone ?? null, notes: edit.notes ?? null, isActive: edit.isActive ?? true };
      await call(edit.id ? `/api/de/technicians/${edit.id}` : "/api/de/technicians", { method: edit.id ? "PATCH" : "POST", json: body });
      toast(tr("Technician saved"));
      setEdit(null);
      void load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <Drawer open onClose={onClose} size="lg" icon={<Users size={18} />} title={tr("Technicians")} description={tr("Internal and vendor technicians, their skills and current jobs")}
      footer={edit ? <><Button variant="secondary" onClick={() => setEdit(null)}>{tr("Cancel")}</Button><Button disabled={!edit.name?.trim()} onClick={() => void save()}><Save size={15} /> {tr("Save")}</Button></>
        : <Button onClick={() => setEdit({ kind: "INTERNAL", isActive: true, skills: [] })}><Plus size={15} /> {tr("New technician")}</Button>}>
      {edit ? (
        <div className="space-y-3">
          <Field label={tr("Name")} required><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={120} /></Field>
          <Segmented label={tr("Type")} value={edit.kind ?? "INTERNAL"} onChange={(kind) => setEdit({ ...edit, kind })}
            options={[{ value: "INTERNAL", label: tr("Internal") }, { value: "VENDOR", label: tr("Vendor") }]} />
          {edit.kind === "VENDOR" && <Field label={tr("Company")}><Input value={edit.company ?? ""} onChange={(e) => setEdit({ ...edit, company: e.target.value })} maxLength={120} /></Field>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={tr("Phone")}><Input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} maxLength={40} inputMode="tel" /></Field>
            <Field label={tr("City / area")}><Input value={edit.city ?? ""} onChange={(e) => setEdit({ ...edit, city: e.target.value })} maxLength={80} /></Field>
          </div>
          <Field label={tr("Skills (category groups)")}>
            <ChoiceGroupMulti options={groups} value={edit.skills ?? []} onChange={(skills) => setEdit({ ...edit, skills })} />
          </Field>
          <Field label={tr("Notes")}><textarea value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} rows={2} maxLength={500} className={cx(inputClass, "h-auto py-2 text-sm")} /></Field>
          <Switch checked={edit.isActive ?? true} onChange={(isActive) => setEdit({ ...edit, isActive })} label={tr("Active")} hint={tr("Inactive technicians cannot be assigned")} />
        </div>
      ) : !rows ? <div className="skeleton h-48 rounded-xl" /> : rows.length === 0 ? (
        <Empty icon={<Users size={28} />} title={tr("No technician yet")}>{tr("Add the internal and vendor technicians who do the work.")}</Empty>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {rows.map((t) => (
            <li key={t.id} className={cx("px-4 py-3", !t.isActive && "bg-slate-50 opacity-70")}>
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{t.name} {!t.isActive && <Badge>{tr("Inactive")}</Badge>}</span>
                  <span className="block text-xs text-slate-500">{t.kind === "VENDOR" ? `${tr("Vendor")}${t.company ? ` · ${t.company}` : ""}` : tr("Internal")}{t.city ? ` · ${t.city}` : ""}{t.phone ? ` · ${t.phone}` : ""}</span>
                  {t.skills.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{t.skills.map((s) => <Badge key={s}>{s}</Badge>)}</span>}
                </span>
                <span className="text-right text-xs"><span className="block font-semibold tabular-nums text-slate-900">{tr("{0} active", t.activeJobs)}</span><span className="text-slate-400">{tr("{0} done", t.doneJobs)}</span></span>
                <Button size="sm" variant="ghost" onClick={() => setEdit(t)}>{tr("Edit")}</Button>
              </div>
              {t.jobs.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {t.jobs.map((j) => <li key={j.requestId} className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600"><span className="font-mono">{j.number}</span> · {j.branchName} <UrgencyBadge u={j.urgency} />{j.scheduledFor ? ` · ${j.scheduledFor}` : ""}</li>)}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}

function ChoiceGroupMulti({ options, value, onChange }: { options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return <button key={o} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
          className={cx("rounded-full border px-3 py-1 text-xs font-medium", on ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300")}>{o}</button>;
      })}
    </div>
  );
}

function CategoriesDrawer({ onClose }: { onClose: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState<Category[] | null>(null);
  const [edit, setEdit] = useState<Partial<Category> & { examplesText?: string } | null>(null);
  const load = useCallback(async () => setRows(await call<Category[]>("/api/de/categories?all=true").catch(() => [])), []);
  useEffect(() => { void load(); }, [load]);
  const groups = [...new Set((rows ?? []).map((c) => c.group))];
  const save = async () => {
    if (!edit) return;
    try {
      const body = { group: edit.group ?? "", name: edit.name ?? "", defaultUrgency: edit.defaultUrgency ?? "NORMAL",
        examples: (edit.examplesText ?? "").split(",").map((x) => x.trim()).filter(Boolean), sort: edit.sort ?? 0, isActive: edit.isActive ?? true };
      await call(edit.id ? `/api/de/categories/${edit.id}` : "/api/de/categories", { method: edit.id ? "PATCH" : "POST", json: body });
      toast(tr("Category saved"));
      setEdit(null);
      void load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  return (
    <Drawer open onClose={onClose} size="lg" icon={<Boxes size={18} />} title={tr("Categories")} description={tr("Groups, categories, default urgency and example items offered on the form")}
      footer={edit ? <><Button variant="secondary" onClick={() => setEdit(null)}>{tr("Cancel")}</Button><Button disabled={!edit.name?.trim() || !edit.group?.trim()} onClick={() => void save()}><Save size={15} /> {tr("Save")}</Button></>
        : <Button onClick={() => setEdit({ defaultUrgency: "NORMAL", isActive: true, sort: 90, examplesText: "" })}><Plus size={15} /> {tr("New category")}</Button>}>
      {edit ? (
        <div className="space-y-3">
          <Field label={tr("Group")} required>
            <Input value={edit.group ?? ""} onChange={(e) => setEdit({ ...edit, group: e.target.value })} list="de-groups" maxLength={60} />
            <datalist id="de-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
          </Field>
          <Field label={tr("Category")} required><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={80} /></Field>
          <Field label={tr("Default urgency")}>
            <select value={edit.defaultUrgency} onChange={(e) => setEdit({ ...edit, defaultUrgency: e.target.value as Urgency })} className={cx(inputClass, "h-10 text-sm")}>
              {URGENCIES.map((u) => <option key={u} value={u}>{URGENCY_LABEL[u]()}</option>)}
            </select>
          </Field>
          <Field label={tr("Example items")} hint={tr("Separated by commas; offered while typing the item name")}>
            <textarea value={edit.examplesText ?? ""} onChange={(e) => setEdit({ ...edit, examplesText: e.target.value })} rows={2} className={cx(inputClass, "h-auto py-2 text-sm")} />
          </Field>
          <Field label={tr("Order")}><Input type="number" value={edit.sort ?? 0} onChange={(e) => setEdit({ ...edit, sort: Number(e.target.value) || 0 })} /></Field>
          <Switch checked={edit.isActive ?? true} onChange={(isActive) => setEdit({ ...edit, isActive })} label={tr("Active")} hint={tr("Inactive categories are not offered on the form")} />
        </div>
      ) : !rows ? <div className="skeleton h-48 rounded-xl" /> : (
        <div className="space-y-3">
          {groups.map((g) => (
            <section key={g} className="rounded-xl border border-slate-200">
              <p className="border-b border-slate-100 bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{g}</p>
              <ul className="divide-y divide-slate-100">
                {rows.filter((c) => c.group === g).map((c) => (
                  <li key={c.id} className={cx("flex items-center gap-3 px-4 py-2.5", !c.isActive && "opacity-60")}>
                    <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-900">{c.name} {!c.isActive && <Badge>{tr("Inactive")}</Badge>}</span>
                      <span className="block truncate text-xs text-slate-500">{c.examples.join(", ") || "—"}</span></span>
                    <UrgencyBadge u={c.defaultUrgency} />
                    <Button size="sm" variant="ghost" onClick={() => setEdit({ ...c, examplesText: c.examples.join(", ") })}>{tr("Edit")}</Button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Drawer>
  );
}

