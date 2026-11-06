"use client";

// Good Receipt (Cost Control, page cc.goods-receipt; integrated_portal_be app/goods_receipt.py, migration 072): the GRs
// of ESB per outlet and period. Cost Control corrects the receipt date of a GR or the quantity of its lines with a reason
// and evidence (photo of the delivery note, PDF); ESB's figures stay next to the corrected ones and every correction is
// kept (replaced / cancelled). The COGS & Usage of the Sales Calculator and the Outlet Ratio use the corrected figures.

import { CalendarDays, FileText, History, PackageCheck, Paperclip, Pencil, PenLine, Store, Truck, Undo2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, fmtNumber, inputClass, Page, PageNav, Panel, SkeletonRows, theadClass, usePaged, useToast } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ComboFilter, FilterRow, MonitorFilterSheet, QuickPeriod, Segments, periodLabel } from "@/so/ui/MonitorFilters";
import Drawer from "@/so/ui/Drawer";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { type ActiveFilter, FilterToolbar, type Period, dmy, wibDay } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { downloadXlsx } from "@/lib/xlsx";
import { tr } from "@/lib/i18n";

type Doc = { docNum: string; esbDate: string | null; date: string | null; poNum: string | null; branchCode: string | null; branchName: string | null;
  location: string | null; supplier: string | null; status: string | null; lines: number; dateCorrected: boolean; qtyCorrected: number };
type List = { data: Doc[]; suppliers: string[]; truncated: boolean };
type Line = { lineNo: number; code: string | null; name: string | null; unit: string | null; category: string | null; esbQty: number | null; qty: number | null; corrected: boolean };
type Correction = { id: number; kind: "date" | "qty"; lineNo: number | null; code: string | null; unit: string | null; oldDate: string | null; newDate: string | null;
  oldQty: number | null; newQty: number | null; reason: string; by: string; at: string; state: "active" | "replaced" | "cancelled"; cancelledBy: string | null;
  files: { id: number; name: string; type: string; bytes: number }[] };
type Detail = Doc & { note: string | null; createdBy: string | null; items: Line[]; corrections: Correction[] };
type BranchOpt = { branch_code: string; branch_name: string };
type Pending = { name: string; data: string };

const qty = (v: number | null | undefined) => (v == null ? "—" : v.toLocaleString("id-ID", { maximumFractionDigits: 3 }));
const fileUrl = (doc: string, id: number) => `/api/cost-control/goods-receipts/${encodeURIComponent(doc)}/evidence/${id}`;
const MAX_TOTAL = 4 * 1024 * 1024; // the request through the portal proxy stays small: photos are shrunk, PDFs as they are
const asDataUrl = (f: Blob) => new Promise<string>((ok, fail) => {
  const r = new FileReader();
  r.onload = () => ok(String(r.result));
  r.onerror = () => fail(new Error(tr("The file could not be read")));
  r.readAsDataURL(f);
});
/** a photo at most 1600 px on its long side as JPEG (a delivery note stays readable), a PDF unchanged */
async function readFile(f: File): Promise<Pending> {
  if (!f.type.startsWith("image/")) return { name: f.name, data: await asDataUrl(f) };
  const img = await createImageBitmap(f);
  const k = Math.min(1, 1600 / Math.max(img.width, img.height));
  const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.85));
  return { name: f.name.replace(/\.[^.]+$/, "") + ".jpg", data: await asDataUrl(blob ?? f) };
}

type F = { period: Period; branch: string; supplier: string; corrected: "" | "yes" };
const NO_F = (): F => ({ period: { from: wibDay(-6), to: wibDay(0) }, branch: "", supplier: "", corrected: "" });

