"use client";

// Building & Renovation → Projects (2026-11-27): the list and the project form (shared with the project page).

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, HardHat, MapPin, Plus, RotateCcw, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { Badge, Button, Empty, SearchBox, cx, useToast } from "@/so/ui";
import { JSelect } from "@/so/ui/Jira";
import Drawer from "@/so/ui/Drawer";
import Floating from "@/components/kc/Floating";
import { SkeletonList } from "@/components/kc/Skeleton";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { DateField, Group, Row, ctl } from "@/aggregator/fields";
import { dmy } from "@/so/ui/Filters";
import { type Full, type Kind, type Project, type Status, KIND_LABEL, RAB_LABEL, RAB_TONE, STATUS_LABEL, STATUS_TONE, placeOf, rp, today } from "./types";
import { FilterCount, filterBtnClass } from "@/jira/filters";

type BranchOpt = { branch_code: string; branch_name: string };
type Approver = { id: string; name: string; jobTitle: string | null; department?: string | null };

/** Who approves the RAB (management, backend migration 165): set by a superadmin; nobody listed = the superadmins. */
function ApproversDrawer({ list, can, onClose, onSaved }: { list: Approver[]; can: boolean; onClose: () => void; onSaved: (list: Approver[]) => void }) {
  const toast = useToast();
  const [ids, setIds] = useState<string[]>(list.map((a) => a.id));
  const [cands, setCands] = useState<Approver[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (can) void call<{ candidates: Approver[] }>("/api/building/approvers").then((r) => setCands(r.candidates)).catch(() => setCands([])); }, [can]);
  const save = async () => {
    setBusy(true);
    try { const r = await call<{ approvers: Approver[] }>("/api/building/approvers", { method: "PUT", json: { ids } }); toast(tr("Saved"), "ok"); onSaved(r.approvers); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const byId = new Map([...list, ...cands].map((a) => [a.id, a]));
  return (
    <Drawer open onClose={onClose} size="sm" icon={<ShieldCheck size={18} />} title={tr("RAB approvers")} description={tr("Management approves the RAB of every project")}
      footer={can ? <div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button disabled={busy} onClick={() => void save()}>{tr("Save")}</Button></div> : undefined}>
      <ul className="space-y-2">
        {ids.map((id) => { const a = byId.get(id); return (
          <li key={id} className="flex items-center justify-between gap-2 rounded-[3px] border border-[color:var(--j-DCDFE4)] px-3 py-2 text-sm">
            <span><span className="block font-medium text-[color:var(--j-172B4D)]">{a?.name ?? id}</span>{a?.jobTitle && <span className="text-xs text-[color:var(--j-626F86)]">{a.jobTitle}</span>}</span>
            {can && <button type="button" onClick={() => setIds(ids.filter((x) => x !== id))} className="rounded p-1 text-[color:var(--j-626F86)] hover:bg-[color:var(--j-FFECEB)] hover:text-[color:var(--j-C9372C)]" aria-label={tr("Remove {0}", a?.name ?? id)}><X size={14} /></button>}
          </li>); })}
        {!ids.length && <li className="text-sm text-[color:var(--j-626F86)]">{tr("Nobody listed: the superadmins approve")}</li>}
      </ul>
      {can && <div className="mt-4"><Row label={tr("Add an approver")}><JSelect value="" onChange={(v) => v && !ids.includes(v) && setIds([...ids, v])} label={tr("Add an approver")} placeholder={tr("Choose an account")}
        options={cands.filter((c) => !ids.includes(c.id)).map((c) => ({ value: c.id, label: c.name, hint: c.jobTitle ?? c.department ?? undefined }))} /></Row></div>}
      {!can && <p className="mt-4 text-xs text-[color:var(--j-626F86)]">{tr("Only a superadmin changes this list.")}</p>}
    </Drawer>
  );
}

export function ProgressBar({ value, plan, className }: { value: number | null; plan?: number | null; className?: string }) {
  const v = Math.max(0, Math.min(100, value ?? 0));
  return (
    <span className={cx("relative block h-2 overflow-hidden rounded-full bg-[color:var(--j-091E420F)]", className)} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <span className={cx("absolute inset-y-0 left-0 rounded-full", v >= 100 ? "bg-[color:var(--j-22A06B)]" : "bg-[color:var(--j-0C66E4)]")} style={{ width: `${v}%` }} />
      {plan != null && plan > 0 && <span className="absolute inset-y-0 w-0.5 bg-neutral-900/60" style={{ left: `calc(${Math.min(100, plan)}% - 1px)` }} title={tr("Plan {0}%", plan)} />}
    </span>
  );
}

export function ProjectList({ onAdd }: { onAdd: () => void }) {
  const [rows, setRows] = useState<Project[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState(""), [kind, setKind] = useState(""), [status, setStatus] = useState("");
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const [appr, setAppr] = useState<{ list: Approver[]; can: boolean } | null>(null);
  const [apprOpen, setApprOpen] = useState(false);
  useEffect(() => { call<{ data: Project[]; approvers: Approver[]; canSetApprovers: boolean }>("/api/building/projects").then((r) => { setRows(r.data); setAppr({ list: r.approvers, can: r.canSetApprovers }); }).catch((e: Error) => setErr(e.message)); }, []);
  const t = q.trim().toLowerCase();
  const shown = (rows ?? []).filter((p) => (!kind || p.kind === kind) && (!status || (status === "OPEN" ? !["DONE", "CANCELLED"].includes(p.status) : p.status === status))
    && (!t || [p.number, p.name, p.branchName, p.branchCode, p.locationName, p.city, p.picName, p.contractor].some((x) => (x ?? "").toLowerCase().includes(t))));
  const chosen = [kind && { k: "kind", label: tr("Kind"), v: KIND_LABEL[kind as Kind](), clear: () => setKind("") }, status && { k: "status", label: tr("Status"), v: status === "OPEN" ? tr("Not finished") : STATUS_LABEL[status as Status](), clear: () => setStatus("") }].filter(Boolean) as { k: string; label: string; v: string; clear: () => void }[];
  return (
    <>
      <div className="space-y-2.5 border-b border-[color:var(--j-DCDFE4)] p-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0 flex-1 basis-full sm:basis-64 sm:max-w-md"><SearchBox value={q} onChange={setQ} placeholder={tr("Search number, project, outlet, PIC or contractor")} /></div>
          <div className="flex flex-1 items-center gap-2 sm:flex-none">
            <button ref={btn} type="button" onClick={() => setOpen(true)} className={filterBtnClass(chosen.length)}>
              <SlidersHorizontal size={16} />{tr("Filter")}<FilterCount count={chosen.length} /></button>
            {chosen.length > 0 && <button type="button" onClick={() => { setKind(""); setStatus(""); }} aria-label={tr("Clear the filters")} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[3px] border border-[color:var(--j-DCDFE4)] text-[color:var(--j-44546F)] sm:h-10 sm:w-10"><RotateCcw size={16} /></button>}
            <Button variant="secondary" className="!h-11 sm:!h-10" onClick={() => setApprOpen(true)} title={tr("RAB approvers")}><ShieldCheck size={15} /><span className="hidden sm:inline">{tr("RAB approvers")}</span></Button>
            <Button className="!h-11 sm:!h-10" onClick={onAdd}><Plus size={15} />{tr("New project")}</Button>
          </div>
        </div>
        {chosen.length > 0 && <ul className="flex flex-wrap gap-1.5">{chosen.map((c) => <li key={c.k}><button type="button" onClick={c.clear} className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[color:var(--j-E9F2FF)] px-2.5 text-xs text-[color:var(--j-0055CC)]"><span className="text-[color:var(--j-0C66E4)]/70">{c.label}:</span><span className="font-semibold">{c.v}</span><X size={13} /></button></li>)}</ul>}
        {apprOpen && appr && <ApproversDrawer list={appr.list} can={appr.can} onClose={() => setApprOpen(false)} onSaved={(list) => { setAppr({ ...appr, list }); setApprOpen(false); }} />}
        <Floating open={open} onClose={() => setOpen(false)} title={tr("Filter")} anchor={btn}
          footer={<><Button variant="secondary" className="flex-1" disabled={!chosen.length} onClick={() => { setKind(""); setStatus(""); }}>{tr("Clear")}</Button><Button className="flex-1" onClick={() => setOpen(false)}>{tr("Show")}</Button></>}>
          <div className="space-y-4 px-4 py-4">
            <Row label={tr("Kind")}><JSelect value={kind} onChange={setKind} label={tr("Kind")} placeholder={tr("All")} options={[{ value: "", label: tr("All") }, ...(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ value: k, label: KIND_LABEL[k]() }))]} /></Row>
            <Row label={tr("Status")}><JSelect value={status} onChange={setStatus} label={tr("Status")} placeholder={tr("All")} options={[{ value: "", label: tr("All") }, { value: "OPEN", label: tr("Not finished") }, ...(Object.keys(STATUS_LABEL) as Status[]).map((k) => ({ value: k, label: STATUS_LABEL[k]() }))]} /></Row>
          </div>
        </Floating>
      </div>
      {err ? <p className="p-5 text-sm text-[color:var(--j-AE2E24)]">{err}</p> : !rows ? <div className="p-4"><SkeletonList /></div> : !shown.length ? <Empty title={rows.length ? tr("No project matches") : tr("No project yet")} /> : (
        <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((p) => (
            <li key={p.id}>
              <Link href={`/monitoring/building/${p.id}`} className="block h-full rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white p-4 transition-colors hover:border-[color:var(--j-85B8FF)] hover:bg-[color:var(--j-E9F2FF)]">
                <span className="flex items-start justify-between gap-2">
                  <span className="min-w-0"><span className="block text-[11px] font-medium text-[color:var(--j-626F86)]">{p.number} · {KIND_LABEL[p.kind]()}</span>
                    <span className="block truncate font-semibold text-[color:var(--j-172B4D)]">{p.name}</span></span>
                  <Badge tone={STATUS_TONE[p.status]}>{STATUS_LABEL[p.status]()}</Badge>
                </span>
                <span className="mt-1 flex items-center gap-1 text-xs text-[color:var(--j-626F86)]"><MapPin size={12} className="shrink-0" /><span className="truncate">{placeOf(p)}</span></span>
                <span className="mt-3 flex items-center justify-between text-xs"><span className="text-[color:var(--j-626F86)]">{tr("Progress")}</span><span className="font-semibold tabular-nums text-[color:var(--j-172B4D)]">{(p.progress ?? 0).toLocaleString("id-ID")}%</span></span>
                <ProgressBar value={p.progress} className="mt-1" />
                <span className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="min-w-0"><span className="block text-[10px] uppercase text-[color:var(--j-626F86)]">{tr("RAB")}</span><span className="font-semibold tabular-nums text-[color:var(--j-172B4D)]">{rp(p.rabTotal)}</span></span>
                  <span className="min-w-0"><span className="block text-[10px] uppercase text-[color:var(--j-626F86)]">{tr("Actual")}</span><span className="font-semibold tabular-nums text-[color:var(--j-172B4D)]">{rp(p.actualTotal)}</span>
                    {p.budget != null && <span className="block text-[11px] text-[color:var(--j-626F86)]">{tr("Budget {0}", rp(p.budget))}</span>}</span>
                </span>
                <span className="mt-2 block"><Badge tone={RAB_TONE[p.rabStatus]}>{RAB_LABEL[p.rabStatus]()}{p.rabVersion ? ` · v${p.rabVersion}` : ""}</Badge></span>
                <span className={cx("mt-3 flex items-center gap-1 text-[11px]", p.late ? "text-[color:var(--j-AE2E24)]" : "text-[color:var(--j-626F86)]")}><CalendarDays size={12} />
                  {p.planStart ? `${dmy(p.planStart)} – ${p.planEnd ? dmy(p.planEnd) : "?"}` : tr("No plan dates yet")}{p.late && ` · ${tr("past the target")}`}</span>
                {(p.picName || p.contractor) && <span className="mt-1 flex items-center gap-1 text-[11px] text-[color:var(--j-626F86)]"><HardHat size={12} />{[p.picName, p.contractor].filter(Boolean).join(" · ")}</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** New project, or its data changed (the project page). */
export function ProjectForm({ p, onClose, onSaved }: { p?: Full | null; onClose: () => void; onSaved: (id: string) => void }) {
  const toast = useToast();
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ kind: (p?.kind ?? "NEW_OUTLET") as Kind, name: p?.name ?? "", branchCode: p?.branchCode ?? "", locationName: p?.locationName ?? "",
    address: p?.address ?? "", city: p?.city ?? "", areaM2: p?.areaM2 != null ? String(p.areaM2) : "", businessUnit: p?.businessUnit ?? "Kopi Calf",
    picName: p?.picName ?? "", contractor: p?.contractor ?? "", planStart: p?.planStart ?? "", planEnd: p?.planEnd ?? "", actualStart: p?.actualStart ?? "",
    actualEnd: p?.actualEnd ?? "", budget: p?.budget != null ? String(Math.round(p.budget)) : "", note: p?.note ?? "" });
  useEffect(() => { void call<BranchOpt[]>("/api/branches?company=all").then(setBranches).catch(() => setBranches([])); }, []);
  const set = (k: keyof typeof f) => (v: string) => setF({ ...f, [k]: v });
  const input = (k: keyof typeof f) => ({ value: f[k], onChange: (e: { target: { value: string } }) => set(k)(e.target.value), className: ctl });
  const opts = useMemo(() => branches.map((b) => ({ value: b.branch_code, label: b.branch_name, hint: b.branch_code })), [branches]);
  const newOutlet = f.kind === "NEW_OUTLET";
  const save = async () => {
    setBusy(true);
    try {
      const out = await call<Full>(p ? `/api/building/projects/${p.id}` : "/api/building/projects", { method: p ? "PUT" : "POST", json: { ...f, branchCode: newOutlet ? "" : f.branchCode } });
      toast(tr("Saved"), "ok"); onSaved(out.id);
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} size="lg" icon={<HardHat size={18} />} title={p ? tr("Project data") : tr("New project")}
      description={p ? `${p.number} · ${p.name}` : tr("The RAB sections and the stages of the kind are prepared; change them in the project")}
      footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button disabled={busy || !f.name.trim()} onClick={() => void save()}>{tr("Save")}</Button></div>}>
      <Group title={tr("Project")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label={tr("Kind")} required><JSelect value={f.kind} onChange={(v) => setF({ ...f, kind: v as Kind })} label={tr("Kind")} placeholder="" options={(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ value: k, label: KIND_LABEL[k]() }))} /></Row>
          <Row label={tr("Project name")} required hint={tr("e.g. Kopi Calf To Go Bintaro Sektor 9")}><input {...input("name")} maxLength={200} /></Row>
          <Row label={tr("Business unit")}><input {...input("businessUnit")} maxLength={60} /></Row>
          <Row label={tr("Budget (Rp)")} hint={f.budget ? rp(Number(f.budget)) : tr("The ceiling agreed by management")}><input {...input("budget")} inputMode="numeric" onChange={(e) => set("budget")(e.target.value.replace(/\D/g, ""))} className={cx(ctl, "text-right tabular-nums")} /></Row>
        </div>
      </Group>
      <Group title={tr("Location")} note={newOutlet ? tr("A new outlet: the planned name and address") : tr("The outlet that is renovated or maintained")}>
        <div className="grid gap-3 sm:grid-cols-2">
          {newOutlet ? <Row label={tr("Planned outlet name")} required><input {...input("locationName")} maxLength={200} /></Row>
            : <Row label={tr("Outlet")} required hint={!opts.length ? tr("The list of outlets could not be read: type the name in Planned outlet name") : undefined}>
              {opts.length ? <JSelect value={f.branchCode} onChange={set("branchCode")} label={tr("Outlet")} placeholder={tr("Choose the outlet")} options={opts} /> : <input {...input("locationName")} maxLength={200} />}</Row>}
          <Row label={tr("City")}><input {...input("city")} maxLength={100} /></Row>
          <Row label={tr("Address")} className="sm:col-span-2"><input {...input("address")} maxLength={500} /></Row>
          <Row label={tr("Building area (m²)")}><input {...input("areaM2")} inputMode="decimal" onChange={(e) => set("areaM2")(e.target.value.replace(/[^\d.,]/g, ""))} className={cx(ctl, "text-right")} /></Row>
        </div>
      </Group>
      <Group title={tr("People & dates")}>
        <div className="grid gap-3 sm:grid-cols-2">
          <Row label={tr("PIC Building")}><input {...input("picName")} maxLength={120} /></Row>
          <Row label={tr("Contractor / foreman")}><input {...input("contractor")} maxLength={200} /></Row>
          <Row label={tr("Planned start")}><DateField label={tr("Planned start")} value={f.planStart} quick={false} onChange={set("planStart")} /></Row>
          <Row label={tr("Target finish")}><DateField label={tr("Target finish")} value={f.planEnd} min={f.planStart || undefined} quick={false} onChange={set("planEnd")} /></Row>
          {p && <><Row label={tr("Actual start")}><DateField label={tr("Actual start")} value={f.actualStart} max={today()} quick={false} onChange={set("actualStart")} /></Row>
            <Row label={tr("Actual finish")}><DateField label={tr("Actual finish")} value={f.actualEnd} max={today()} quick={false} onChange={set("actualEnd")} /></Row></>}
        </div>
        {!p && <p className="text-xs text-[color:var(--j-626F86)]">{tr("The plan dates spread the default stages by their weight; adjust them in Progress.")}</p>}
      </Group>
      <Group title={tr("Note")}><textarea rows={3} value={f.note} onChange={(e) => set("note")(e.target.value)} maxLength={2000} className={cx(ctl, "h-auto py-2")} /></Group>
    </Drawer>
  );
}
