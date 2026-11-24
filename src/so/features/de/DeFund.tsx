"use client";

// The money of a Maintenance & Procurement request in Fund Request (2026-11-21, backend app/de_funds.py): the team asks
// Finance from the cost lines (nothing typed twice), sees where the fund waits, and asks again after a revision. The
// settlement at Done (top-up or refund) shows here as well.

import { useState } from "react";
import { ExternalLink, Send, Wallet } from "lucide-react";
import { Badge, Button, Field, cx, inputClass, type Tone } from "@/so/ui";
import Dialog from "@/so/ui/Dialog";
import { tr } from "@/lib/i18n";
import { type Fund, type Request, fmtRp } from "./de";

type Act = (path: string, json: unknown, ok: string, method?: string) => Promise<boolean>;

const TONE: Record<Fund["status"], Tone> = { SUBMITTED: "amber", REVISION: "red", APPROVED: "blue", PAID: "violet", VERIFYING: "amber", DONE: "green", REJECTED: "red", CANCELLED: "slate" };
const ASK_FROM = ["ACCEPTED", "IN_PROGRESS", "ORDERED", "ON_HOLD"];

function AskDialog({ r, fund, busy, act, onClose }: { r: Request; fund: Fund | null; busy: boolean; act: Act; onClose: () => void }) {
  const [payee, setPayee] = useState({ type: "BANK" as "BANK" | "VA", bank: fund?.payeeBank ?? "", account: fund?.payeeAccount ?? "", name: fund?.payeeName ?? r.vendor ?? "" });
  const [note, setNote] = useState("");
  const ready = payee.bank.trim() && payee.account.trim() && (payee.type === "VA" || payee.name.trim());
  const send = async () => {
    if (await act(`/api/de/monitor/${r.id}/funds`, { ...payee, note: note.trim() || null }, tr("Funds requested from Finance"))) onClose();
  };
  return (
    <Dialog open onClose={onClose} title={fund?.status === "REVISION" ? tr("Ask for the funds again") : tr("Ask Finance for the funds")}
      description={tr("The lines are the estimated cost lines ({0}); the invoices / quotations go with it", fmtRp(r.estCost))}
      footer={<div className="flex w-full justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!ready} onClick={() => void send()}><Send size={14} /> {tr("Send to Finance")}</Button></div>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={tr("Pay to")} className="sm:col-span-2"><select value={payee.type} onChange={(e) => setPayee({ ...payee, type: e.target.value as "BANK" | "VA" })} className={cx(inputClass, "h-10")}>
          <option value="BANK">{tr("Bank account")}</option><option value="VA">{tr("Virtual Account (Shopee, Tokopedia …)")}</option></select></Field>
        <Field label={payee.type === "VA" ? tr("VA provider") : tr("Bank")} required><input value={payee.bank} maxLength={120} onChange={(e) => setPayee({ ...payee, bank: e.target.value })} className={cx(inputClass, "h-10")} /></Field>
        <Field label={payee.type === "VA" ? tr("VA number") : tr("Account number")} required><input value={payee.account} maxLength={120} inputMode="numeric" onChange={(e) => setPayee({ ...payee, account: e.target.value })} className={cx(inputClass, "h-10")} /></Field>
        <Field label={tr("Account name")} required={payee.type === "BANK"} className="sm:col-span-2"><input value={payee.name} maxLength={120} onChange={(e) => setPayee({ ...payee, name: e.target.value })} className={cx(inputClass, "h-10")} /></Field>
        <Field label={tr("Note for Finance")} className="sm:col-span-2"><textarea value={note} maxLength={2000} rows={2} onChange={(e) => setNote(e.target.value)} className={cx(inputClass, "py-2")} /></Field>
      </div>
    </Dialog>
  );
}

function Figures({ fund }: { fund: Fund }) {
  const rows: [string, number | null][] = [[tr("Asked"), fund.requestedAmount], [tr("Approved"), fund.approvedAmount], [tr("Paid"), fund.paidAmount]];
  return (
    <dl className="grid grid-cols-3 gap-2 text-xs">
      {rows.map(([label, v]) => (
        <div key={label}><dt className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{label}</dt>
          <dd className="mt-0.5 font-medium tabular-nums text-neutral-900">{fmtRp(v)}</dd></div>
      ))}
    </dl>
  );
}

/** The fund of the request: ask, where it waits, the settlement. */
export default function FundCard({ r, busy, act }: { r: Request; busy: boolean; act: Act }) {
  const [asking, setAsking] = useState(false);
  const fund = r.fund ?? null;
  const canAsk = ASK_FROM.includes(r.status) && (r.estCost ?? 0) > 0 && (!fund || fund.status === "REVISION" || fund.status === "REJECTED" || fund.status === "CANCELLED");
  if (!fund && !(r.estCost ?? 0)) {
    return <p className="text-xs text-neutral-500">{tr("No cost yet: fill in the estimated cost lines above, then ask Finance for the funds.")}</p>;
  }
  return (
    <div className="space-y-3">
      {fund && (
        <div className="space-y-3 rounded-lg border border-neutral-200 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Wallet size={15} className="text-neutral-400" />
            <a href={`/monitoring/pengajuan?open=${fund.id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
              {fund.number} <ExternalLink size={12} /></a>
            <Badge tone={TONE[fund.status]}>{fund.statusLabel}</Badge>
            {fund.status === "SUBMITTED" && fund.step && <span className="text-xs text-neutral-500">{tr("Waiting at {0}", fund.step)}</span>}
          </div>
          <Figures fund={fund} />
          {fund.refundAmount !== null && (
            <p className="text-xs text-neutral-600">{fund.refundedAt ? tr("Money back to Finance confirmed: {0}", fmtRp(fund.refundAmount))
              : tr("Spent less than paid: {0} to give back to Finance", fmtRp(fund.refundAmount))}</p>
          )}
          {fund.topUps.map((t) => (
            <p key={t.id} className="text-xs text-neutral-600">{tr("Top-up for the actual cost")} · <a href={`/monitoring/pengajuan?open=${t.id}`} className="font-medium text-brand-700 hover:underline">{t.number}</a> · {fmtRp(t.amount)} · {t.statusLabel}</p>
          ))}
        </div>
      )}
      {fund?.status === "PAID" && (r.status === "HANDOVER" || r.status === "DONE") && (
        <Button disabled={busy} onClick={() => void act(`/api/de/monitor/${r.id}/fund-proof`, {}, tr("Proof sent to Finance"))}><Send size={14} /> {tr("Send the invoices as proof")}</Button>
      )}
      {fund?.status === "PAID" && r.status !== "HANDOVER" && r.status !== "DONE" && (
        <p className="text-xs text-neutral-500">{tr("Paid: the invoices go to Finance as proof once the goods are received / the work is handed over.")}</p>
      )}
      {canAsk && (
        <Button variant={fund ? "secondary" : "primary"} disabled={busy} onClick={() => setAsking(true)}>
          <Send size={14} /> {fund?.status === "REVISION" ? tr("Ask again after the revision") : tr("Ask Finance for the funds")}</Button>
      )}
      {asking && <AskDialog r={r} fund={fund} busy={busy} act={act} onClose={() => setAsking(false)} />}
    </div>
  );
}
