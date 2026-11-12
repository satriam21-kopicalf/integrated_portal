"use client";

// Unusual ESB documents (COGS & Usage, 2026-11-12; integrated_portal_be app/doc_checks.py, migration 097): the lines of
// the documents that move the stock of an outlet whose quantity is 20× the usual one or more (or that much less) — TGP04
// entered its espresso production in KG instead of GR, ~Rp 2.6 bn of "unexplained" usage. Cost Control corrects the
// quantity here with a reason (ESB stays as it is) and the COGS, the Sales Calculator and the Stock List use it; a goods
// receipt is corrected on its own page.

import { FileWarning, Pencil, Undo2 } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, inputClass, Panel, SkeletonRows, theadClass, useToast } from "@/so/ui";
import Dialog, { ConfirmDialog } from "@/so/ui/Dialog";
import { dmy } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";

type Fix = { id: number; newQty: number; oldQty: number; reason: string; by: string | null; at: string };
export type DocLine = {
  module: string; lineType: string; kind: string; docNum: string; docDate: string; status: string | null; branch: string; branchName: string;
  code: string; name: string; uom: string; qty: number; baseQty: number; unit: string; usual: number; samples: number; factor: number | null;
  unusual: boolean; severe: boolean; price: number | null; impact: number | null; ownPage: boolean; fix: Fix | null;
};
type Result = { data: DocLine[]; summary: { lines: number; open: number; fixed: number; impact: number } };

const num = (v: number) => v.toLocaleString("id-ID", { maximumFractionDigits: 3 });
const rp = (v: number | null) => (v == null ? "—" : `Rp ${Math.round(v).toLocaleString("id-ID")}`);
const KIND: Record<string, string> = {
  received: "Goods receipt", outletBuy: "Outlet purchase", produced: "Production result", consumed: "Production material",
  delivered: "Goods delivery", returned: "Return",
};
/** a unit typed wrong by about 1,000 (KG for GR, L for ML): the quantity ÷ 1,000 */
const guess = (l: DocLine) => (l.factor && l.factor >= 500 && l.factor <= 2000 ? l.qty / 1000 : null);

