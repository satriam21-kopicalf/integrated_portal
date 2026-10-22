"use client";

// Monitoring → Damaged Equipment (page mon.damaged-equipment): every request sent by the PICs for the Maintenance /
// procurement team. A summary of the open requests (urgency, category groups, technicians' load), then the requests with
// status tabs and one Filters sheet; the list can be grouped per branch or per PIC so the team sees at once what one
// outlet / PIC already asked. A request opens in a drawer: its head (status, facts, steps) and three tabs — Handling (next
// step with a note, technicians, the technician's photo link and the work photos, cost & invoices, duplicates), the
// request itself and its history. Technicians and categories are kept here too.

import { AlertTriangle, Boxes, Camera, Check, ChevronDown, ChevronRight, Clock, Copy, Hammer, Link2, MessageCircle, Paperclip, Plus, Save,
  Shuffle, Tags, Upload, Users, Wrench, X } from "lucide-react";
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
import RequestView, { Gallery, Invoices, RequestHero, StatusBadge, UrgencyBadge } from "./RequestView";
import { DocActions } from "./DeForm";
import { type Category, type Request, type Status, type Technician, type Urgency, type WorkLink, OPEN, PORTAL_URLS, STATUS_LABEL, STEPS, URGENCIES,
  URGENCY_LABEL, fmtHours, fmtMb, fmtRp, workUrl } from "./de";

type Result = { period: { from: string; to: string }; data: Request[]; categories: Category[]; technicians: Technician[] };
/** group = category group (Utilitas …), bgroup = branch group (CCI, CTG, CTGP: Monitoring → Branch groups) */
type F = { period: Period; kind: string; urgency: string; group: string; tech: string; overdue: boolean; by: "none" | "branch" | "pic";
  bgroup: string; branch: string; pic: string };
const NO_F = (): F => ({ period: { from: wibDay(-89), to: wibDay(0) }, kind: "", urgency: "", group: "", tech: "", overdue: false, by: "branch",
  bgroup: "", branch: "", pic: "" });
type GroupOpt = { id: string; code: string; name: string };
const DOT: Partial<Record<Status, string>> = { PENDING: "bg-slate-400", VALIDATION: "bg-sky-500", REVIEW: "bg-violet-500", ON_HOLD: "bg-amber-500",
  ACCEPTED: "bg-blue-500", IN_PROGRESS: "bg-blue-700", DONE: "bg-emerald-500", REJECTED: "bg-red-500" };
const STRIPE: Record<Urgency, string> = { CRITICAL: "border-l-red-500", HIGH: "border-l-amber-400", NORMAL: "border-l-blue-400", LOW: "border-l-slate-300", PLANNED: "border-l-violet-400" };
const URG_BAR: Record<Urgency, string> = { CRITICAL: "bg-red-500", HIGH: "bg-amber-400", NORMAL: "bg-blue-500", LOW: "bg-slate-400", PLANNED: "bg-violet-500" };
const TABS: (Status | "" | "OPEN")[] = ["OPEN", "", "PENDING", "VALIDATION", "REVIEW", "ON_HOLD", "ACCEPTED", "IN_PROGRESS", "DONE", "REJECTED"];
const OPEN_SET = new Set<Status>(OPEN);
const urgRank = (u: Urgency) => URGENCIES.indexOf(u);
const stepOf = (r: Request) => (r.status === "DONE" ? STEPS.length : Math.max(0, STEPS.indexOf((r.status === "ON_HOLD" ? r.holdFrom : r.status) ?? "PENDING")) + 1);

