"use client";

// Monitoring → Fund Request in bulk (2026-11-25, backend app/fund_vendor.py): several requests waiting at the signed-in
// approver approved at once, or several approved ones of one PT paid with the proof of one bank batch. What cannot be
// taken in bulk (another PT, same account and amount, Antar-PT) is refused one by one with its reason.

import { CheckCircle2, Paperclip, Wallet, X } from "lucide-react";
import { useState } from "react";
import { Button, cx, inputClass, useToast } from "@/so/ui";
import { call } from "@/so/features/checkin/checkin";
import { wibDate } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import { type Pengajuan, fmtRp, upload } from "./pengajuan";

type Bulk = { done: string[]; failed: { id: string; reason: string }[] };

export function BulkBar({ rows, onClear, onDone }: { rows: Pengajuan[]; onClear: () => void; onDone: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [on, setOn] = useState(wibDate());
  const [sure, setSure] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  if (!rows.length && !failed.length) return null;
  const status = rows.length && rows.every((r) => r.status === rows[0].status) ? rows[0].status : null;
  const payers = [...new Set(rows.map((r) => r.payer ?? "—"))];
  const total = rows.reduce((a, r) => a + (r.approvedAmount ?? r.requestedAmount ?? 0), 0);
  const finish = (r: Bulk) => {
    const no = (id: string) => rows.find((x) => x.id === id)?.number ?? id;
    setFailed(r.failed.map((f) => `${no(f.id)}: ${f.reason}`));
    toast(tr("{0} done, {1} refused", r.done.length, r.failed.length), r.failed.length ? "error" : undefined);
    setSure(false); setFile(null); onDone();
  };
  const approve = async () => {
    setBusy(true);
    try { finish(await call<Bulk>("/api/pengajuan/monitor/bulk/approve", { method: "POST", json: { ids: rows.map((r) => r.id) } })); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const pay = async () => {
    if (!file) return;
    setBusy(true);
    try { finish(await upload<Bulk>(`/api/pengajuan/monitor/bulk/pay?${new URLSearchParams({ ids: rows.map((r) => r.id).join(","), on, name: file.name.slice(0, 150) })}`, file)); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <div className="space-y-2 border-b border-[color:var(--j-85B8FF)] bg-[color:var(--j-E9F2FF)] px-4 py-3">
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button type="button" onClick={onClear} aria-label={tr("Clear")} className="rounded p-1 text-[color:var(--j-626F86)] hover:bg-white"><X size={15} /></button>
          <span className="mr-auto font-semibold text-[color:var(--j-172B4D)]">{tr("{0} chosen · {1}", rows.length, fmtRp(total))}{payers.length === 1 ? ` · ${payers[0]}` : ""}</span>
          {status === "SUBMITTED" && (sure
            ? <><span className="text-xs text-[color:var(--j-44546F)]">{tr("Approve all {0}?", rows.length)}</span><Button variant="secondary" disabled={busy} onClick={() => setSure(false)}>{tr("Cancel")}</Button>
              <Button loading={busy} onClick={() => void approve()}><CheckCircle2 size={14} /> {tr("Yes, approve")}</Button></>
            : <Button onClick={() => setSure(true)}><CheckCircle2 size={14} /> {tr("Approve {0}", rows.length)}</Button>)}
          {status === "APPROVED" && payers.length === 1 && (
            <>
              <input type="date" value={on} max={wibDate()} onChange={(e) => setOn(e.target.value)} aria-label={tr("Transfer date")} className={cx(inputClass, "h-9 !w-auto text-xs")} />
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[3px] border border-[color:var(--j-8590A2)] bg-white px-3 text-xs font-medium text-[color:var(--j-44546F)]">
                <Paperclip size={13} /> <span className="max-w-[12rem] truncate">{file?.name ?? tr("Proof of the bank batch")}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
              {sure
                ? <><span className="text-xs text-[color:var(--j-44546F)]">{tr("Paid {0} from {1}?", fmtRp(total), payers[0])}</span><Button variant="secondary" disabled={busy} onClick={() => setSure(false)}>{tr("Cancel")}</Button>
                  <Button loading={busy} onClick={() => void pay()}><Wallet size={14} /> {tr("Yes, paid")}</Button></>
                : <Button disabled={!file || !on} onClick={() => setSure(true)}><Wallet size={14} /> {tr("Record payment of {0}", rows.length)}</Button>}
            </>
          )}
          {status === "APPROVED" && payers.length > 1 && <span className="text-xs text-red-700">{tr("Choose requests of one paying PT")}</span>}
          {!status && <span className="text-xs text-[color:var(--j-44546F)]">{tr("Choose requests of one status")}</span>}
        </div>
      )}
      {failed.length > 0 && (
        <div className="rounded-[3px] bg-amber-50 px-3 py-2 text-xs text-amber-900">
          <button type="button" className="float-right" onClick={() => setFailed([])} aria-label={tr("Close")}><X size={13} /></button>
          <ul className="max-h-40 list-disc overflow-y-auto pl-4">{failed.map((f) => <li key={f}>{f}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

/** Antar-PT paid: the receiving PT confirms the money is in (never who recorded the payment). */
export function ReceivePanel({ p, base, onChanged }: { p: Pengajuan; base: string; onChanged: (p: Pengajuan) => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (p.kind !== "INTERCOMPANY" || p.status !== "PAID") return null;
  const run = async () => {
    setBusy(true);
    try { onChanged(await call<Pengajuan>(`${base}/received`, { method: "POST", json: { note: note.trim() || null } })); toast(tr("Done")); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <section className="space-y-2 rounded-[3px] border border-violet-200 bg-violet-50/40 p-3">
      <p className="text-sm font-semibold text-[color:var(--j-172B4D)]">{tr("Money received by {0}", p.payeePt ?? "—")}</p>
      {p.can?.receive ? (
        <>
          <p className="text-xs text-[color:var(--j-44546F)]">{tr("Check {0} on the account of {1}, then confirm: the request is Done.", fmtRp(p.paidAmount), p.payeePt ?? "—")}</p>
          <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder={tr("Note (optional)")} className={cx(inputClass, "h-10 text-sm")} />
          <div className="flex justify-end"><Button loading={busy} onClick={() => void run()}><CheckCircle2 size={14} /> {tr("Money is in")}</Button></div>
        </>
      ) : <p className="text-xs text-[color:var(--j-44546F)]">{tr("Waiting for the receiving PT to confirm; who recorded the payment cannot confirm it.")}</p>}
    </section>
  );
}
