"use client";

// The life of a Fund Request after the money went out (2026-11-24, backend app/fund_lifecycle.py, migration 144):
//   In Progress (money out, the proof awaited) → Verifikasi (Finance checks the proof and the difference) → Done.
// LifeSummary shows the proof, the amount spent, Finance's accepted amount and the difference to everyone who opens the
// request; ProofPanel lets its owner attach the proof and send it; VerifyPanel is Finance's (adjust the accepted amount,
// send back for missing proof, pay the shortfall, Done); RulesPanel sets the rules of every kind.

import { AlertTriangle, Ban, CheckCircle2, Paperclip, Receipt, Scale, Send, Undo2 } from "lucide-react";
import { useState } from "react";
import { Button, cx, inputClass, useToast } from "@/so/ui";
import { call } from "@/so/features/checkin/checkin";
import { wibDay } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import { FileChip } from "./PengajuanView";
import { type Pengajuan, type Rule, PAID_OUT, docLabel, fmtRp, parseRp, typeRp, upload } from "./pengajuan";

const ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const DOCS = ["NOTA", "KWITANSI", "INVOICE", "STRUK", "FOTO", "TRANSFER", "OTHER"];

/** Paid, spent, accepted and the difference (+ Finance still pays, − money back), with the proof attached. */
export function LifeSummary({ p }: { p: Pengajuan }) {
  if (p.kind === "INTERCOMPANY" || (!PAID_OUT.includes(p.status) && !p.proofDueOn)) return null;
  const proof = (p.files ?? []).filter((f) => f.kind === "PROOF");
  const topup = (p.files ?? []).filter((f) => f.kind === "TOPUP");
  const accepted = p.verifiedAmount ?? p.actualAmount;
  const diff = p.difference;
  const left = p.outstanding ?? 0;
  const cells: [string, string, string?][] = [
    [tr("Paid out"), fmtRp(p.paidAmount)],
    [tr("Spent (requester)"), fmtRp(p.actualAmount)],
    [tr("Accepted by Finance"), fmtRp(accepted)],
    [tr("Difference"), diff == null ? "—" : diff === 0 ? tr("Even") : `${diff > 0 ? "+" : "−"}${fmtRp(Math.abs(diff))}`,
      diff == null || diff === 0 ? undefined : diff > 0 ? "text-amber-700" : "text-emerald-700"],
  ];
  return (
    <section className="space-y-3 rounded-[3px] border border-violet-200 bg-violet-50/30 p-4">
      <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[color:var(--j-172B4D)]"><Scale size={15} className="text-violet-600" /> {tr("Proof & difference")}
        {p.status === "PAID" && p.proofDueOn && (
          <span className={cx("ml-auto rounded px-2 py-0.5 text-xs font-medium", p.proofOverdue ? "bg-red-100 text-red-800" : "bg-white text-[color:var(--j-44546F)] ring-1 ring-[color:var(--j-DCDFE4)]")}>
            {p.proofOverdue ? tr("Proof overdue since {0}", wibDay(p.proofDueOn)) : tr("Proof due {0}", wibDay(p.proofDueOn))}</span>)}
      </h3>
      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cells.map(([k, v, tone]) => (
          <div key={k} className="rounded-[3px] bg-white px-3 py-2 ring-1 ring-[color:var(--j-DCDFE4)]">
            <dt className="text-xs font-semibold text-[color:var(--j-626F86)]">{k}</dt>
            <dd className={cx("mt-0.5 truncate text-sm font-semibold tabular-nums text-[color:var(--j-172B4D)]", tone)}>{v}</dd>
          </div>
        ))}
      </dl>
      {diff != null && diff !== 0 && (
        <p className="text-xs text-[color:var(--j-44546F)]">{diff > 0
          ? (p.topupAmount ? tr("Shortfall paid {0}; still {1}", fmtRp(p.topupAmount), fmtRp(Math.max(left, 0))) : tr("Finance pays the shortfall {0} in this request", fmtRp(diff)))
          : (p.refundedAt ? tr("Money back {0} received {1}", fmtRp(p.refundAmount ?? -diff), wibDay(p.refundedAt)) : tr("{0} goes back to the company; Done once Finance confirms it", fmtRp(-diff)))}</p>
      )}
      {p.actualNote && <p className="whitespace-pre-line text-xs text-[color:var(--j-44546F)]"><span className="font-medium text-[color:var(--j-172B4D)]">{tr("Requester")}:</span> {p.actualNote}</p>}
      {p.verifiedNote && <p className="whitespace-pre-line text-xs text-[color:var(--j-44546F)]"><span className="font-medium text-[color:var(--j-172B4D)]">{tr("Finance adjustment")}:</span> {p.verifiedNote}</p>}
      {(proof.length > 0 || topup.length > 0) && (
        <div className="flex flex-wrap gap-2">{proof.map((f) => <FileChip key={f.id} f={f} />)}{topup.map((f) => <FileChip key={f.id} f={f} />)}</div>
      )}
      {p.status === "DONE" && <p className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 size={13} /> {tr("Verified {0}{1}", p.verifiedBy ? `${p.verifiedBy} · ` : "", p.doneAt ? wibDay(p.doneAt) : "")}</p>}
    </section>
  );
}

