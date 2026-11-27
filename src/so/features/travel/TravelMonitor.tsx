"use client";

// Operations → Travel Path (page mon.travel; integrated_portal_be app/travel_path.py): whether every outlet did its sessions
// of the day, the reports with their photos and score, and the findings with their deadline and after photo.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, CalendarCheck, CalendarDays, Download, FileText, Footprints, RotateCcw, SlidersHorizontal, Wrench, X } from "lucide-react";
import { Button, Empty, ErrorState, Field, PageNav, SearchBox, cx, fmtNumber, usePaged, useToast } from "@/so/ui";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { SkeletonList, SkeletonTable } from "@/components/kc/Skeleton";
import { CardFooter, JSelect, Lozenge, QuickChips, Toolbar, WorkCard, jHeadRow, jRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import Drawer from "@/so/ui/Drawer";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { dmy } from "@/so/ui/Filters";
import { daysAgo, downloadSheets } from "@/aggregator/ui";
import { PeriodField, Row as FRow } from "@/aggregator/fields";
import { tl } from "@/so/features/visit/visit";
import { thumb } from "@/lib/assets";
import { tr } from "@/lib/i18n";
import { type Band, type Finding, type FullReport, type Report, bandClass, bandText, categoryClass, categoryText, photoUrl, ratingText, sessionName } from "./travel";

type CellState = "done" | "late" | "missing" | "waiting" | "none";
type Cell = { session: string; state: CellState; id: string | null; score: number | null; critical: number };
type Outlet = { code: string; name: string; group: string | null; days: { date: string; sessions: Cell[] }[]; expected: number; done: number; missing: number; rate: number | null; score: number | null };
type Data = { period: { from: string; to: string }; sessions: { key: string; label: string; labelEn: string; from: string; to: string }[]; since: string; criticalCap: number; standard: number; pass: number;
  dates: string[]; outlets: Outlet[]; reports: Report[]; findings: Finding[]; truncated: boolean;
  top: { key: string; label: string; zone: string | null; category: string | null; count: number; outlets: string[]; open: number }[];
  groups: { code: string; outlets: number; expected: number; done: number; rate: number | null; score: number | null }[];
  summary: { expected: number; done: number; late: number; missing: number; rate: number | null; outlets: number; reports: number; score: number | null; failed: number; critical: number; openFindings: number; overdue: number } };
type Tab = "compliance" | "reports" | "findings" | "analysis";
type FShow = "open" | "overdue" | "critical" | "fixed" | "all";
type RShow = "all" | "failed" | "late" | "critical";

const short = (n: string) => n.replace(/^Kopi Calf (To Go )?/, "");
const CELL: Record<CellState, string> = { done: "bg-emerald-500", late: "bg-amber-400", missing: "bg-red-500", waiting: "bg-[color:var(--j-DCDFE4)]", none: "bg-transparent" };
const cellText = (s: CellState) => ({ done: tr("On time"), late: tr("Late"), missing: tr("Not done"), waiting: tr("Not due yet"), none: "—" })[s];
const Cat = ({ c }: { c: string | null | undefined }) => (c ? <span className={cx("inline-block rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide", categoryClass(c))}>{categoryText(c)}</span> : null);
const Score = ({ v, band }: { v: number | null; band?: Band | null }) => <span className={cx("rounded px-1.5 py-0.5 text-xs font-bold tabular-nums", bandClass(band ?? null))}>{v != null ? `${v}%` : "—"}</span>;

function Photos({ ids, label }: { ids?: string[]; label?: string }) {
  if (!ids?.length) return null;
  return <span className="inline-flex flex-wrap items-center gap-1.5">{label && <span className="text-[11px] text-[color:var(--j-626F86)]">{label}</span>}{ids.map((id) => (
    <a key={id} href={photoUrl(id)} target="_blank" rel="noreferrer">
      {/* eslint-disable-next-line @next/next/no-img-element -- private photo through the API */}
      <img src={thumb(photoUrl(id), 160)} decoding="async" loading="lazy" alt={label ?? tr("Photo")} className="h-12 w-12 rounded-[3px] bg-[color:var(--j-091E420F)] object-cover" /></a>))}</span>;
}

export default function TravelMonitor() {
  const toast = useToast();
  const [from, setFrom] = useState(daysAgo(6));
  const [to, setTo] = useState(daysAgo(0));
  const [group, setGroup] = useState("");
  const [groups, setGroups] = useState<{ id: string; code: string }[]>([]);
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("compliance");
  const [q, setQ] = useState("");
  const [fshow, setFshow] = useState<FShow>("open");
  const [rshow, setRshow] = useState<RShow>("all");
  const [open, setOpen] = useState<string | null>(null);
  const [reopening, setReopening] = useState<Finding | null>(null);
  const [version, setVersion] = useState(0);
  const [filtering, setFiltering] = useState(false);
  useEffect(() => { call<{ groups: { id: string; code: string }[] }>("/api/monitoring/branch-groups").then((r) => setGroups(r.groups)).catch(() => setGroups([])); }, []);
  useEffect(() => {
    let live = true;
    setData(null); setErr(null);
    call<Data>(`/api/monitoring/travel?dateFrom=${from}&dateTo=${to}${group ? `&group=${encodeURIComponent(group)}` : ""}`).then((d) => live && setData(d)).catch((e: Error) => live && setErr(e.message));
    return () => { live = false; };
  }, [from, to, group, version]);
  const t = q.trim().toLowerCase();
  const outlets = useMemo(() => (data?.outlets ?? []).filter((o) => !t || `${o.name} ${o.code}`.toLowerCase().includes(t)), [data, t]);
  const reports = useMemo(() => (data?.reports ?? []).filter((r) => (rshow === "all" || (rshow === "failed" ? r.band === "failed" : rshow === "late" ? r.late || r.reportLate : (r.counts?.critical ?? 0) > 0))
    && (!t || `${r.branchName} ${r.crew ?? ""} ${r.supervisor ?? ""}`.toLowerCase().includes(t))), [data, rshow, t]);
  const findings = useMemo(() => (data?.findings ?? []).filter((f) => (fshow === "all" || (fshow === "open" ? f.status === "OPEN" : fshow === "overdue" ? f.overdue : fshow === "critical" ? f.category === "Kritikal" : f.status === "FIXED"))
    && (!t || `${f.branchName} ${f.label} ${f.note ?? ""}`.toLowerCase().includes(t))), [data, fshow, t]);
  const po = usePaged(outlets, `o${t}${from}${to}${group}`), pr = usePaged(reports, `r${t}${rshow}${from}${to}${group}`), pf = usePaged(findings, `f${t}${fshow}${from}${to}${group}`);
  const s = data?.summary;
  const sname = (k: string) => { const x = data?.sessions.find((y) => y.key === k); return x ? sessionName(x) : k; };
  const exportXlsx = async () => {
    if (!data || !s) return;
    try {
      await downloadSheets(`Travel Path ${from} - ${to}`, [
        { sheet: "Summary", title: `Travel Path ${dmy(from)} – ${dmy(to)}`, header: [tr("Measure"), tr("Value")], rows: [[tr("Compliance"), s.rate != null ? `${s.rate}%` : "—"], [tr("Reports"), s.reports], [tr("Not done"), s.missing], [tr("Late"), s.late],
          [tr("Average score"), s.score], [tr("Not passed"), s.failed], [tr("Critical findings"), s.critical], [tr("Open findings"), s.openFindings], [tr("Overdue"), s.overdue]] },
        { sheet: "Compliance", header: [tr("Outlet"), tr("Group"), tr("Expected"), tr("Done"), tr("Not done"), "%", tr("Average score"), ...data.dates.flatMap((d) => data.sessions.map((x) => `${dmy(d)} ${sessionName(x)}`))],
          rows: data.outlets.map((o) => [o.name, o.group, o.expected, o.done, o.missing, o.rate, o.score, ...o.days.flatMap((d) => data.sessions.map((x) => { const c = d.sessions.find((y) => y.session === x.key); return c ? (c.score != null ? `${cellText(c.state)} ${c.score}%` : cellText(c.state)) : ""; }))]) },
        { sheet: "Reports", header: [tr("Day"), tr("Session"), tr("Outlet"), tr("Sent"), tr("Crew"), tr("Outlet Supervisor"), tr("Score"), tr("Result"), tr("Findings"), tr("Critical"), "N/A", tr("Late"), tr("Distance (m)")],
          rows: data.reports.map((r) => [r.day, r.sessionLabel, r.branchName, r.submittedAt ? wibDateTime(r.submittedAt) : "", r.crew, r.supervisor, r.score, r.band ? bandText(r.band) : "", r.counts?.nok ?? 0, r.counts?.critical ?? 0, r.counts?.na ?? 0, r.late || r.reportLate ? tr("Yes") : "", r.distanceM]) },
        { sheet: "Findings", header: [tr("Day"), tr("Session"), tr("Outlet"), tr("Category"), tr("Zone"), tr("Area"), tr("Finding"), tr("Repair before"), tr("Status"), tr("Overdue"), tr("What was done"), tr("Repaired by"), tr("Repaired at")],
          rows: data.findings.map((f) => [f.day, sname(f.session), f.branchName, f.category, f.zone, f.label, f.note, f.dueAt ? wibDateTime(f.dueAt) : "", f.status === "OPEN" ? tr("Open") : tr("Repaired"), f.overdue || f.fixedLate ? tr("Yes") : "", f.fixNote, f.fixedBy, f.fixedAt ? wibDateTime(f.fixedAt) : ""]) },
      ]);
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const presets = ([["today", tr("Today"), 0, 0], ["yesterday", tr("Yesterday"), 1, 1], ["7", tr("Last 7 days"), 6, 0], ["30", tr("Last 30 days"), 29, 0]] as const)
    .map(([value, label, a, b]) => ({ value, label, from: daysAgo(a), to: daysAgo(b) }));
  return (
    <Page title={tr("Travel Path")} eyebrow={tr("Operations")} subtitle={tr("Photo check of every outlet, several times a day")} media={<Footprints size={19} />}
      actions={<span className="flex items-center gap-2">        <Button variant="secondary" size="sm" disabled={!data} onClick={() => void exportXlsx()}><Download size={14} /> {tr("Excel")}</Button></span>}>
      {err ? <ErrorState message={err} onRetry={() => setVersion((v) => v + 1)} /> : (
        <div className="space-y-4">
          <StatStrip columns={5} label={tr("Summary")} gridClassName="grid-cols-2 lg:grid-cols-5">
            <Stat label={tr("Compliance")} value={s ? (s.rate != null ? `${s.rate}%` : "—") : <StatSkeleton />}>{s && <p>{tr("{0} of {1} sessions", fmtNumber(s.done), fmtNumber(s.expected))}</p>}</Stat>
            <Stat label={tr("Not done")} value={s ? <span className={s.missing ? "text-red-600" : undefined}>{fmtNumber(s.missing)}</span> : <StatSkeleton />}>{s && <p>{tr("{0} late", fmtNumber(s.late))}</p>}</Stat>
            <Stat label={tr("Average score")} value={s ? (s.score != null ? `${s.score}%` : "—") : <StatSkeleton />}>{s && <p>{tr("{0} not passed", fmtNumber(s.failed))}</p>}</Stat>
            <Stat label={tr("Critical findings")} value={s ? <span className={s.critical ? "text-red-600" : undefined}>{fmtNumber(s.critical)}</span> : <StatSkeleton />} />
            <Stat label={tr("Open findings")} value={s ? fmtNumber(s.openFindings) : <StatSkeleton />}>{s && <p className={s.overdue ? "font-semibold text-red-600" : undefined}>{tr("{0} overdue", fmtNumber(s.overdue))}</p>}</Stat>
          </StatStrip>
          <WorkCard<Tab> active={tab} onTab={setTab} label={tr("Views")} tabs={[{ key: "compliance", label: tr("Compliance"), icon: <CalendarCheck size={15} /> }, { key: "reports", label: tr("Reports"), icon: <FileText size={15} />, count: s?.reports },
            { key: "findings", label: tr("Findings"), icon: <AlertTriangle size={15} />, count: s?.openFindings }, { key: "analysis", label: tr("Analysis"), icon: <BarChart3 size={15} /> }]}
            left={<div className="flex flex-wrap items-center gap-2">
              <Button variant="secondary" size="sm" className="!h-9" onClick={() => setFiltering(true)}><SlidersHorizontal size={14} /> {tr("Filter")}{group ? <span className="rounded-full bg-[color:var(--j-0C66E4)] px-1.5 text-[10px] font-bold text-white">1</span> : null}</Button>
              <button type="button" onClick={() => setFiltering(true)} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[color:var(--j-091E420F)] px-3 text-xs font-medium text-[color:var(--j-44546F)]"><CalendarDays size={13} />{from === to ? dmy(from) : `${dmy(from)} – ${dmy(to)}`}</button>
              {group && <button type="button" onClick={() => setGroup("")} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-[color:var(--j-E9F2FF)] px-3 text-xs font-medium text-[color:var(--j-0055CC)]">{tr("Group")}: {groups.find((g) => g.id === group)?.code ?? group}<X size={13} /></button>}
            </div>}>
            {tab !== "analysis" && <Toolbar><div className="flex flex-wrap items-center gap-2">
              <div className="w-full sm:w-64"><SearchBox value={q} onChange={setQ} placeholder={tr("Search outlet")} /></div>
              {tab === "reports" && <QuickChips<RShow> value={rshow} onChange={setRshow} label={tr("Show")} items={[{ key: "all", label: tr("All") }, { key: "failed", label: tr("Not passed"), dot: "bg-red-500", count: s?.failed }, { key: "critical", label: tr("Critical") }, { key: "late", label: tr("Late"), dot: "bg-amber-400" }]} />}
              {tab === "findings" && <QuickChips<FShow> value={fshow} onChange={setFshow} label={tr("Show")} items={[{ key: "open", label: tr("Open"), count: s?.openFindings }, { key: "overdue", label: tr("Overdue"), dot: "bg-red-500", count: s?.overdue }, { key: "critical", label: tr("Critical") }, { key: "fixed", label: tr("Repaired"), dot: "bg-emerald-500" }, { key: "all", label: tr("All") }]} />}
            </div>
              {tab === "compliance" && data && <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-[color:var(--j-626F86)]">{(["done", "late", "missing", "waiting"] as CellState[]).map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className={cx("h-3 w-3 rounded-sm", CELL[k])} />{cellText(k)}</span>)}
                <span>{data.sessions.map((x) => `${sessionName(x)} ${x.from}–${x.to}`).join(" · ")}</span><span>{tr("Counted from {0}", dmy(data.since))}</span></p>}
            </Toolbar>}
            {!data ? <SkeletonTable cols={6} /> : tab === "compliance" ? (outlets.length === 0 ? <Empty title={tr("Nothing matches the search or filters")} /> : (
              <div className="overflow-x-auto"><table className={cx(jTable, "min-w-[760px]")}>
                <thead><tr className={jHeadRow}><th className={cx(jTh, "sticky left-0 z-10 bg-white")}>{tr("Outlet")}</th><th className={cx(jTh, "text-right")}>{tr("Done")}</th><th className={cx(jTh, "text-right")}>{tr("Score")}</th>
                  {data.dates.map((d) => <th key={d} className="px-1 py-2 text-center font-medium">{d.slice(8)}/{d.slice(5, 7)}</th>)}</tr></thead>
                <tbody>{po.rows.map((o) => (
                  <tr key={o.code} className={jRow.replace("cursor-pointer", "")}>
                    <td className={cx(jTd, "sticky left-0 z-10 bg-white")}><span className="block font-medium text-[color:var(--j-172B4D)]">{short(o.name)}</span><span className="text-[11px] text-[color:var(--j-626F86)]">{o.code}{o.group ? ` · ${o.group}` : ""}</span></td>
                    <td className={cx(jTd, "whitespace-nowrap text-right tabular-nums", o.missing > 0 && "font-semibold text-red-700")}>{o.done}/{o.expected}</td>
                    <td className={cx(jTd, "text-right tabular-nums")}>{o.score != null ? `${o.score}%` : "—"}</td>
                    {o.days.map((d) => <td key={d.date} className="px-1 py-2 text-center"><span className="inline-flex gap-0.5">{d.sessions.map((c) => {
                      const label = `${short(o.name)} · ${dmy(d.date)} · ${sname(c.session)}: ${cellText(c.state)}${c.score != null ? ` ${c.score}%` : ""}`;
                      const box = cx("block h-5 w-4 rounded-sm", CELL[c.state], c.critical > 0 && "ring-2 ring-red-600 ring-offset-1");
                      return c.id ? <button key={c.session} type="button" title={label} aria-label={label} onClick={() => setOpen(c.id)} className={box} /> : <span key={c.session} title={label} className={box} />;
                    })}</span></td>)}
                  </tr>))}</tbody></table></div>
            )) : tab === "reports" ? (reports.length === 0 ? <Empty title={tr("No report in this period")} /> : (
              <div className="overflow-x-auto"><table className={cx(jTable, "min-w-[860px]")}>
                <thead><tr className={jHeadRow}>{[tr("Sent"), tr("Session"), tr("Outlet"), tr("Done by"), tr("Score"), tr("Findings"), "N/A", tr("Notes")].map((h) => <th key={h} className={jTh}>{h}</th>)}</tr></thead>
                <tbody>{pr.rows.map((r) => (
                  <tr key={r.id} className={jRow} onClick={() => setOpen(r.id)}>
                    <td className={cx(jTd, "whitespace-nowrap text-[color:var(--j-44546F)]")}>{wibDateTime(r.submittedAt)}</td><td className={jTd}>{r.sessionLabel}</td>
                    <td className={cx(jTd, "font-medium text-[color:var(--j-172B4D)]")}><button type="button" className="text-left hover:underline" onClick={(e) => { e.stopPropagation(); setOpen(r.id); }}>{short(r.branchName)}</button></td>
                    <td className={cx(jTd, "text-[color:var(--j-44546F)]")}>{[r.crew, r.supervisor].filter(Boolean).join(" & ")}</td><td className={jTd}><Score v={r.score} band={r.band} /></td>
                    <td className={jTd}>{r.counts?.nok ? <span className={cx("tabular-nums", r.counts.critical > 0 && "font-semibold text-red-700")}>{r.counts.nok}{r.counts.critical ? ` (${tr("{0} critical", r.counts.critical)})` : ""}</span> : "0"}</td><td className={cx(jTd, "tabular-nums")}>{r.counts?.na ?? 0}</td>
                    <td className={jTd}><span className="flex flex-wrap gap-1">{r.late && <Lozenge tone="amber">{tr("Late")}</Lozenge>}{r.reportLate && <Lozenge tone="amber">{tr("Late report")}</Lozenge>}{r.outsideRadius && <Lozenge tone="red">{tr("Outside radius")}</Lozenge>}</span></td>
                  </tr>))}</tbody></table></div>
            )) : tab === "findings" ? (findings.length === 0 ? <Empty title={tr("No finding here")} /> : (
              <div className="overflow-x-auto"><table className={cx(jTable, "min-w-[980px]")}>
                <thead><tr className={jHeadRow}>{[tr("Outlet"), tr("Area"), tr("Finding"), tr("Photo"), tr("Repair before"), tr("Status"), ""].map((h, i) => <th key={i} className={jTh}>{h}</th>)}</tr></thead>
                <tbody>{pf.rows.map((f) => (
                  <tr key={f.id} className="border-b border-[color:var(--j-F1F2F4)] align-top hover:bg-[color:var(--j-F7F8F9)]">
                    <td className={jTd}><button type="button" onClick={() => setOpen(f.reportId)} className="text-left font-medium text-[color:var(--j-172B4D)] hover:underline">{short(f.branchName)}</button><span className="block text-[11px] text-[color:var(--j-626F86)]">{dmy(f.day)} · {sname(f.session)}</span></td>
                    <td className={jTd}><Cat c={f.category} /> <span className="text-[color:var(--j-172B4D)]">{f.label}</span></td><td className={cx(jTd, "max-w-[18rem] text-[color:var(--j-44546F)]")}>{f.note}{f.reopenedNote && <span className="block text-xs text-amber-800">{tr("Opened again by {0}: {1}", f.reopenedBy ?? "", f.reopenedNote)}</span>}</td>
                    <td className={jTd}><Photos ids={f.photos.MAIN} /> <Photos ids={f.photos.AFTER} label={tr("After")} /></td>
                    <td className={cx(jTd, "whitespace-nowrap", f.overdue && "font-semibold text-red-700")}>{f.dueAt ? wibDateTime(f.dueAt) : "—"}</td>
                    <td className={jTd}>{f.status === "OPEN" ? <Lozenge tone={f.overdue ? "red" : "amber"}>{f.overdue ? tr("Overdue") : tr("Open")}</Lozenge> : <><Lozenge tone="green">{tr("Repaired")}</Lozenge>{f.fixedLate && <span className="ml-1"><Lozenge tone="amber">{tr("Late")}</Lozenge></span>}
                      <span className="block max-w-[14rem] text-xs text-[color:var(--j-44546F)]">{f.fixNote}</span><span className="block text-[11px] text-[color:var(--j-626F86)]">{f.fixedBy} · {wibDateTime(f.fixedAt)}</span></>}</td>
                    <td className={cx(jTd, "text-right")}>{f.status === "FIXED" && <Button size="sm" variant="ghost" onClick={() => setReopening(f)}><RotateCcw size={13} /> {tr("Open again")}</Button>}</td>
                  </tr>))}</tbody></table></div>
            )) : (
              <div className="grid gap-6 p-4 sm:p-5 lg:grid-cols-2">
                <section><h3 className="mb-2 text-sm font-semibold text-[color:var(--j-172B4D)]">{tr("Most frequent findings")}</h3>
                  {data.top.length === 0 ? <p className="text-sm text-[color:var(--j-626F86)]">{tr("No finding here")}</p> : <ul className="space-y-2">{data.top.slice(0, 15).map((x) => (
                    <li key={x.key} className="text-sm"><div className="flex items-baseline justify-between gap-3"><span className="min-w-0 truncate"><Cat c={x.category} /> {x.label}</span><span className="shrink-0 tabular-nums text-[color:var(--j-44546F)]">{x.count}× · {tr("{0} outlets", x.outlets.length)}</span></div>
                      <span className="mt-1 block h-2 rounded-sm bg-[color:var(--j-091E420F)]"><span className="block h-2 rounded-sm bg-[color:var(--j-0C66E4)]" style={{ width: `${(x.count / data.top[0].count) * 100}%` }} /></span></li>))}</ul>}</section>
                <section><h3 className="mb-2 text-sm font-semibold text-[color:var(--j-172B4D)]">{tr("Per branch group")}</h3>
                  <table className={jTable}><thead><tr className={jHeadRow}>{[tr("Group"), tr("Outlets"), tr("Done"), "%", tr("Average score")].map((h) => <th key={h} className={jTh}>{h}</th>)}</tr></thead>
                    <tbody>{data.groups.map((g) => <tr key={g.code} className="border-b border-[color:var(--j-F1F2F4)]"><td className={cx(jTd, "font-medium")}>{g.code}</td><td className={cx(jTd, "tabular-nums")}>{g.outlets}</td><td className={cx(jTd, "tabular-nums")}>{g.done}/{g.expected}</td><td className={cx(jTd, "tabular-nums")}>{g.rate != null ? `${g.rate}%` : "—"}</td><td className={cx(jTd, "tabular-nums")}>{g.score != null ? `${g.score}%` : "—"}</td></tr>)}</tbody></table>
                  <p className="mt-3 text-xs text-[color:var(--j-626F86)]">{tr("Score = areas that meet ÷ areas that apply; one critical finding caps it at {0}%. {1}% or more is standard, below {2}% is not passed.", data.criticalCap, data.standard, data.pass)}</p></section>
              </div>)}
            {data && tab !== "analysis" && <CardFooter><span>{tr("{0} lines", fmtNumber(tab === "compliance" ? outlets.length : tab === "reports" ? reports.length : findings.length))}{data.truncated ? ` · ${tr("only the latest are listed, narrow the period")}` : ""}</span><PageNav paged={tab === "compliance" ? po : tab === "reports" ? pr : pf} /></CardFooter>}
          </WorkCard>
        </div>
      )}
      {open && <ReportDrawer id={open} onClose={() => setOpen(null)} />}
      {reopening && <Reopen finding={reopening} onClose={() => setReopening(null)} onDone={() => { setReopening(null); toast(tr("Finding opened again")); setVersion((v) => v + 1); }} />}
      {filtering && <FilterDrawer from={from} to={to} group={group} groups={groups} presets={presets} onClose={() => setFiltering(false)}
        onApply={(f, t2, g) => { setFrom(f); setTo(t2); setGroup(g); setFiltering(false); }} />}
    </Page>
  );
}

function ReportDrawer({ id, onClose }: { id: string; onClose: () => void }) {
  const [r, setR] = useState<FullReport | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => { call<FullReport>(`/api/monitoring/travel/reports/${id}`).then(setR).catch((e: Error) => setErr(e.message)); }, [id]);
  return (
    <Drawer open onClose={onClose} size="lg" icon={<Footprints size={18} />} title={r ? `${r.branchName} · ${r.sessionLabel}` : "Travel Path"} description={r ? `${wibDateTime(r.submittedAt)} · ${[r.crew, r.supervisor].filter(Boolean).join(" & ")}` : undefined}>
      {err ? <ErrorState message={err} /> : !r ? <SkeletonList rows={8} /> : (
        <div className="space-y-5">
          <p className="flex flex-wrap items-center gap-2 text-sm"><Score v={r.score} band={r.band} />{r.band && <span className="font-semibold text-[color:var(--j-172B4D)]">{bandText(r.band)}</span>}<span className="text-[color:var(--j-44546F)]">{tr("{0} meet · {1} findings · {2} N/A", r.counts?.ok ?? 0, r.counts?.nok ?? 0, r.counts?.na ?? 0)}</span>
            {r.late && <Lozenge tone="amber">{tr("Late")}</Lozenge>}{r.reportLate && <Lozenge tone="amber">{tr("Late report")}</Lozenge>}{r.distanceM != null && <span className="text-xs text-[color:var(--j-626F86)]">{tr("{0} m from the outlet", r.distanceM)}</span>}</p>
          {r.definition.groups.flatMap((g) => g.sections).map((z) => (
            <section key={z.key}><h3 className="mb-1 text-sm font-semibold text-[color:var(--j-172B4D)]">{tl(z, "title")}</h3>
              <ul className="divide-y divide-[color:var(--j-F1F2F4)] rounded-[3px] border border-[color:var(--j-DCDFE4)]">{z.items.map((i) => { const a = r.answers[i.key]; const f = r.findings?.find((x) => x.itemKey === i.key); return (
                <li key={i.key} className={cx("space-y-1 px-3 py-2.5 text-sm", a?.rating === "NOK" && "bg-red-50/40")}>
                  <p className="flex flex-wrap items-center gap-1.5"><span className="font-medium text-[color:var(--j-172B4D)]">{i.no}. {tl(i)}</span><Cat c={i.category} />{a?.rating && <Lozenge tone={a.rating === "OK" ? "green" : a.rating === "NOK" ? "red" : "grey"}>{ratingText(a.rating)}</Lozenge>}</p>
                  {a?.note && <p className="text-[color:var(--j-44546F)]">{a.note}</p>}
                  <Photos ids={r.photos.filter((p) => p.item === i.key && p.kind === "MAIN").map((p) => p.id)} />
                  {f && <p className="text-xs text-[color:var(--j-44546F)]"><Wrench size={12} className="mr-1 inline" aria-hidden />{f.status === "FIXED" ? `${tr("Repaired")} · ${f.fixNote ?? ""} · ${f.fixedBy ?? ""} ${f.fixedAt ? wibDateTime(f.fixedAt) : ""}` : `${f.overdue ? tr("Overdue") : tr("Open")} · ${tr("Repair before {0}", f.dueAt ? wibDateTime(f.dueAt) : "—")}`}</p>}
                  <Photos ids={r.photos.filter((p) => p.item === i.key && p.kind === "AFTER").map((p) => p.id)} label={tr("After")} />
                </li>); })}</ul></section>))}
        </div>)}
    </Drawer>
  );
}

function Reopen({ finding, onClose, onDone }: { finding: Finding; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await call(`/api/monitoring/travel/findings/${finding.id}/reopen`, { method: "POST", json: { note: note.trim() } }); onDone(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} icon={<RotateCcw size={18} />} title={tr("Open the finding again")} description={`${finding.branchName} · ${finding.label}`}
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} disabled={note.trim().length < 3} onClick={() => void save()}>{tr("Open again")}</Button></>}>
      <div className="space-y-4"><p className="text-sm text-[color:var(--j-44546F)]">{finding.fixNote}</p><Photos ids={finding.photos.AFTER} label={tr("After")} />
        <Field label={tr("What is still not right")} required><textarea className="min-h-[80px] w-full rounded-[3px] border border-[color:var(--j-8590A2)] px-3 py-2 text-sm" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} /></Field></div>
    </Drawer>
  );
}

