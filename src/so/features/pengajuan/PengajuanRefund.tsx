"use client";

// Finance confirms the money a Maintenance & Procurement fund gave back (spent less than paid; backend app/de_funds.py
// settle → pengajuan.confirm_refund): the proof of the money received, then the confirmation with a note.

import { useState } from "react";
import { CheckCircle2, Paperclip, Undo2 } from "lucide-react";
import { Button, cx, inputClass, useToast } from "@/so/ui";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";
import { FileChip } from "./PengajuanView";
import { type Pengajuan, fmtRp, upload } from "./pengajuan";

export default function RefundPanel({ p, base, onChanged }: { p: Pengajuan; base: string; onChanged: (p: Pengajuan) => void }) {
  const toast = useToast();
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const proofs = (p.files ?? []).filter((f) => f.kind === "REFUND");
  const run = async (fn: () => Promise<Pengajuan>, ok?: string) => {
    setBusy(true);
    try {
      onChanged(await fn());
      if (ok) toast(ok);
    } catch (e) {
      toast((e as Error).message, "error");
    } finally {
      setBusy(false);
    }
  };
  const attach = async (list: FileList | null) => {
    for (const file of Array.from(list ?? [])) {
      const q = new URLSearchParams({ docType: "TRANSFER", name: file.name.slice(0, 150) });
      await run(() => upload<Pengajuan>(`${base}/refund-files?${q}`, file));
    }
  };
  return (
    <section className="rounded-md border border-amber-200 bg-amber-50/50 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-900"><Undo2 size={15} /> {tr("Money back: {0}", fmtRp(p.refundAmount))}</p>
      <p className="mb-2 text-xs text-neutral-600">{tr("The actual cost was lower than paid. Attach the proof of the money received, then confirm.")}</p>
      <div className="flex flex-wrap items-end gap-2">
        {proofs.map((f) => <FileChip key={f.id} f={f} onRemove={() => void run(() => call<Pengajuan>(`${base}/refund-files/${f.id}`, { method: "DELETE" }))} />)}
        <label className={cx("inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-3 text-xs font-medium text-neutral-700 hover:bg-neutral-50", busy && "pointer-events-none opacity-60")}>
          <Paperclip size={13} /> {tr("Attach proof")}
          <input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" multiple className="hidden" onChange={(e) => { void attach(e.target.files); e.target.value = ""; }} />
        </label>
      </div>
      <div className="mt-2 flex gap-2">
        <input value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder={tr("Note, e.g. received in which account")} className={cx(inputClass, "h-9 min-w-0 flex-1 text-sm")} />
        <Button loading={busy} disabled={!proofs.length || !note.trim()}
          onClick={() => void run(() => call<Pengajuan>(`${base}/refunded`, { method: "POST", json: { note: note.trim() } }), tr("Money back confirmed"))}>
          <CheckCircle2 size={14} /> {tr("Confirm")}</Button>
      </div>
    </section>
  );
}
