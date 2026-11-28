"use client";

// The technicians' Cash in Advance of a Maintenance & Procurement request (2026-11-24, backend app/de_funds.py, migration
// 143): the team asks it for a technician assigned to the request; it is a personal Fund Request of the Keperluan Dana
// "Deposit / Cash in Advance" (its own approval flow), paid to the technician's account and settled afterwards with the
// receipts (Laporan Penyelesaian, in Fund Request). The card shows each advance and whether it is settled yet.

import { useEffect, useState } from "react";
import { HandCoins, Plus, Send } from "lucide-react";
import { Badge, Button, Field, cx, inputClass, type Tone } from "@/so/ui";
import Dialog from "@/so/ui/Dialog";
import { JSelect } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { LifeSummary, ProofPanel } from "@/so/features/pengajuan/PengajuanLife";
import type { Pengajuan } from "@/so/features/pengajuan/pengajuan";
import { useAuth } from "@/lib/auth";
import { tr } from "@/lib/i18n";
import { type Request, fmtRp } from "./de";

type Act = (path: string, json: unknown, ok: string, method?: string) => Promise<boolean>;
export type Advance = {
  id: string; number: string | null; status: "SUBMITTED" | "REVISION" | "APPROVED" | "PAID" | "VERIFYING" | "DONE" | "REJECTED" | "CANCELLED" | "DRAFT"; statusLabel: string;
  technician: string; amount: number | null; approvedAmount: number | null; paidAmount: number | null;
  /** the team member who asked it: they send its proof */ userId: string;
};
const TONE: Record<string, Tone> = { SUBMITTED: "amber", REVISION: "red", APPROVED: "blue", PAID: "violet", VERIFYING: "amber", DONE: "green", REJECTED: "red", DRAFT: "slate", CANCELLED: "slate" };
const ASK_FROM = ["ACCEPTED", "IN_PROGRESS", "ORDERED", "ON_HOLD"];
const digits = (v: string) => v.replace(/[^0-9]/g, "");

