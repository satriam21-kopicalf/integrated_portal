"use client";

// One pengajuan read-only (the outlet's sent pengajuan, the approver's drawer): the approval steps of its kind, the
// requester and the bank account, the balances and baristas (petty cash) or the purpose (budget), every line with its
// receipts (the approver may reject a line with a note), the other evidence and the history.

import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Check, Copy, FileText, Landmark, Paperclip, Users, Wallet, X } from "lucide-react";
import { useState } from "react";
import { Badge, Button, cx, inputClass } from "@/so/ui";
import { wibDateTime, wibDay } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import { type Line, type Pengajuan, type PgFile, type Status, NEEDED_LABEL, STATUS_LABEL, STATUS_TONE, acceptedTotal, categoryLabel, docLabel,
  fileUrl, fmtRp, kindLabel } from "./pengajuan";

export function StatusBadge({ s }: { s: Status }) {
  return <Badge tone={STATUS_TONE[s]} dot>{STATUS_LABEL[s]()}</Badge>;
}

/** Sent → every approval step of its kind → paid; a revision or a rejection shows where it stopped. */
export function Steps({ p }: { p: Pengajuan }) {
  const approvals = (p.steps ?? []).filter((x) => x.type === "APPROVE");
  const pay = (p.steps ?? []).find((x) => x.type === "PAY");
  const cells = [{ label: tr("Sent"), users: [p.name] }, ...approvals.map((x) => ({ label: x.label, users: x.users })),
    { label: pay?.label ?? tr("Paid"), users: pay?.users ?? [] }];
  // index of the cell waiting: sent = 0 done; SUBMITTED at approval step n → cell n; APPROVED → the payment; PAID → all done
  const at = p.status === "PAID" ? cells.length : p.status === "APPROVED" ? cells.length - 1 : p.status === "DRAFT" ? 0
    : Math.min(Math.max(p.approvalStep, 1), approvals.length || 1);
  const stopped = p.status === "REVISION" || p.status === "REJECTED";
  return (
    <ol className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
      {cells.map((c, i) => {
        const done = i < at;
        const here = i === at && p.status !== "PAID";
        return (
          <li key={i} className="min-w-0">
            <span className={cx("block h-1.5 rounded-full", here && stopped ? (p.status === "REJECTED" ? "bg-red-500" : "bg-amber-500") : done ? (p.status === "PAID" ? "bg-emerald-500" : "bg-blue-600") : here ? "bg-blue-200" : "bg-slate-200")} />
            <p className={cx("mt-1 truncate text-[11px] font-semibold", done ? "text-slate-800" : here ? (stopped ? (p.status === "REJECTED" ? "text-red-700" : "text-amber-700") : "text-blue-700") : "text-slate-400")} title={c.label}>
              {here && stopped ? STATUS_LABEL[p.status]() : c.label}</p>
            <p className="truncate text-[10px] text-slate-400" title={c.users.join(", ")}>{i === 0 ? wibDateTime(p.firstSubmittedAt ?? p.submittedAt) : c.users.length ? c.users.join(", ") : "Superadmin"}</p>
          </li>
        );
      })}
    </ol>
  );
}

/** Opening + in − out = closing, as four figures. */
export function Balances({ p, out }: { p: Pengajuan; out?: number }) {
  const total = out ?? p.totalOut ?? 0;
  const closing = p.openingBalance === null ? null : p.openingBalance + (p.incomeAmount ?? 0) - total;
  const cells: [string, number | null, React.ReactNode, string][] = [
    [tr("Opening balance"), p.openingBalance, <Wallet key="o" size={13} />, "text-slate-900"],
    [tr("Money in"), p.incomeAmount, <ArrowDownLeft key="i" size={13} />, "text-emerald-700"],
    [tr("Money out"), total, <ArrowUpRight key="u" size={13} />, "text-red-700"],
    [tr("Closing balance"), closing, <Wallet key="c" size={13} />, closing !== null && closing < 0 ? "text-red-700" : "text-slate-900"],
  ];
  return (
    <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {cells.map(([k, v, icon, tone]) => (
        <div key={k} className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
          <dt className="flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{icon}{k}</dt>
          <dd className={cx("mt-0.5 truncate text-base font-semibold tabular-nums", tone)}>{fmtRp(v)}</dd>
        </div>
      ))}
    </dl>
  );
}

