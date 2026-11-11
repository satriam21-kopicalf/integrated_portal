"use client";

// Monitoring COTR → Master Fleet → Issues (migration 088): the maintenance needs / issues of the armada the drivers report
// from the driver app (brake, battery, tyre, cooler …) with a photo and where it happened. The management handles them:
// in progress (who handles it), resolved (what was done, the cost) or rejected with a reason; every step is logged.

import { AlertTriangle, CheckCircle2, Clock3, MapPin, UserRound, Wrench, XCircle } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorState, Field, Input, useToast } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { EmptyState, StatCard, StatGrid, ValueSkeleton } from "@/components/kc";
import Drawer, { DrawerSection } from "@/components/kc/Drawer";
import { SkeletonList } from "@/components/kc/Skeleton";
import { Segments } from "@/so/ui/MonitorFilters";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { rupiah } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

type Status = "open" | "in_progress" | "resolved" | "rejected";
export type Issue = { id: string; fleet: string; fleetName: string; plate: string | null; pool: string; driver: string | null; driverName: string | null;
  category: string; severity: "low" | "medium" | "high"; title: string; description: string; hasPhoto: boolean; lat: number | null; lng: number | null;
  status: Status; handler: string | null; resolutionNote: string | null; cost: number | null; resolvedAt: string | null; at: string;
  log?: { status: Status; note: string | null; by: string | null; at: string }[] };

export const ISSUE_CATEGORY: Record<string, () => string> = {
  brake: () => tr("Brake"), battery: () => tr("Battery"), tyre: () => tr("Tyre"), engine: () => tr("Engine / dynamo"), electrical: () => tr("Electrical / lights"),
  body: () => tr("Body / frame"), cooler: () => tr("Cooler / storage box"), accessory: () => tr("Accessory"), other: () => tr("Other"),
};
const STATUS: Record<Status, { label: () => string; tone: "red" | "blue" | "green" | "slate"; icon: typeof Clock3 }> = {
  open: { label: () => tr("Reported"), tone: "red", icon: AlertTriangle }, in_progress: { label: () => tr("In progress"), tone: "blue", icon: Wrench },
  resolved: { label: () => tr("Resolved"), tone: "green", icon: CheckCircle2 }, rejected: { label: () => tr("Rejected"), tone: "slate", icon: XCircle },
};
const SEVERITY: Record<Issue["severity"], { label: () => string; tone: "slate" | "amber" | "red" }> = {
  low: { label: () => tr("Low"), tone: "slate" }, medium: { label: () => tr("Medium"), tone: "amber" }, high: { label: () => tr("Cannot sell"), tone: "red" },
};
const NEXT: Record<Status, Status[]> = { open: ["in_progress", "resolved", "rejected"], in_progress: ["resolved", "rejected", "open"], resolved: ["in_progress"], rejected: ["open"] };
const ACTION: Record<Status, () => string> = { open: () => tr("Open again"), in_progress: () => tr("Handle"), resolved: () => tr("Resolve"), rejected: () => tr("Reject") };

