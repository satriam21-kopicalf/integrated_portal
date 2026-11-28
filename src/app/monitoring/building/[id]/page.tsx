"use client";

// Building & Renovation → one project (2026-11-27, Building team): summary with the S-curve, the RAB (sections, lines from the
// material catalog, actual, approval and versions, Excel) and the progress (stages with weight and plan, reports with photos).

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Camera, CheckCircle2, ClipboardList, HardHat, ListChecks, Package, Pencil, Plus, Send, Trash2, TrendingUp, Undo2, Wallet, X } from "lucide-react";
import { Badge, Button, ErrorState, cx, useToast } from "@/so/ui";
import { Page, Stat, StatSkeleton, StatStrip } from "@/components/kc/compat";
import { WorkCard, JSelect } from "@/so/ui/Jira";
import Drawer from "@/so/ui/Drawer";
import ExcelIconButton from "@/components/ExcelIconButton";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { downloadSheets } from "@/aggregator/ui";
import { DateField, Facts, Group, Row, ctl } from "@/aggregator/fields";
import { dmy } from "@/so/ui/Filters";
import { ProgressBar, ProjectForm } from "@/building/Projects";
import { type Full, type Line, type LineKind, type Stage, type Status, LINE_KIND_LABEL, RAB_LABEL, RAB_TONE, STATUS_LABEL, STATUS_TONE, num, placeOf, rp, today } from "@/building/types";

type Tab = "summary" | "rab" | "progress";
type Pick = { id: number; label: string; category: string; spec: string | null; detail: string | null; unit: string | null; price: number | null; priceOn: string | null; stale: boolean; vendor: string | null; vendorId: number | null; group: string };
type Vendor = { id: number; name: string; location: string | null; kindLabel: string; bank?: string | null; accountNo?: string | null; accountName?: string | null };
const FREE = ["REJECTED", "CANCELLED"];
const taken = (l: Line) => !!l.fundId && !FREE.includes(l.fundStatus ?? "");

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const [p, setP] = useState<Full | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("summary");
  const [edit, setEdit] = useState(false);
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => { setErr(null); call<Full>(`/api/building/projects/${id}`).then(setP).catch((e: Error) => setErr(e.message)); }, [id]);
  useEffect(load, [load]);
  const act = useCallback(async (path: string, json: unknown, ok: string, method = "POST") => {
    setBusy(true);
    try { setP(await call<Full>(`/api/building/projects/${id}${path}`, { method, json })); toast(ok, "ok"); return true; }
    catch (e) { toast((e as Error).message, "error"); return false; } finally { setBusy(false); }
  }, [id, toast]);
  if (err) return <Page title={tr("Project")}><ErrorState message={err} onRetry={load} /></Page>;
  const over = p && p.budget != null && p.rabTotal != null && p.rabTotal > p.budget;
  return (
    <Page title={p?.name ?? tr("Project")} eyebrow={p ? `${p.number} · ${p.kindLabel}` : tr("Building & Renovation")} media={<HardHat size={19} />}
      subtitle={p ? placeOf(p) : undefined}
      actions={<div className="flex flex-wrap gap-2">
        <Link href="/monitoring/building" className="inline-flex h-10 items-center gap-1.5 rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white px-3 text-sm font-medium text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]"><ArrowLeft size={15} />{tr("Projects")}</Link>
        {p && <Button variant="secondary" onClick={() => setEdit(true)}><Pencil size={15} />{tr("Project data")}</Button>}
      </div>}>
      {!p ? <StatStrip columns={4} label={tr("Project")}><Stat label={tr("Progress")} value={<StatSkeleton />} /><Stat label="RAB" value={<StatSkeleton />} /><Stat label={tr("Actual")} value={<StatSkeleton />} /><Stat label={tr("Status")} value={<StatSkeleton />} /></StatStrip> : <>
        <StatStrip columns={4} label={tr("Project")} gridClassName="grid-cols-2 lg:grid-cols-4">
          <Stat label={tr("Progress")} value={`${num(p.progress, 1)}%`}><p>{tr("plan today {0}%", num(p.plannedToday, 1))}</p><ProgressBar value={p.progress} plan={p.plannedToday} className="mt-1.5" /></Stat>
          <Stat label="RAB" value={rp(p.rabTotal)}><Badge tone={RAB_TONE[p.rabStatus]}>{RAB_LABEL[p.rabStatus]()}{p.rabVersion ? ` · v${p.rabVersion}` : ""}</Badge>
            {p.budget != null && <p className={cx(over && "font-semibold text-red-700")}>{tr("Budget {0}", rp(p.budget))}</p>}</Stat>
          <Stat label={tr("Actual")} value={rp(p.actualTotal)}><p>{tr("{0} of {1} lines bought", p.bought, p.lines.length)}</p>
            {p.rabTotal ? <p>{num(((p.actualTotal ?? 0) / p.rabTotal) * 100, 1)}% {tr("of the RAB")}</p> : null}</Stat>
          <Stat label={tr("Status")} value={<Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]()}</Badge>}>
            <p className={cx(p.late && "font-semibold text-red-700")}>{p.planEnd ? tr("target {0}", dmy(p.planEnd)) : tr("No target yet")}{p.late ? ` · ${tr("late")}` : ""}</p>
            {p.next.length > 0 && <div className="mt-2 flex flex-wrap gap-1.5">{p.next.map((s) => <Button key={s} size="sm" variant={s === "CANCELLED" || s === "ON_HOLD" ? "secondary" : "primary"} disabled={busy} onClick={() => setStatus(s)}>{STATUS_LABEL[s]()}</Button>)}</div>}</Stat>
        </StatStrip>
        <WorkCard<Tab> active={tab} onTab={setTab} label={tr("Views")} tabs={[{ key: "summary", label: tr("Summary"), icon: <TrendingUp size={15} /> },
          { key: "rab", label: "RAB", icon: <ClipboardList size={15} />, count: p.lines.length }, { key: "progress", label: tr("Progress"), icon: <ListChecks size={15} />, count: p.reports.length }]}>
          {tab === "summary" ? <Summary p={p} /> : tab === "rab" ? <Rab p={p} busy={busy} act={act} /> : <Progress p={p} busy={busy} act={act} />}
        </WorkCard>
      </>}
      {edit && p && <ProjectForm p={p} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); load(); }} />}
      {status && p && <StatusDrawer to={status} busy={busy} onClose={() => setStatus(null)} onSave={async (note) => { if (await act("/status", { to: status, note }, tr("Status changed"))) setStatus(null); }} />}
    </Page>
  );
}