export function FileChip({ f, onRemove }: { f: PgFile; onRemove?: () => void }) {
  const image = f.mime.startsWith("image/");
  return (
    <span className="relative inline-flex">
      <a href={fileUrl(f.id)} target="_blank" rel="noreferrer" title={`${docLabel(f.docType)} · ${f.fileName ?? ""} · ${wibDateTime(f.uploadedAt)}`}
        className="group flex w-20 flex-col items-center gap-1">
        {image
          // eslint-disable-next-line @next/next/no-img-element -- private file through the API
          ? <img src={fileUrl(f.id)} alt={docLabel(f.docType)} loading="lazy" className="h-16 w-20 rounded-lg object-cover ring-1 ring-slate-200 group-hover:ring-2 group-hover:ring-blue-400" />
          : <span className="flex h-16 w-20 items-center justify-center rounded-lg bg-slate-50 text-slate-500 ring-1 ring-slate-200 group-hover:ring-2 group-hover:ring-blue-400"><FileText size={22} /></span>}
        <span className="w-full truncate text-center text-[10px] font-medium text-slate-600">{docLabel(f.docType)}</span>
      </a>
      {f.usedIn.length > 0 && (
        <span className="absolute left-0.5 top-0.5 rounded bg-amber-500 p-0.5 text-white" title={tr("Same file as in {0}", f.usedIn.join(", "))}><Copy size={10} /></span>
      )}
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={tr("Remove attachment")}
          className="absolute -right-1.5 -top-1.5 rounded-full bg-slate-900 p-0.5 text-white shadow"><X size={11} /></button>
      )}
    </span>
  );
}