export default function DeMonitor() {
  const [f, setF] = useState<F>(NO_F);
  const [status, setStatus] = useState<Status | "" | "OPEN">("OPEN");
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [masters, setMasters] = useState<"tech" | "cat" | null>(null);
  const [bgroups, setBgroups] = useState<GroupOpt[]>([]);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRes(await call<Result>(`/api/de/monitor?dateFrom=${f.period.from}&dateTo=${f.period.to}${f.bgroup ? `&group=${encodeURIComponent(f.bgroup)}` : ""}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [f.period, f.bgroup]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void call<{ groups: GroupOpt[] }>("/api/monitoring/branch-groups").then((r) => setBgroups(r.groups)).catch(() => setBgroups([])); }, []);

  const all = useMemo(() => res?.data ?? [], [res]);
  const base = useMemo(() => {
    const s = search.trim().toLowerCase();
    return all.filter((r) => (!f.kind || r.kind === f.kind) && (!f.urgency || r.urgency === f.urgency) && (!f.overdue || r.tracker?.overdue)
      && (!f.branch || r.branchCode === f.branch) && (!f.pic || r.username === f.pic)
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
    ...(f.bgroup ? [{ key: "bg", label: `${tr("Group")} ${f.bgroup === "none" ? tr("Without a group") : bgroups.find((g) => g.id === f.bgroup)?.code ?? ""}`, onRemove: () => setF({ ...f, bgroup: "" }) }] : []),
    ...(f.branch ? [{ key: "b", label: all.find((r) => r.branchCode === f.branch)?.branchName ?? f.branch, onRemove: () => setF({ ...f, branch: "" }) }] : []),
    ...(f.pic ? [{ key: "pic", label: all.find((r) => r.username === f.pic)?.picName ?? f.pic, onRemove: () => setF({ ...f, pic: "" }) }] : []),
    ...(f.by !== "branch" ? [{ key: "by", label: f.by === "pic" ? tr("Per PIC") : tr("List"), onRemove: () => setF({ ...f, by: "branch" }) }] : []),
  ];
  const branchOpts = useMemo(() => [...new Map(all.map((r) => [r.branchCode, r.branchName])).entries()].map(([value, label]) => ({ value, label })), [all]);
  const picOpts = useMemo(() => [...new Map(all.map((r) => [r.username, r.picName])).entries()].map(([value, label]) => ({ value, label })), [all]);

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
      {res && all.length > 0 && <Overview open={openRows} techs={res.technicians} f={f} setF={setF} />}

      <Panel title={tr("Requests")} description={tr("Most urgent first; tap a request to handle it")}
        toolbar={<>
          <div className="-mx-1 flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1" role="tablist" aria-label={tr("Status")}>
            {TABS.map((t) => {
              const on = status === t;
              return (
                <button key={t || "all"} type="button" role="tab" aria-selected={on} onClick={() => setStatus(t)}
                  className={cx("inline-flex flex-shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors", on ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900")}>
                  {t && t !== "OPEN" && <span className={cx("h-2 w-2 rounded-full", DOT[t])} aria-hidden />}
                  {t === "OPEN" ? tr("Open") : t ? STATUS_LABEL[t]() : tr("All")}
                  <span className={cx("rounded-full px-1.5 text-[11px] tabular-nums", on ? "bg-slate-900 text-white" : "bg-white text-slate-700")}>{fmtNumber(count(t))}</span>
                </button>
              );
            })}
          </div>
          <FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search number, outlet, PIC or item")} filters={chips}
            onOpen={() => setSheet(true)} onClear={() => setF(NO_F())} />
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

      {sheet && <MonitorFilters value={f} groups={groups} bgroups={bgroups} branches={branchOpts} pics={picOpts} technicians={(res?.technicians ?? []).map((t) => t.name)}
        onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
      {open && res && <TeamDrawer id={open} technicians={res.technicians} all={all} onOpen={setOpen} onClose={() => setOpen(null)} onChanged={load} />}
      {masters === "tech" && <TechniciansDrawer groups={groups} onClose={() => { setMasters(null); void load(); }} />}
      {masters === "cat" && <CategoriesDrawer onClose={() => { setMasters(null); void load(); }} />}
    </Page>
  );
}

function Group({ g, onOpen }: { g: { key: string; title: string; sub: string; rows: Request[] }; onOpen: (id: string) => void }) {
  const [open, setOpen] = useState(true);
  const live = g.rows.filter((r) => OPEN_SET.has(r.status)).length;
  const critical = g.rows.filter((r) => OPEN_SET.has(r.status) && r.urgency === "CRITICAL").length;
  return (
    <li>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center gap-3 bg-slate-50 px-4 py-3 text-left hover:bg-slate-100/80">
        <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-white text-xs font-bold text-slate-600 ring-1 ring-slate-200">
          {g.title.replace(/^Kopi Calf( To Go)?\s*/i, "").slice(0, 2).toUpperCase()}</span>
        <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-slate-900">{g.title}</span>
          <span className="text-[11px] text-slate-500">{g.sub}</span></span>
        <span className="hidden flex-wrap items-center gap-1.5 sm:flex">
          {critical > 0 && <Badge tone="red">{tr("{0} critical", critical)}</Badge>}
          {live > 0 && <Badge tone="blue">{tr("{0} open", live)}</Badge>}
          <span className="text-xs tabular-nums text-slate-500">{tr("{0} requests", g.rows.length)}</span>
        </span>
        {open ? <ChevronDown size={16} className="text-slate-400" /> : <ChevronRight size={16} className="text-slate-400" />}
      </button>
      {open && <RequestTable rows={g.rows} onOpen={onOpen} />}
    </li>
  );
}

function RequestTable({ rows, onOpen }: { rows: Request[]; onOpen: (id: string) => void }) {
  const items = (r: Request) => {
    const list = r.items ?? [];
    return list.length ? `${list[0].name}${list.length > 1 ? ` ${tr("+{0} more", list.length - 1)}` : ""}` : "—";
  };
  return (
    <>
      <ul className="divide-y divide-slate-100 md:hidden">
        {rows.map((r) => (
          <li key={r.id} className={cx("border-l-4", STRIPE[r.urgency])}>
            <button type="button" onClick={() => onOpen(r.id)} className="w-full px-4 py-3 text-left hover:bg-slate-50">
              <span className="flex items-center justify-between gap-2"><span className="font-mono text-xs font-semibold text-slate-500">{r.number}</span><StatusBadge r={r} /></span>
              <span className="mt-1 block truncate text-sm font-semibold text-slate-900">{items(r)}</span>
              <span className="block truncate text-xs text-slate-500">{r.branchName} · {r.picName}</span>
              <span className="mt-2 flex items-center gap-2">
                <span className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100"><span className={cx("block h-full rounded-full", r.status === "REJECTED" ? "bg-red-500" : r.status === "DONE" ? "bg-emerald-500" : "bg-blue-600")} style={{ width: `${r.status === "REJECTED" ? 100 : r.tracker?.progress ?? 0}%` }} /></span>
                <span className={cx("text-[11px] tabular-nums", r.tracker?.overdue ? "font-semibold text-red-600" : "text-slate-500")}>{fmtHours(r.tracker?.workHours)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-sm">
          <thead className={theadClass}>
            <tr>
              <th className="py-2.5 pl-5 pr-3">{tr("Request")}</th><th className="px-3 py-2.5">{tr("Items")}</th><th className="px-3 py-2.5">{tr("Outlet & PIC")}</th>
              <th className="px-3 py-2.5">{tr("Status")}</th><th className="px-3 py-2.5 text-right">{tr("Time")}</th><th className="px-3 py-2.5">{tr("Technician")}</th><th className="w-8" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.id} onClick={() => onOpen(r.id)} className="group cursor-pointer hover:bg-blue-50/40">
                <td className={cx("whitespace-nowrap border-l-4 py-3 pl-4 pr-3", STRIPE[r.urgency])}>
                  <span className="block font-mono text-xs font-semibold text-slate-800">{r.number}</span>
                  <span className="mt-0.5 flex items-center gap-1.5"><UrgencyBadge u={r.urgency} /><span className="text-[11px] text-slate-500">{r.kind === "REPAIR" ? tr("Repair") : tr("Procurement")}</span></span>
                </td>
                <td className="max-w-[16rem] px-3 py-3">
                  <span className="block truncate font-medium text-slate-900">{items(r)}</span>
                  <span className="block truncate text-[11px] text-slate-500">{[...new Set((r.items ?? []).map((i) => i.category))].join(" · ")}</span>
                </td>
                <td className="max-w-[14rem] px-3 py-3"><span className="block truncate text-slate-800">{r.branchName}</span><span className="block truncate text-[11px] text-slate-500">{r.picName} · {wibDateTime(r.submittedAt)}</span></td>
                <td className="px-3 py-3">
                  <StatusBadge r={r} />
                  <span className="mt-1.5 flex items-center gap-1.5">
                    <span className="flex gap-0.5">{STEPS.map((s, i) => <span key={s} className={cx("h-1 w-3.5 rounded-full", r.status === "REJECTED" ? "bg-red-300" : i < stepOf(r) ? (r.status === "DONE" ? "bg-emerald-500" : r.status === "ON_HOLD" ? "bg-amber-400" : "bg-blue-600") : "bg-slate-200")} />)}</span>
                    <span className="text-[10px] tabular-nums text-slate-400">{stepOf(r)}/{STEPS.length}</span>
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-3 text-right text-xs">
                  <span className={cx("block font-semibold tabular-nums", r.tracker?.overdue ? "text-red-600" : "text-slate-800")}>{fmtHours(r.tracker?.workHours)}</span>
                  <span className="text-slate-400">{r.tracker?.slaHours ? tr("target {0}", fmtHours(r.tracker.slaHours)) : "—"}</span>
                </td>
                <td className="max-w-[10rem] px-3 py-3 text-xs text-slate-600"><span className="block truncate">{(r.technicians ?? []).join(", ") || <span className="text-slate-300">{tr("Not assigned")}</span>}</span></td>
                <td className="pr-3 text-slate-300 group-hover:text-blue-600"><ChevronRight size={16} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

type Opt = { value: string; label: string };

/** One card above the requests: open requests per urgency and per category group, and the technicians' load; a tap filters. */
function Overview({ open, techs, f, setF }: { open: Request[]; techs: Technician[]; f: F; setF: (f: F) => void }) {
  const groups = new Map<string, number>();
  open.forEach((r) => new Set((r.items ?? []).map((i) => i.group ?? "")).forEach((g) => g && groups.set(g, (groups.get(g) ?? 0) + 1)));
  const urg = URGENCIES.map((u) => [u, open.filter((r) => r.urgency === u).length] as const);
  const maxU = Math.max(1, ...urg.map(([, n]) => n));
  const maxG = Math.max(1, ...groups.values());
  const row = (key: string, label: React.ReactNode, n: number, max: number, bar: string, on: boolean, onClick: () => void) => (
    <li key={key}>
      <button type="button" onClick={onClick} aria-pressed={on}
        className={cx("grid w-full grid-cols-[7.5rem_1fr_2rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50", on && "bg-blue-50 ring-1 ring-blue-200")}>
        <span className="truncate text-slate-700">{label}</span>
        <span className="h-2 overflow-hidden rounded-full bg-slate-100"><span className={cx("block h-full rounded-full", bar)} style={{ width: `${(n / max) * 100}%` }} /></span>
        <span className="text-right font-semibold tabular-nums text-slate-900">{n}</span>
      </button>
    </li>
  );
  const head = (title: string, hint: string) => (
    <div className="mb-2 px-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</p><p className="text-[11px] text-slate-400">{hint}</p></div>
  );
  return (
    <section className="grid overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:grid-cols-3 md:divide-x md:divide-slate-100">
      <div className="p-3 sm:p-4">
        {head(tr("Open per urgency"), tr("Tap to show only that urgency"))}
        <ul className="space-y-0.5">{urg.map(([u, n]) => row(u, URGENCY_LABEL[u](), n, maxU, URG_BAR[u], f.urgency === u, () => setF({ ...f, urgency: f.urgency === u ? "" : u })))}</ul>
      </div>
      <div className="border-t border-slate-100 p-3 sm:p-4 md:border-t-0">
        {head(tr("Open per category group"), tr("Requests with an item of the group"))}
        {groups.size === 0 ? <p className="px-2 py-4 text-sm text-slate-400">—</p> : (
          <ul className="space-y-0.5">{[...groups.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([g, n]) => row(g, g, n, maxG, "bg-blue-600", f.group === g, () => setF({ ...f, group: f.group === g ? "" : g })))}</ul>
        )}
      </div>
      <div className="border-t border-slate-100 p-3 sm:p-4 md:border-t-0">
        {head(tr("Technicians' load"), tr("Active jobs per technician"))}
        {techs.length === 0 ? <p className="px-2 py-4 text-sm text-slate-400">{tr("No technician yet")}</p> : (
          <ul className="space-y-0.5">
            {[...techs].sort((a, b) => b.activeJobs - a.activeJobs).slice(0, 6).map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setF({ ...f, tech: f.tech === t.name ? "" : t.name })} aria-pressed={f.tech === t.name}
                  className={cx("flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50", f.tech === t.name && "bg-blue-50 ring-1 ring-blue-200")}>
                  <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">{t.name.slice(0, 1).toUpperCase()}</span>
                  <span className="min-w-0 flex-1 truncate text-slate-700">{t.name}</span>
                  <span className={cx("rounded-full px-2 py-0.5 text-[11px] font-semibold tabular-nums", t.activeJobs >= 3 ? "bg-red-50 text-red-700" : t.activeJobs ? "bg-blue-50 text-blue-700" : "bg-slate-100 text-slate-500")}>
                    {tr("{0} active", t.activeJobs)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function MonitorFilters({ value, groups, bgroups, branches, pics, technicians, onApply, onClose }: {
  value: F; groups: string[]; bgroups: GroupOpt[]; branches: Opt[]; pics: Opt[]; technicians: string[]; onApply: (v: F) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(NO_F())}>
      <FilterSection title={tr("View")} hint={tr("Group the requests to see at once what one outlet or PIC already asked")}>
        <Segmented label={tr("View")} value={d.by} onChange={(by) => setD({ ...d, by })}
          options={[{ value: "branch", label: tr("Per branch") }, { value: "pic", label: tr("Per PIC") }, { value: "none", label: tr("List") }]} />
      </FilterSection>
      <FilterSection title={tr("Sent in")} hint={tr("Open requests are always shown")}><PeriodField value={d.period} onChange={(period) => setD({ ...d, period })} maxDays={366} /></FilterSection>
      {bgroups.length > 0 && (
        <FilterSection title={tr("Branch group")}>
          <ChoiceGroup label="" value={d.bgroup} onChange={(v) => setD({ ...d, bgroup: v })}
            choices={[{ value: "", label: tr("All") }, ...bgroups.map((g) => ({ value: g.id, label: g.code })), { value: "none", label: tr("Without a group") }]} />
        </FilterSection>
      )}
      {branches.length > 0 && (
        <FilterSection title={tr("Branch")}>
          <SearchChoice label="" anyLabel={tr("All branches")} value={d.branch} onChange={(v) => setD({ ...d, branch: v })} placeholder={tr("Search branch")} options={branches} />
        </FilterSection>
      )}
      {pics.length > 0 && (
        <FilterSection title="PIC">
          <SearchChoice label="" anyLabel={tr("All PICs")} value={d.pic} onChange={(v) => setD({ ...d, pic: v })} placeholder={tr("Search PIC")} options={pics} />
        </FilterSection>
      )}
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

type Tab = "handle" | "detail" | "history";

function TeamDrawer({ id, technicians, all, onOpen, onClose, onChanged }: {
  id: string; technicians: Technician[]; all: Request[]; onOpen: (id: string) => void; onClose: () => void; onChanged: () => void;
}) {
  const toast = useToast();
  const [r, setR] = useState<Request | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("handle");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [assign, setAssign] = useState({ technicianId: "", scheduledFor: "", note: "" });
  const [swap, setSwap] = useState<{ assignmentId: number; to: string; scheduledFor: string; note: string } | null>(null);
  const [release, setRelease] = useState<{ assignmentId: number; note: string } | null>(null);
  const [cost, setCost] = useState({ est: "", actual: "", vendor: "" });
  const [dup, setDup] = useState({ of: "", note: "" });
  const [camera, setCamera] = useState(false);
  const [invNote, setInvNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [linkTech, setLinkTech] = useState("");

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
  // the technician's photos arrive while the drawer is open: refresh while a link is open
  const waiting = (r?.workLinks ?? []).some((l) => l.state === "OPEN");
  useEffect(() => {
    if (!waiting) return;
    const t = setInterval(() => void load(), 15000);
    return () => clearInterval(t);
  }, [waiting, load]);
  useEffect(() => { if (r && !OPEN_SET.has(r.status)) setTab((t) => (t === "handle" ? "detail" : t)); }, [r?.status]); // eslint-disable-line react-hooks/exhaustive-deps

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
  const uploadInvoice = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast(tr("{0}: larger than {1}", file.name, fmtMb(10 * 1024 * 1024)), "error"); return; }
    setUploading(true);
    try {
      const res = await fetch(`/api/de/monitor/${id}/invoices?name=${encodeURIComponent(file.name)}${invNote ? `&note=${encodeURIComponent(invNote)}` : ""}`,
        { method: "POST", body: file, headers: { "content-type": "application/octet-stream" }, credentials: "same-origin" });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error ?? tr("The file could not be uploaded"));
      setInvNote("");
      toast(tr("Invoice attached"));
      await load();
      onChanged();
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setUploading(false);
    }
  };
  const removeInvoice = async (mid: string) => {
    try {
      await call(`/api/de/monitor/${id}/invoices/${mid}`, { method: "DELETE" });
      await load();
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const active = (r?.assignments ?? []).filter((a) => a.status === "ACTIVE");
  const targets = all.filter((x) => x.id !== id && ["REVIEW", "ACCEPTED", "IN_PROGRESS", "ON_HOLD"].includes(x.status));
  const closed = r ? !OPEN_SET.has(r.status) : true;
  const noteNeeded = (to: Status) => to === "ON_HOLD" || to === "REJECTED";
  const afterCount = (r?.media ?? []).filter((m) => m.kind === "AFTER").length;
  const tabs: [Tab, string, number | null][] = [["handle", tr("Handling"), null], ["detail", tr("Request"), r?.items?.length ?? null], ["history", tr("History"), r?.events?.length ?? null]];
  let n = 0;
  const next = () => ++n;

  return (
    <Drawer open onClose={onClose} size="xl" icon={<Wrench size={18} />} title={r ? `${r.number} · ${r.branchName}` : tr("Request")}
      description={r ? `${r.kindLabel} · ${r.picName}` : undefined} focusFirstField={false} footer={r ? <DocActions r={r} /> : undefined}>
      {error ? <ErrorState message={error} /> : !r ? <div className="skeleton h-72 rounded-xl" /> : (
        <div className="space-y-4">
          <RequestHero r={r} compact />
          <div role="tablist" aria-label={tr("Sections")}>
            <div className="grid grid-cols-3 gap-1 rounded-xl bg-slate-100 p-1">
              {tabs.map(([k, label, count]) => (
                <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                  className={cx("inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium", tab === k ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200" : "text-slate-600 hover:text-slate-900")}>
                  {label}{count !== null && <span className="rounded-full bg-slate-200 px-1.5 text-[11px] tabular-nums text-slate-600">{count}</span>}
                </button>
              ))}
            </div>
          </div>

          {tab === "detail" && <RequestView r={r} urls={PORTAL_URLS} part="detail" />}
          {tab === "history" && <RequestView r={r} urls={PORTAL_URLS} part="history" />}
          {tab === "handle" && (closed ? <RequestView r={r} urls={PORTAL_URLS} part="handling" /> : (
            <div className="space-y-4">
              <FormCard n={next()} title={tr("Next step")} hint={tr("A note is required to put on hold or reject; the PIC sees every note")}>
                <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder={tr("Note / reason for the PIC")}
                  className={cx(inputClass, "h-auto py-2 text-sm")} aria-label={tr("Note")} />
                {(r.allowed ?? []).includes("DONE") && afterCount === 0 && (
                  <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800"><Camera size={13} /> {tr("Done needs the photos of the work: send the photo link to the technician below.")}</p>
                )}
                <div className="flex flex-wrap gap-2">
                  {(r.allowed ?? []).map((to) => (
                    <Button key={to} size="sm" variant={to === "REJECTED" ? "danger" : to === "ON_HOLD" ? "secondary" : "primary"}
                      disabled={busy || (noteNeeded(to) && !note.trim()) || (to === "DONE" && afterCount === 0)}
                      onClick={() => void go(to)}>{to === "DONE" && <Check size={14} />}{r.status === "ON_HOLD" && to === r.holdFrom ? tr("Resume: {0}", STATUS_LABEL[to]()) : STATUS_LABEL[to]()}</Button>
                  ))}
                  <Button size="sm" variant="ghost" disabled={busy || !note.trim()} onClick={async () => { if (await act(`/api/de/monitor/${id}/notes`, { note }, tr("Note added"))) setNote(""); }}>{tr("Note only")}</Button>
                </div>
              </FormCard>

              <FormCard n={next()} title={tr("Technicians")} hint={tr("Assign after review; move a technician to a request that needs them first, with the reason")}
                aside={active.length ? <Badge tone="blue">{tr("{0} assigned", active.length)}</Badge> : undefined}>
                {active.length > 0 && (
                  <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                    {active.map((a) => (
                      <li key={a.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5 text-sm">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">{a.name.slice(0, 1).toUpperCase()}</span>
                        <span className="min-w-0 flex-1"><span className="block font-medium text-slate-900">{a.name}</span>
                          <span className="text-xs text-slate-500">{a.kind === "VENDOR" ? a.company ?? tr("Vendor") : tr("Internal")}{a.phone ? ` · ${a.phone}` : ""}{a.scheduledFor ? ` · ${tr("scheduled {0}", a.scheduledFor)}` : ""}</span></span>
                        <Button size="sm" variant="secondary" onClick={() => setSwap({ assignmentId: a.id, to: "", scheduledFor: "", note: "" })}><Shuffle size={13} /> {tr("Move")}</Button>
                        <Button size="sm" variant="ghost" onClick={() => setRelease({ assignmentId: a.id, note: "" })}>{tr("Release")}</Button>
                      </li>
                    ))}
                  </ul>
                )}
                {["REVIEW", "ACCEPTED", "IN_PROGRESS", "ON_HOLD"].includes(r.status) ? (
                  <div className="grid gap-2 rounded-lg bg-slate-50 p-3 sm:grid-cols-[1fr_10rem]">
                    <select value={assign.technicianId} onChange={(e) => setAssign({ ...assign, technicianId: e.target.value })} className={cx(inputClass, "h-10 bg-white text-sm")} aria-label={tr("Technician")}>
                      <option value="">{tr("Choose a technician")}</option>
                      {technicians.map((t) => <option key={t.id} value={t.id}>{t.name}{t.kind === "VENDOR" && t.company ? ` (${t.company})` : ""} · {tr("{0} active jobs", t.activeJobs)}</option>)}
                    </select>
                    <input type="date" value={assign.scheduledFor} onChange={(e) => setAssign({ ...assign, scheduledFor: e.target.value })} className={cx(inputClass, "h-10 bg-white text-sm")} aria-label={tr("Scheduled for")} />
                    <input value={assign.note} onChange={(e) => setAssign({ ...assign, note: e.target.value })} maxLength={500} placeholder={tr("Note (optional)")} className={cx(inputClass, "h-10 bg-white text-sm sm:col-span-2")} />
                    <Button size="sm" className="sm:col-span-2 sm:justify-self-start" disabled={busy || !assign.technicianId}
                      onClick={async () => { if (await act(`/api/de/monitor/${id}/assignments`, { technicianId: Number(assign.technicianId), scheduledFor: assign.scheduledFor || null, note: assign.note || null }, tr("Technician assigned"))) setAssign({ technicianId: "", scheduledFor: "", note: "" }); }}>
                      <Plus size={14} /> {tr("Assign")}</Button>
                  </div>
                ) : <p className="text-xs text-slate-500">{tr("Technicians are assigned once the request is in review.")}</p>}
                {technicians.length === 0 && <p className="text-xs text-amber-700">{tr("No technician yet: add them with the Technicians button.")}</p>}
              </FormCard>

              <FormCard n={next()} title={tr("Photos of the work done")} hint={tr("The technician sends 1–5 photos through a link (no sign-in, valid 1 hour); then process Done")}
                aside={<Badge tone={afterCount ? "green" : "slate"}>{tr("{0} photos", afterCount)}</Badge>}>
                <WorkLinks r={r} busy={busy} tech={linkTech} setTech={setLinkTech}
                  onCreate={() => void act(`/api/de/monitor/${id}/work-links`, { technicianId: linkTech ? Number(linkTech) : null }, tr("Photo link created"))}
                  onCloseLink={(lid) => void act(`/api/de/monitor/${id}/work-links/${lid}`, undefined, tr("Link closed"), "DELETE")} />
                <Gallery r={r} urls={PORTAL_URLS} kind="AFTER" />
                {["ACCEPTED", "IN_PROGRESS"].includes(r.status) && (
                  <button type="button" onClick={() => setCamera(true)} className="inline-flex items-center gap-1.5 self-start text-xs font-medium text-slate-500 hover:text-slate-800">
                    <Camera size={13} /> {tr("Or take the photo yourself on site")}</button>
                )}
              </FormCard>

              <FormCard n={next()} title={tr("Cost & invoices")} hint={tr("Estimate, actual and vendor (optional); attach the invoices while the work runs")}>
                <div className="grid gap-2 sm:grid-cols-3">
                  <Field label={tr("Estimated (Rp)")}><Input inputMode="numeric" value={cost.est} onChange={(e) => setCost({ ...cost, est: e.target.value.replace(/[^0-9]/g, "") })} aria-label={tr("Estimated cost")} /></Field>
                  <Field label={tr("Actual (Rp)")}><Input inputMode="numeric" value={cost.actual} onChange={(e) => setCost({ ...cost, actual: e.target.value.replace(/[^0-9]/g, "") })} aria-label={tr("Actual cost")} /></Field>
                  <Field label={tr("Vendor")}><Input value={cost.vendor} onChange={(e) => setCost({ ...cost, vendor: e.target.value })} maxLength={120} aria-label={tr("Vendor")} /></Field>
                </div>
                <Button size="sm" variant="secondary" className="self-start" disabled={busy} onClick={() => void act(`/api/de/monitor/${id}/cost`, { estCost: cost.est ? Number(cost.est) : null, actualCost: cost.actual ? Number(cost.actual) : null, vendor: cost.vendor || null }, tr("Cost saved"), "PUT")}>
                  <Save size={14} /> {tr("Save cost")}</Button>
                <div className="border-t border-slate-100 pt-3">
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700"><Paperclip size={13} /> {tr("Invoices / receipts")} <span className="font-normal text-slate-400">({tr("PDF or photo, at most {0} each", "10 MB")})</span></p>
                  <Invoices list={(r.media ?? []).filter((m) => m.kind === "INVOICE")} urls={PORTAL_URLS} onRemove={(mid) => void removeInvoice(mid)} />
                  <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_auto]">
                    <input value={invNote} onChange={(e) => setInvNote(e.target.value)} maxLength={200} placeholder={tr("Note, e.g. invoice number or what it pays")} className={cx(inputClass, "h-9 text-sm")} aria-label={tr("Invoice note")} />
                    <label className={cx("inline-flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-medium text-slate-700 hover:bg-slate-50", uploading && "pointer-events-none opacity-60")}>
                      <Upload size={14} /> {uploading ? tr("Uploading…") : tr("Attach invoice")}
                      <input type="file" accept="application/pdf,image/*" className="hidden" onChange={(e) => { void uploadInvoice(e.target.files?.[0]); e.target.value = ""; }} />
                    </label>
                  </div>
                </div>
              </FormCard>

              {(r.related ?? []).length > 0 && (
                <FormCard n={next()} title={tr("Other requests of this outlet / PIC ({0})", r.related!.length)} hint={tr("Check for double requests; mark this one as a duplicate if needed")}>
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
                  <div className="grid gap-2 sm:grid-cols-[12rem_1fr_auto]">
                    <select value={dup.of} onChange={(e) => setDup({ ...dup, of: e.target.value })} className={cx(inputClass, "h-9 text-sm")} aria-label={tr("Duplicate of")}>
                      <option value="">{tr("Duplicate of …")}</option>
                      {r.related!.filter((o) => o.status !== "REJECTED").map((o) => <option key={o.id} value={o.id}>{o.number}</option>)}
                    </select>
                    <input value={dup.note} onChange={(e) => setDup({ ...dup, note: e.target.value })} maxLength={2000} placeholder={tr("Reason (required)")} className={cx(inputClass, "h-9 text-sm")} />
                    <Button size="sm" variant="danger" disabled={busy || !dup.of || !dup.note.trim()} onClick={() => void act(`/api/de/monitor/${id}/duplicate`, { ofId: dup.of, note: dup.note }, tr("Marked as duplicate"))}>{tr("Mark duplicate")}</Button>
                  </div>
                </FormCard>
              )}
            </div>
          ))}
        </div>
      )}
      <CameraCapture open={camera} title={tr("Work done")} branch={r?.branchName ?? ""} countNumber={r?.number ?? ""} onClose={() => setCamera(false)} onShot={addAfter} />
      {swap && r && (
        <Drawer open onClose={() => setSwap(null)} size="md" icon={<Shuffle size={18} />} title={tr("Move the technician")} description={tr("To a request that needs them first; this request waits for another technician")}
          footer={<><Button variant="secondary" onClick={() => setSwap(null)}>{tr("Cancel")}</Button>
            <Button disabled={busy || !swap.to || !swap.note.trim()} onClick={async () => {
              if (await act(`/api/de/assignments/${swap.assignmentId}/swap`, { toRequestId: swap.to, scheduledFor: swap.scheduledFor || null, note: swap.note }, tr("Technician moved"))) { setSwap(null); onOpen(swap.to); }
            }}><Shuffle size={15} /> {tr("Move")}</Button></>}>
          <FormCard title={tr("Move the technician")}>
            <Field label={tr("Priority request")} required>
              <select value={swap.to} onChange={(e) => setSwap({ ...swap, to: e.target.value })} className={cx(inputClass, "h-10 text-sm")}>
                <option value="">{tr("Choose the request")}</option>
                {targets.sort((a, b) => urgRank(a.urgency) - urgRank(b.urgency)).map((t) => <option key={t.id} value={t.id}>{t.number} · {t.branchName} · {URGENCY_LABEL[t.urgency]()} · {STATUS_LABEL[t.status]()}</option>)}
              </select>
            </Field>
            <Field label={tr("Scheduled for")}><Input type="date" value={swap.scheduledFor} onChange={(e) => setSwap({ ...swap, scheduledFor: e.target.value })} /></Field>
            <Field label={tr("Reason")} required><textarea value={swap.note} onChange={(e) => setSwap({ ...swap, note: e.target.value })} rows={3} maxLength={500} className={cx(inputClass, "h-auto py-2 text-sm")} /></Field>
          </FormCard>
        </Drawer>
      )}
      {release && (
        <Drawer open onClose={() => setRelease(null)} size="sm" icon={<X size={18} />} title={tr("Release the technician")}
          footer={<><Button variant="secondary" onClick={() => setRelease(null)}>{tr("Cancel")}</Button>
            <Button variant="danger" disabled={busy || !release.note.trim()} onClick={async () => { if (await act(`/api/de/assignments/${release.assignmentId}/release`, { note: release.note }, tr("Technician released"))) setRelease(null); }}>{tr("Release")}</Button></>}>
          <FormCard title={tr("Release the technician")}>
            <Field label={tr("Reason")} required><textarea value={release.note} onChange={(e) => setRelease({ ...release, note: e.target.value })} rows={3} maxLength={500} className={cx(inputClass, "h-auto py-2 text-sm")} /></Field>
          </FormCard>
        </Drawer>
      )}
    </Drawer>
  );
}

const LINK_TONE: Record<WorkLink["state"], "blue" | "green" | "slate" | "amber"> = { OPEN: "blue", SENT: "green", EXPIRED: "amber", CLOSED: "slate" };
const LINK_LABEL: Record<WorkLink["state"], () => string> = { OPEN: () => tr("Waiting for photos"), SENT: () => tr("Photos sent"), EXPIRED: () => tr("Expired"), CLOSED: () => tr("Closed") };

/** The technician's photo link: create (In progress), share by WhatsApp / copy, see whether the photos arrived, close. */
function WorkLinks({ r, busy, tech, setTech, onCreate, onCloseLink }: {
  r: Request; busy: boolean; tech: string; setTech: (v: string) => void; onCreate: () => void; onCloseLink: (id: number) => void;
}) {
  const toast = useToast();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const active = (r.assignments ?? []).filter((a) => a.status === "ACTIVE");
  const links = r.workLinks ?? [];
  const live = links.find((l) => l.state === "OPEN");
  const msg = (l: WorkLink) => tr("Hello {0}, please send the photos of the work for {1} ({2}) through this link (valid 1 hour): {3}", l.technician, r.number ?? "", r.branchName, workUrl(l));
  const phoneOf = (l: WorkLink) => {
    const p = active.find((a) => a.name === l.technician)?.phone?.replace(/[^0-9]/g, "") ?? "";
    return p.startsWith("0") ? `62${p.slice(1)}` : p;
  };
  const copy = async (l: WorkLink) => {
    try { await navigator.clipboard.writeText(workUrl(l)); toast(tr("Link copied")); } catch { toast(workUrl(l)); }
  };
  const minutes = (l: WorkLink) => Math.max(0, Math.round((Date.parse(l.expiresAt) - now) / 60000));
  return (
    <div className="space-y-2">
      {r.status === "IN_PROGRESS" ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-blue-100 bg-blue-50/60 p-3">
          <Link2 size={16} className="text-blue-700" />
          <span className="min-w-0 flex-1 text-xs text-blue-900">{live ? tr("A link is open; a new one replaces it.") : tr("Create a link for the technician on site.")}</span>
          {active.length > 1 && (
            <select value={tech} onChange={(e) => setTech(e.target.value)} className={cx(inputClass, "h-9 w-auto bg-white text-sm")} aria-label={tr("Technician of the link")}>
              {active.map((a) => <option key={a.id} value={a.technicianId}>{a.name}</option>)}
            </select>
          )}
          <Button size="sm" disabled={busy || !active.length} onClick={onCreate}><Link2 size={14} /> {live ? tr("New link") : tr("Create link")}</Button>
        </div>
      ) : <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">{tr("The photo link is created once the request is In progress.")}</p>}
      {links.length > 0 && (
        <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {links.slice(0, 4).map((l) => (
            <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-slate-900">{l.technician} <Badge tone={LINK_TONE[l.state]}>{LINK_LABEL[l.state]()}</Badge></span>
                <span className="block text-[11px] text-slate-500">
                  {l.state === "OPEN" ? tr("{0} min left · {1} photo(s) so far", minutes(l), l.photos) : l.state === "SENT" ? tr("{0} photo(s) sent {1}", l.photos, wibDateTime(l.submittedAt)) : `${tr("Created {0}", wibDateTime(l.createdAt))}${l.createdBy ? ` · ${l.createdBy}` : ""}`}
                </span>
                {l.note && <span className="mt-0.5 block text-xs text-slate-700">“{l.note}”</span>}
              </span>
              {l.state === "OPEN" && (
                <>
                  <Button size="sm" variant="secondary" onClick={() => void copy(l)}><Copy size={13} /> {tr("Copy")}</Button>
                  <a href={`https://wa.me/${phoneOf(l)}?text=${encodeURIComponent(msg(l))}`} target="_blank" rel="noreferrer"
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-600 px-3 text-xs font-medium text-white hover:bg-emerald-700"><MessageCircle size={13} /> WhatsApp</a>
                  <Button size="sm" variant="ghost" onClick={() => onCloseLink(l.id)}>{tr("Close")}</Button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
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
        phone: edit.phone ?? null, notes: edit.notes ?? null, isActive: edit.isActive ?? true, wageType: edit.wageType ?? "DAILY",
        wageAmount: edit.wageAmount === null || edit.wageAmount === undefined || Number.isNaN(edit.wageAmount) ? null : edit.wageAmount };
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
        : <Button onClick={() => setEdit({ kind: "INTERNAL", isActive: true, skills: [], wageType: "DAILY", wageAmount: null })}><Plus size={15} /> {tr("New technician")}</Button>}>
      {edit ? (
        <div className="space-y-4">
          <FormCard n={1} title={tr("Technician")} hint={tr("Internal staff or a vendor")}>
            <Field label={tr("Name")} required><Input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} maxLength={120} /></Field>
            <Segmented label={tr("Type")} value={edit.kind ?? "INTERNAL"} onChange={(kind) => setEdit({ ...edit, kind })}
              options={[{ value: "INTERNAL", label: tr("Internal") }, { value: "VENDOR", label: tr("Vendor") }]} />
            {edit.kind === "VENDOR" && <Field label={tr("Company")}><Input value={edit.company ?? ""} onChange={(e) => setEdit({ ...edit, company: e.target.value })} maxLength={120} /></Field>}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={tr("Phone")}><Input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} maxLength={40} inputMode="tel" /></Field>
              <Field label={tr("City / area")}><Input value={edit.city ?? ""} onChange={(e) => setEdit({ ...edit, city: e.target.value })} maxLength={80} /></Field>
            </div>
          </FormCard>
          <FormCard n={2} title={tr("Skills")} hint={tr("Category groups the technician handles")}>
            <ChoiceGroupMulti options={groups} value={edit.skills ?? []} onChange={(skills) => setEdit({ ...edit, skills })} />
          </FormCard>
          <FormCard n={3} title={tr("Pay")} hint={tr("Daily or monthly; adjust whenever it changes")}>
            <Segmented label={tr("Pay")} value={edit.wageType ?? "DAILY"} onChange={(wageType) => setEdit({ ...edit, wageType })}
              options={[{ value: "DAILY", label: tr("Daily") }, { value: "MONTHLY", label: tr("Monthly") }]} />
            <Field label={edit.wageType === "MONTHLY" ? tr("Pay per month (Rp)") : tr("Pay per day (Rp)")}>
              <Input inputMode="numeric" value={edit.wageAmount ?? ""} onChange={(e) => setEdit({ ...edit, wageAmount: e.target.value ? Number(e.target.value.replace(/[^0-9]/g, "")) : null })} />
            </Field>
            {edit.wageAmount ? <p className="text-xs text-slate-500">{edit.wageType === "MONTHLY" ? tr("≈ {0} per day (26 working days)", fmtRp(edit.wageAmount / 26)) : tr("≈ {0} per month (26 working days)", fmtRp(edit.wageAmount * 26))}</p> : null}
          </FormCard>
          <FormCard n={4} title={tr("Status & notes")}>
            <Field label={tr("Notes")}><textarea value={edit.notes ?? ""} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} rows={2} maxLength={500} className={cx(inputClass, "h-auto py-2 text-sm")} /></Field>
            <Switch checked={edit.isActive ?? true} onChange={(isActive) => setEdit({ ...edit, isActive })} label={tr("Active")} hint={tr("Inactive technicians cannot be assigned")} />
          </FormCard>
        </div>
      ) : !rows ? <div className="skeleton h-48 rounded-xl" /> : rows.length === 0 ? (
        <Empty icon={<Users size={28} />} title={tr("No technician yet")}>{tr("Add the internal and vendor technicians who do the work.")}</Empty>
      ) : (
        <div className="space-y-3">
        <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-center">
          <div className="bg-white px-2 py-2.5"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr("Active")}</dt><dd className="text-lg font-semibold tabular-nums">{rows.filter((t) => t.isActive).length}</dd></div>
          <div className="bg-white px-2 py-2.5"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr("Jobs in progress")}</dt><dd className="text-lg font-semibold tabular-nums">{rows.reduce((a, t) => a + t.activeJobs, 0)}</dd></div>
          <div className="bg-white px-2 py-2.5"><dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{tr("Pay per month")}</dt>
            <dd className="text-sm font-semibold tabular-nums">{fmtRp(rows.filter((t) => t.isActive).reduce((a, t) => a + (t.wageAmount ?? 0) * (t.wageType === "MONTHLY" ? 1 : 26), 0))}</dd></div>
        </dl>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {rows.map((t) => (
            <li key={t.id} className={cx("px-4 py-3", !t.isActive && "bg-slate-50 opacity-70")}>
              <div className="flex items-start gap-3">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-slate-900">{t.name} {!t.isActive && <Badge>{tr("Inactive")}</Badge>}</span>
                  <span className="block text-xs text-slate-500">{t.kind === "VENDOR" ? `${tr("Vendor")}${t.company ? ` · ${t.company}` : ""}` : tr("Internal")}{t.city ? ` · ${t.city}` : ""}{t.phone ? ` · ${t.phone}` : ""}</span>
                  {t.skills.length > 0 && <span className="mt-1 flex flex-wrap gap-1">{t.skills.map((s) => <Badge key={s}>{s}</Badge>)}</span>}
                </span>
                <span className="text-right text-xs">
                  <span className="block font-semibold tabular-nums text-slate-900">{t.wageAmount ? `${fmtRp(t.wageAmount)} / ${t.wageType === "MONTHLY" ? tr("month") : tr("day")}` : tr("Pay not set")}</span>
                  <span className="text-slate-400">{tr("{0} active", t.activeJobs)} · {tr("{0} done", t.doneJobs)}</span>
                </span>
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
        </div>
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
        <FormCard title={edit.id ? tr("Edit category") : tr("New category")} hint={tr("Offered on the form; the default urgency fills in when an item is added")}>
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
        </FormCard>
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

