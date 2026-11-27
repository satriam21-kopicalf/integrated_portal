"use client";

// Usage Management in the waste monitor / review (integrated_portal_be app/usage_fix.py, 2026-11-25): the quantities the
// branches filled, the unusual ones marked (10x the usual quantity of the item, mostly pieces or grams entered in a pack
// unit). Whoever reviews waste corrects a line, or many at once with the suggested quantity; every change is kept.

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, History, PencilLine, Save, Wand2 } from "lucide-react";
import { Button, Empty, ErrorState, Field, Input, PageNav, SearchBox, Select, cx, fmtNumber, usePaged, useToast } from "@/so/ui";
import { CardFooter, Lozenge, QuickChips, Toolbar, jHeadRow, jTable, jTd } from "@/so/ui/Jira";
import Drawer from "@/so/ui/Drawer";
import { SkeletonList, SkeletonTable } from "@/components/kc/Skeleton";
import { SearchSelect } from "@/cotr/ui";
import { SortTh, useSort } from "@/so/ui/Sort";
import { type Period, dmy } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import { thumb } from "@/lib/assets";
import { type UsageRow, fmtQty, usagePhotoUrl } from "./waste";

type Show = "all" | "unusual" | "corrected";
type UKey = "day" | "branch" | "item" | "qty" | "category" | "by";
const uValue = (r: UsageRow, k: UKey) => ({ day: r.businessDate, branch: r.branchName, item: r.itemName, qty: r.qty, category: r.category ?? "", by: r.by }[k]);
const idOf = (r: UsageRow) => `${r.branchCode}|${r.businessDate}|${r.itemCode}`;
const FIELD: Record<string, () => string> = { qty: () => tr("Quantity"), item: () => tr("Item"), category: () => tr("Category"), note: () => tr("Note / reason") };
type Fix = { field: string; old: string | null; new: string | null; reason: string; by: string; at: string };
type Result = { updated: unknown[]; skipped: { itemCode: string; reason: string }[] };
const url = (r: UsageRow) => `/api/waste/usage/${encodeURIComponent(r.branchCode)}/${r.businessDate}/${encodeURIComponent(r.itemCode)}`;
const area = "min-h-[80px] w-full rounded-[3px] border border-[color:var(--j-8590A2)] px-3 py-2 text-sm focus:border-[color:var(--j-388BFF)] focus:outline-none";

