"use client";

// Form Items editor of Product & Outlet (Operations → Branch Groups → Form Items, 2026-11-13; integrated_portal_be
// app/form_items.py): change an item (category, note / photo required / optional / none, required, active, label and
// description ID / EN), add an item to a section, and set the weight of each category in the final score. Every form
// of Operations and the portal reads the same definitions, so a change reaches them within a few seconds.

import { Plus, RotateCcw, Scale } from "lucide-react";
import { useState } from "react";
import Dialog from "@/so/ui/Dialog";
import { Button, Field, Input, Select, cx, useToast } from "@/so/ui";
import { call } from "@/so/features/checkin/checkin";
import { tr } from "@/lib/i18n";

export type Level = "required" | "optional" | "none";
export type EditorItem = {
  key: string; no: number; label: string; labelEn: string; category: string | null; note: Level; photo: Level; required: boolean;
  active: boolean; detail: string | null; detailEn: string | null; standard: string | null; standardEn: string | null; custom: boolean;
  changed: boolean; code: { label: string; category: string | null; note: Level; photo: Level; required: boolean } | null;
};
export type EditorSection = { key: string; title: string; titleEn: string; group: string; groupTitle: string; items: EditorItem[] };
export type Editor = { forms: { form: "product" | "outlet"; sections: EditorSection[] }[]; weights: { category: string; categoryEn: string; weight: number }[] };

const CATEGORIES = ["Kritikal", "Mayor", "Minor"];
const CATEGORY_LABEL: Record<string, () => string> = { Kritikal: () => tr("Critical"), Mayor: () => tr("Major"), Minor: () => tr("Minor") };
export const categoryLabel = (c: string) => CATEGORY_LABEL[c]?.() ?? c;
export const categoryTone = (c: string | null) =>
  c === "Kritikal" ? "bg-red-600 text-white" : c === "Mayor" ? "bg-amber-100 text-amber-800" : c ? "bg-neutral-100 text-neutral-600" : "";
const LEVELS: { value: Level; label: () => string }[] = [
  { value: "required", label: () => tr("Required") }, { value: "optional", label: () => tr("Optional") }, { value: "none", label: () => tr("Not asked") },
];