/** The owner's part while In Progress: attach the proof the rule asks, the amount really spent, send to Finance. */
export function ProofPanel({ p, onChanged }: { p: Pengajuan; onChanged: (p: Pengajuan) => void }) {
  const toast = useToast();
  const rule: Rule = p.rule ?? { proofAfter: true, proofDays: 7, proofDocs: [], vendor: false };
  const [doc, setDoc] = useState(rule.proofDocs[0] ?? "NOTA");
  const [amount, setAmount] = useState(typeRp(p.actualAmount ?? p.paidAmount));
  const [note, setNote] = useState(p.actualNote ?? "");
  const [busy, setBusy] = useState(false);
  if (p.status !== "PAID" || p.kind === "INTERCOMPANY") return null;
  const base = `/api/pengajuan/requests/${p.id}`;
  const proof = (p.files ?? []).filter((f) => f.kind === "PROOF");
  const spent = parseRp(amount);
  const diff = spent == null || p.paidAmount == null ? null : spent - p.paidAmount;
  const add = async (list: FileList | null) => {
    if (!list?.length) return;
    try {
      for (const file of Array.from(list)) {
        const q = new URLSearchParams({ docType: doc, name: file.name.slice(0, 150) });
        onChanged(await upload<Pengajuan>(`${base}/proof-files?${q}`, file));
      }
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const remove = async (id: string) => {
    try { onChanged(await call<Pengajuan>(`${base}/proof-files/${id}`, { method: "DELETE" })); } catch (e) { toast((e as Error).message, "error"); }
  };
  const send = async () => {
    setBusy(true);
    try {
      onChanged(await call<Pengajuan>(`${base}/proof`, { method: "POST", json: { actualAmount: spent, note: note.trim() || null } }));
      toast(tr("Proof sent to Finance"));
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const asked = rule.proofDocs.length ? rule.proofDocs.map(docLabel).join(", ") : tr("bill / receipt / invoice");
  return (
    <section className={cx("space-y-3 rounded-[3px] border p-4", p.proofOverdue ? "border-red-300 bg-red-50/40" : "border-[color:var(--j-85B8FF)] bg-[color:var(--j-E9F2FF)]")}>
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--j-172B4D)]"><Receipt size={15} className="text-[color:var(--j-0C66E4)]" /> {tr("Send the proof to Finance")}</h3>
      <p className="text-xs text-[color:var(--j-44546F)]">{tr("The money was paid. Attach the proof ({0}) and the amount really spent; Finance checks it and closes the request.", asked)}
        {p.proofDueOn && ` ${tr("Due {0}.", wibDay(p.proofDueOn))}`}</p>
      {p.proofOverdue && <p className="flex items-center gap-1.5 text-xs font-semibold text-red-700"><AlertTriangle size={13} /> {tr("The proof is overdue")}</p>}
      <div className="flex flex-wrap items-end gap-2">
        {proof.map((f) => <FileChip key={f.id} f={f} onRemove={() => void remove(f.id)} />)}
        <select value={doc} onChange={(e) => setDoc(e.target.value)} aria-label={tr("Document")} className={cx(inputClass, "h-9 !w-auto text-xs")}>
          {DOCS.map((d) => <option key={d} value={d}>{docLabel(d)}</option>)}
        </select>
        <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[3px] bg-[color:var(--j-0C66E4)] px-3 text-xs font-medium text-white hover:bg-[color:var(--j-0055CC)]">
          <Paperclip size={13} /> {tr("Attach")}
          <input type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => void add(e.target.files)} />
        </label>
      </div>
      <div className="grid gap-2 sm:grid-cols-[12rem_minmax(0,1fr)]">
        <label className="block"><span className="mb-1 block text-xs font-medium text-[color:var(--j-44546F)]">{tr("Amount really spent")}</span>
          <input value={amount} inputMode="numeric" onChange={(e) => setAmount(typeRp(parseRp(e.target.value)))} className={cx(inputClass, "h-10 text-right font-semibold tabular-nums")} /></label>
        <label className="block"><span className="mb-1 block text-xs font-medium text-[color:var(--j-44546F)]">{tr("Note for Finance")}</span>
          <input value={note} maxLength={2000} onChange={(e) => setNote(e.target.value)} placeholder={tr("e.g. the rest is returned by transfer")} className={cx(inputClass, "h-10 text-sm")} /></label>
      </div>
      {diff != null && diff !== 0 && (
        <p className={cx("text-xs font-medium", diff > 0 ? "text-amber-800" : "text-emerald-800")}>
          {diff > 0 ? tr("Spent {0} more than paid: Finance pays the shortfall after checking", fmtRp(diff)) : tr("{0} less than paid: it goes back to the company", fmtRp(-diff))}</p>
      )}
      {(p.proofMissing ?? []).length > 0 && <ul className="list-disc pl-5 text-xs text-red-700">{p.proofMissing!.map((m) => <li key={m}>{m}</li>)}</ul>}
      <div className="flex justify-end"><Button loading={busy} disabled={!proof.length || spent == null} onClick={() => void send()}><Send size={14} /> {tr("Send proof")}</Button></div>
    </section>
  );
}

/** The owner withdraws the request while the money is not out yet (Dibatalkan); a reason is required. */
export function CancelPanel({ p, onChanged }: { p: Pengajuan; onChanged: (p: Pengajuan) => void }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!["SUBMITTED", "REVISION", "APPROVED"].includes(p.status)) return null;
  const send = async () => {
    setBusy(true);
    try {
      onChanged(await call<Pengajuan>(`/api/pengajuan/requests/${p.id}/cancel`, { method: "POST", json: { note: note.trim() } }));
      toast(tr("Request cancelled"));
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  if (!open) return <div className="flex justify-end"><Button variant="ghost" onClick={() => setOpen(true)}><Ban size={14} /> {tr("Cancel request")}</Button></div>;
  return (
    <section className="space-y-2 rounded-[3px] border border-red-200 bg-red-50/40 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--j-172B4D)]"><Ban size={15} className="text-red-700" /> {tr("Cancel request")}</h3>
      <p className="text-xs text-[color:var(--j-44546F)]">{tr("The request stops here and cannot be reopened. Only possible before Finance pays.")}</p>
      <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000} placeholder={tr("Reason for cancelling (required)")} className={cx(inputClass, "h-auto py-2 text-sm")} />
      <div className="flex justify-end gap-2">
        <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>{tr("Back")}</Button>
        <Button variant="danger" loading={busy} disabled={!note.trim()} onClick={() => void send()}>{tr("Cancel request")}</Button>
      </div>
    </section>
  );
}

/** Finance on a request in Verifikasi: the accepted amount (adjustable with a note), back for missing proof, the
 * shortfall paid in this request, Done once the difference is settled (money back confirmed in the refund panel). */
export function VerifyPanel({ p, base, onChanged }: { p: Pengajuan; base: string; onChanged: (p: Pengajuan) => void }) {
  const toast = useToast();
  const [mode, setMode] = useState<"" | "ADJUST" | "MISSING" | "TOPUP">("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  if (!p.can?.verify) return null;
  const diff = p.outstanding ?? 0;
  const topupFiles = (p.files ?? []).filter((f) => f.kind === "TOPUP");
  const run = async (action: "ADJUST" | "MISSING" | "TOPUP" | "DONE") => {
    setBusy(true);
    try {
      onChanged(await call<Pengajuan>(`${base}/verify`, { method: "POST", json: { action, amount: parseRp(amount), note: note.trim() || null } }));
      setMode(""); setAmount(""); setNote("");
      toast(action === "DONE" ? tr("Done") : tr("Saved"));
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const attach = async (list: FileList | null) => {
    if (!list?.length) return;
    try {
      for (const file of Array.from(list)) onChanged(await upload<Pengajuan>(`${base}/topup-files?${new URLSearchParams({ name: file.name.slice(0, 150) })}`, file));
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const removeTopup = async (id: string) => {
    try { onChanged(await call<Pengajuan>(`${base}/topup-files/${id}`, { method: "DELETE" })); } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <section className="space-y-3 rounded-[3px] border border-amber-300 bg-amber-50/40 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-[color:var(--j-172B4D)]"><Scale size={15} className="text-amber-700" /> {tr("Verify the proof")}</h3>
      <p className="text-xs text-[color:var(--j-44546F)]">{p.outstanding == null ? tr("The amount spent is not filled in: set it with Adjust amount.") : diff > 0 ? tr("Spent {0} more than paid: pay the shortfall here, then Done.", fmtRp(diff))
        : diff < 0 ? tr("{0} less than paid: Done asks for the money back; confirm it with its proof.", fmtRp(-diff)) : tr("Spent as paid: check the proof and press Done.")}</p>
      {mode && (
        <div className="space-y-2 rounded-[3px] bg-white p-3 ring-1 ring-[color:var(--j-DCDFE4)]">
          {mode === "TOPUP" && (
            <div className="flex flex-wrap items-end gap-2">
              {topupFiles.map((f) => <FileChip key={f.id} f={f} onRemove={p.topupPaidAt ? undefined : () => void removeTopup(f.id)} />)}
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[3px] bg-[color:var(--j-0C66E4)] px-3 text-xs font-medium text-white hover:bg-[color:var(--j-0055CC)]">
                <Paperclip size={13} /> {tr("Attach transfer proof")}
                <input type="file" accept={ACCEPT} multiple className="hidden" onChange={(e) => void attach(e.target.files)} /></label>
            </div>
          )}
          {mode !== "MISSING" && (
            <input value={amount} inputMode="numeric" placeholder={mode === "ADJUST" ? tr("Amount Finance accepts") : tr("Shortfall paid")}
              onChange={(e) => setAmount(typeRp(parseRp(e.target.value)))} className={cx(inputClass, "h-10 text-right font-semibold tabular-nums")} />
          )}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={2000}
            placeholder={mode === "MISSING" ? tr("What proof is still missing (required)") : mode === "ADJUST" ? tr("Why it is adjusted (required)") : tr("Note (optional)")}
            className={cx(inputClass, "h-auto py-2 text-sm")} />
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setMode("")} disabled={busy}>{tr("Cancel")}</Button>
            <Button loading={busy} disabled={(mode !== "TOPUP" && !note.trim()) || (mode !== "MISSING" && parseRp(amount) == null) || (mode === "TOPUP" && !topupFiles.length)}
              onClick={() => void run(mode)}>{tr("Save")}</Button>
          </div>
        </div>
      )}
      {!mode && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => { setMode("ADJUST"); setAmount(typeRp(p.verifiedAmount ?? p.actualAmount)); }}>{tr("Adjust amount")}</Button>
          <Button variant="secondary" onClick={() => setMode("MISSING")}><Undo2 size={14} /> {tr("Proof missing")}</Button>
          {diff > 0 && <Button variant="secondary" onClick={() => { setMode("TOPUP"); setAmount(typeRp(diff)); }}>{tr("Pay shortfall")}</Button>}
          <Button loading={busy} disabled={diff > 0 || p.outstanding == null || (p.refundAmount != null && !p.refundedAt)} onClick={() => void run("DONE")}><CheckCircle2 size={14} /> {tr("Done")}</Button>
        </div>
      )}
    </section>
  );
}

export type RuleRow = Rule & { key: string; label: string; group: "outlet" | "de" | "personal" };
export type Lifecycle = { blockOverdueProof: boolean; minLeadDays: number };

/** Finance's rules of every kind: proof after the money (and within how many days, which documents), vendor payment
 * (due date + invoice); and the global settings (block new requests while a proof is overdue, the least days to a due date). */
export function RulesPanel({ rules, lifecycle, docs, edit, onChanged }: { rules: RuleRow[]; lifecycle: Lifecycle; docs: Record<string, string>; edit: boolean;
  onChanged: () => void }) {
  const toast = useToast();
  const [life, setLife] = useState(lifecycle);
  const save = async (r: RuleRow, patch: Partial<Rule>) => {
    try {
      await call(`/api/pengajuan/settings/rules/${encodeURIComponent(r.key)}`, { method: "PUT", json: { ...r, ...patch } });
      toast(tr("Rules of {0} saved", r.label));
      onChanged();
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const saveLife = async (patch: Partial<Lifecycle>) => {
    const next = { ...life, ...patch };
    setLife(next);
    try { await call("/api/pengajuan/settings/lifecycle", { method: "PUT", json: patch }); toast(tr("Saved")); } catch (e) { toast((e as Error).message, "error"); }
  };
  const groups: [RuleRow["group"], string][] = [["outlet", tr("Outlet requests")], ["de", tr("Maintenance & Procurement")], ["personal", tr("Personal requests")]];
  return (
    <section className="space-y-4">
      <div className="border-b border-[color:var(--j-DCDFE4)] pb-3">
        <h3 className="text-base font-semibold text-[color:var(--j-172B4D)]">{tr("Rules after the payment")}</h3>
        <p className="mt-0.5 max-w-xl text-xs text-[color:var(--j-626F86)]">{tr("Every request goes Pending → Approved → In Progress → Verifying → Done. A kind without proof after the money is Done once paid; with it, the requester attaches the proof and Finance verifies it.")}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex cursor-pointer items-start gap-3 rounded border border-[color:var(--j-DCDFE4)] px-3 py-2.5">
          <input type="checkbox" className="mt-0.5" disabled={!edit} checked={life.blockOverdueProof} onChange={(e) => void saveLife({ blockOverdueProof: e.target.checked })} />
          <span><span className="block text-sm font-medium text-[color:var(--j-172B4D)]">{tr("Block new requests while a proof is overdue")}</span>
            <span className="block text-xs text-[color:var(--j-626F86)]">{tr("Someone whose proof is past its due day cannot send a new request until it is complete")}</span></span>
        </label>
        <label className="flex items-center justify-between gap-3 rounded border border-[color:var(--j-DCDFE4)] px-3 py-2.5">
          <span><span className="block text-sm font-medium text-[color:var(--j-172B4D)]">{tr("Least days to a vendor's due date")}</span>
            <span className="block text-xs text-[color:var(--j-626F86)]">{tr("A warning below it: Finance needs time to pay")}</span></span>
          <input type="number" min={0} max={60} disabled={!edit} defaultValue={life.minLeadDays} onBlur={(e) => Number(e.target.value) !== life.minLeadDays && void saveLife({ minLeadDays: Number(e.target.value) })}
            className={cx(inputClass, "h-9 !w-20 text-right")} />
        </label>
      </div>
      {groups.map(([g, title]) => (
        <div key={g} className="overflow-x-auto rounded border border-[color:var(--j-DCDFE4)]">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="bg-[color:var(--j-F7F8F9)] text-left text-[11px] uppercase tracking-wide text-[color:var(--j-626F86)]">
              <tr><th className="px-3 py-2">{title}</th><th className="px-3 py-2">{tr("Proof after payment")}</th><th className="px-3 py-2">{tr("Within (days)")}</th>
                <th className="px-3 py-2">{tr("Documents asked")}</th><th className="px-3 py-2">{tr("Vendor payment")}</th></tr>
            </thead>
            <tbody className="divide-y divide-[color:var(--j-F1F2F4)]">
              {rules.filter((r) => r.group === g).map((r) => (
                <tr key={r.key}>
                  <td className="px-3 py-2 font-medium text-[color:var(--j-172B4D)]">{r.label}</td>
                  <td className="px-3 py-2"><input type="checkbox" disabled={!edit} checked={r.proofAfter} onChange={(e) => void save(r, { proofAfter: e.target.checked })} aria-label={tr("Proof after payment")} /></td>
                  <td className="px-3 py-2"><input type="number" min={1} max={180} disabled={!edit || !r.proofAfter} defaultValue={r.proofDays}
                    onBlur={(e) => Number(e.target.value) !== r.proofDays && void save(r, { proofDays: Number(e.target.value) })} className={cx(inputClass, "h-8 !w-16 text-right")} /></td>
                  <td className="px-3 py-2"><span className="flex flex-wrap gap-1">
                    {Object.keys(docs).map((d) => {
                      const on = r.proofDocs.includes(d);
                      return <button key={d} type="button" disabled={!edit || !r.proofAfter} onClick={() => void save(r, { proofDocs: on ? r.proofDocs.filter((x) => x !== d) : [...r.proofDocs, d] })}
                        className={cx("rounded px-1.5 py-0.5 text-[11px] ring-1", on ? "bg-[color:var(--j-E9F2FF)] font-semibold text-[color:var(--j-0055CC)] ring-[color:var(--j-85B8FF)]" : "text-[color:var(--j-626F86)] ring-[color:var(--j-DCDFE4)] hover:bg-[color:var(--j-F7F8F9)]", (!edit || !r.proofAfter) && "opacity-50")}>{docs[d]}</button>;
                    })}</span></td>
                  <td className="px-3 py-2"><input type="checkbox" disabled={!edit} checked={r.vendor} onChange={(e) => void save(r, { vendor: e.target.checked })} aria-label={tr("Vendor payment")} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
      {!edit && <p className="text-xs text-[color:var(--j-626F86)]">{tr("Only management or Finance changes these rules.")}</p>}
    </section>
  );
}