/** Review of one expense by a checker: OK, or rejected with a note. */
function LineReview({ line, onReview }: { line: Line; onReview: (review: "OK" | "REJECTED", note: string) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const run = async (review: "OK" | "REJECTED") => {
    setBusy(true);
    try { await onReview(review, note.trim()); setOpen(false); setNote(""); } finally { setBusy(false); }
  };
  if (line.review === "REJECTED") {
    return <Button variant="secondary" loading={busy} onClick={() => void run("OK")}><Check size={14} /> {tr("Accept again")}</Button>;
  }
  return open ? (
    <div className="flex w-full flex-wrap items-center gap-2">
      <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={tr("Why is it rejected? (required)")}
        className={cx(inputClass, "h-9 min-w-0 flex-1 text-sm")} autoFocus />
      <Button variant="danger" loading={busy} disabled={!note.trim()} onClick={() => void run("REJECTED")}>{tr("Reject")}</Button>
      <Button variant="secondary" onClick={() => setOpen(false)}>{tr("Cancel")}</Button>
    </div>
  ) : <Button variant="secondary" onClick={() => setOpen(true)}><X size={14} /> {tr("Reject expense")}</Button>;
}

export default function PengajuanView({ p, onReview }: { p: Pengajuan; onReview?: (lineId: number, review: "OK" | "REJECTED", note: string) => Promise<void> }) {
  const lines = p.lines ?? [];
  const files = p.files ?? [];
  const byLine = (id?: number) => files.filter((f) => f.kind === "LINE" && f.lineId === id);
  const income = files.filter((f) => f.kind === "INCOME");
  const other = files.filter((f) => f.kind === "OTHER");
  const payment = files.filter((f) => f.kind === "PAYMENT");
  const rejected = lines.filter((l) => l.review === "REJECTED");
  const reused = files.filter((f) => f.usedIn.length > 0);
  const differs = p.openingExpected !== null && p.openingBalance !== null && p.openingBalance !== p.openingExpected;
  const petty = p.kind === "PETTY_CASH";
  return (
    <div className="space-y-5">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
        <Steps p={p} />
        {petty && <Balances p={p} />}
        <div className="grid gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
          <Info k={tr("Kind")} v={kindLabel(p.kind)} />
          {petty ? <Info k={tr("Period")} v={p.periodFrom && p.periodTo ? `${wibDay(p.periodFrom)} – ${wibDay(p.periodTo)}` : "—"} />
            : NEEDED_LABEL[p.kind] ? <Info k={NEEDED_LABEL[p.kind]!()} v={p.neededOn ? wibDay(p.neededOn) : "—"} /> : null}
          <Info k={tr("Sent by")} v={`${p.requesterName ?? p.name}${p.requesterPhone ? ` · ${p.requesterPhone}` : ""} (@${p.username})`} />
          <Info k={tr("Lines accepted")} v={`${fmtRp(acceptedTotal(lines))}${rejected.length ? ` · ${tr("{0} rejected", rejected.length)}` : ""}`} />
          <Info k={petty ? tr("Top-up asked") : tr("Amount asked")} v={`${fmtRp(p.requestedAmount ?? p.totalOut)}${petty && p.plafon !== null ? ` · ${tr("plafon {0}", fmtRp(p.plafon))}` : ""}`} />
          {p.approvedAmount !== null && <Info k={tr("Approved amount")} v={fmtRp(p.approvedAmount)} />}
          {p.paidAmount !== null && <Info k={tr("Paid")} v={`${fmtRp(p.paidAmount)}${p.paidOn ? ` · ${wibDay(p.paidOn)}` : ""}`} />}
        </div>
        {(differs || reused.length > 0 || (p.closingBalance ?? 0) < 0) && (
          <ul className="space-y-1 text-xs">
            {differs && <li className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-amber-900"><AlertTriangle size={13} className="mt-px flex-shrink-0" />
              {tr("Opening balance differs from the previous closing balance ({0}): {1}", fmtRp(p.openingExpected), p.openingNote ?? "—")}</li>}
            {(p.closingBalance ?? 0) < 0 && <li className="flex items-start gap-1.5 rounded-lg bg-red-50 px-2.5 py-2 text-red-800"><AlertTriangle size={13} className="mt-px flex-shrink-0" />
              {tr("Closing balance is negative")}</li>}
            {reused.length > 0 && <li className="flex items-start gap-1.5 rounded-lg bg-amber-50 px-2.5 py-2 text-amber-900"><Copy size={13} className="mt-px flex-shrink-0" />
              {tr("{0} attachments are the same file as in another fund request: {1}", reused.length, [...new Set(reused.flatMap((f) => f.usedIn))].join(", "))}</li>}
          </ul>
        )}
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-3 text-sm">
          <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><Landmark size={12} /> {tr("Transfer to")}</p>
          <p className="font-semibold text-slate-900">{p.payeeBank ?? "—"} · <span className="tabular-nums">{p.payeeAccount ?? "—"}</span></p>
          <p className="text-slate-600">a/n {p.payeeName ?? "—"}</p>
        </div>
        {!petty && (
          <div className="rounded-xl border border-slate-200 p-3 text-sm">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{tr("Purpose")}</p>
            <p className="whitespace-pre-line text-slate-800">{p.purpose ?? "—"}</p>
          </div>
        )}
      </section>

      {petty && <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><Users size={15} className="text-slate-500" /> {tr("Baristas")}</h3>
        <div className="flex flex-wrap gap-1.5">{p.baristas.length ? p.baristas.map((b) => <Badge key={b.name} tone={b.userId ? "blue" : "slate"}>{b.name}</Badge>) : <span className="text-sm text-slate-400">—</span>}</div>
      </section>}

      {petty && <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><ArrowDownLeft size={15} className="text-emerald-600" /> {tr("Money in")}</h3>
        <div className="rounded-xl border border-slate-200 p-3 text-sm">
          <p className="font-semibold tabular-nums text-slate-900">{fmtRp(p.incomeAmount)}</p>
          {p.incomeNote && <p className="mt-0.5 text-slate-600">{p.incomeNote}</p>}
          {income.length > 0 && <div className="mt-2 flex flex-wrap gap-2">{income.map((f) => <FileChip key={f.id} f={f} />)}</div>}
        </div>
      </section>}

      <section>
        <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-900"><ArrowUpRight size={15} className="text-red-600" /> {petty || p.kind === "EMERGENCY" ? tr("Money out ({0})", lines.length) : tr("Cost details ({0})", lines.length)}
          <span className="ml-auto text-sm tabular-nums">{fmtRp(p.totalOut)}</span></h3>
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {lines.map((l, i) => (
            <li key={l.id ?? i} className={cx("px-3 py-3", l.review === "REJECTED" && "bg-red-50/50")}>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 w-5 flex-shrink-0 text-right text-xs font-semibold tabular-nums text-slate-400">{i + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
                    <span className={cx("font-medium text-slate-900", l.review === "REJECTED" && "line-through decoration-red-400")}>{l.description || "—"}</span>
                    <span className="ml-auto font-semibold tabular-nums text-slate-900">{fmtRp(l.amount)}</span>
                  </p>
                  <p className="text-xs text-slate-500">{l.spentOn ? `${wibDay(l.spentOn)} · ` : ""}{categoryLabel(l.category)}</p>
                  {l.review === "REJECTED" && <p className="mt-1 text-xs font-medium text-red-700">{tr("Rejected")}{l.reviewedBy ? ` (${l.reviewedBy})` : ""}: {l.reviewNote}</p>}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {byLine(l.id).length ? byLine(l.id).map((f) => <FileChip key={f.id} f={f} />) : <span className={cx("text-xs", ["PETTY_CASH", "EMERGENCY", "BILL"].includes(p.kind) ? "text-red-600" : "text-slate-400")}>{tr("No receipt")}</span>}
                  </div>
                  {onReview && l.id !== undefined && <div className="mt-2"><LineReview line={l} onReview={(r, n) => onReview(l.id!, r, n)} /></div>}
                </div>
              </div>
            </li>
          ))}
          {!lines.length && <li className="px-3 py-4 text-center text-sm text-slate-400">{tr("No expense")}</li>}
        </ul>
      </section>

      {(other.length > 0 || payment.length > 0 || p.note) && (
        <section className="space-y-3">
          {p.note && <div><p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{tr("Note")}</p><p className="whitespace-pre-line text-sm text-slate-700">{p.note}</p></div>}
          {other.length > 0 && <div><p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><Paperclip size={11} /> {tr("Other attachments")}</p>
            <div className="flex flex-wrap gap-2">{other.map((f) => <FileChip key={f.id} f={f} />)}</div></div>}
          {payment.length > 0 && <div><p className="mb-1 flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400"><Wallet size={11} /> {tr("Payment proof")}</p>
            <div className="flex flex-wrap gap-2">{payment.map((f) => <FileChip key={f.id} f={f} />)}</div></div>}
        </section>
      )}

      {!!p.events?.length && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-slate-900">{tr("History")}</h3>
          <ol className="space-y-2 border-l-2 border-slate-100 pl-3">
            {[...p.events].reverse().map((e, i) => (
              <li key={i} className="text-sm">
                <p className="text-xs text-slate-400">{wibDateTime(e.at)} · {e.actor ?? "—"}</p>
                <p className="text-slate-800">{eventText(e)}</p>
                {e.note && <p className="mt-0.5 whitespace-pre-line rounded-lg bg-slate-50 px-2.5 py-1.5 text-slate-700">{e.note}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}

function eventText(e: NonNullable<Pengajuan["events"]>[number]): string {
  if (e.kind === "SUBMIT") return e.details.resubmit ? tr("Sent again after the revision") : tr("Sent");
  if (e.kind === "STATUS" && e.details.action === "APPROVE") return tr("Approved: {0}", String(e.details.step ?? ""));
  if (e.kind === "STATUS" && e.to) return `${tr("Status: {0}", STATUS_LABEL[e.to]())}${e.details.step ? ` (${String(e.details.step)})` : ""}`;
  if (e.kind === "LINE") return e.details.review === "REJECTED" ? tr("Line rejected: {0}", String(e.details.description ?? "")) : tr("Line accepted again: {0}", String(e.details.description ?? ""));
  return tr("Note");
}

function Info({ k, v }: { k: string; v: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{k}</p>
      <p className="truncate font-medium text-slate-800" title={v}>{v}</p>
    </div>
  );
}
