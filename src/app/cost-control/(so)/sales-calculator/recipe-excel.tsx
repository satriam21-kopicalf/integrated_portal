"use client";

// Recipe Cards ↔ Excel (2026-11-18): the export (one row per line of a card, the same Excel as every export of the
// portal) is also the template of the import; the import checks the whole file first (dry run, nothing saved) and shows
// per card what will be made, changed or refused, then saves the valid cards (integrated_portal_be app/recipe_import.py).

import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import { useState } from "react";
import { Button, Empty, cx } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Lozenge, jHeadRow, jTable, jTd, jTh } from "@/so/ui/Jira";
import { type XlsxCell, downloadXlsx } from "@/lib/xlsx";
import { tr } from "@/lib/i18n";

type Kind = "item" | "wip" | "other" | "menu";
type Card = { code: string; name: string; category: string | null; isActive: boolean; note: string | null;
  lines: { type: Kind; code: string; name: string; qty: number; unit: string; price?: number | null }[]; menus: { id: string; name: string }[] };
type Result = { dry: boolean; create: number; update: number; invalid: number; saved: number; failed: number;
  cards: { code: string; name: string; action: "create" | "update"; errors: string[]; lines: number; rows: number }[] };

const KIND_TEXT: Record<Kind, string> = { item: "Bahan", wip: "WIP", other: "Lain", menu: "Menu" };
export const RECIPE_HEADER = ["Kode Kartu", "Nama Kartu", "Kategori", "Aktif", "Catatan", "Jenis Baris", "Kode Baris", "Nama Baris", "Qty", "Satuan", "Harga", "Menu POS (info)"];

/** Every card as rows of the Excel (empty cards: one row so they are kept). */
export async function exportRecipes(cards: Card[]) {
  const rows: XlsxCell[][] = [];
  for (const c of cards) {
    const head = [c.code, c.name, c.category, c.isActive ? "Ya" : "Tidak", c.note];
    const menus = c.menus.map((m) => m.name).join(" / ");
    if (!c.lines.length) rows.push([...head, null, null, null, null, null, null, menus]);
    c.lines.forEach((l, i) => rows.push([...(i === 0 ? head : [c.code, null, null, null, null]), KIND_TEXT[l.type], l.code, l.name, l.qty, l.unit, l.type === "other" ? l.price ?? null : null, i === 0 ? menus : null]));
  }
  await downloadXlsx({ fileName: `${tr("Recipe Cards")} ${new Date().toISOString().slice(0, 10)}`, sheet: tr("Recipe Cards"),
    title: tr("Recipe Cards · one row per line; edit and import the file to make or change cards"), header: RECIPE_HEADER, rows });
}

export function RecipeImport({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [res, setRes] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (f: File, dry: boolean) => {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch(`/api/cost-control/sales-calc/recipes/import?dry=${dry}`, { method: "POST", body: f, credentials: "same-origin",
        headers: { "content-type": "application/octet-stream" } });
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error ?? body.detail ?? tr("The file could not be read"));
      setRes(body);
      if (!dry) onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const pick = (f: File | undefined) => { if (!f) return; setFile(f); setRes(null); void send(f, true); };
  const saved = res && !res.dry;
  const ok = res ? res.create + res.update : 0;
  return (
    <Drawer open onClose={onClose} size="lg" icon={<Upload size={18} />} title={tr("Import Recipe Cards")}
      description={tr("Use the Excel of the Export button: one row per line, rows of one card share its code")}
      footer={<>
        <Button variant="secondary" onClick={onClose}>{saved ? tr("Close") : tr("Cancel")}</Button>
        {!saved && <Button loading={busy} disabled={!file || !res || ok === 0} onClick={() => file && void send(file, false)}>
          <CheckCircle2 size={15} /> {tr("Import {0} cards", ok)}</Button>}
      </>}>
      <div className="space-y-4">
        <label className={cx("flex cursor-pointer items-center gap-3 rounded-[3px] border border-dashed px-4 py-4 transition-colors",
          file ? "border-[color:var(--j-85B8FF)] bg-[color:var(--j-E9F2FF)]" : "border-[color:var(--j-8590A2)] hover:bg-[color:var(--j-F7F8F9)]")}>
          <FileSpreadsheet size={22} className="flex-shrink-0 text-emerald-600" />
          <span className="min-w-0 flex-1 text-sm"><span className="block truncate font-medium text-[color:var(--j-172B4D)]">{file ? file.name : tr("Choose the Excel file (.xlsx)")}</span>
            <span className="block text-xs text-[color:var(--j-626F86)]">{tr("Columns: Kode Kartu, Nama Kartu, Kategori, Aktif, Catatan, Jenis Baris (Bahan / WIP / Lain / Menu), Kode Baris, Nama Baris, Qty, Satuan, Harga")}</span></span>
          <span className="rounded-[4px] border border-[color:var(--j-8590A2)] bg-white px-2.5 py-1 text-xs font-medium text-[color:var(--j-44546F)]">{file ? tr("Change") : tr("Choose")}</span>
          <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
        </label>
        {error && <p className="rounded-[4px] border-l-[3px] border-red-600 bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
        {busy && !res && <p className="text-sm text-[color:var(--j-626F86)]">{tr("Checking the file…")}</p>}
        {res && (
          <>
            <div className="flex flex-wrap gap-2 text-xs">
              {saved ? <Lozenge tone="green">{tr("{0} saved", res.saved)}</Lozenge> : <>
                <Lozenge tone="blue">{tr("{0} new", res.create)}</Lozenge><Lozenge tone="violet">{tr("{0} changed", res.update)}</Lozenge></>}
              {res.invalid > 0 && <Lozenge tone="red">{tr("{0} refused", res.invalid)}</Lozenge>}
              {!saved && <span className="text-[color:var(--j-626F86)]">{tr("Checked only, nothing saved yet")}</span>}
            </div>
            {res.cards.length === 0 ? <Empty title={tr("No card in the file")} /> : (
              <div className="-mx-5 overflow-x-auto sm:-mx-6">
                <table className={jTable}>
                  <thead><tr className={jHeadRow}><th className={jTh}>Key</th><th className={jTh}>{tr("Name")}</th><th className={jTh}>{tr("Action")}</th>
                    <th className={cx(jTh, "text-right")}>{tr("Lines")}</th><th className={jTh}>{tr("Check")}</th></tr></thead>
                  <tbody>
                    {res.cards.map((c) => (
                      <tr key={c.code} className="border-b border-[color:var(--j-F1F2F4)] align-top">
                        <td className={cx(jTd, "whitespace-nowrap font-medium text-[color:var(--j-0C66E4)]")}>{c.code}</td>
                        <td className={cx(jTd, "max-w-[14rem]")}><span className="block truncate">{c.name || "—"}</span></td>
                        <td className={jTd}><Lozenge tone={c.errors.length ? "red" : c.action === "create" ? "blue" : "violet"}>
                          {c.errors.length ? tr("Refused") : c.action === "create" ? tr("New") : tr("Change")}</Lozenge></td>
                        <td className={cx(jTd, "text-right tabular-nums")}>{c.lines}</td>
                        <td className={cx(jTd, "text-xs")}>{c.errors.length ? <ul className="space-y-0.5 text-red-700">{c.errors.map((e) => <li key={e}>{e}</li>)}</ul>
                          : <span className="text-emerald-700">OK</span>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>
    </Drawer>
  );
}