/** Edit an item (item set) or add one to a section (section set, item null). */
export function ItemDialog({ form, item, section, onClose, onSaved }: {
  form: "product" | "outlet"; item: EditorItem | null; section: EditorSection | null; onClose: () => void; onSaved: () => void;
}) {
  const toast = useToast();
  const [d, setD] = useState(() => ({
    label: item?.label ?? "", labelEn: item?.labelEn ?? "", category: item?.category ?? "", other: "",
    note: item?.note ?? "required", photo: item?.photo ?? "required", required: item?.required ?? true, active: item?.active ?? true,
    detail: item?.detail ?? "", detailEn: item?.detailEn ?? "", standard: item?.standard ?? "", standardEn: item?.standardEn ?? "",
  }));
  const [busy, setBusy] = useState(false);
  const isOther = d.category !== "" && !CATEGORIES.includes(d.category);
  const set = (p: Partial<typeof d>) => setD((x) => ({ ...x, ...p }));
  const body = () => ({
    label: d.label.trim(), label_en: d.labelEn.trim() || d.label.trim(), category: d.category.trim(), note: d.note, photo: d.photo,
    required: d.required, active: d.active, detail: d.detail.trim(), detail_en: d.detailEn.trim(), standard: d.standard.trim(), standard_en: d.standardEn.trim(),
  });
  const save = async (reset = false) => {
    setBusy(true);
    try {
      if (item) await call(`/api/monitoring/form-items/${form}/items/${encodeURIComponent(item.key)}`, { method: "PUT", json: reset ? { reset: true } : body() });
      else await call(`/api/monitoring/form-items/${form}/items`, { method: "POST", json: { ...body(), section: section!.key } });
      toast(tr("Saved"));
      onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Dialog open size="lg" onClose={onClose} title={item ? tr("Item {0}", item.no) : tr("New item")}
      description={item ? (item.custom ? tr("An item added by Operations") : tr("An item of the standard form; Back to standard undoes every change")) : tr("Added at the end of {0}", section?.title ?? "")}
      footer={<>
        {item && !item.custom && item.changed && <Button variant="secondary" onClick={() => void save(true)} disabled={busy}><RotateCcw size={14} /> {tr("Back to standard")}</Button>}
        <Button variant="secondary" onClick={onClose} disabled={busy}>{tr("Cancel")}</Button>
        <Button onClick={() => void save()} loading={busy} disabled={!d.label.trim()}>{tr("Save")}</Button>
      </>}>
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr("Item name (ID)")} required><Input value={d.label} onChange={(e) => set({ label: e.target.value })} maxLength={300} /></Field>
          <Field label={tr("Item name (EN)")}><Input value={d.labelEn} onChange={(e) => set({ labelEn: e.target.value })} maxLength={300} placeholder={d.label} /></Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label={tr("Category")} hint={tr("Its weight in the final score")}>
            <Select value={isOther ? "__other" : d.category} onChange={(e) => set({ category: e.target.value === "__other" ? (d.other || "Lainnya") : e.target.value })}>
              <option value="">{tr("No category")}</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{categoryLabel(c)}</option>)}
              <option value="__other">{tr("Other…")}</option>
            </Select>
            {isOther && <Input className="mt-2" value={d.category} maxLength={40} onChange={(e) => set({ category: e.target.value, other: e.target.value })} placeholder={tr("Category name")} />}
          </Field>
          <Field label={tr("Note")}>
            <Select value={d.note} onChange={(e) => set({ note: e.target.value as Level })}>{LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label()}</option>)}</Select>
          </Field>
          <Field label={tr("Photo")}>
            <Select value={d.photo} onChange={(e) => set({ photo: e.target.value as Level })}>{LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label()}</option>)}</Select>
          </Field>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-neutral-800">
          <label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={d.required} onChange={(e) => set({ required: e.target.checked })} /> {tr("Must be rated before sending")}</label>
          <label className="inline-flex items-center gap-2"><input type="checkbox" className="h-4 w-4 accent-brand-700" checked={d.active} onChange={(e) => set({ active: e.target.checked })} /> {tr("Active (asked and scored)")}</label>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={tr("Description / photo points (ID)")}><textarea rows={3} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" value={d.detail} maxLength={1000} onChange={(e) => set({ detail: e.target.value })} /></Field>
          <Field label={tr("Description / photo points (EN)")}><textarea rows={3} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" value={d.detailEn} maxLength={1000} onChange={(e) => set({ detailEn: e.target.value })} /></Field>
          <Field label={tr("Standard (ID)")}><textarea rows={2} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" value={d.standard} maxLength={1000} onChange={(e) => set({ standard: e.target.value })} /></Field>
          <Field label={tr("Standard (EN)")}><textarea rows={2} className="w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm" value={d.standardEn} maxLength={1000} onChange={(e) => set({ standardEn: e.target.value })} /></Field>
        </div>
        {!d.active && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">{tr("An inactive item is not asked and not scored; the visits already sent keep their answers and score.")}</p>}
        {item?.code && item.changed && <p className="text-xs text-neutral-500">{tr("Standard: {0}", `${item.code.label}${item.code.category ? ` · ${categoryLabel(item.code.category)}` : ""}`)}</p>}
      </div>
    </Dialog>
  );
}

/** The weight of every category in the final score: Σ weight of MEET / EXCEED ÷ Σ weight of the rated items. */
export function WeightsDialog({ weights, onClose, onSaved }: { weights: Editor["weights"]; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [w, setW] = useState(() => Object.fromEntries(weights.map((x) => [x.category, String(x.weight)])));
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await call("/api/monitoring/form-items/weights", { method: "PUT", json: { weights: Object.entries(w).map(([category, v]) => ({ category, weight: Number(v.replace(",", ".")) || 0 })) } });
      toast(tr("Saved"));
      onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Dialog open onClose={onClose} title={tr("Category weights")} description={tr("Final score = Σ weight of the items rated MEET or EXCEED ÷ Σ weight of the rated items. An item without a category weighs 1. Visits already sent keep their score.")}
      footer={<><Button variant="secondary" onClick={onClose} disabled={busy}>{tr("Cancel")}</Button><Button onClick={() => void save()} loading={busy}>{tr("Save")}</Button></>}>
      <ul className="divide-y divide-neutral-100 rounded-lg border border-neutral-200">
        {weights.map((x) => (
          <li key={x.category} className="flex items-center gap-3 px-3 py-2">
            <span className={cx("rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide", categoryTone(x.category))}>{categoryLabel(x.category)}</span>
            <span className="flex-1" />
            <Input inputMode="decimal" className="h-9 w-24 text-right" value={w[x.category] ?? ""} onChange={(e) => setW({ ...w, [x.category]: e.target.value.replace(/[^\d.,]/g, "") })} aria-label={tr("Weight of {0}", categoryLabel(x.category))} />
          </li>
        ))}
      </ul>
    </Dialog>
  );
}

export const AddIcon = Plus;
export const WeightIcon = Scale;