function AskDialog({ r, busy, act, onClose }: { r: Request; busy: boolean; act: Act; onClose: () => void }) {
  const techs = (r.assignments ?? []).filter((a) => a.status !== "RELEASED");
  const [tech, setTech] = useState(techs.length === 1 ? String(techs[0].technicianId) : "");
  const first = techs.find((a) => String(a.technicianId) === tech);
  const [f, setF] = useState({ amount: "", trx: "", acct: "", bank: first?.bank ?? "", account: first?.accountNo ?? "", name: first?.accountName ?? first?.name ?? "", note: "" });
  const pick = (v: string) => {
    setTech(v);
    const a = techs.find((x) => String(x.technicianId) === v);
    setF((x) => ({ ...x, bank: a?.bank ?? "", account: a?.accountNo ?? "", name: a?.accountName ?? a?.name ?? "" }));
  };
  const ready = tech && Number(f.amount) > 0 && f.trx && f.acct && f.bank.trim() && f.account.trim() && f.name.trim();
  const send = async () => {
    if (await act(`/api/de/monitor/${r.id}/advances`, {
      technicianId: Number(tech), amount: Number(f.amount), transactionId: Number(f.trx), accountTypeId: Number(f.acct),
      bank: f.bank.trim(), account: f.account.trim(), name: f.name.trim(), note: f.note.trim() || null,
    }, tr("Cash in Advance requested"))) onClose();
  };
  return (
    <Dialog open onClose={onClose} title={tr("Cash in Advance for a technician")}
      description={tr("A Fund Request (Deposit / Cash in Advance) on behalf of the technician; send its receipts here afterwards.")}
      footer={<div className="flex w-full justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!ready} onClick={() => void send()}><Send size={14} /> {tr("Send to Finance")}</Button></div>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label={tr("Technician")} required className="sm:col-span-2">
          <JSelect value={tech} onChange={pick} placeholder={tr("Choose a technician of this request")}
            options={techs.map((a) => ({ value: String(a.technicianId), label: a.name, hint: a.company ?? undefined }))} /></Field>
        <Field label={tr("Amount (Rp)")} required><input value={f.amount} onChange={(e) => setF({ ...f, amount: digits(e.target.value) })} inputMode="numeric" className={cx(inputClass, "h-10 text-right tabular-nums")} /></Field>
        <Field label={tr("Jenis Transaksi")} required>
          <JSelect value={f.trx} onChange={(v) => setF({ ...f, trx: v })} placeholder={tr("Jenis Transaksi (Fund Request)")}
            options={(r.transactionOptions ?? []).map((o) => ({ value: String(o.id), label: o.name }))} /></Field>
        <Field label={tr("Account type")} required className="sm:col-span-2">
          <JSelect value={f.acct} onChange={(v) => setF({ ...f, acct: v })} placeholder={tr("Choose")}
            options={(r.accountTypes ?? []).map((o) => ({ value: String(o.id), label: o.name }))} /></Field>
        <Field label={tr("Bank")} required><input value={f.bank} maxLength={120} onChange={(e) => setF({ ...f, bank: e.target.value })} className={cx(inputClass, "h-10")} /></Field>
        <Field label={tr("Account number")} required><input value={f.account} maxLength={120} inputMode="numeric" onChange={(e) => setF({ ...f, account: e.target.value })} className={cx(inputClass, "h-10")} /></Field>
        <Field label={tr("Account name")} required className="sm:col-span-2"><input value={f.name} maxLength={120} onChange={(e) => setF({ ...f, name: e.target.value })} className={cx(inputClass, "h-10")} /></Field>
        <Field label={tr("What the money is for")} className="sm:col-span-2"><textarea value={f.note} maxLength={2000} rows={2} onChange={(e) => setF({ ...f, note: e.target.value })} className={cx(inputClass, "py-2")} placeholder={tr("e.g. parts bought on site, transport")} /></Field>
      </div>
    </Dialog>
  );
}

/** The proof of a technician's advance, sent by the team member who asked it (the same panel as Fund Request). */
function ProofDialog({ id, onClose }: { id: string; onClose: () => void }) {
  const [p, setP] = useState<Pengajuan | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { call<Pengajuan>(`/api/pengajuan/requests/${id}`).then(setP).catch((e) => setError((e as Error).message)); }, [id]);
  return (
    <Dialog open onClose={onClose} title={p?.number ?? tr("Proof")} description={tr("The receipts and the amount the technician really spent")}>
      {error ? <p className="text-sm text-[color:var(--j-C9372C)]">{error}</p> : !p ? <p className="text-sm text-[color:var(--j-626F86)]">…</p>
        : p.status === "PAID" ? <ProofPanel key={p.files?.length} p={p} onChanged={setP} /> : <LifeSummary p={p} />}
    </Dialog>
  );
}

export default function AdvanceCard({ r, busy, act, onChanged }: { r: Request; busy: boolean; act: Act; onChanged?: () => void }) {
  const [open, setOpen] = useState(false);
  const [proof, setProof] = useState<string | null>(null);
  const { user } = useAuth();
  const list = r.advances ?? [];
  const can = ASK_FROM.includes(r.status) && (r.assignments ?? []).some((a) => a.status !== "RELEASED");
  return (
    <div className="space-y-3">
      {list.length === 0 ? <p className="text-sm text-[color:var(--j-626F86)]">{tr("No Cash in Advance for the technicians of this request.")}</p> : (
        <ul className="divide-y divide-[color:var(--j-F1F2F4)] rounded-[3px] border border-[color:var(--j-DCDFE4)]">
          {list.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2.5 text-sm">
              <HandCoins size={15} className="text-[color:var(--j-626F86)]" />
              <span className="min-w-0 flex-1"><span className="font-medium text-[color:var(--j-172B4D)]">{a.technician}</span>
                <span className="block text-[11px] text-[color:var(--j-626F86)]">{a.number} · {fmtRp(a.paidAmount ?? a.approvedAmount ?? a.amount)}</span></span>
              <Badge tone={TONE[a.status] ?? "slate"}>{a.statusLabel}</Badge>
              {a.status === "PAID" && a.userId === user?.id && <Button size="sm" variant="secondary" onClick={() => setProof(a.id)}><Send size={13} /> {tr("Send proof")}</Button>}
            </li>
          ))}
        </ul>
      )}
      {can && <Button size="sm" variant="secondary" onClick={() => setOpen(true)}><Plus size={14} /> {tr("Cash in Advance for a technician")}</Button>}
      {proof && <ProofDialog id={proof} onClose={() => { setProof(null); onChanged?.(); }} />}
      {open && <AskDialog r={r} busy={busy} act={act} onClose={() => setOpen(false)} />}
    </div>
  );
}