/** Every filter of the monitor in one drawer: the period (shortcuts or two dates) and the branch group. */
function FilterDrawer({ from, to, group, groups, presets, onApply, onClose }: { from: string; to: string; group: string; groups: { id: string; code: string }[];
  presets: { value: string; label: string; from: string; to: string }[]; onApply: (from: string, to: string, group: string) => void; onClose: () => void }) {
  const [f, setF] = useState(from);
  const [t2, setT] = useState(to);
  const [g, setG] = useState(group);
  const preset = presets.find((p) => p.from === f && p.to === t2)?.value ?? "custom";
  return (
    <Drawer open onClose={onClose} icon={<SlidersHorizontal size={18} />} title={tr("Filter")} description={tr("The period and the branch group of the monitor")}
      footer={<><Button variant="secondary" onClick={() => { setF(presets[2].from); setT(presets[2].to); setG(""); }}><RotateCcw size={14} /> {tr("Reset")}</Button><Button onClick={() => onApply(f, t2, g)}>{tr("Show")}</Button></>}>
      <div className="space-y-5">
        <FRow label={tr("Period")} hint={tr("At most 93 days")}><PeriodField label={tr("Period")} from={f} to={t2} preset={preset} presets={presets} onChange={(a, b) => { setF(a); setT(b); }} /></FRow>
        <FRow label={tr("Branch group")}><JSelect value={g} onChange={setG} label={tr("Branch group")} placeholder={tr("All groups")} options={[{ value: "", label: tr("All groups") }, ...groups.map((x) => ({ value: x.id, label: x.code }))]} /></FRow>
      </div>
    </Drawer>
  );
}