export function UsageReport({ period, branch, canFix }: { period: Period; branch: string; canFix: boolean }) {
  const toast = useToast();
  const [rowsAll, setRows] = useState<UsageRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<Show>("all");
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [edit, setEdit] = useState<UsageRow | null>(null);
  const [bulk, setBulk] = useState(false);
  useEffect(() => {
    let live = true;
    setError(null);
    setRows(null);
    setPicked(new Set());
    const q = new URLSearchParams({ dateFrom: period.from, dateTo: period.to, ...(branch ? { branch } : {}) });
    call<{ data: UsageRow[] }>(`/api/waste/usage?${q}`).then((r) => live && setRows(r.data)).catch((e: Error) => live && setError(e.message));
    return () => { live = false; };
  }, [period, branch, version]);
  const s = search.trim().toLowerCase();
  const rows = useMemo(() => (rowsAll ?? []).filter((r) => (show === "all" || (show === "unusual" ? !!r.unusual : !!r.corrections))
    && (!s || `${r.itemName} ${r.itemCode} ${r.branchName} ${r.by}`.toLowerCase().includes(s))), [rowsAll, show, s]);
  const sorted = useSort<UsageRow, UKey>(rows, uValue, { key: "day", dir: "desc" });
  const paged = usePaged(sorted.rows, show + search + rows.length + JSON.stringify(sorted.sort));
  if (error) return <ErrorState message={error} onRetry={() => setVersion((v) => v + 1)} />;
  if (!rowsAll) return <SkeletonTable cols={7} />;
  const suggestable = rows.filter((r) => r.suggested != null);
  const chosen = suggestable.filter((r) => picked.has(idOf(r)));
  const toggle = (r: UsageRow) => setPicked((p) => { const n = new Set(p); if (!n.delete(idOf(r))) n.add(idOf(r)); return n; });
  const done = (r: Result) => {
    if (r.updated.length) toast(tr("{0} lines corrected", r.updated.length));
    if (r.skipped.length) toast(`${tr("{0} lines skipped", r.skipped.length)}: ${r.skipped[0].reason}`, "error");
    if (r.updated.length) { setEdit(null); setBulk(false); setVersion((v) => v + 1); }
  };
  return (
    <div>
      <Toolbar>
        <div className="flex flex-wrap items-center gap-2">
          <div className="w-full sm:w-72"><SearchBox value={search} onChange={setSearch} placeholder={tr("Search item or branch")} /></div>
          <QuickChips<Show> value={show} onChange={setShow} label={tr("Show")} items={[{ key: "all", label: tr("All"), count: rowsAll.length },
            { key: "unusual", label: tr("Unusual"), dot: "bg-amber-500", count: rowsAll.filter((r) => r.unusual).length },
            { key: "corrected", label: tr("Corrected"), dot: "bg-[color:var(--j-388BFF)]", count: rowsAll.filter((r) => r.corrections).length }]} />
          {canFix && suggestable.length > 0 && show === "unusual" && (
            <span className="ml-auto flex items-center gap-2">
              <button type="button" className="text-xs font-medium text-[color:var(--j-0C66E4)] hover:underline"
                onClick={() => setPicked(chosen.length === suggestable.length ? new Set() : new Set(suggestable.map(idOf)))}>
                {chosen.length === suggestable.length ? tr("Select none") : tr("Select every suggestion ({0})", suggestable.length)}</button>
              <Button size="sm" disabled={!chosen.length || chosen.length > 500} onClick={() => setBulk(true)}><Wand2 size={14} />{tr("Use the suggestion")} ({chosen.length})</Button>
            </span>
          )}
        </div>
        {show === "unusual" && <p className="text-xs text-[color:var(--j-626F86)]">{tr("10 times or more the usual quantity of the item (60 days, every outlet). The suggestion divides it by the content of the pack; check the photo before using it.")}</p>}
      </Toolbar>
      {!rows.length ? <Empty title={show === "all" ? tr("No Usage Management list filled in this period") : tr("Nothing matches the search or filters")} /> : (
        <div className="overflow-x-auto">
          <table className={cx("m-cards", jTable)}>
            <thead><tr className={jHeadRow}>
              <SortTh k="day" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" first="desc">{tr("Day")}</SortTh>
              <SortTh k="branch" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2">{tr("Branch")}</SortTh>
              <SortTh k="item" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2">{tr("Item")}</SortTh>
              <SortTh k="qty" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Quantity")}</SortTh>
              <SortTh k="category" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2">{tr("Category")}</SortTh>
              <th className="px-3 py-2 font-medium">{tr("Photo")}</th>
              <SortTh k="by" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2">{tr("Filled by")}</SortTh>
              {canFix && <th className="px-3 py-2"><span className="sr-only">{tr("Correct")}</span></th>}
            </tr></thead>
            <tbody className="divide-y divide-[color:var(--j-F1F2F4)]">
              {paged.rows.map((r) => (
                <tr key={idOf(r)} className={cx("align-top", r.unusual && "bg-amber-50/40")}>
                  <td className={cx(jTd, "whitespace-nowrap text-[color:var(--j-44546F)]")}>
                    {canFix && show === "unusual" && r.suggested != null && <input type="checkbox" className="mr-2 align-middle" aria-label={tr("Select")} checked={picked.has(idOf(r))} onChange={() => toggle(r)} />}
                    {dmy(r.businessDate)}</td>
                  <td className={cx(jTd, "text-[color:var(--j-172B4D)]")}>{r.branchName}</td>
                  <td className={jTd}><span className="text-[color:var(--j-172B4D)]">{r.itemName}</span> <span className="block text-[11px] text-[color:var(--j-626F86)]">{r.itemCode}</span></td>
                  <td className={cx(jTd, "text-right tabular-nums")}><span className={cx(r.unusual && "font-semibold text-amber-800")}>{fmtQty(r.qty)}</span> <span className="text-xs text-[color:var(--j-626F86)]">{r.unit}</span>
                    {r.unusual && <span className="block text-[11px] text-amber-800"><AlertTriangle size={11} className="mr-1 inline" aria-hidden />{tr("usual {0}", fmtQty(r.usual ?? 0))}{r.suggested != null && <> · {tr("suggested {0}", fmtQty(r.suggested))}</>}</span>}
                    {!!r.corrections && <span className="block"><Lozenge tone="blue">{tr("Corrected")}</Lozenge></span>}</td>
                  <td className={cx(jTd, "text-xs text-[color:var(--j-44546F)]")}>{r.category ?? "—"}{r.note && <span className="block text-[color:var(--j-626F86)]">“{r.note}”</span>}</td>
                  <td className={jTd}>{r.hasPhoto ? (
                    <a href={usagePhotoUrl(r.branchCode, r.businessDate, r.itemCode)} target="_blank" rel="noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={thumb(usagePhotoUrl(r.branchCode, r.businessDate, r.itemCode), 96)} decoding="async" alt="" loading="lazy" className="h-10 w-10 rounded-[3px] bg-[color:var(--j-091E420F)] object-cover" />
                    </a>) : <span className="text-xs text-[color:var(--j-626F86)]">—</span>}</td>
                  <td className={cx(jTd, "text-xs text-[color:var(--j-626F86)]")}>{r.by} · {wibDateTime(r.updatedAt)}</td>
                  {canFix && <td className={cx(jTd, "text-right")}><Button size="sm" variant="ghost" onClick={() => setEdit(r)}><PencilLine size={13} />{tr("Correct")}</Button></td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <CardFooter><span>{tr("{0} lines", fmtNumber(rows.length))}</span><PageNav paged={paged} /></CardFooter>
      {edit && <UsageCorrect key={idOf(edit)} row={edit} onClose={() => setEdit(null)} onDone={done} />}
      {bulk && <UsageBulk rows={chosen} onClose={() => setBulk(false)} onDone={done} />}
    </div>
  );
}

function UsageHistory({ row }: { row: UsageRow }) {
  const [rows, setRows] = useState<Fix[] | null>(null);
  useEffect(() => { call<{ data: Fix[] }>(`${url(row)}/corrections`).then((r) => setRows(r.data)).catch(() => setRows([])); }, [row]);
  return (
    <div className="rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)] p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-[color:var(--j-44546F)]"><History size={13} />{tr("Corrected by Cost Control")}</p>
      {!rows ? <SkeletonList rows={2} /> : (
        <ul className="space-y-2 text-xs text-[color:var(--j-44546F)]">{rows.map((r, i) => (
          <li key={i}><span className="font-medium">{FIELD[r.field]?.() ?? r.field}</span>: <span className="text-[color:var(--j-626F86)] line-through">{r.old || "—"}</span> → <span className="font-medium text-[color:var(--j-172B4D)]">{r.new || "—"}</span>
            <span className="block text-[color:var(--j-626F86)]">“{r.reason}” · {r.by} · {wibDateTime(r.at)}</span></li>))}</ul>)}
    </div>
  );
}

function UsageCorrect({ row, onClose, onDone }: { row: UsageRow; onClose: () => void; onDone: (r: Result) => void }) {
  const toast = useToast();
  const [opts, setOpts] = useState<{ items: { code: string; name: string; unit: string }[]; categories: string[] } | null>(null);
  const [item, setItem] = useState(row.itemCode);
  const [qty, setQty] = useState(String(row.qty));
  const [category, setCategory] = useState(row.category ?? "");
  const [note, setNote] = useState(row.note ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { call<NonNullable<typeof opts>>(`/api/waste/usage/options?branch=${encodeURIComponent(row.branchCode)}`).then(setOpts).catch((e: Error) => toast(e.message, "error")); }, [row.branchCode, toast]);
  const amount = Number(qty.replace(",", "."));
  const line: Record<string, unknown> = { branchCode: row.branchCode, businessDate: row.businessDate, itemCode: row.itemCode, seen: row.qty };
  if (item !== row.itemCode) line.newItemCode = item;
  if (amount !== row.qty) line.qty = amount;
  if (category !== (row.category ?? "")) line.category = category;
  if (note.trim() !== (row.note ?? "")) line.note = note.trim() || null;
  const changes = Object.keys(line).length - 4;
  const valid = changes > 0 && qty.trim() !== "" && Number.isFinite(amount) && amount >= 0 && reason.trim().length >= 3;
  const unit = opts?.items.find((i) => i.code === item)?.unit ?? row.unit;
  const items = (opts?.items ?? []).map((i) => ({ value: i.code, label: i.name, hint: `${i.code} · ${i.unit}` }));
  const packs = row.packSize ? Math.round((row.qty / row.packSize) * 1000) / 1000 : null;
  const save = async () => {
    setBusy(true);
    try { onDone(await call<Result>("/api/waste/usage/corrections", { method: "POST", json: { lines: [line], reason: reason.trim() } })); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} icon={<PencilLine size={18} />} title={tr("Correct Usage Management")} description={`${row.branchName} · ${dmy(row.businessDate)}`}
      footer={<><span className="mr-auto text-xs text-[color:var(--j-626F86)]">{changes ? tr("{0} changes", changes) : tr("No change yet")}</span>
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!valid} onClick={() => void save()}><Save size={14} />{tr("Save correction")}</Button></>}>
      <div className="space-y-4">
        {row.hasPhoto && <a href={usagePhotoUrl(row.branchCode, row.businessDate, row.itemCode)} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={thumb(usagePhotoUrl(row.branchCode, row.businessDate, row.itemCode), 800)} alt={tr("Photo")} className="max-h-72 w-full rounded-[3px] bg-[color:var(--j-091E420F)] object-contain" /></a>}
        <Field label={tr("Item")}>{opts ? <SearchSelect value={item} options={items.some((o) => o.value === row.itemCode) ? items : [{ value: row.itemCode, label: row.itemName, hint: row.itemCode }, ...items]} onChange={(v) => v && setItem(v)} />
          : <div className="skeleton h-10 rounded-[3px]" />}</Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("Quantity")} required><Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="text-right tabular-nums" /></Field>
          <Field label={tr("Unit")}><Input value={unit} disabled /></Field>
        </div>
        {packs != null && item === row.itemCode && packs !== amount && (
          <button type="button" onClick={() => setQty(String(packs))} className="flex w-full items-center gap-2 rounded-[3px] border border-amber-200 bg-amber-50 px-3 py-2 text-left text-xs text-amber-900 hover:bg-amber-100">
            <Wand2 size={14} className="shrink-0" /><span>{tr("Entered in pieces or grams? {0} ÷ {1} = {2} {3}", fmtQty(row.qty), fmtNumber(row.packSize!), fmtQty(packs), row.unit)}</span></button>)}
        <Field label={tr("Category")}><Select value={category} onChange={(e) => setCategory(e.target.value)}>
          {[...new Set([row.category ?? "", ...(opts?.categories ?? [])])].map((c) => <option key={c} value={c} disabled={!c}>{c || "—"}</option>)}</Select></Field>
        <Field label={tr("Note / reason")}><Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></Field>
        <Field label={tr("Reason for the correction")} required hint={tr("The outlet is told and can not change this line again")}>
          <textarea className={area} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr("e.g. the branch entered pieces instead of packs")} /></Field>
        {!!row.corrections && <UsageHistory row={row} />}
      </div>
    </Drawer>
  );
}

function UsageBulk({ rows, onClose, onDone }: { rows: UsageRow[]; onClose: () => void; onDone: (r: Result) => void }) {
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      onDone(await call<Result>("/api/waste/usage/corrections", { method: "POST", json: { reason: reason.trim(),
        lines: rows.map((r) => ({ branchCode: r.branchCode, businessDate: r.businessDate, itemCode: r.itemCode, seen: r.qty, qty: r.suggested })) } }));
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} icon={<Wand2 size={18} />} title={tr("Use the suggestion")} description={tr("{0} lines", rows.length)}
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={reason.trim().length < 3} onClick={() => void save()}><Save size={14} />{tr("Save correction")}</Button></>}>
      <div className="space-y-4">
        <Field label={tr("Reason for the correction")} required hint={tr("The outlet is told and can not change this line again")}>
          <textarea className={area} maxLength={500} value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr("e.g. the branch entered pieces instead of packs")} /></Field>
        <ul className="divide-y divide-[color:var(--j-F1F2F4)] rounded-[3px] border border-[color:var(--j-DCDFE4)] text-sm">
          {rows.map((r) => <li key={idOf(r)} className="flex items-start justify-between gap-3 px-3 py-2">
            <span className="min-w-0"><span className="block text-[color:var(--j-172B4D)]">{r.itemName}</span><span className="block text-xs text-[color:var(--j-626F86)]">{dmy(r.businessDate)} · {r.branchName}</span></span>
            <span className="whitespace-nowrap text-right tabular-nums"><span className="text-[color:var(--j-626F86)] line-through">{fmtQty(r.qty)}</span> → <b>{fmtQty(r.suggested!)}</b><span className="block text-[11px] text-[color:var(--j-626F86)]">{r.unit}</span></span></li>)}
        </ul>
      </div>
    </Drawer>
  );
}
