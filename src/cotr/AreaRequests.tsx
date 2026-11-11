"use client";

// Monitoring COTR → Master Schedule → Area requests (migration 088): a driver asks from the driver app to go to an area of
// Master → Area, or to a new place found on the road (its name, address and the GPS there). Approved: a new place becomes a
// master area (the code, name and address as corrected here) and the roster of that day sends the driver there for the
// times asked. Rejected: with a reason, shown to the driver.

import { Check, MapPin, MapPinned, Plus, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, ErrorState, Field, Input, useToast } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { EmptyState } from "@/components/kc";
import Drawer, { DrawerSection } from "@/components/kc/Drawer";
import { SkeletonList } from "@/components/kc/Skeleton";
import { Segments } from "@/so/ui/MonitorFilters";
import { call } from "@/so/features/checkin/checkin";
import { dmyOf } from "@/components/kc/ScopeBar";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";

type Req = { id: string; driver: string; driverName: string; pool: string; day: string; area: string | null; areaName: string; areaAddress: string | null; isNew: boolean;
  name: string | null; address: string | null; city: string | null; lat: number | null; lng: number | null; accuracy: number | null; start: string | null; end: string | null;
  note: string | null; status: "sent" | "approved" | "rejected"; decisionNote: string | null; decidedBy: string | null; decidedAt: string | null; at: string };

const TONE = { sent: "amber", approved: "green", rejected: "red" } as const;
const LABEL = { sent: () => tr("Waiting"), approved: () => tr("Approved"), rejected: () => tr("Rejected") };

export function AreaRequests({ onDecided }: { onDecided?: () => void }) {
  const [rows, setRows] = useState<Req[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"" | Req["status"]>("");
  const [open, setOpen] = useState<Req | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setRows(await call<Req[]>("/api/cotr/area-requests")); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const listed = (rows ?? []).filter((r) => !filter || r.status === filter);
  const waiting = (rows ?? []).filter((r) => r.status === "sent").length;
  return (
    <Panel title={tr("Area requests of the drivers")} description={tr("A master area or a new place; approving puts it on the roster of that day")}
      actions={waiting ? <Badge tone="amber">{tr("{0} waiting", waiting)}</Badge> : undefined}>
      <div className="px-4 pb-3 pt-1"><Segments value={filter} onChange={(v) => setFilter(v as typeof filter)} choices={[
        { value: "", label: tr("All") }, { value: "sent", label: tr("Waiting") }, { value: "approved", label: tr("Approved") }, { value: "rejected", label: tr("Rejected") }]} /></div>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : !rows ? <SkeletonList rows={3} /> : listed.length === 0 ? (
        <EmptyState icon={<MapPinned />} title={tr("No area requests")} />
      ) : (
        <ul className="divide-y divide-neutral-100">
          {listed.map((r) => (
            <li key={r.id}>
              <button type="button" onClick={() => setOpen(r)} className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-neutral-50">
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-1.5"><span className="font-medium text-neutral-900">{r.areaName}</span>
                    {r.isNew && <Badge tone="violet"><Plus size={11} />{tr("New place")}</Badge>}</span>
                  <span className="block text-xs text-neutral-500">{r.driverName} · {dmyOf(r.day)}{r.start ? ` · ${r.start}–${r.end ?? "…"}` : ""}</span>
                  {r.note && <span className="block text-xs text-neutral-600">“{r.note}”</span>}
                </span>
                <Badge tone={TONE[r.status]}>{LABEL[r.status]()}</Badge>
              </button>
            </li>
          ))}
        </ul>
      )}
      {open && <Decide req={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); void load(); onDecided?.(); }} />}
    </Panel>
  );
}

function Decide({ req, onClose, onDone }: { req: Req; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(req.name ?? "");
  const [address, setAddress] = useState(req.address ?? "");
  const [city, setCity] = useState(req.city ?? "");
  const [code, setCode] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState<"" | "yes" | "no">("");
  const decide = async (approve: boolean) => {
    setBusy(approve ? "yes" : "no");
    try {
      await call(`/api/cotr/area-requests/${req.id}/decide`, { method: "POST", json: { approve, note: note.trim() || null, code: code.trim() || null, name: name.trim() || null, address: address.trim() || null, city: city.trim() || null } });
      toast(approve ? tr("Approved") : tr("Rejected")); onDone();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(""); }
  };
  const pending = req.status === "sent";
  return (
    <Drawer open onClose={onClose} icon={<MapPinned size={18} />} title={req.areaName} description={`${req.driverName} · ${dmyOf(req.day)}`}
      footer={pending ? <>
        <Button variant="secondary" loading={busy === "no"} disabled={!note.trim()} onClick={() => void decide(false)}><X size={15} />{tr("Reject")}</Button>
        <Button loading={busy === "yes"} disabled={req.isNew && !name.trim()} onClick={() => void decide(true)}><Check size={15} />{tr("Approve")}</Button>
      </> : <Button variant="ghost" onClick={onClose}>{tr("Close")}</Button>}>
      <div className="space-y-4">
        <DrawerSection title={tr("Request")}>
          <p className="text-sm">{req.start ? tr("From {0} to {1}", req.start, req.end ?? "…") : tr("No time given: the roster is not changed")}</p>
          {req.areaAddress && <p className="text-sm text-neutral-600">{req.areaAddress}</p>}
          {req.note && <p className="text-sm text-neutral-700">“{req.note}”</p>}
          {req.lat != null && req.lng != null && <a href={`https://maps.google.com/?q=${req.lat},${req.lng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-700">
            <MapPin size={12} />{tr("Map")}{req.accuracy ? ` · ±${Math.round(req.accuracy)} m` : ""}</a>}
          <p className="text-[11px] text-neutral-400">{tr("Sent")} {wibDateTime(req.at)}</p>
        </DrawerSection>
        {pending && req.isNew && (
          <DrawerSection title={tr("New area of the master")}>
            <Field label={tr("Code")} hint={tr("Empty: made from the request")}><Input value={code} placeholder="AREA-XXX" onChange={(e) => setCode(e.target.value.toUpperCase())} /></Field>
            <Field label={tr("Name")} required><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
            <Field label={tr("Address")}><Input value={address} onChange={(e) => setAddress(e.target.value)} /></Field>
            <Field label={tr("City")}><Input value={city} onChange={(e) => setCity(e.target.value)} /></Field>
          </DrawerSection>
        )}
        {pending ? (
          <Field label={tr("Note")} hint={tr("Required to reject; shown to the driver")}><Input value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></Field>
        ) : (
          <DrawerSection title={tr("Decision")}>
            <Badge tone={TONE[req.status]}>{LABEL[req.status]()}</Badge>
            <p className="text-xs text-neutral-500">{req.decidedBy ?? "—"} · {req.decidedAt ? wibDateTime(req.decidedAt) : "—"}</p>
            {req.decisionNote && <p className="text-sm">{req.decisionNote}</p>}
          </DrawerSection>
        )}
      </div>
    </Drawer>
  );
}