export default function GoodsReceiptPage() {
  const toast = useToast();
  const [f, setF] = useState<F>(NO_F);
  const { period, branch, supplier } = f;
  const onlyCorrected = f.corrected === "yes";
  const [search, setSearch] = useState("");
  const [sheet, setSheet] = useState(false);
  const [branches, setBranches] = useState<BranchOpt[]>([]);
  const [res, setRes] = useState<List | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  useEffect(() => { void call<BranchOpt[]>("/api/branches?company=all").then(setBranches).catch(() => setBranches([])); }, []);
  const load = useCallback(async () => {
    setError(null);
    setRes(null);
    const qs = new URLSearchParams({ dateFrom: period.from, dateTo: period.to, ...(branch ? { branch } : {}), ...(supplier ? { supplier } : {}),
      ...(onlyCorrected ? { corrected: "true" } : {}) });
    try { setRes(await call<List>(`/api/cost-control/goods-receipts?${qs}`)); } catch (e) { setError((e as Error).message); }
  }, [period, branch, supplier, onlyCorrected]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (res?.data ?? []).filter((d) => !q || [d.docNum, d.poNum, d.branchName, d.supplier].some((v) => (v ?? "").toLowerCase().includes(q)));
  }, [res, search]);
  const paged = usePaged(rows, search + rows.length);
  const corrected = rows.filter((d) => d.dateCorrected || d.qtyCorrected).length;
  const all = res?.data ?? [];
  const def = NO_F();
  const branchName = (code: string) => branches.find((b) => b.branch_code === code)?.branch_name ?? code;
  const chips: ActiveFilter[] = [
    ...(periodLabel(period, def.period) ? [{ key: "p", label: periodLabel(period, def.period)!, onRemove: () => setF({ ...f, period: def.period }) }] : []),
    ...(branch ? [{ key: "b", label: branchName(branch), onRemove: () => setF({ ...f, branch: "" }) }] : []),
    ...(supplier ? [{ key: "s", label: supplier, onRemove: () => setF({ ...f, supplier: "" }) }] : []),
    ...(onlyCorrected ? [{ key: "c", label: tr("Corrected only"), onRemove: () => setF({ ...f, corrected: "" }) }] : []),
  ];

  const exportList = () => downloadXlsx({ fileName: `Good Receipt ${period.from} - ${period.to}`, sheet: "GR", title: `Good Receipt ${dmy(period.from)} – ${dmy(period.to)}`,
    header: ["No GR", "Tanggal terima", "Tanggal ESB", "No PO", "Cabang", "Lokasi", "Supplier", "Status", "Baris", "Tanggal dikoreksi", "Baris qty dikoreksi"],
    rows: rows.map((d) => [d.docNum, d.date, d.esbDate, d.poNum, d.branchName, d.location, d.supplier, d.status, d.lines, d.dateCorrected ? "Ya" : "", d.qtyCorrected || ""]) });

  return (
    <Page title={tr("Good Receipt")} subtitle={`${dmy(period.from)} – ${dmy(period.to)} · ${tr("Goods received by the outlets in ESB; correct the date and quantity with evidence for COGS & usage ratio")}`}
      stats={
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={tr("Good Receipt")} emphasis icon={<PackageCheck size={13} />} value={res ? fmtNumber(all.length) : <StatSkeleton />}>
            {res && <p>{tr("{0} lines", fmtNumber(all.reduce((a, d) => a + d.lines, 0)))}</p>}</Stat>
          <Stat label={tr("Branches")} icon={<Store size={13} />} value={res ? fmtNumber(new Set(all.map((d) => d.branchCode)).size) : <StatSkeleton />}>
            {res && <p>{tr("received goods")}</p>}</Stat>
          <Stat label={tr("Suppliers")} icon={<Truck size={13} />} value={res ? fmtNumber(new Set(all.map((d) => d.supplier).filter(Boolean)).size) : <StatSkeleton />}>
            {res && <p>{tr("delivered")}</p>}</Stat>
          <Stat label={tr("Corrected")} icon={<PenLine size={13} />} active={onlyCorrected}
            onClick={res ? () => setF({ ...f, corrected: onlyCorrected ? "" : "yes" }) : undefined}
            value={res ? <span className={all.some((d) => d.dateCorrected || d.qtyCorrected) ? "text-amber-700" : undefined}>{fmtNumber(all.filter((d) => d.dateCorrected || d.qtyCorrected).length)}</span> : <StatSkeleton />}>
            {res && <p>{tr("{0} date · {1} qty lines", fmtNumber(all.filter((d) => d.dateCorrected).length), fmtNumber(all.reduce((a, d) => a + d.qtyCorrected, 0)))}</p>}</Stat>
        </StatStrip>
      }>
      <Panel toolbar={
        <FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search GR, PO, branch or supplier")} filters={chips}
          onOpen={() => setSheet(true)} onClear={() => setF(NO_F())}
          extra={<Button size="sm" variant="secondary" className="ml-auto" disabled={!rows.length} onClick={() => void exportList().catch((e) => toast((e as Error).message, "error"))}><FileText size={14} />{tr("Export")}</Button>} />
      } footer={res ? <><span>{tr("{0} GR · {1} corrected", rows.length.toLocaleString("id-ID"), corrected)}{res.truncated ? ` · ${tr("the latest 1,000 of the period")}` : ""}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : !res ? <table className="w-full"><tbody><SkeletonRows cols={6} /></tbody></table>
          : !rows.length ? <Empty icon={<PackageCheck size={28} />} title={tr("No Good Receipt in this period")} />
          : (
            <div className="overflow-x-auto"><table className="m-cards w-full text-sm">
              <thead className={theadClass}><tr>
                <th className="py-2.5 pl-5 pr-3">{tr("GR")}</th><th className="px-3 py-2.5">{tr("Received")}</th><th className="px-3 py-2.5">{tr("Branch")}</th>
                <th className="px-3 py-2.5">{tr("Supplier")}</th><th className="px-3 py-2.5">{tr("Status")}</th><th className="px-3 py-2.5 text-right">{tr("Lines")}</th><th className="px-3 py-2.5 pr-5">{tr("Correction")}</th>
              </tr></thead>
              <tbody className="divide-y divide-neutral-100">{paged.rows.map((d) => (
                <tr key={d.docNum} className={cx("cursor-pointer", d.dateCorrected || d.qtyCorrected ? "bg-amber-50/40 hover:bg-amber-50" : "hover:bg-neutral-50/70")} onClick={() => setOpen(d.docNum)}>
                  <td className="py-2.5 pl-5 pr-3"><p className="font-mono text-[13px] font-medium text-neutral-900">{d.docNum}</p><p className="text-[11px] text-neutral-400">{tr("PO")} {d.poNum ?? "—"}</p></td>
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums">{d.date ? dmy(d.date) : "—"}{d.dateCorrected && <p className="text-[11px] text-neutral-400 line-through">{d.esbDate ? dmy(d.esbDate) : ""}</p>}</td>
                  <td className="max-w-[14rem] px-3 py-2.5"><p className="truncate text-neutral-800">{d.branchName ?? "—"}</p>{d.location && <p className="truncate text-[11px] text-neutral-400">{d.location}</p>}</td>
                  <td className="max-w-[14rem] px-3 py-2.5"><p className="truncate text-neutral-700">{d.supplier ?? "—"}</p></td>
                  <td className="px-3 py-2.5">{d.status ? <Badge tone="slate">{d.status}</Badge> : "—"}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{d.lines}</td>
                  <td className="px-3 py-2.5 pr-5">
                    {d.dateCorrected && <Badge tone="amber">{tr("Date")}</Badge>} {d.qtyCorrected > 0 && <Badge tone="amber">{tr("{0} qty", d.qtyCorrected)}</Badge>}
                    {!d.dateCorrected && !d.qtyCorrected && <span className="text-neutral-300">—</span>}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
      </Panel>
      {open && <GrDrawer docNum={open} onClose={() => setOpen(null)} onChanged={() => void load()} />}
      {sheet && <GrFilters value={f} branches={branches} suppliers={[...new Set([...(res?.suppliers ?? []), ...(supplier ? [supplier] : [])])]}
        onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
    </Page>
  );
}

function GrFilters({ value, branches, suppliers, onApply, onClose }: {
  value: F; branches: BranchOpt[]; suppliers: string[]; onApply: (v: F) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  const def = NO_F();
  const period = periodLabel(d.period, def.period);
  const days = Math.round((Date.parse(d.period.to) - Date.parse(d.period.from)) / 864e5) + 1;
  const active = [period, d.branch, d.supplier, d.corrected].filter(Boolean).length;
  return (
    <MonitorFilterSheet active={active} onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(def)} applyDisabled={days > 93}>
      <FilterRow icon={<CalendarDays size={15} />} label={tr("Receipt Date")} value={period ?? tr("Last 7 Days")} onClear={period ? () => setD({ ...d, period: def.period }) : undefined}>
        <QuickPeriod value={d.period} onChange={(p) => setD({ ...d, period: p })} maxDays={93} />
      </FilterRow>
      <FilterRow icon={<Store size={15} />} label={tr("Branch")} value={branches.find((b) => b.branch_code === d.branch)?.branch_name ?? null} onClear={() => setD({ ...d, branch: "" })}>
        <ComboFilter value={d.branch} onChange={(v) => setD({ ...d, branch: v })} allLabel={tr("All branches")} placeholder={tr("Search branch")}
          options={branches.map((b) => ({ value: b.branch_code, label: b.branch_name, hint: b.branch_code }))} />
      </FilterRow>
      <FilterRow icon={<Truck size={15} />} label={tr("Supplier")} value={d.supplier || null} onClear={() => setD({ ...d, supplier: "" })}>
        <ComboFilter value={d.supplier} onChange={(v) => setD({ ...d, supplier: v })} allLabel={tr("All suppliers")} placeholder={tr("Search supplier")}
          options={suppliers.map((s) => ({ value: s, label: s }))} />
      </FilterRow>
      <FilterRow icon={<PenLine size={15} />} label={tr("Correction")} value={d.corrected ? tr("Corrected only") : null} onClear={() => setD({ ...d, corrected: "" })}>
        <Segments value={d.corrected} onChange={(v) => setD({ ...d, corrected: v as F["corrected"] })}
          choices={[{ value: "", label: tr("All GR") }, { value: "yes", label: tr("Corrected only") }]} />
      </FilterRow>
    </MonitorFilterSheet>
  );
}

function GrDrawer({ docNum, onClose, onChanged }: { docNum: string; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [date, setDate] = useState("");
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [reason, setReason] = useState("");
  const [files, setFiles] = useState<Pending[]>([]);
  const [busy, setBusy] = useState(false);
  const [undo, setUndo] = useState<Correction | null>(null);
  const path = `/api/cost-control/goods-receipts/${encodeURIComponent(docNum)}`;

  const load = useCallback(async () => {
    setError(null);
    try { setD(await call<Detail>(path)); } catch (e) { setError((e as Error).message); }
  }, [path]);
  useEffect(() => { void load(); }, [load]);
  const start = () => {
    if (!d) return;
    setDate(d.date ?? "");
    setDraft(Object.fromEntries(d.items.map((l) => [l.lineNo, l.qty == null ? "" : String(l.qty)])));
    setReason("");
    setFiles([]);
    setEditing(true);
  };
  const changedLines = d ? d.items.filter((l) => draft[l.lineNo] !== undefined && draft[l.lineNo].trim() !== "" && Number(draft[l.lineNo].replace(",", ".")) !== l.qty) : [];
  const dateChanged = !!d && !!date && date !== d.date;

  const save = async () => {
    setBusy(true);
    try {
      setD(await call<Detail>(`${path}/corrections`, { method: "POST", json: {
        ...(dateChanged ? { date } : {}), reason: reason.trim(), files,
        lines: changedLines.map((l) => ({ lineNo: l.lineNo, qty: Number(draft[l.lineNo].replace(",", ".")) })) } }));
      setEditing(false);
      toast(tr("Correction saved"));
      onChanged();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const cancel = async () => {
    if (!undo) return;
    setBusy(true);
    try {
      setD(await call<Detail>(`${path}/corrections/${undo.id}`, { method: "DELETE" }));
      setUndo(null);
      toast(tr("Correction cancelled"));
      onChanged();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const addFiles = async (list: FileList | null) => {
    try {
      const picked = await Promise.all([...(list ?? [])].slice(0, 5 - files.length).map(readFile));
      if ([...files, ...picked].reduce((n, f) => n + f.data.length * 0.75, 0) > MAX_TOTAL) throw new Error(tr("The files are too large together (at most 4 MB)"));
      setFiles((f) => [...f, ...picked]);
    } catch (e) { toast((e as Error).message, "error"); }
  };

  return (
    <Drawer open onClose={onClose} size="lg" icon={<PackageCheck size={18} />} title={docNum}
      description={d ? `${d.branchName ?? ""} · ${d.supplier ?? ""} · PO ${d.poNum ?? "—"}` : ""}
      footer={d && (editing ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={() => setEditing(false)}>{tr("Cancel")}</Button>
          <Button loading={busy} disabled={(!dateChanged && !changedLines.length) || reason.trim().length < 3 || !files.length} onClick={() => void save()}>{tr("Save Correction")}</Button>
        </div>
      ) : <div className="flex justify-end"><Button onClick={start}><Pencil size={14} />{tr("Correct Date / Qty")}</Button></div>)}>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : !d ? <p className="text-sm text-neutral-400">{tr("Loading…")}</p> : (
        <div className="space-y-4">
          <dl className="grid grid-cols-2 gap-3 rounded-xl border border-neutral-200 p-3 text-sm sm:grid-cols-4">
            <div><dt className="text-xs text-neutral-500">{tr("Received")}</dt><dd className="font-medium">
              {editing ? <input type="date" className={inputClass + " mt-1"} value={date} onChange={(e) => setDate(e.target.value)} /> : d.date ? dmy(d.date) : "—"}</dd></div>
            <div><dt className="text-xs text-neutral-500">{tr("ESB date")}</dt><dd>{d.esbDate ? dmy(d.esbDate) : "—"}</dd></div>
            <div><dt className="text-xs text-neutral-500">{tr("Location")}</dt><dd>{d.location ?? "—"}</dd></div>
            <div><dt className="text-xs text-neutral-500">{tr("Status")}</dt><dd>{d.status ?? "—"}</dd></div>
          </dl>

          <div className="overflow-x-auto rounded-xl border border-neutral-200"><table className="w-full text-sm">
            <thead className={theadClass}><tr><th className="px-3 py-2">{tr("Item")}</th><th className="px-3 py-2 text-right">{tr("ESB Qty")}</th>
              <th className="px-3 py-2 text-right">{tr("Qty Used")}</th><th className="px-3 py-2">{tr("Unit")}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">{d.items.map((l) => (
              <tr key={l.lineNo}>
                <td className="px-3 py-2"><p className="text-neutral-800">{l.name}</p><p className="text-[11px] text-neutral-400">{l.code}</p></td>
                <td className="px-3 py-2 text-right tabular-nums text-neutral-500">{qty(l.esbQty)}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {editing ? <input inputMode="decimal" className={inputClass + " w-24 text-right"} value={draft[l.lineNo] ?? ""}
                    onChange={(e) => setDraft((x) => ({ ...x, [l.lineNo]: e.target.value }))} />
                    : <span className={l.corrected ? "font-semibold text-amber-700" : ""}>{qty(l.qty)}</span>}
                </td>
                <td className="px-3 py-2 text-neutral-600">{l.unit}</td>
              </tr>
            ))}</tbody>
          </table></div>

          {editing && (
            <div className="space-y-3 rounded-xl border border-amber-200 bg-amber-50/60 p-3">
              <label className="block text-xs font-medium text-neutral-700">{tr("Reason (required)")}
                <textarea className={inputClass + " mt-1 h-20 w-full"} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)}
                  placeholder={tr("e.g. the goods arrived on 3/11, the delivery note says 3 bottles")} />
              </label>
              <div>
                <p className="text-xs font-medium text-neutral-700">{tr("Evidence (required, photo or PDF, at most 5 files, 4 MB together)")}</p>
                <div className="mt-1 flex flex-wrap gap-2">
                  {files.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2 py-1 text-xs">
                      <Paperclip size={12} />{f.name}<button type="button" aria-label={tr("Remove")} onClick={() => setFiles((x) => x.filter((_, j) => j !== i))}><X size={12} /></button>
                    </span>
                  ))}
                  {files.length < 5 && (
                    <label className="inline-flex cursor-pointer items-center gap-1 rounded-lg border border-dashed border-neutral-300 bg-white px-2 py-1 text-xs text-brand-700">
                      <Paperclip size={12} />{tr("Attach")}
                      <input type="file" className="hidden" multiple accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => { void addFiles(e.target.files); e.target.value = ""; }} />
                    </label>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-neutral-500">{tr("{0} lines changed", changedLines.length)}{dateChanged ? ` · ${tr("date {0} → {1}", d.date ? dmy(d.date) : "—", dmy(date))}` : ""}</p>
            </div>
          )}

          <section>
            <h3 className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-neutral-800"><History size={14} />{tr("Correction History")}</h3>
            {!d.corrections.length ? <p className="text-sm text-neutral-400">{tr("No correction yet: the figures are ESB's")}</p> : (
              <ul className="space-y-2">{d.corrections.map((c) => {
                const line = c.lineNo ? d.items.find((l) => l.lineNo === c.lineNo) : null;
                return (
                  <li key={c.id} className="rounded-xl border border-neutral-200 p-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-neutral-900">{c.kind === "date"
                        ? tr("Date {0} → {1}", c.oldDate ? dmy(c.oldDate) : "—", c.newDate ? dmy(c.newDate) : "—")
                        : `${line?.name ?? c.code}: ${qty(c.oldQty)} → ${qty(c.newQty)} ${c.unit ?? ""}`}</span>
                      <Badge tone={c.state === "active" ? "green" : "slate"}>{c.state === "active" ? tr("Active") : c.state === "replaced" ? tr("Replaced") : tr("Cancelled")}</Badge>
                      {c.state === "active" && <button type="button" className="ml-auto inline-flex items-center gap-1 text-xs text-red-600 hover:underline" onClick={() => setUndo(c)}><Undo2 size={12} />{tr("Cancel")}</button>}
                    </div>
                    <p className="mt-0.5 text-neutral-700">{c.reason}</p>
                    <p className="text-[11px] text-neutral-500">{c.by} · {wibDateTime(c.at)}{c.cancelledBy ? ` · ${tr("cancelled by {0}", c.cancelledBy)}` : ""}</p>
                    {c.files.length > 0 && <div className="mt-1 flex flex-wrap gap-2">{c.files.map((f) => (
                      <a key={f.id} href={fileUrl(docNum, f.id)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-700 hover:underline"><Paperclip size={12} />{f.name}</a>
                    ))}</div>}
                  </li>
                );
              })}</ul>
            )}
          </section>
        </div>
      )}
      <ConfirmDialog open={!!undo} busy={busy} danger title={tr("Cancel this correction?")} description={tr("The figure goes back to ESB's")}
        confirmLabel={tr("Cancel Correction")} onConfirm={() => void cancel()} onClose={() => setUndo(null)} />
    </Drawer>
  );
}
