"use client";

// Form → Fund Request → Vendor Payment in bulk (2026-11-25, backend app/fund_vendor.py): the recap of the Google Form (or
// the template) is read and checked row by row, the good rows become drafts, the invoices are attached by the invoice
// number in their file name, and every complete draft is sent at once.

import { AlertTriangle, CheckCircle2, Download, Paperclip, Pencil, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button, cx, useToast } from "@/so/ui";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { call } from "@/so/features/checkin/checkin";
import { wibDay } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import { type Unit, fmtRp, upload } from "./pengajuan";
import { ExcelIcon, excelBtnClass } from "@/components/ExcelIconButton";

type Row = { row: number; vendor: string; invoiceNo: string; amount: number | null; due: string | null; account: string; bank: string; unit: string | null; problems: string[]; warnings: string[] };
type Check = { rows: Row[]; ready: number; created: number; total: number };
type DraftRow = { id: string; unit: string | null; vendor: string | null; invoiceNo: string | null; term: string | null; due: string | null; amount: number | null; account: string | null; files: number; missing: string[] };
type Bulk = { done: string[]; failed: { id: string; reason: string }[] };

export default function VendorBatch({ units, unit, onEdit, onSent }: { units: Unit[]; unit: string; onEdit: (id: string) => void; onSent: () => void }) {
  const toast = useToast();
  const [drafts, setDrafts] = useState<DraftRow[] | null>(null);
  const [pick, setPick] = useState<Set<string>>(new Set());
  const [file, setFile] = useState<File | null>(null);
  const [check, setCheck] = useState<Check | null>(null);
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [ask, setAsk] = useState<"send" | "delete" | null>(null);
  const load = useCallback(async () => {
    try { setDrafts((await call<{ data: DraftRow[] }>("/api/pengajuan/vendor/drafts")).data); } catch { setDrafts([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const q = unit ? `&unit=${encodeURIComponent(unit)}` : "";
  const choose = async (f: File | undefined) => {
    if (!f) return;
    setBusy("check"); setCheck(null); setFile(f); setNotes([]);
    try { setCheck(await upload<Check>(`/api/pengajuan/vendor/import?apply=false${q}`, f)); }
    catch (e) { setFile(null); toast((e as Error).message, "error"); } finally { setBusy(""); }
  };
  const apply = async () => {
    if (!file) return;
    setBusy("apply");
    try {
      const r = await upload<Check>(`/api/pengajuan/vendor/import?apply=true${q}`, file);
      toast(tr("{0} drafts made", r.created)); setCheck(null); setFile(null); await load();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(""); }
  };
  const attach = async (list: FileList | null, ids?: string[]) => {
    if (!list?.length) return;
    setBusy("attach");
    const out: string[] = [];
    let n = 0;
    for (const f of Array.from(list)) {
      try {
        const p = new URLSearchParams({ name: f.name.slice(0, 150), ...(ids?.length ? { ids: ids.join(",") } : {}) });
        const r = await upload<{ matched: number; reason: string | null }>(`/api/pengajuan/vendor/attach?${p}`, f);
        if (r.matched) n += r.matched; else out.push(`${f.name}: ${r.reason}`);
      } catch (e) { out.push(`${f.name}: ${(e as Error).message}`); }
    }
    setNotes(out); setBusy(""); toast(tr("{0} drafts with a file", n)); await load();
  };
  const bulk = async (what: "send" | "discard") => {
    setBusy(what);
    try {
      const ids = [...pick];
      const out: Bulk = { done: [], failed: [] };
      for (let i = 0; i < ids.length; i += 50) {
        const r = await call<Bulk>(`/api/pengajuan/vendor/${what}`, { method: "POST", json: { ids: ids.slice(i, i + 50) } });
        out.done.push(...r.done); out.failed.push(...r.failed);
      }
      const name = (id: string) => drafts?.find((d) => d.id === id)?.vendor ?? id;
      setNotes(out.failed.map((f) => `${name(f.id)}: ${f.reason}`));
      toast(what === "send" ? tr("{0} sent, {1} refused", out.done.length, out.failed.length) : tr("Deleted"));
      setPick(new Set()); await load(); if (what === "send") onSent();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(""); setAsk(null); }
  };
  const rows = drafts ?? [];
  const ready = rows.filter((d) => !d.missing.length);
  const toggle = (id: string) => setPick((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const picked = rows.filter((d) => pick.has(d.id));
  const unitName = (c: string | null) => units.find((u) => u.code === c)?.name ?? c ?? "—";
  return (
    <div className="space-y-3 rounded-[3px] border border-[color:var(--j-DCDFE4)] p-3">
      <div className="flex flex-wrap items-center gap-2">
        <p className="mr-auto text-sm font-semibold text-[color:var(--j-172B4D)]">{tr("Many invoices at once")}</p>
        <a href="/api/pengajuan/vendor/template" className="inline-flex h-9 items-center gap-1.5 rounded-[3px] border border-[color:var(--j-DCDFE4)] px-3 text-xs font-medium text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]"><Download size={13} /> {tr("Template")}</a>
        <label className={cx(excelBtnClass, "cursor-pointer", busy && "pointer-events-none opacity-60")}>
          <ExcelIcon busy={busy === "check"} /> {busy === "check" ? tr("Reading …") : tr("Import Excel")}
          <input type="file" accept=".xlsx" className="hidden" onChange={(e) => { void choose(e.target.files?.[0]); e.target.value = ""; }} /></label>
      </div>
      <p className="text-xs text-[color:var(--j-626F86)]">{tr("The Google Form recap can be used as it is. The unit follows the Departemen column, else the unit chosen above.")}</p>
      {check && (
        <div className="space-y-2 rounded-[3px] bg-[color:var(--j-F7F8F9)] p-3">
          <p className="text-sm font-medium text-[color:var(--j-172B4D)]">{tr("{0} of {1} rows ready · {2}", check.ready, check.rows.length, fmtRp(check.total))}</p>
          <ul className="max-h-72 divide-y divide-[color:var(--j-DCDFE4)] overflow-y-auto rounded border border-[color:var(--j-DCDFE4)] bg-white text-xs">
            {check.rows.map((r) => (
              <li key={r.row} className="flex items-start gap-2 px-3 py-2">
                {r.problems.length ? <AlertTriangle size={14} className="mt-px flex-shrink-0 text-red-600" /> : <CheckCircle2 size={14} className="mt-px flex-shrink-0 text-emerald-600" />}
                <span className="min-w-0 flex-1"><span className="block truncate text-[color:var(--j-172B4D)]">{r.row}. {r.vendor || "—"} · {r.invoiceNo || "—"} · {unitName(r.unit)}</span>
                  {r.problems.length > 0 && <span className="block text-red-700">{r.problems.join("; ")}</span>}
                  {r.warnings.length > 0 && <span className="block text-amber-700">{r.warnings.join("; ")}</span>}</span>
                <span className="flex-shrink-0 font-semibold tabular-nums">{fmtRp(r.amount)}</span>
              </li>
            ))}
          </ul>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => { setCheck(null); setFile(null); }}>{tr("Cancel")}</Button>
            <Button loading={busy === "apply"} disabled={!check.ready} onClick={() => void apply()}>{tr("Make {0} drafts", check.ready)}</Button>
          </div>
        </div>
      )}
      {notes.length > 0 && <ul className="max-h-40 list-disc overflow-y-auto rounded-[3px] bg-amber-50 py-2 pl-6 pr-3 text-xs text-amber-900">{notes.map((n) => <li key={n}>{n}</li>)}</ul>}
      {rows.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-2 border-t border-[color:var(--j-F1F2F4)] pt-3">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-[color:var(--j-44546F)]"><input type="checkbox" checked={pick.size > 0 && pick.size === rows.length} onChange={(e) => setPick(e.target.checked ? new Set(rows.map((d) => d.id)) : new Set())} />
              {tr("{0} drafts · {1} complete", rows.length, ready.length)}</label>
            <button type="button" className="text-xs font-medium text-[color:var(--j-0C66E4)] hover:underline" onClick={() => setPick(new Set(ready.map((d) => d.id)))}>{tr("Choose the complete ones")}</button>
            <span className="ml-auto flex flex-wrap gap-2">
              <label className="inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-[3px] border border-[color:var(--j-DCDFE4)] px-3 text-xs font-medium text-[color:var(--j-44546F)] hover:bg-[color:var(--j-F7F8F9)]">
                <Paperclip size={13} /> {busy === "attach" ? tr("Attaching …") : picked.length ? tr("Attach to {0} chosen", picked.length) : tr("Attach by invoice number")}
                <input type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={(e) => { void attach(e.target.files, picked.length ? picked.map((d) => d.id) : undefined); e.target.value = ""; }} /></label>
              <Button variant="ghost" disabled={!picked.length || !!busy} onClick={() => setAsk("delete")}><Trash2 size={14} /> {tr("Delete")}</Button>
              <Button disabled={!picked.length || picked.some((d) => d.missing.length) || !!busy} loading={busy === "send"} onClick={() => setAsk("send")}><Send size={14} /> {tr("Send {0}", picked.length)}</Button>
            </span>
          </div>
          <ul className="max-h-[28rem] divide-y divide-[color:var(--j-F1F2F4)] overflow-y-auto rounded border border-[color:var(--j-DCDFE4)] text-sm">
            {rows.map((d) => (
              <li key={d.id} className="flex items-start gap-3 px-3 py-2">
                <input type="checkbox" className="mt-1" checked={pick.has(d.id)} onChange={() => toggle(d.id)} aria-label={d.vendor ?? d.id} />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium text-[color:var(--j-172B4D)]">{d.vendor ?? "—"}</span>
                  <span className="block truncate text-xs text-[color:var(--j-626F86)]">{unitName(d.unit)} · {d.term ?? "—"} · {d.invoiceNo ?? "—"} · {d.due ? wibDay(d.due) : "—"} · {tr("{0} files", d.files)}</span>
                  {d.missing.length > 0 && <span className="block text-xs text-red-700">{d.missing.join("; ")}</span>}</span>
                <span className="flex-shrink-0 font-semibold tabular-nums">{fmtRp(d.amount)}</span>
                <button type="button" onClick={() => onEdit(d.id)} className="rounded p-1 text-[color:var(--j-626F86)] hover:text-[color:var(--j-0055CC)]" aria-label={tr("Edit")}><Pencil size={14} /></button>
              </li>
            ))}
          </ul>
        </>
      )}
      <ConfirmDialog open={ask === "send"} onClose={() => setAsk(null)} onConfirm={() => void bulk("send")} busy={busy === "send"} title={tr("Send {0} vendor payments?", picked.length)} confirmLabel={tr("Send")}
        description={tr("{0} in total. After sending they cannot be changed unless sent back.", fmtRp(picked.reduce((a, d) => a + (d.amount ?? 0), 0)))} />
      <ConfirmDialog open={ask === "delete"} onClose={() => setAsk(null)} onConfirm={() => void bulk("discard")} busy={busy === "discard"} danger title={tr("Delete {0} drafts?", picked.length)} confirmLabel={tr("Delete")}
        description={tr("Every figure and attachment of this draft is removed.")} />
    </div>
  );
}