export default function DocChecks({ from, to, onChanged }: { from: string; to: string; onChanged: () => void }) {
  const toast = useToast();
  const [res, setRes] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fixing, setFixing] = useState<DocLine | null>(null);
  const [undo, setUndo] = useState<DocLine | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError(null); setRes(null);
    try { setRes(await call<Result>(`/api/cost-control/doc-checks?dateFrom=${from}&dateTo=${to}`)); } catch (e) { setError((e as Error).message); }
  }, [from, to]);
  useEffect(() => { void load(); }, [load]);
  const cancel = async (l: DocLine) => {
    if (!l.fix) return;
    setBusy(true);
    try {
      await call(`/api/cost-control/doc-fixes/${l.fix.id}`, { method: "DELETE" });
      toast(tr("Correction of {0} cancelled", l.docNum)); setUndo(null); await load(); onChanged();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const s = res?.summary;
  return (
    <Panel className="mt-4" title={tr("Unusual ESB documents")}
      description={tr("Lines of the ESB documents of the outlets 20× the usual quantity or more (or that much less): usually a unit typed wrong. Correct them before reading the COGS; ESB itself is not changed.")}
      actions={s ? <span className="text-xs text-neutral-500">{s.open ? <span className="font-semibold text-red-700">{tr("{0} to check · {1}", s.open, rp(s.impact))}</span> : tr("Nothing to check")}{s.fixed ? ` · ${tr("{0} corrected", s.fixed)}` : ""}</span> : undefined}>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : !res ? <table className="w-full"><tbody><SkeletonRows cols={6} /></tbody></table>
        : !res.data.length ? <Empty icon={<FileWarning size={24} />} title={tr("No unusual document in this period")} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] text-sm">
              <thead className={theadClass}><tr>
                <th className="py-2.5 pl-5 pr-3">{tr("Outlet / document")}</th><th className="px-3 py-2.5">{tr("Item")}</th>
                <th className="px-3 py-2.5 text-right">{tr("ESB quantity")}</th><th className="px-3 py-2.5 text-right">{tr("Usually")}</th>
                <th className="px-3 py-2.5 text-right">{tr("Impact")}</th><th className="px-3 py-2.5">{tr("Correction")}</th>
              </tr></thead>
              <tbody className="divide-y divide-neutral-100">{res.data.map((l) => (
                <tr key={`${l.module}|${l.docNum}|${l.lineType}|${l.code}|${l.uom}`} className={cx(l.fix && "bg-emerald-50/40")}>
                  <td className="max-w-[13rem] py-2.5 pl-5 pr-3">
                    <span className="block truncate font-medium text-neutral-900">{l.branchName}</span>
                    <span className="block text-[11px] text-neutral-500">{l.docNum} · {dmy(l.docDate)}</span>
                    <span className="text-[11px] text-neutral-400">{tr(KIND[l.kind] ?? l.kind)}</span>
                  </td>
                  <td className="max-w-[11rem] px-3 py-2.5"><span className="block truncate" title={l.name}>{l.name}</span><span className="text-[11px] text-neutral-400">{l.code}</span></td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                    <span className={cx("font-semibold", l.unusual && !l.fix && "text-red-700")}>{num(l.qty)} {l.uom}</span>
                    {l.unit !== l.uom && <span className="block text-[11px] text-neutral-400">= {num(l.baseQty)} {l.unit}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">
                    <span className="text-neutral-700">{num(l.usual)} {l.unit}</span>
                    {l.factor != null && <span className="block">{l.severe ? <Badge tone="red">{tr("×{0} · wrong unit?", num(l.factor))}</Badge>
                      : <span className="text-[11px] text-amber-700">×{num(l.factor)}</span>}</span>}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums">{rp(l.impact)}</td>
                  <td className="px-3 py-2.5">
                    {l.fix ? (
                      <div className="text-xs">
                        <Badge tone="green">{tr("Corrected to {0} {1}", num(l.fix.newQty), l.uom)}</Badge>
                        <span className="mt-0.5 block text-neutral-500" title={l.fix.reason}>{l.fix.by} · {wibDateTime(l.fix.at)}</span>
                        <button type="button" onClick={() => setUndo(l)} className="mt-0.5 inline-flex items-center gap-1 text-neutral-500 hover:text-red-700"><Undo2 size={12} />{tr("Cancel")}</button>
                      </div>
                    ) : l.ownPage ? (
                      <Link href={`/cost-control/goods-receipt?doc=${encodeURIComponent(l.docNum)}&date=${l.docDate}`} className="text-xs font-medium text-brand-700 hover:underline">{tr("Correct in Good Receipt")}</Link>
                    ) : (
                      <Button size="sm" variant="secondary" onClick={() => setFixing(l)}><Pencil size={13} />{tr("Correct")}</Button>
                    )}
                  </td>
                </tr>))}</tbody>
            </table>
          </div>
        )}
      {fixing && <FixDialog line={fixing} onClose={() => setFixing(null)} onDone={() => { setFixing(null); void load(); onChanged(); }} />}
      <ConfirmDialog open={!!undo} busy={busy} danger title={tr("Cancel the correction of {0}?", undo?.docNum ?? "")}
        description={tr("The COGS uses the ESB quantity again ({0} {1}).", undo ? num(undo.qty) : "", undo?.uom ?? "")}
        confirmLabel={tr("Cancel correction")} onConfirm={() => undo && void cancel(undo)} onClose={() => setUndo(null)} />
    </Panel>
  );
}

function FixDialog({ line, onClose, onDone }: { line: DocLine; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const g = guess(line);
  const [qty, setQty] = useState(g != null ? String(g).replace(".", ",") : "");
  const [reason, setReason] = useState(g != null ? tr("Unit typed wrong in ESB ({0} instead of {1})", line.uom, line.unit) : "");
  const [busy, setBusy] = useState(false);
  const value = Number(qty.replace(/\./g, "").replace(",", "."));
  const ok = qty.trim() !== "" && Number.isFinite(value) && value >= 0 && reason.trim().length >= 5;
  const save = async () => {
    setBusy(true);
    try {
      await call("/api/cost-control/doc-fixes", { method: "POST", json: { module: line.module, docNum: line.docNum, lineType: line.lineType, code: line.code,
        uom: line.uom, qty: value, reason: reason.trim() } });
      toast(tr("{0} corrected", line.docNum)); onDone();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Dialog open title={tr("Correct {0}", line.docNum)} description={`${line.branchName} · ${line.name} · ${tr("ESB: {0} {1}", num(line.qty), line.uom)}`} onClose={onClose}
      footer={<><Button variant="ghost" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} disabled={!ok} onClick={() => void save()}>{tr("Save correction")}</Button></>}>
      <div className="space-y-3">
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">{tr("Usually {0} {1} a document for this item (median of {2} lines in 90 days).", num(line.usual), line.unit, line.samples)}</p>
        <label className="block text-sm font-medium text-neutral-700">{tr("Right quantity ({0})", line.uom)}
          <input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className={cx(inputClass, "mt-1 h-10 text-right")} />
        </label>
        <label className="block text-sm font-medium text-neutral-700">{tr("Reason")}
          <input value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} className={cx(inputClass, "mt-1 h-10")} />
        </label>
        <p className="text-[11px] text-neutral-500">{tr("ESB stays as it is: correct the document in ESB as well so both agree.")}</p>
      </div>
    </Dialog>
  );
}