export function FleetIssues({ onCount }: { onCount?: (open: number) => void }) {
  const [rows, setRows] = useState<Issue[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"active" | Status>("active");
  const [open, setOpen] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { const r = await call<Issue[]>("/api/cotr/issues"); setRows(r); onCount?.(r.filter((x) => x.status === "open" || x.status === "in_progress").length); }
    catch (e) { setError((e as Error).message); }
  }, [onCount]);
  useEffect(() => { void load(); }, [load]);
  const listed = useMemo(() => (rows ?? []).filter((r) => filter === "active" ? r.status === "open" || r.status === "in_progress" : r.status === filter), [rows, filter]);
  const n = (f: (r: Issue) => boolean) => (rows ? rows.filter(f).length : <ValueSkeleton />);
  return (
    <>
      <StatGrid label={tr("Fleet issues")} cols={4}>
        <StatCard label={tr("Reported")} tone="warn" icon={<AlertTriangle />} value={n((r) => r.status === "open")} sub={tr("waiting to be handled")} />
        <StatCard label={tr("Cannot sell")} icon={<XCircle />} tone={rows?.some((r) => r.severity === "high" && r.status !== "resolved" && r.status !== "rejected") ? "warn" : "default"}
          value={n((r) => r.severity === "high" && (r.status === "open" || r.status === "in_progress"))} />
        <StatCard label={tr("In progress")} icon={<Wrench />} value={n((r) => r.status === "in_progress")} />
        <StatCard label={tr("Repair cost")} icon={<CheckCircle2 />} value={rows ? rupiah(rows.reduce((a, r) => a + (r.cost ?? 0), 0)) : <ValueSkeleton />} sub={tr("Last 90 days")} />
      </StatGrid>
      <Segments value={filter} onChange={(v) => setFilter(v as typeof filter)} choices={[
        { value: "active", label: tr("Need handling") }, { value: "open", label: tr("Reported") }, { value: "in_progress", label: tr("In progress") },
        { value: "resolved", label: tr("Resolved") }, { value: "rejected", label: tr("Rejected") }]} />
      <Panel title={tr("Fleet issues")} description={tr("Reported by the drivers from the driver app; the urgent first")}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : !rows ? <SkeletonList rows={4} /> : listed.length === 0 ? (
          <EmptyState icon={<Wrench />} title={tr("No issues here")} />
        ) : (
          <ul className="divide-y divide-neutral-100">
            {listed.map((r) => {
              const st = STATUS[r.status];
              return (
                <li key={r.id}>
                  <button type="button" onClick={() => setOpen(r.id)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-neutral-50">
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5"><span className="font-medium text-neutral-900">{r.title}</span>
                        <Badge tone={SEVERITY[r.severity].tone}>{SEVERITY[r.severity].label()}</Badge><Badge tone="slate">{ISSUE_CATEGORY[r.category]?.() ?? r.category}</Badge></span>
                      <span className="mt-0.5 block text-xs text-neutral-500">{r.fleetName} · {r.plate ?? r.fleet} · {r.driverName ?? "—"} · {wibDateTime(r.at)}</span>
                      {r.handler && <span className="block text-xs text-neutral-500">{tr("Handled by {0}", r.handler)}</span>}
                    </span>
                    <Badge tone={st.tone}>{st.label()}</Badge>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
      {open && <IssueDrawer id={open} onClose={() => setOpen(null)} onSaved={() => void load()} />}
    </>
  );
}

function IssueDrawer({ id, onClose, onSaved }: { id: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [x, setX] = useState<Issue | null>(null);
  const [to, setTo] = useState<Status | null>(null);
  const [note, setNote] = useState("");
  const [handler, setHandler] = useState("");
  const [cost, setCost] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { call<Issue>(`/api/cotr/issues/${id}`).then((r) => { setX(r); setHandler(r.handler ?? ""); setCost(r.cost != null ? String(r.cost) : ""); }).catch((e: Error) => toast(e.message, "error")); }, [id, toast]);
  const needNote = to === "resolved" || to === "rejected";
  const save = async () => {
    if (!to) return;
    setBusy(true);
    try {
      const out = await call<Issue>(`/api/cotr/issues/${id}/step`, { method: "POST", json: { status: to, note: note.trim() || null, handler: handler.trim() || null, cost: cost ? Number(cost) : null } });
      setX(out); setTo(null); setNote(""); toast(tr("Saved")); onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} icon={<Wrench size={18} />} title={x?.title ?? tr("Fleet issue")} description={x ? `${x.fleetName} · ${x.plate ?? x.fleet}` : undefined}
      footer={to ? <><Button variant="ghost" onClick={() => setTo(null)}>{tr("Cancel")}</Button><Button loading={busy} disabled={needNote && !note.trim()} onClick={() => void save()}>{ACTION[to]()}</Button></>
        : <Button variant="ghost" onClick={onClose}>{tr("Close")}</Button>}>
      {!x ? <SkeletonList rows={4} /> : (
        <div className="space-y-4">
          <DrawerSection title={tr("Report")}>
            <div className="flex flex-wrap gap-1.5"><Badge tone={STATUS[x.status].tone}>{STATUS[x.status].label()}</Badge><Badge tone={SEVERITY[x.severity].tone}>{SEVERITY[x.severity].label()}</Badge>
              <Badge tone="slate">{ISSUE_CATEGORY[x.category]?.() ?? x.category}</Badge></div>
            {x.description && <p className="text-sm text-neutral-700">{x.description}</p>}
            <p className="flex items-center gap-1.5 text-xs text-neutral-500"><UserRound size={12} />{x.driverName ?? "—"} · {wibDateTime(x.at)}</p>
            {x.lat != null && x.lng != null && <a href={`https://maps.google.com/?q=${x.lat},${x.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-700"><MapPin size={12} />{tr("Map")}</a>}
            {x.hasPhoto && <a href={`/api/cotr/photos/issue/${x.id}`} target="_blank" rel="noreferrer"><img src={`/api/cotr/photos/issue/${x.id}?w=640`} alt="" className="max-h-72 rounded-xl border border-neutral-200 object-contain" /></a>}
          </DrawerSection>
          {(x.handler || x.resolutionNote || x.cost != null) && (
            <DrawerSection title={tr("Handling")}>
              {x.handler && <p className="text-sm">{tr("Handled by {0}", x.handler)}</p>}
              {x.resolutionNote && <p className="text-sm text-neutral-700">{x.resolutionNote}</p>}
              {x.cost != null && <p className="text-sm">{tr("Cost")}: <span className="font-semibold tabular-nums">{rupiah(x.cost)}</span></p>}
            </DrawerSection>
          )}
          {to ? (
            <DrawerSection title={ACTION[to]()}>
              <Field label={tr("Handled by")} hint={tr("Workshop or technician")}><Input value={handler} maxLength={120} onChange={(e) => setHandler(e.target.value)} /></Field>
              {to === "resolved" && <Field label={tr("Cost (Rp)")}><Input inputMode="numeric" value={cost} onChange={(e) => setCost(e.target.value.replace(/\D/g, ""))} className="text-right tabular-nums" /></Field>}
              <Field label={to === "resolved" ? tr("What was done") : to === "rejected" ? tr("Reason") : tr("Note")} required={needNote}>
                <textarea className="min-h-[80px] w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
              </Field>
            </DrawerSection>
          ) : (
            <div className="flex flex-wrap gap-2">{NEXT[x.status].map((s) => <Button key={s} variant={s === "rejected" || s === "open" ? "secondary" : "primary"} onClick={() => setTo(s)}>{ACTION[s]()}</Button>)}</div>
          )}
          <DrawerSection title={tr("History")}>
            <ol className="space-y-2 text-xs">
              {(x.log ?? []).map((l, i) => (
                <li key={i}><Badge tone={STATUS[l.status]?.tone ?? "slate"}>{STATUS[l.status]?.label() ?? l.status}</Badge> <span className="text-neutral-500">{l.by ?? "—"} · {wibDateTime(l.at)}</span>
                  {l.note && <p className="mt-0.5 text-neutral-700">{l.note}</p>}</li>
              ))}
            </ol>
          </DrawerSection>
        </div>
      )}
    </Drawer>
  );
}