function StatusDrawer({ to, busy, onClose, onSave }: { to: Status; busy: boolean; onClose: () => void; onSave: (note: string) => void }) {
  const [note, setNote] = useState("");
  const need = to === "ON_HOLD" || to === "CANCELLED";
  return (
    <Drawer open onClose={onClose} size="sm" icon={<CheckCircle2 size={18} />} title={tr("Move to {0}", STATUS_LABEL[to]())}
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button disabled={busy || (need && !note.trim())} onClick={() => onSave(note)}>{tr("Save")}</Button></div>}>
      <Row label={need ? tr("Reason") : tr("Note")} required={need}><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={cx(ctl, "h-auto py-2")} /></Row>
      {to === "IN_PROGRESS" && <p className="mt-3 text-xs text-[color:var(--j-626F86)]">{tr("The actual start is set to today when it is empty.")}</p>}
    </Drawer>
  );
}

// ------------------------------------------------------------------------------------------------ summary

function Curve({ points }: { points: Full["curve"] }) {
  if (points.length < 2) return <p className="rounded-[3px] bg-[color:var(--j-F7F8F9)] p-4 text-sm text-[color:var(--j-626F86)]">{tr("Fill the plan dates of the stages to see the S-curve.")}</p>;
  const W = 640, H = 220, L = 34, B = 26, T = 10, R = 10;
  const x = (i: number) => L + (i / (points.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - v / 100) * (H - T - B);
  const plan = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.plan).toFixed(1)}`).join(" ");
  const act = points.filter((p) => p.actual != null);
  const actual = act.map((p, i) => `${i ? "L" : "M"}${x(points.indexOf(p)).toFixed(1)},${y(p.actual ?? 0).toFixed(1)}`).join(" ");
  const ticks = points.length <= 8 ? points.map((_, i) => i) : [0, Math.floor(points.length / 2), points.length - 1];
  return (
    <figure>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={tr("S-curve: plan and actual progress")}>
        {[0, 25, 50, 75, 100].map((v) => <g key={v}><line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="stroke-neutral-200" strokeWidth={1} /><text x={L - 6} y={y(v) + 3} textAnchor="end" className="fill-neutral-400 text-[10px]">{v}%</text></g>)}
        {ticks.map((i) => <text key={i} x={x(i)} y={H - 8} textAnchor={i === 0 ? "start" : i === points.length - 1 ? "end" : "middle"} className="fill-neutral-400 text-[10px]">{dmy(points[i].day).slice(0, 5)}</text>)}
        <path d={plan} fill="none" className="stroke-neutral-400" strokeWidth={2} strokeDasharray="5 4" />
        {act.length > 0 && <path d={actual} fill="none" className="stroke-[color:var(--j-0C66E4)]" strokeWidth={2.5} />}
        {act.length > 0 && <circle cx={x(points.indexOf(act[act.length - 1]))} cy={y(act[act.length - 1].actual ?? 0)} r={4} className="fill-[color:var(--j-0C66E4)]" />}
      </svg>
      <figcaption className="mt-1 flex flex-wrap gap-4 text-xs text-[color:var(--j-44546F)]">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 border-t-2 border-dashed border-neutral-400" />{tr("Plan")}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-5 bg-[color:var(--j-0C66E4)]" />{tr("Actual")}</span>
      </figcaption>
    </figure>
  );
}

function Summary({ p }: { p: Full }) {
  return (
    <div className="grid gap-5 p-4 sm:p-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="space-y-5">
        <section><h3 className="mb-2 text-sm font-semibold text-[color:var(--j-172B4D)]">{tr("S-curve")}</h3><Curve points={p.curve} /></section>
        <section><h3 className="mb-2 text-sm font-semibold text-[color:var(--j-172B4D)]">{tr("RAB per section")}</h3>
          <ul className="divide-y divide-[color:var(--j-F1F2F4)] rounded-[3px] border border-[color:var(--j-DCDFE4)] text-sm">
            {p.sections.filter((s) => s.lines).map((s) => (
              <li key={s.id} className="flex items-center justify-between gap-3 px-3 py-2"><span className="min-w-0 truncate">{s.name}<span className="ml-1 text-xs text-[color:var(--j-626F86)]">{tr("{0} lines", s.lines)}</span></span>
                <span className="text-right tabular-nums"><span className="block font-semibold text-[color:var(--j-172B4D)]">{rp(s.total)}</span>{s.actual > 0 && <span className="text-[11px] text-[color:var(--j-626F86)]">{tr("actual {0}", rp(s.actual))}</span>}</span></li>))}
            {!p.sections.some((s) => s.lines) && <li className="px-3 py-3 text-xs text-[color:var(--j-626F86)]">{tr("The RAB is still empty")}</li>}
          </ul></section>
      </div>
      <div className="space-y-5">
        <Facts rows={[
          [tr("Kind"), p.kindLabel], [tr("Location"), placeOf(p)], [tr("Address"), p.address || "—"], [tr("Building area"), p.areaM2 != null ? `${num(p.areaM2)} m²` : "—"],
          [tr("Business unit"), p.businessUnit || "—"], [tr("PIC Building"), p.picName || "—"], [tr("Contractor / foreman"), p.contractor || "—"],
          [tr("Plan"), p.planStart ? `${dmy(p.planStart)} – ${p.planEnd ? dmy(p.planEnd) : "?"}` : "—"],
          [tr("Actual"), p.actualStart ? `${dmy(p.actualStart)} – ${p.actualEnd ? dmy(p.actualEnd) : tr("running")}` : "—"],
          [tr("Budget"), rp(p.budget)], [tr("Created"), `${p.createdBy ?? ""} · ${dmy(p.createdAt.slice(0, 10))}`],
        ]} />
        {p.note && <section><h3 className="mb-1 text-sm font-semibold text-[color:var(--j-172B4D)]">{tr("Note")}</h3><p className="whitespace-pre-line rounded-[3px] bg-[color:var(--j-F7F8F9)] p-3 text-xs text-[color:var(--j-44546F)]">{p.note}</p></section>}
      </div>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------ RAB

type Act = (path: string, json: unknown, ok: string, method?: string) => Promise<boolean>;

function Rab({ p, busy, act }: { p: Full; busy: boolean; act: Act }) {
  const [line, setLine] = useState<Partial<Line> | null>(null);
  const [actual, setActual] = useState<Line | null>(null);
  const [section, setSection] = useState<{ id?: number; name: string } | null>(null);
  const [decide, setDecide] = useState<boolean | null>(null);
  const [fund, setFund] = useState(false);
  const free = p.lines.filter((l) => !taken(l) && l.amount > 0);
  const locked = p.status === "DONE" || p.status === "CANCELLED";
  const exportXlsx = () => void downloadSheets(`RAB ${p.number} ${p.name}`, [
    { sheet: "RAB", title: `RAB ${p.number} · ${p.name} · ${placeOf(p)} · ${RAB_LABEL[p.rabStatus]()}${p.rabVersion ? ` v${p.rabVersion}` : ""} · ${dmy(today())}`,
      header: ["Bagian", "No", "Jenis", "Uraian", "Spesifikasi", "Volume", "Satuan", "Harga satuan (Rp)", "Jumlah (Rp)", "Tanggal harga", "Toko", "Realisasi volume", "Realisasi (Rp)", "Selisih (Rp)", "Catatan"],
      rows: [...p.sections.flatMap((s) => p.lines.filter((l) => l.sectionId === s.id).map((l, i) => [s.name, i + 1, LINE_KIND_LABEL[l.kind](), l.description, l.spec, l.qty, l.unit, l.unitPrice, l.amount,
        l.priceOn, l.vendor, l.actualQty, l.actualAmount, l.actualAmount != null ? l.actualAmount - l.amount : null, l.note])),
        ["TOTAL", null, null, null, null, null, null, null, p.rabTotal, null, null, null, p.actualTotal, null, null]] },
    { sheet: "Rekap bagian", header: ["Bagian", "Baris", "RAB (Rp)", "Realisasi (Rp)"], rows: p.sections.map((s) => [s.name, s.lines, s.total, s.actual]) },
  ]);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--j-DCDFE4)] p-4 sm:px-5">
        <span className="mr-auto flex flex-wrap items-center gap-2 text-sm"><Badge tone={RAB_TONE[p.rabStatus]}>{RAB_LABEL[p.rabStatus]()}</Badge>
          <span className="font-semibold tabular-nums text-[color:var(--j-172B4D)]">{rp(p.rabTotal)}</span>
          {p.rabStatus === "DRAFT" && p.rabVersion > 0 && <span className="text-xs text-amber-700">{tr("Changed after v{0}: approve again", p.rabVersion)}</span>}</span>
        <ExcelIconButton boxed label={tr("Export to Excel")} onClick={exportXlsx} />
        {!locked && <Button variant="secondary" onClick={() => setSection({ name: "" })}><Plus size={14} />{tr("Section")}</Button>}
        {p.rabStatus === "DRAFT" && !locked && <Button disabled={busy || !p.lines.length} onClick={() => void act("/rab/submit", {}, tr("RAB sent for approval"))}><Send size={14} />{tr("Send for approval")}</Button>}
        {p.rabStatus === "SUBMITTED" && p.canApprove && <><Button variant="secondary" disabled={busy} onClick={() => setDecide(false)}><Undo2 size={14} />{tr("Return")}</Button><Button disabled={busy} onClick={() => setDecide(true)}><CheckCircle2 size={14} />{tr("Approve")}</Button></>}
        {p.rabStatus === "APPROVED" && !locked && <Button disabled={busy || !free.length} onClick={() => setFund(true)} title={free.length ? undefined : tr("Every line is already asked")}><Wallet size={14} />{tr("Ask for funds")}</Button>}
        {p.rabStatus === "SUBMITTED" && !p.canApprove && <span className="text-xs text-[color:var(--j-626F86)]">{tr("Waiting for the approver")}{p.approvers?.length ? `: ${p.approvers.join(", ")}` : ""}</span>}
      </div>
      {p.sections.map((s) => {
        const rows = p.lines.filter((l) => l.sectionId === s.id);
        return (
          <section key={s.id} className="border-b border-[color:var(--j-F1F2F4)] last:border-b-0">
            <header className="flex flex-wrap items-center gap-2 bg-[color:var(--j-F7F8F9)] px-4 py-2 sm:px-5">
              <h3 className="mr-auto text-sm font-semibold text-[color:var(--j-172B4D)]">{s.name}<span className="ml-2 text-xs font-normal text-[color:var(--j-626F86)]">{rp(s.total)}{s.actual ? ` · ${tr("actual {0}", rp(s.actual))}` : ""}</span></h3>
              {!locked && <><button type="button" onClick={() => setSection({ id: s.id, name: s.name })} className="rounded p-1 text-[color:var(--j-626F86)] hover:bg-[color:var(--j-DCDFE4)] hover:text-[color:var(--j-172B4D)]" aria-label={tr("Rename {0}", s.name)}><Pencil size={13} /></button>
                {!rows.length && <button type="button" onClick={() => void act(`/sections/${s.id}`, undefined, tr("Section removed"), "DELETE")} className="rounded p-1 text-[color:var(--j-626F86)] hover:bg-red-50 hover:text-red-600" aria-label={tr("Remove {0}", s.name)}><Trash2 size={13} /></button>}
                <Button size="sm" variant="secondary" onClick={() => setLine({ sectionId: s.id, kind: "MATERIAL", qty: 1 })}><Plus size={13} />{tr("RAB row")}</Button></>}
            </header>
            {rows.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] table-fixed text-xs">
                  <thead className="text-left text-[10px] uppercase tracking-wide text-[color:var(--j-626F86)]"><tr>
                    <th className="px-4 py-2 sm:pl-5">{tr("Description")}</th><th className="w-24 px-2 py-2 text-right">{tr("Volume")}</th><th className="w-32 px-2 py-2 text-right">{tr("Unit price")}</th>
                    <th className="w-32 px-2 py-2 text-right">{tr("Amount")}</th><th className="w-32 px-2 py-2 text-right">{tr("Actual")}</th><th className="w-40 px-2 py-2">{tr("Store")}</th><th className="w-28" /></tr></thead>
                  <tbody className="divide-y divide-[color:var(--j-F1F2F4)]">{rows.map((l) => {
                    const diff = l.actualAmount != null ? l.actualAmount - l.amount : null;
                    const moved = l.catalogPrice != null && l.materialId != null && Math.round(l.catalogPrice) !== Math.round(l.unitPrice);
                    return (
                      <tr key={l.id} className="align-top">
                        <td className="px-4 py-2 sm:pl-5"><span className="block font-medium text-[color:var(--j-172B4D)]">{l.description}</span>
                          <span className="text-[11px] text-[color:var(--j-626F86)]">{LINE_KIND_LABEL[l.kind]()}{l.spec ? ` · ${l.spec}` : ""}{l.materialId ? ` · ${tr("catalog")}` : ""}{l.note ? ` · ${l.note}` : ""}</span>
                          {moved && <span className="block text-[11px] text-amber-700">{tr("Catalog now {0}", rp(l.catalogPrice))}</span>}
                          {l.fundNumber && <span className={cx("mt-0.5 inline-block rounded px-1.5 text-[10px] font-medium", taken(l) ? "bg-blue-50 text-blue-800" : "bg-[color:var(--j-091E420F)] text-[color:var(--j-626F86)] line-through")}>{l.fundNumber}</span>}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{num(l.qty, 3)} {l.unit ?? ""}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{rp(l.unitPrice)}{l.priceOn && <span className="block text-[10px] text-[color:var(--j-626F86)]">{dmy(l.priceOn)}</span>}</td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums text-[color:var(--j-172B4D)]">{rp(l.amount)}</td>
                        <td className="px-2 py-2 text-right tabular-nums">{l.actualAmount != null ? <>{rp(l.actualAmount)}<span className={cx("block text-[10px]", (diff ?? 0) > 0 ? "text-red-700" : "text-emerald-700")}>{(diff ?? 0) > 0 ? "+" : ""}{rp(diff)}</span></> : <span className="text-[color:var(--j-626F86)]">—</span>}</td>
                        <td className="truncate px-2 py-2 text-[color:var(--j-44546F)]" title={l.vendor ?? undefined}>{l.vendor ?? "—"}</td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          {!locked && <button type="button" onClick={() => setActual(l)} className="rounded px-1.5 py-1 text-[11px] font-medium text-[color:var(--j-0C66E4)] hover:bg-[color:var(--j-E9F2FF)]">{tr("Actual")}</button>}
                          {!locked && <button type="button" onClick={() => setLine(l)} className="rounded p-1 text-[color:var(--j-626F86)] hover:bg-[color:var(--j-091E420F)] hover:text-[color:var(--j-172B4D)]" aria-label={tr("Edit {0}", l.description)}><Pencil size={13} /></button>}
                          {!locked && <button type="button" onClick={() => void act(`/lines/${l.id}`, undefined, tr("Line removed"), "DELETE")} className="rounded p-1 text-[color:var(--j-626F86)] hover:bg-red-50 hover:text-red-600" aria-label={tr("Remove {0}", l.description)}><Trash2 size={13} /></button>}
                        </td>
                      </tr>);
                  })}</tbody>
                </table>
              </div>)}
          </section>);
      })}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t-2 border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] px-4 py-3 text-sm sm:px-5">
        <span className="font-semibold text-[color:var(--j-172B4D)]">{tr("Total RAB")} <span className="tabular-nums">{rp(p.rabTotal)}</span></span>
        <span className="text-xs text-[color:var(--j-44546F)]">{(Object.keys(p.kinds) as LineKind[]).filter((k) => p.kinds[k]).map((k) => `${LINE_KIND_LABEL[k]()} ${rp(p.kinds[k])}`).join(" · ")}</span>
        <span className="font-semibold text-[color:var(--j-172B4D)]">{tr("Actual")} <span className="tabular-nums">{rp(p.actualTotal)}</span></span>
      </div>
      {p.funds.length > 0 && (
        <div className="border-t border-[color:var(--j-DCDFE4)] p-4 sm:px-5">
          <h3 className="mb-2 text-sm font-semibold text-[color:var(--j-172B4D)]">{tr("Fund Requests of the project")}</h3>
          <ul className="divide-y divide-[color:var(--j-F1F2F4)] rounded-[3px] border border-[color:var(--j-DCDFE4)] text-xs">{p.funds.map((f) => (
            <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
              <span><a href={`/monitoring/pengajuan?open=${f.id}`} className="font-semibold text-[color:var(--j-0C66E4)] hover:underline">{f.number}</a> · {tr("{0} lines", f.lines)} · {f.payee ?? "—"}{f.bank ? ` (${f.bank})` : ""}</span>
              <span className="flex items-center gap-2"><Badge tone={FREE.includes(f.status) ? "red" : f.status === "DONE" ? "green" : f.status === "SUBMITTED" ? "amber" : "blue"}>{f.statusLabel}</Badge>
                <b className="tabular-nums text-[color:var(--j-172B4D)]">{rp(f.paid ?? f.approved ?? f.requested)}</b></span>
            </li>))}</ul>
        </div>)}
      {p.versions.length > 0 && (
        <div className="border-t border-[color:var(--j-DCDFE4)] p-4 sm:px-5">
          <h3 className="mb-2 text-sm font-semibold text-[color:var(--j-172B4D)]">{tr("Approved versions")}</h3>
          <ul className="space-y-1 text-xs text-[color:var(--j-44546F)]">{p.versions.map((v) => <li key={v.version}><b className="text-[color:var(--j-172B4D)]">v{v.version}</b> · {rp(v.total)} · {v.by} · {dmy(v.at.slice(0, 10))}{v.note ? ` · ${v.note}` : ""}</li>)}</ul>
        </div>)}
      {line && <LineDrawer p={p} line={line} busy={busy} onClose={() => setLine(null)} onSave={async (body) => { if (await act(line.id ? `/lines/${line.id}` : "/lines", body, tr("Line saved"), line.id ? "PUT" : "POST")) setLine(null); }} />}
      {actual && <ActualDrawer line={actual} busy={busy} onClose={() => setActual(null)} onSave={async (q, a) => { if (await act(`/lines/${actual.id}/actual`, { actualQty: q, actualAmount: a }, tr("Actual saved"), "PUT")) setActual(null); }} />}
      {section && <Drawer open onClose={() => setSection(null)} size="sm" icon={<ClipboardList size={18} />} title={section.id ? tr("Rename section") : tr("New section")}
        footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setSection(null)}>{tr("Cancel")}</Button>
          <Button disabled={busy || !section.name.trim()} onClick={async () => { if (await act(section.id ? `/sections/${section.id}` : "/sections", { name: section.name }, tr("Saved"), section.id ? "PUT" : "POST")) setSection(null); }}>{tr("Save")}</Button></div>}>
        <Row label={tr("Section name")} required><input autoFocus value={section.name} onChange={(e) => setSection({ ...section, name: e.target.value })} maxLength={120} className={ctl} /></Row>
      </Drawer>}
      {fund && <FundDrawer p={p} busy={busy} onClose={() => setFund(false)} onSave={async (body) => { if (await act("/fund", body, tr("Fund Request sent"))) setFund(false); }} />}
      {decide !== null && <DecideDrawer approve={decide} busy={busy} total={p.rabTotal} onClose={() => setDecide(null)} onSave={async (note) => { if (await act("/rab/decide", { approve: decide, note }, decide ? tr("RAB approved") : tr("RAB returned"))) setDecide(null); }} />}
    </div>
  );
}

/** Ask Finance for the money of RAB lines (migration 166): a Fund Request of kind Building & Renovation. */
function FundDrawer({ p, busy, onClose, onSave }: { p: Full; busy: boolean; onClose: () => void; onSave: (body: unknown) => void }) {
  const free = p.lines.filter((l) => !taken(l) && l.amount > 0);
  const [ids, setIds] = useState<Set<number>>(new Set());
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [payee, setPayee] = useState({ type: "BANK", bank: "", account: "", name: "" });
  const [from, setFrom] = useState("");
  const [note, setNote] = useState("");
  useEffect(() => { void call<{ vendors: Vendor[] }>("/api/building/catalog").then((r) => setVendors(r.vendors)).catch(() => setVendors([])); }, []);
  const stores = [...new Set(free.map((l) => l.vendor).filter(Boolean) as string[])].sort();
  const total = free.filter((l) => ids.has(l.id)).reduce((a, l) => a + l.amount, 0);
  const pickVendor = (id: string) => {
    setFrom(id);
    const v = vendors.find((x) => String(x.id) === id);
    if (v) setPayee({ type: "BANK", bank: v.bank ?? "", account: v.accountNo ?? "", name: v.accountName ?? v.name });
  };
  const toggle = (list: Line[], on: boolean) => { const n = new Set(ids); list.forEach((l) => (on ? n.add(l.id) : n.delete(l.id))); setIds(n); };
  const ok = ids.size > 0 && payee.bank.trim() && payee.account.trim() && (payee.type === "VA" || payee.name.trim());
  return (
    <Drawer open onClose={onClose} size="lg" icon={<Wallet size={18} />} title={tr("Ask for funds")} description={tr("A Fund Request of kind Building & Renovation: approval by its flow, then Finance pays; the proof after the transfer")}
      footer={<div className="flex items-center justify-between gap-2"><span className="text-sm"><b className="tabular-nums text-[color:var(--j-172B4D)]">{rp(total)}</b> <span className="text-[color:var(--j-626F86)]">· {tr("{0} lines", ids.size)}</span></span>
        <span className="flex gap-2"><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
          <Button disabled={busy || !ok} onClick={() => onSave({ lineIds: [...ids], payee, note })}><Send size={14} />{tr("Send to Finance")}</Button></span></div>}>
      <Group title={tr("RAB lines")} note={tr("Lines already asked are not shown; a rejected or cancelled fund frees its lines.")}>
        <div className="flex flex-wrap gap-1.5">
          <Button size="sm" variant="secondary" onClick={() => toggle(free, ids.size < free.length)}>{ids.size < free.length ? tr("All") : tr("None")}</Button>
          {p.sections.filter((s) => free.some((l) => l.sectionId === s.id)).map((s) => <Button key={s.id} size="sm" variant="secondary" onClick={() => toggle(free.filter((l) => l.sectionId === s.id), true)}>{s.name}</Button>)}
        </div>
        {stores.length > 1 && <Row label={tr("Lines of one store")}><JSelect value="" onChange={(v) => { if (v) { setIds(new Set(free.filter((l) => l.vendor === v).map((l) => l.id))); const d = vendors.find((x) => x.name === v); if (d) pickVendor(String(d.id)); } }} label={tr("Lines of one store")} placeholder={tr("Choose a store")} options={stores.map((x) => ({ value: x, label: x }))} /></Row>}
        <ul className="max-h-72 divide-y divide-[color:var(--j-F1F2F4)] overflow-y-auto rounded-[3px] border border-[color:var(--j-DCDFE4)]">
          {free.map((l) => (
            <li key={l.id}><label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-xs hover:bg-[color:var(--j-F7F8F9)]">
              <input type="checkbox" className="mt-0.5 h-4 w-4" checked={ids.has(l.id)} onChange={(e) => toggle([l], e.target.checked)} />
              <span className="min-w-0 flex-1"><span className="block font-medium text-[color:var(--j-172B4D)]">{l.description}</span>
                <span className="text-[color:var(--j-626F86)]">{p.sections.find((s) => s.id === l.sectionId)?.name} · {num(l.qty, 3)} {l.unit ?? ""} × {rp(l.unitPrice)}{l.vendor ? ` · ${l.vendor}` : ""}</span></span>
              <b className="shrink-0 tabular-nums text-[color:var(--j-172B4D)]">{rp(l.amount)}</b></label></li>))}
        </ul>
      </Group>
      <Group title={tr("Payee")}>
        <Row label={tr("From the directory")} hint={tr("A store with its bank account fills the transfer")}><JSelect value={from} onChange={pickVendor} label={tr("From the directory")} placeholder={tr("Not chosen")}
          options={vendors.map((v) => ({ value: String(v.id), label: v.name, hint: v.bank ? `${v.bank} ${v.accountNo ?? ""}` : tr("no bank account") }))} /></Row>
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label={tr("Kind")}><JSelect value={payee.type} onChange={(v) => setPayee({ ...payee, type: v })} label={tr("Kind")} placeholder="" options={[{ value: "BANK", label: tr("Bank account") }, { value: "VA", label: "Virtual Account" }]} /></Row>
          <Row label={payee.type === "VA" ? tr("VA provider") : tr("Bank")} required><input value={payee.bank} onChange={(e) => setPayee({ ...payee, bank: e.target.value })} maxLength={120} className={ctl} placeholder={payee.type === "VA" ? "Shopee, Tokopedia …" : "BCA, Mandiri …"} /></Row>
          <Row label={payee.type === "VA" ? tr("VA number") : tr("Account no.")} required><input value={payee.account} onChange={(e) => setPayee({ ...payee, account: e.target.value })} maxLength={120} inputMode="numeric" className={ctl} /></Row>
          <Row label={tr("Account name")} required={payee.type !== "VA"}><input value={payee.name} onChange={(e) => setPayee({ ...payee, name: e.target.value })} maxLength={120} className={ctl} /></Row>
        </div>
        <Row label={tr("Note for Finance")}><textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} className={cx(ctl, "h-auto py-2")} /></Row>
      </Group>
    </Drawer>
  );
}

function DecideDrawer({ approve, busy, total, onClose, onSave }: { approve: boolean; busy: boolean; total: number | null; onClose: () => void; onSave: (note: string) => void }) {
  const [note, setNote] = useState("");
  return (
    <Drawer open onClose={onClose} size="sm" icon={approve ? <CheckCircle2 size={18} /> : <Undo2 size={18} />} title={approve ? tr("Approve the RAB") : tr("Return the RAB")} description={rp(total)}
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button disabled={busy || (!approve && !note.trim())} onClick={() => onSave(note)}>{approve ? tr("Approve") : tr("Return")}</Button></div>}>
      <Row label={approve ? tr("Note") : tr("What to fix")} required={!approve}><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} className={cx(ctl, "h-auto py-2")} /></Row>
      {approve && <p className="mt-3 text-xs text-[color:var(--j-626F86)]">{tr("The RAB is kept as a version; a later change needs a new approval.")}</p>}
    </Drawer>
  );
}

function LineDrawer({ p, line, busy, onClose, onSave }: { p: Full; line: Partial<Line>; busy: boolean; onClose: () => void; onSave: (body: unknown) => void }) {
  const [f, setF] = useState({ sectionId: String(line.sectionId ?? p.sections[0]?.id ?? ""), kind: (line.kind ?? "MATERIAL") as LineKind, materialId: line.materialId ?? null as number | null,
    description: line.description ?? "", spec: line.spec ?? "", unit: line.unit ?? "", qty: line.qty != null ? String(line.qty) : "1",
    unitPrice: line.unitPrice != null ? String(Math.round(line.unitPrice)) : "", priceOn: line.priceOn ?? "", vendorId: line.vendorId ? String(line.vendorId) : "", vendor: line.vendorId ? "" : line.vendor ?? "", note: line.note ?? "" });
  const [q, setQ] = useState("");
  const [list, setList] = useState<Pick[] | null>(null);
  const [vendors, setVendors] = useState<Vendor[]>([]);
  useEffect(() => { void call<{ vendors: Vendor[] }>("/api/building/catalog").then((r) => setVendors(r.vendors)).catch(() => setVendors([])); }, []);
  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) { setList(null); return; }
    let off = false;
    const h = setTimeout(() => { call<Pick[]>(`/api/building/pick?q=${encodeURIComponent(t)}`).then((r) => { if (!off) setList(r); }).catch(() => { if (!off) setList([]); }); }, 250);
    return () => { off = true; clearTimeout(h); };
  }, [q]);
  const pick = (m: Pick) => { setF({ ...f, kind: "MATERIAL", materialId: m.id, description: [m.category, m.spec, m.detail].filter(Boolean).join(" "), unit: m.unit ?? f.unit,
    unitPrice: m.price != null ? String(Math.round(m.price)) : "", priceOn: m.priceOn ?? "", vendorId: m.vendorId ? String(m.vendorId) : "", vendor: m.vendorId ? "" : m.vendor ?? "" }); setQ(""); setList(null); };
  const amount = (Number(f.qty.replace(",", ".")) || 0) * (Number(f.unitPrice) || 0);
  const vendorOpts = useMemo(() => vendors.map((v) => ({ value: String(v.id), label: v.name, hint: v.location ?? v.kindLabel })), [vendors]);
  return (
    <Drawer open onClose={onClose} size="md" icon={line.id ? <Pencil size={18} /> : <Plus size={18} />} title={line.id ? tr("Edit RAB line") : tr("New RAB line")}
      description={p.rabStatus !== "DRAFT" ? tr("The approved RAB becomes a draft again and needs a new approval") : undefined}
      footer={<div className="flex items-center justify-between gap-2"><span className="text-sm font-semibold tabular-nums text-[color:var(--j-172B4D)]">{rp(amount)}</span>
        <span className="flex gap-2"><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
          <Button disabled={busy || !f.description.trim() || !f.sectionId} onClick={() => onSave({ ...f, sectionId: Number(f.sectionId), qty: f.qty.replace(",", "."), vendorId: f.vendorId || null })}>{tr("Save")}</Button></span></div>}>
      <Group title={tr("From the material catalog")} note={tr("Search and choose: description, unit, price and store are filled in. Labour and other costs: type below.")}>
        {f.materialId ? <div className="flex items-center gap-2 rounded-[3px] border border-[color:var(--j-85B8FF)] bg-[color:var(--j-E9F2FF)] px-3 py-2 text-xs"><Package size={14} className="shrink-0 text-[color:var(--j-0C66E4)]" />
          <span className="min-w-0 flex-1 font-medium text-[color:var(--j-172B4D)]">{f.description}</span>
          <button type="button" onClick={() => setF({ ...f, materialId: null })} className="text-[color:var(--j-626F86)] hover:text-[color:var(--j-172B4D)]" aria-label={tr("Not from the catalog")}><X size={14} /></button></div>
          : <div className="relative"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("e.g. keramik 60x60, kabel nym, acp taco")} aria-label={tr("Search the material catalog")} className={ctl} />
            {list && <ul className="absolute z-20 mt-1 max-h-72 w-full overflow-y-auto rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white shadow-lg">
              {list.length === 0 ? <li className="px-3 py-2 text-xs text-[color:var(--j-626F86)]">{tr("Not in the catalog: type the description below")}</li> : list.map((m) => (
                <li key={m.id}><button type="button" onClick={() => pick(m)} className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-[color:var(--j-F7F8F9)]">
                  <span className="min-w-0"><span className="block font-medium text-[color:var(--j-172B4D)]">{m.label}</span><span className="text-[color:var(--j-626F86)]">{m.group}{m.vendor ? ` · ${m.vendor}` : ""}</span></span>
                  <span className="shrink-0 text-right tabular-nums"><span className="block font-semibold">{rp(m.price)}</span>{m.priceOn && <span className={cx("text-[10px]", m.stale ? "text-amber-700" : "text-[color:var(--j-626F86)]")}>{dmy(m.priceOn)}</span>}</span></button></li>))}
            </ul>}</div>}
      </Group>
      <Group title={tr("RAB row")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label={tr("Section")} required><JSelect value={f.sectionId} onChange={(v) => setF({ ...f, sectionId: v })} label={tr("Section")} placeholder="" options={p.sections.map((s) => ({ value: String(s.id), label: s.name }))} /></Row>
          <Row label={tr("Kind")}><JSelect value={f.kind} onChange={(v) => setF({ ...f, kind: v as LineKind })} label={tr("Kind")} placeholder="" options={(Object.keys(LINE_KIND_LABEL) as LineKind[]).map((k) => ({ value: k, label: LINE_KIND_LABEL[k]() }))} /></Row>
          <Row label={tr("Description")} required className="sm:col-span-2"><input value={f.description} onChange={(e) => setF({ ...f, description: e.target.value })} maxLength={300} className={ctl} /></Row>
          <Row label={tr("Specification")}><input value={f.spec} onChange={(e) => setF({ ...f, spec: e.target.value })} maxLength={200} className={ctl} placeholder={tr("size, colour, brand …")} /></Row>
          <Row label={tr("Unit")}><input value={f.unit} onChange={(e) => setF({ ...f, unit: e.target.value })} maxLength={30} className={ctl} placeholder="m², lbr, pcs, ls" /></Row>
          <Row label={tr("Volume")} required><input value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value.replace(/[^\d.,]/g, "") })} inputMode="decimal" className={cx(ctl, "text-right tabular-nums")} /></Row>
          <Row label={tr("Unit price (Rp)")} hint={f.priceOn ? tr("price of {0}", dmy(f.priceOn)) : undefined}><input value={f.unitPrice} onChange={(e) => setF({ ...f, unitPrice: e.target.value.replace(/\D/g, ""), priceOn: today() })} inputMode="numeric" className={cx(ctl, "text-right tabular-nums")} /></Row>
          <Row label={tr("Store")} className="sm:col-span-2"><JSelect value={f.vendorId} onChange={(v) => setF({ ...f, vendorId: v, vendor: "" })} label={tr("Store")} placeholder={tr("Not chosen")} options={[{ value: "", label: tr("Not chosen") }, ...vendorOpts]} /></Row>
          {!f.vendorId && <Row label={tr("Store (as written)")} className="sm:col-span-2"><input value={f.vendor} onChange={(e) => setF({ ...f, vendor: e.target.value })} maxLength={200} className={ctl} /></Row>}
          <Row label={tr("Note")} className="sm:col-span-2"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} maxLength={500} className={ctl} /></Row>
        </div>
      </Group>
    </Drawer>
  );
}

function ActualDrawer({ line, busy, onClose, onSave }: { line: Line; busy: boolean; onClose: () => void; onSave: (qty: string, amount: string) => void }) {
  const [qty, setQty] = useState(line.actualQty != null ? String(line.actualQty) : String(line.qty));
  const [amount, setAmount] = useState(line.actualAmount != null ? String(Math.round(line.actualAmount)) : "");
  return (
    <Drawer open onClose={onClose} size="sm" icon={<Package size={18} />} title={tr("Actual purchase")} description={`${line.description} · RAB ${rp(line.amount)}`}
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button disabled={busy} onClick={() => onSave(qty.replace(",", "."), amount)}>{tr("Save")}</Button></div>}>
      <div className="grid gap-3">
        <Row label={tr("Volume bought")}><input value={qty} onChange={(e) => setQty(e.target.value.replace(/[^\d.,]/g, ""))} inputMode="decimal" className={cx(ctl, "text-right")} /></Row>
        <Row label={tr("Amount paid (Rp)")} hint={amount ? `${rp(Number(amount))} · ${tr("difference {0}", rp(Number(amount) - line.amount))}` : tr("Empty: not bought yet")}>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} inputMode="numeric" className={cx(ctl, "text-right tabular-nums")} /></Row>
      </div>
      <p className="mt-3 text-xs text-[color:var(--j-626F86)]">{tr("The actual does not change the approved RAB.")}</p>
    </Drawer>
  );
}

// ------------------------------------------------------------------------------------------------ progress

function Progress({ p, busy, act }: { p: Full; busy: boolean; act: Act }) {
  const [stages, setStages] = useState<Partial<Stage>[] | null>(null);
  const [report, setReport] = useState(false);
  const [photo, setPhoto] = useState<string | null>(null);
  const locked = p.status === "DONE" || p.status === "CANCELLED";
  const weight = (stages ?? []).reduce((a, s) => a + (Number(s.weight) || 0), 0);
  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 border-b border-[color:var(--j-DCDFE4)] p-4 sm:px-5">
        <span className="mr-auto text-sm"><b className="tabular-nums text-[color:var(--j-172B4D)]">{num(p.progress, 1)}%</b> <span className="text-[color:var(--j-626F86)]">{tr("done · plan today {0}%", num(p.plannedToday, 1))}</span></span>
        {!locked && <Button variant="secondary" onClick={() => setStages(p.stages.map((s) => ({ ...s })))}><Pencil size={14} />{tr("Stages")}</Button>}
        {!locked && <Button onClick={() => setReport(true)}><Camera size={14} />{tr("Report progress")}</Button>}
      </div>
      <ul className="divide-y divide-[color:var(--j-F1F2F4)]">
        {p.stages.map((s) => (
          <li key={s.id} className="grid gap-1 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_10rem_12rem] sm:items-center sm:gap-4 sm:px-5">
            <span className="min-w-0"><span className="block text-sm font-medium text-[color:var(--j-172B4D)]">{s.name}</span>
              <span className={cx("text-[11px]", s.late ? "text-red-700" : "text-[color:var(--j-626F86)]")}>{tr("weight {0}%", num(s.weight))} · {s.planStart ? `${dmy(s.planStart)} – ${s.planEnd ? dmy(s.planEnd) : "?"}` : tr("no plan dates")}{s.late ? ` · ${tr("late")}` : ""}{s.doneOn ? ` · ${tr("done {0}", dmy(s.doneOn))}` : ""}</span></span>
            <ProgressBar value={s.progress} />
            <span className="text-right text-sm font-semibold tabular-nums text-[color:var(--j-172B4D)]">{num(s.progress, 1)}%</span>
          </li>))}
      </ul>
      <div className="border-t border-[color:var(--j-DCDFE4)] p-4 sm:px-5">
        <h3 className="mb-3 text-sm font-semibold text-[color:var(--j-172B4D)]">{tr("Progress reports")}</h3>
        {!p.reports.length ? <p className="text-xs text-[color:var(--j-626F86)]">{tr("No report yet")}</p> : (
          <ol className="space-y-3">{p.reports.map((r) => (
            <li key={r.id} className="rounded-[3px] border border-[color:var(--j-DCDFE4)] p-3">
              <p className="flex flex-wrap items-center justify-between gap-2 text-xs"><span className="font-semibold text-[color:var(--j-172B4D)]">{r.stage ?? "—"} · {num(r.progress, 1)}%</span><span className="text-[color:var(--j-626F86)]">{dmy(r.reportedOn)} · {r.by}</span></p>
              {r.note && <p className="mt-1 whitespace-pre-line text-sm text-[color:var(--j-44546F)]">{r.note}</p>}
              {r.photos.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{r.photos.map((ph) => (
                // eslint-disable-next-line @next/next/no-img-element
                <button key={ph} type="button" onClick={() => setPhoto(ph)} className="h-20 w-20 overflow-hidden rounded-[3px] bg-[color:var(--j-091E420F)]"><img src={`/api/building/photos/${ph}`} alt={tr("Progress photo")} loading="lazy" className="h-full w-full object-cover" /></button>))}</div>}
            </li>))}</ol>)}
      </div>
      {stages && <Drawer open onClose={() => setStages(null)} size="lg" icon={<ListChecks size={18} />} title={tr("Stages of the work")} description={tr("The weights make 100%; the progress of a stage kept stays")}
        footer={<div className="flex items-center justify-between gap-2"><span className={cx("text-sm font-semibold", Math.abs(weight - 100) > 0.01 ? "text-red-700" : "text-emerald-700")}>{tr("Total weight {0}%", num(weight))}</span>
          <span className="flex gap-2"><Button variant="secondary" onClick={() => setStages(null)}>{tr("Cancel")}</Button>
            <Button disabled={busy || Math.abs(weight - 100) > 0.01} onClick={async () => { if (await act("/stages", { stages }, tr("Stages saved"), "PUT")) setStages(null); }}>{tr("Save")}</Button></span></div>}>
        <ul className="space-y-3">{stages.map((s, i) => (
          <li key={s.id ?? `n${i}`} className="grid gap-2 rounded-[3px] border border-[color:var(--j-DCDFE4)] p-3 sm:grid-cols-[minmax(0,1fr)_6rem]">
            <Row label={tr("Stage")}><input value={s.name ?? ""} onChange={(e) => setStages(stages.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} maxLength={120} className={ctl} /></Row>
            <Row label={tr("Weight %")}><input value={s.weight ?? ""} onChange={(e) => setStages(stages.map((x, j) => (j === i ? { ...x, weight: Number(e.target.value.replace(/[^\d.]/g, "")) || 0 } : x)))} inputMode="decimal" className={cx(ctl, "text-right")} /></Row>
            <div className="grid grid-cols-2 gap-2 sm:col-span-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <Row label={tr("Plan start")}><DateField label={tr("Plan start")} value={s.planStart ?? ""} quick={false} onChange={(v) => setStages(stages.map((x, j) => (j === i ? { ...x, planStart: v } : x)))} /></Row>
              <Row label={tr("Plan finish")}><DateField label={tr("Plan finish")} value={s.planEnd ?? ""} min={s.planStart ?? undefined} quick={false} onChange={(v) => setStages(stages.map((x, j) => (j === i ? { ...x, planEnd: v } : x)))} /></Row>
              <Button variant="secondary" className="col-span-2 sm:col-span-1" onClick={() => setStages(stages.filter((_, j) => j !== i))}><Trash2 size={14} />{tr("Remove")}</Button>
            </div>
          </li>))}</ul>
        <Button variant="secondary" className="mt-3" onClick={() => setStages([...stages, { name: "", weight: 0 }])}><Plus size={14} />{tr("Add stage")}</Button>
      </Drawer>}
      {report && <ReportDrawer p={p} busy={busy} onClose={() => setReport(false)} onSave={async (body) => { if (await act("/progress", body, tr("Progress reported"))) setReport(false); }} />}
      {photo && <Drawer open onClose={() => setPhoto(null)} size="lg" title={tr("Progress photo")}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={`/api/building/photos/${photo}`} alt={tr("Progress photo")} className="w-full rounded-[3px]" /></Drawer>}
    </div>
  );
}

function ReportDrawer({ p, busy, onClose, onSave }: { p: Full; busy: boolean; onClose: () => void; onSave: (body: unknown) => void }) {
  const first = p.stages.find((s) => s.progress < 100) ?? p.stages[0];
  const [stage, setStage] = useState(first ? String(first.id) : "");
  const cur = p.stages.find((s) => String(s.id) === stage);
  const [progress, setProgress] = useState(cur ? String(cur.progress) : "0");
  const [note, setNote] = useState("");
  const [day, setDay] = useState(today());
  const [photos, setPhotos] = useState<string[]>([]);
  const add = (files: FileList | null) => {
    if (!files) return;
    [...files].slice(0, 6 - photos.length).forEach((file) => { const r = new FileReader(); r.onload = () => setPhotos((x) => (x.length < 6 ? [...x, String(r.result)] : x)); r.readAsDataURL(file); });
  };
  const n = Number(progress) || 0;
  return (
    <Drawer open onClose={onClose} size="md" icon={<Camera size={18} />} title={tr("Report progress")} description={p.name}
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button disabled={busy || !stage || n < 0 || n > 100} onClick={() => onSave({ stageId: Number(stage), progress: n, note, reportedOn: day, photos })}>{tr("Send")}</Button></div>}>
      <div className="grid gap-3">
        <Row label={tr("Stage")} required><JSelect value={stage} onChange={(v) => { setStage(v); setProgress(String(p.stages.find((s) => String(s.id) === v)?.progress ?? 0)); }} label={tr("Stage")} placeholder="" options={p.stages.map((s) => ({ value: String(s.id), label: s.name, hint: `${num(s.progress, 1)}%` }))} /></Row>
        <Row label={tr("Progress of the stage (%)")} hint={cur ? tr("was {0}%", num(cur.progress, 1)) : undefined}>
          <div className="flex items-center gap-3"><input type="range" min={0} max={100} step={5} value={n} onChange={(e) => setProgress(e.target.value)} className="flex-1 accent-[color:var(--j-0C66E4)]" aria-label={tr("Progress of the stage (%)")} />
            <input value={progress} onChange={(e) => setProgress(e.target.value.replace(/[^\d.]/g, ""))} inputMode="decimal" className={cx(ctl, "w-20 text-right")} aria-label="%" /></div></Row>
        <Row label={tr("Report date")}><DateField label={tr("Report date")} value={day} max={today()} quick={false} onChange={setDay} /></Row>
        <Row label={tr("What was done")}><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} className={cx(ctl, "h-auto py-2")} placeholder={tr("e.g. ceramic floor 80% installed, waiting for grout")} /></Row>
        <Row label={tr("Photos ({0}/6)", photos.length)}>
          <div className="flex flex-wrap gap-2">
            {photos.map((src, i) => <span key={i} className="relative h-20 w-20 overflow-hidden rounded-[3px] bg-[color:var(--j-091E420F)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="" className="h-full w-full object-cover" /><button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-black/60 p-0.5 text-white" aria-label={tr("Remove")}><X size={12} /></button></span>)}
            {photos.length < 6 && <label className="flex h-20 w-20 cursor-pointer flex-col items-center justify-center gap-1 rounded-[3px] border border-dashed border-[color:var(--j-8590A2)] text-[11px] text-[color:var(--j-626F86)] hover:bg-[color:var(--j-F7F8F9)]">
              <Camera size={18} />{tr("Add")}<input type="file" accept="image/*" capture="environment" multiple className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = ""; }} /></label>}
          </div></Row>
      </div>
    </Drawer>
  );
}
