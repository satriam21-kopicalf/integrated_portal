"use client";

// Cost Control corrects a waste entry (2026-11-10, migration 087): quantity (unit of a premix), item of the same type,
// category, business / production / expired date and note, with a required reason; every change is logged (old → new)
// and the history shows under the entry.

import { useEffect, useMemo, useState } from "react";
import { History, PencilLine, Save } from "lucide-react";
import Drawer from "@/so/ui/Drawer";
import { Button, Field, Input, Select, useToast } from "@/so/ui";
import { SearchSelect } from "@/cotr/ui";
import { SkeletonList } from "@/components/kc/Skeleton";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { dmy } from "@/so/ui/Filters";
import { tr } from "@/lib/i18n";
import type { Entry, WasteItem } from "./waste";

type Options = { items: WasteItem[]; categories: string[] };
type Fix = { field: string; old: string | null; new: string | null; reason: string; by: string; at: string };

const FIELD: Record<string, () => string> = {
  qty: () => tr("Quantity"), item: () => tr("Item"), category: () => tr("Waste category"), businessDate: () => tr("Waste date"),
  productionDate: () => tr("Production Date"), expiredDate: () => tr("Expired Date"), note: () => tr("Note / reason"),
};

/** The corrections of an entry (old → new, reason, by, when). */
export function CorrectionHistory({ entry, version }: { entry: Entry; version?: number }) {
  const [rows, setRows] = useState<Fix[] | null>(null);
  useEffect(() => {
    if (!entry.corrections) { setRows([]); return; }
    setRows(null);
    call<{ data: Fix[] }>(`/api/waste/reviews/${entry.id}/corrections`).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [entry.id, entry.corrections, version]);
  if (rows && !rows.length) return null;
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-amber-800"><History size={13} />{tr("Corrected by Cost Control")}</p>
      {!rows ? <SkeletonList rows={2} /> : (
        <ul className="space-y-2 text-xs">
          {rows.map((r, i) => (
            <li key={i} className="text-neutral-700">
              <span className="font-medium">{FIELD[r.field]?.() ?? r.field}</span>: <span className="text-neutral-400 line-through">{r.old || "—"}</span> → <span className="font-medium text-neutral-900">{r.new || "—"}</span>
              <span className="block text-neutral-500">“{r.reason}” · {r.by} · {wibDateTime(r.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function WasteCorrect({ entry, onClose, onSaved }: { entry: Entry; onClose: () => void; onSaved: (e: Entry) => void }) {
  const toast = useToast();
  const [opts, setOpts] = useState<Options | null>(null);
  const [itemCode, setItemCode] = useState(entry.itemCode);
  const [qty, setQty] = useState(String(entry.qty));
  const [uom, setUom] = useState(entry.unit);
  const [category, setCategory] = useState(entry.category);
  const [day, setDay] = useState(entry.businessDate);
  const [made, setMade] = useState(entry.productionDate ?? "");
  const [expires, setExpires] = useState(entry.expiredDate ?? "");
  const [note, setNote] = useState(entry.note ?? "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    call<Options>(`/api/waste/reviews/${entry.id}/options`).then(setOpts).catch((e: Error) => toast(e.message, "error"));
  }, [entry.id, toast]);
  const item = opts?.items.find((i) => i.code === itemCode);
  const units = entry.scope === "premix" ? (item?.units ?? [{ uom: entry.unit, grams: 1 }]) : null;
  const itemOptions = useMemo(() => {
    const list = (opts?.items ?? []).map((i) => ({ value: i.code, label: i.name, hint: `${i.code} · ${i.unit}` }));
    return list.some((o) => o.value === entry.itemCode) ? list : [{ value: entry.itemCode, label: entry.itemName, hint: entry.itemCode }, ...list];
  }, [opts, entry]);
  const amount = Number(qty.replace(",", "."));
  const body: Record<string, unknown> = { reason: reason.trim() };
  if (itemCode !== entry.itemCode) body.itemCode = itemCode;
  if (amount !== entry.qty) body.qty = amount;
  if (units && uom !== entry.unit) body.uom = uom;
  if (category !== entry.category) body.category = category;
  if (day !== entry.businessDate) body.businessDate = day;
  if (made !== (entry.productionDate ?? "")) body.productionDate = made || null;
  if (expires !== (entry.expiredDate ?? "")) body.expiredDate = expires || null;
  if (note.trim() !== (entry.note ?? "")) body.note = note.trim() || null;
  const changes = Object.keys(body).length - 1;
  const valid = changes > 0 && reason.trim().length >= 3 && amount > 0 && !!day;
  const save = async () => {
    setBusy(true);
    try {
      const out = await call<Entry>(`/api/waste/reviews/${entry.id}`, { method: "PATCH", json: body });
      toast(tr("Waste corrected"));
      onSaved(out);
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} icon={<PencilLine size={18} />} title={tr("Correct the waste")} description={`${entry.branchName} · ${dmy(entry.businessDate)}`}
      footer={<>
        <span className="mr-auto text-xs text-neutral-500">{changes ? tr("{0} changes", changes) : tr("No change yet")}</span>
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!valid} onClick={() => void save()}><Save size={14} />{tr("Save correction")}</Button>
      </>}>
      <div className="space-y-4">
        <p className="rounded-lg bg-neutral-50 px-3 py-2 text-xs text-neutral-600">{tr("The entry is changed in place; the value, COGS and Stock List follow. The old figures and the reason are kept in the history.")}</p>
        <Field label={tr("Item")}>
          {opts ? <SearchSelect value={itemCode} options={itemOptions} onChange={(v) => { if (v) { setItemCode(v); const it = opts.items.find((i) => i.code === v); if (it && entry.scope === "premix") setUom(it.unit); } }} />
            : <div className="skeleton h-10 rounded-lg" />}
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={tr("Quantity")} required><Input inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="text-right tabular-nums" /></Field>
          <Field label={tr("Unit")}>
            {units ? <Select value={uom} onChange={(e) => setUom(e.target.value)}>{units.map((u) => <option key={u.uom} value={u.uom}>{u.uom}</option>)}</Select>
              : <Input value={item?.unit ?? entry.unit} disabled />}
          </Field>
        </div>
        <Field label={tr("Waste category")}>
          <Select value={category} onChange={(e) => setCategory(e.target.value)}>
            {[...new Set([entry.category, ...(opts?.categories ?? [])])].map((c) => <option key={c} value={c}>{c}</option>)}
          </Select>
        </Field>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Field label={tr("Waste date")} required><Input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></Field>
          <Field label={tr("Production Date")}><Input type="date" value={made} onChange={(e) => setMade(e.target.value)} /></Field>
          <Field label={tr("Expired Date")}><Input type="date" value={expires} onChange={(e) => setExpires(e.target.value)} /></Field>
        </div>
        <Field label={tr("Note / reason")}><Input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} /></Field>
        <Field label={tr("Reason for the correction")} required hint={tr("Shown in the history of the entry")}>
          <textarea className="min-h-[80px] w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" maxLength={500}
            value={reason} onChange={(e) => setReason(e.target.value)} placeholder={tr("e.g. the branch entered 50 instead of 5")} />
        </Field>
      </div>
    </Drawer>
  );
}
