"use client";

// Excel of a count for the crew (2026-10-29): while the count is open, the import format (the items, Qty and Date
// empty, sheet Petunjuk) and the import of the filled file (a preview of the changes and of the rows to correct,
// then saved); once submitted, the export of what was sent (user decision: the export only after the submit).

import { Download, FileSpreadsheet, Info, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Badge, Button, cx, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { api, errorText } from "@/so/lib/api";
import { type Count, fmtQty } from "@/so/lib/counts";
import { tr } from "@/lib/i18n";

type Preview = { rows: number; applied: boolean; changes: { row: number; item: string; from: number | null; to: number | null; date: string | null }[];
  problems: { row: number; item: string | null; error: string }[] };

export default function SheetTools({ count, open, onImported }: { count: Count; open: boolean; onImported: () => void }) {
  const toast = useToast();
  const [downloading, setDownloading] = useState(false);
  const [importing, setImporting] = useState(false);
  const download = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/so/counts/${count.id}/sheet`, { credentials: "same-origin" });
      if (!res.ok) throw new Error(tr("The file could not be downloaded"));
      const href = URL.createObjectURL(await res.blob());
      const name = `${open ? "Format Import SO" : "SO"} ${count.facility_name} ${count.business_date} ${count.number}.xlsx`;
      Object.assign(document.createElement("a"), { href, download: name }).click();
      URL.revokeObjectURL(href);
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setDownloading(false);
    }
  };
  return (
    <>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <Button size="sm" variant="secondary" loading={downloading} onClick={() => void download()}>
          <Download size={14} /> {open ? tr("Import format") : tr("Export Excel")}
        </Button>
        {open && <Button size="sm" variant="secondary" onClick={() => setImporting(true)}><Upload size={14} /> {tr("Import Excel")}</Button>}
      </div>
      {importing && <ImportDrawer count={count} onClose={() => setImporting(false)} onDownload={() => void download()}
        onImported={() => { setImporting(false); onImported(); }} />}
    </>
  );
}

function ImportDrawer({ count, onClose, onDownload, onImported }: { count: Count; onClose: () => void; onDownload: () => void; onImported: () => void }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<{ name: string; data: string } | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [busy, setBusy] = useState(false);
  const send = async (data: string, apply: boolean) => api<Preview>(`/api/so/counts/${count.id}/sheet`, { method: "POST", json: { file: data, apply } });
  const pick = async (f: File | undefined) => {
    if (!f) return;
    setBusy(true);
    setPreview(null);
    try {
      const data = await new Promise<string>((ok, fail) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = fail; r.readAsDataURL(f); });
      setFile({ name: f.name, data });
      setPreview(await send(data, false));
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };
  const apply = async () => {
    if (!file) return;
    setBusy(true);
    try {
      const r = await send(file.data, true);
      toast(tr("{0} items imported", r.changes.length));
      onImported();
    } catch (e) {
      toast(errorText(e), "error");
    } finally {
      setBusy(false);
    }
  };
  const recount = count.status === "RECOUNT_REQUESTED";
  return (
    <Drawer open onClose={onClose} size="lg" icon={<FileSpreadsheet size={18} />} title={tr("Import Excel")} description={`${count.facility_name} · ${count.number}`}
      locked={busy}
      footer={preview ? (
        <div className="flex w-full flex-wrap items-center justify-end gap-2">
          <Button variant="secondary" onClick={() => input.current?.click()} disabled={busy}>{tr("Choose another file")}</Button>
          <Button loading={busy} disabled={preview.problems.length > 0 || preview.changes.length === 0} onClick={() => void apply()}>
            {tr("Save {0} items", preview.changes.length)}</Button>
        </div>
      ) : undefined}>
      <div className="space-y-4">
        <div className="rounded-xl bg-blue-50 px-4 py-3 text-sm text-blue-900">
          <p className="mb-1.5 flex items-center gap-1.5 font-semibold"><Info size={15} /> {tr("How to fill in")}</p>
          <ol className="list-decimal space-y-1 pl-5 text-xs">
            <li>{tr("Download the import format of this count (the button below or Import format).")}</li>
            <li>{tr("Fill in Qty in the unit of the Unit column (0 = none). Decimals with a dot or a comma.")}</li>
            <li>{tr("Where Date type says Roasted / Expired, fill in Date as dd/mm/yyyy.")}</li>
            <li>{tr("Keep every row and the columns Line ID, Item code and Unit as they are. An empty Qty keeps what is on the form.")}</li>
            {recount && <li>{tr("Recount: only the items marked RECOUNT can be filled (the same quantity confirms one).")}</li>}
            <li>{tr("Upload it here, check the preview, then save. Photos, the WIP and the signature are still done on the form.")}</li>
          </ol>
          <Button size="sm" variant="secondary" className="mt-2" onClick={onDownload}><Download size={14} /> {tr("Import format")}</Button>
        </div>
        <input ref={input} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden"
          onChange={(e) => void pick(e.target.files?.[0])} />
        {!preview && (
          <button type="button" disabled={busy} onClick={() => input.current?.click()}
            className="flex w-full flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-slate-300 px-4 py-8 text-sm text-slate-600 hover:border-blue-400 hover:bg-blue-50/40">
            <Upload size={22} className="text-slate-400" />
            <span className="font-semibold">{busy ? tr("Reading the file…") : tr("Choose the filled Excel file")}</span>
            <span className="text-xs text-slate-400">.xlsx</span>
          </button>
        )}
        {preview && (
          <div className="space-y-3">
            <p className="text-sm text-slate-700">{file?.name} · {tr("{0} rows read", preview.rows)}</p>
            <div className="flex flex-wrap gap-1.5">
              <Badge tone="blue">{tr("{0} items change", preview.changes.length)}</Badge>
              {preview.problems.length > 0 && <Badge tone="red">{tr("{0} rows to correct", preview.problems.length)}</Badge>}
            </div>
            {preview.problems.length > 0 && (
              <ul className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {preview.problems.map((p) => <li key={p.row}>{tr("Row {0}", p.row)}{p.item ? ` · ${p.item}` : ""}: {p.error}</li>)}
                <li className="pt-1 font-semibold">{tr("Correct these rows in the file and choose it again: nothing is saved while a row is wrong.")}</li>
              </ul>
            )}
            {preview.changes.length > 0 && (
              <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 text-sm">
                {preview.changes.map((c) => (
                  <li key={c.row} className="flex items-center justify-between gap-2 px-3 py-2">
                    <span className="min-w-0 truncate">{c.item}</span>
                    <span className={cx("flex-shrink-0 tabular-nums text-xs", "text-slate-600")}>
                      {c.from === null ? "—" : fmtQty(String(c.from))} → <b className="text-slate-900">{c.to === null ? "—" : fmtQty(String(c.to))}</b>{c.date ? ` · ${c.date}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {preview.changes.length === 0 && preview.problems.length === 0 && <p className="text-sm text-slate-500">{tr("Nothing to change: fill in Qty in the file first.")}</p>}
          </div>
        )}
      </div>
    </Drawer>
  );
}
