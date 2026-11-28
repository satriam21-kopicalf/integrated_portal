"use client";

// Calf On The Road → Requests & Maintenance → Driver costs (moved from Monitoring Armada - Driver, 2026-11-23): the costs
// on the road a driver asks with the receipt (fuel, ice, stall rent, repair …), approved or rejected by the team. The
// ones still waiting are listed whatever their day (/api/cotr/monitor).

import { Check, X } from "lucide-react";
import { useState } from "react";
import { Badge, Button, Empty, Input, usePaged, useToast } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { call } from "@/so/features/checkin/checkin";
import { Request } from "@/cotr/types";
import { COTR_PAGE, CotrPager, rupiah, useMaster } from "@/cotr/ui";
import type { RequestKind } from "@/cotr/RequestKinds";
import { locale, tr } from "@/lib/i18n";
import { thumb } from "@/lib/assets";

const time = (iso: string | null) => (iso ? new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }) : "—");
const photoUrl = (id: string) => `/api/cotr/photos/request/${id}`;
const KINDS: Record<string, () => string> = { fuel: () => tr("Fuel"), ice: () => tr("Ice"), stall: () => tr("Stall rent"), repair: () => tr("Fleet repair"), parking: () => tr("Parking / levy"), other: () => tr("Other") };
export const REQUEST: Record<Request["status"], { label: () => string; tone: "amber" | "green" | "red" }> = {
  sent: { label: () => tr("Waiting"), tone: "amber" }, approved: { label: () => tr("Approved"), tone: "green" }, rejected: { label: () => tr("Rejected"), tone: "red" },
};

function Decide({ url, onDone }: { url: string; onDone: () => Promise<void> }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const decide = async (approve: boolean) => {
    if (!approve && !note.trim()) { toast(tr("Write the reason for the rejection"), "error"); return; }
    setBusy(true);
    try { await call(url, { method: "POST", json: { approve, note: note.trim() || null } }); toast(approve ? tr("Approved") : tr("Rejected")); await onDone(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
      <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder={tr("Note (a rejection needs it)")} className="h-9 min-w-0 flex-1 sm:w-48 sm:flex-none" />
      <Button size="sm" loading={busy} onClick={() => void decide(true)}><Check size={14} /> {tr("Approve")}</Button>
      <Button size="sm" variant="secondary" disabled={busy} className="text-[color:var(--j-C9372C)]" onClick={() => void decide(false)}><X size={14} /> {tr("Reject")}</Button>
    </div>
  );
}

export function DriverRequests({ rows, onDone }: { rows: Request[]; onDone: () => Promise<void> }) {
  // the names come from Master → Pengajuan (migration 083); the built-in labels stay for the older codes
  const kinds = useMaster<RequestKind>("request-kinds");
  const kindName = (code: string) => kinds.rows?.find((k) => k.code === code)?.name ?? (KINDS[code] ?? (() => code))();
  const sorted = [...rows].sort((a, b) => Number(b.status === "sent") - Number(a.status === "sent") || b.at.localeCompare(a.at));
  const paged = usePaged(sorted, sorted.length, COTR_PAGE);
  return (
    <Panel title={tr("Driver cost requests")} description={tr("Costs on the road with the receipt; the ones still waiting are listed whatever their day")}>
      {rows.length === 0 ? <Empty title={tr("No request")} /> : (
        <ul className="divide-y divide-[color:var(--j-F1F2F4)]">
          {paged.rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
              <span className="flex min-w-0 items-center gap-3">
                <a href={photoUrl(r.id)} target="_blank" rel="noreferrer" className="flex-shrink-0 overflow-hidden rounded-[3px] ring-1 ring-[color:var(--j-DCDFE4)]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={thumb(photoUrl(r.id), 160)} decoding="async" alt={tr("Receipt")} className="h-14 w-14 object-cover" loading="lazy" />
                </a>
                <span className="min-w-0">
                  <span className="block font-medium text-[color:var(--j-172B4D)]">{r.driverName ?? r.driverCode} · {kindName(r.kind)} · {rupiah(r.amount)}</span>
                  <span className="text-xs text-[color:var(--j-626F86)]">{new Date(r.at).toLocaleDateString(locale(), { day: "numeric", month: "short", timeZone: "Asia/Jakarta" })} {time(r.at)} · {r.note}</span>
                  {r.decisionNote && <span className="block text-xs text-[color:var(--j-626F86)]">{r.decisionNote}</span>}
                </span>
              </span>
              {r.status === "sent" ? <Decide url={`/api/cotr/requests/${r.id}/decide`} onDone={onDone} />
                : <Badge tone={REQUEST[r.status].tone}>{REQUEST[r.status].label()}</Badge>}
            </li>
          ))}
        </ul>
      )}
      <CotrPager paged={paged} className="px-4 pb-3" />
    </Panel>
  );
}
