"use client";

// WIP / premix recipe editor (Cost Control): name, type, where it is counted, units (Pail / Teko / Gram), and the
// versions: a draft is edited (components in grams per batch, mapped to stock items; water is not stock) and then
// activated; the active version is what the calculator and the count form use.

import { CheckCircle2, CopyPlus, FlaskConical, Loader2, Plus, Save, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Checkbox, cx, Field, Input, inputClass, Select, useToast } from "@/so/ui";
import Drawer, { DrawerSection } from "@/so/ui/Drawer";
import { api, errorText } from "@/so/lib/api";
import { fmtDate } from "@/so/ui";
import { tr } from "@/lib/i18n";
import { num, RecipeDetail, RecipeLine, Unit, unitGrams, Version } from "./types";

const FACILITY_TYPES = ["OUTLET", "HUB_WH", "HUB_CK", "CK_ESPRESSO", "CK_FOOD", "VIRTUAL"];
const TYPES = ["WIP", "PREMIX", "FOOD"];
type DraftLine = { item_id: string | null; item_code: string | null; item_name: string | null; component_name: string; qty_base: string; is_stock: boolean };
type Found = { item_id: string; item_code: string; item_name: string; base_uom: string };

const fmtG = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });
const toDraft = (l: RecipeLine): DraftLine => ({
  item_id: l.item_id, item_code: l.item_code, item_name: l.item_name, component_name: l.component_name,
  qty_base: String(num(l.qty_base)), is_stock: l.is_stock,
});

export default function RecipeDrawer({ recipeId, onClose, onChanged }: { recipeId: string | "new"; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [r, setR] = useState<RecipeDetail | null>(null);
  const [head, setHead] = useState({ name: "", recipe_type: "WIP", facility_types: [] as string[], is_active: true });
  const [units, setUnits] = useState<Unit[]>([{ uom: "Pail", qty_base: null, per_batch: 1 }, { uom: "Teko", qty_base: null, per_batch: 3 }, { uom: "Gram", qty_base: 1, per_batch: null }]);
  const [versionId, setVersionId] = useState<string | null>(null);
  const [draft, setDraft] = useState<{ batch: string; note: string; lines: DraftLine[] } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const creating = recipeId === "new";

  const load = useCallback(async (id: string, keep?: string | null) => {
    const d = await api<RecipeDetail>(`/api/so/recipes/${id}`);
    setR(d);
    setHead({ name: d.name, recipe_type: d.recipe_type, facility_types: d.facility_types, is_active: d.is_active });
    setUnits(d.units.length ? d.units : [{ uom: "Gram", qty_base: 1, per_batch: null }]);
    const pick = d.versions.find(v => v.id === keep) ?? d.versions.find(v => v.status === "DRAFT") ?? d.versions.find(v => v.status === "ACTIVE") ?? d.versions[0];
    setVersionId(pick?.id ?? null);
    setDraft(pick?.status === "DRAFT" ? { batch: String(num(pick.output_qty_base)), note: pick.note ?? "", lines: pick.lines.map(toDraft) } : null);
  }, []);
  useEffect(() => {
    if (!creating) void load(recipeId).catch(e => setError(errorText(e)));
    else setDraft({ batch: "1000", note: "", lines: [] });
  }, [creating, recipeId, load]);

  const version = r?.versions.find(v => v.id === versionId) ?? null;
  const batch = draft ? num(draft.batch) : num(version?.output_qty_base);
  const lines: DraftLine[] = draft ? draft.lines : (version?.lines ?? []).map(toDraft);
  const total = lines.reduce((s, l) => s + num(l.qty_base), 0);
  const ratio = batch ? total / batch : 0;

  const run = async (fn: () => Promise<RecipeDetail | void>, ok?: string) => {
    setBusy(true);
    setError("");
    try {
      const out = await fn();
      if (ok) toast(ok);
      onChanged();
      return out;
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const headBody = () => ({ ...head, name: head.name.trim(), units: units.map(u => ({ uom: u.uom, qty_base: u.qty_base === "" ? null : u.qty_base, per_batch: u.per_batch === "" ? null : u.per_batch })) });
  const versionBody = () => ({
    output_qty_base: num(draft!.batch), note: draft!.note || null,
    lines: draft!.lines.filter(l => num(l.qty_base) > 0).map(l => ({ item_id: l.item_id, component_name: l.component_name || l.item_name, qty_base: num(l.qty_base), is_stock: l.is_stock })),
  });

  const saveAll = () => run(async () => {
    let id = r?.id;
    if (!id) {
      const created = await api<RecipeDetail>("/api/so/recipes", { method: "POST", json: headBody() });
      id = created.id;
    } else {
      await api(`/api/so/recipes/${id}`, { method: "PATCH", json: headBody() });
    }
    let keep = versionId;
    if (draft) {
      const out = await api<RecipeDetail>(version?.status === "DRAFT" ? `/api/so/recipes/${id}/versions/${version.id}` : `/api/so/recipes/${id}/versions`,
        { method: version?.status === "DRAFT" ? "PUT" : "POST", json: versionBody() });
      keep = out.versions.find(v => v.status === "DRAFT")?.id ?? keep;
    }
    await load(id, keep);
  }, tr("Recipe saved"));
  const activate = () => run(async () => {
    await saveAll();
    const id = r!.id;
    const v = (await api<RecipeDetail>(`/api/so/recipes/${id}`)).versions.find(x => x.status === "DRAFT");
    if (!v) return;
    await api(`/api/so/recipes/${id}/versions/${v.id}/activate`, { method: "POST", json: {} });
    await load(id, v.id);
  }, tr("Version activated: the calculator and the count form use it now"));
  const newVersion = () => {
    const base = version ?? r?.versions[0];
    setVersionId(null);
    setDraft({ batch: String(num(base?.output_qty_base) || 1000), note: "", lines: (base?.lines ?? []).map(toDraft) });
  };
  const deleteDraft = () => run(async () => {
    if (!r || !version || version.status !== "DRAFT") return;
    await api(`/api/so/recipes/${r.id}/versions/${version.id}`, { method: "DELETE" });
    await load(r.id);
  }, tr("Draft deleted"));

  const setLine = (i: number, patch: Partial<DraftLine>) => setDraft(d => d && ({ ...d, lines: d.lines.map((l, n) => (n === i ? { ...l, ...patch } : l)) }));
  const issues = version?.issues ?? [];

  return (
    <Drawer open onClose={onClose} size="xl" icon={<FlaskConical size={18} />}
      title={creating ? tr("New WIP recipe") : (r?.name ?? tr("WIP recipe"))}
      description={r ? `${r.code} · ${tr("{0} versions", r.versions.length)}` : tr("Components per batch; the batch of a pail recipe is one pail")}
      footer={<>
        {version?.status === "DRAFT" && <Button variant="ghost" className="mr-auto text-red-600" disabled={busy} onClick={deleteDraft}><Trash2 size={16} /> {tr("Delete draft")}</Button>}
        <Button variant="secondary" onClick={onClose}>{tr("Close")}</Button>
        <Button variant="secondary" loading={busy} disabled={!head.name.trim()} onClick={() => void saveAll()}><Save size={16} /> {draft ? tr("Save draft") : tr("Save")}</Button>
        {draft && <Button loading={busy} disabled={!head.name.trim() || !draft.lines.length} onClick={() => void activate()}><CheckCircle2 size={16} /> {tr("Save & activate")}</Button>}
      </>}>
      {!creating && !r ? <div className="skeleton h-72 rounded-lg" /> : (
        <div className="space-y-6">
          <DrawerSection title={tr("Recipe")}>
            <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
              <Field label={tr("Name")} required><Input value={head.name} onChange={e => setHead({ ...head, name: e.target.value })} placeholder={tr("e.g. Premix Premium")} /></Field>
              <Field label={tr("Type")}><Select value={head.recipe_type} onChange={e => setHead({ ...head, recipe_type: e.target.value })}>{TYPES.map(t => <option key={t}>{t}</option>)}</Select></Field>
            </div>
            <div>
              <p className="mb-1.5 text-xs font-semibold text-slate-700">{tr("Counted at")} <span className="font-normal text-slate-400">({tr("none ticked = every facility type")})</span></p>
              <div className="flex flex-wrap gap-1.5">
                {FACILITY_TYPES.map(t => {
                  const on = head.facility_types.includes(t);
                  return (
                    <button key={t} type="button" aria-pressed={on} onClick={() => setHead({ ...head, facility_types: on ? head.facility_types.filter(x => x !== t) : [...head.facility_types, t] })}
                      className={cx("rounded-full border px-3 py-1 text-xs font-medium", on ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300")}>{t}</button>
                  );
                })}
              </div>
            </div>
            <Checkbox label={tr("Active")} hint={tr("An inactive recipe is not offered in the calculator and the count form")} checked={head.is_active} onChange={e => setHead({ ...head, is_active: e.target.checked })} />
          </DrawerSection>

          <DrawerSection title={tr("Units")} description={tr("How the crew counts this WIP: a share of the batch (Pail = 1 per batch, Teko = 3 per batch) or fixed grams.")}>
            <ul className="space-y-2">
              {units.map((u, i) => (
                <li key={i} className="grid grid-cols-[1fr_8rem_8rem_auto] items-center gap-2">
                  <input className={cx(inputClass, "h-9")} value={u.uom} aria-label={tr("Unit")} onChange={e => setUnits(us => us.map((x, n) => (n === i ? { ...x, uom: e.target.value } : x)))} />
                  <input className={cx(inputClass, "h-9")} inputMode="decimal" aria-label={tr("Per batch")} placeholder={tr("per batch")} value={u.per_batch ?? ""}
                    onChange={e => setUnits(us => us.map((x, n) => (n === i ? { ...x, per_batch: e.target.value || null, qty_base: e.target.value ? null : x.qty_base } : x)))} />
                  <input className={cx(inputClass, "h-9")} inputMode="decimal" aria-label={tr("Grams")} placeholder={tr("grams")} value={u.qty_base ?? ""}
                    onChange={e => setUnits(us => us.map((x, n) => (n === i ? { ...x, qty_base: e.target.value || null, per_batch: e.target.value ? null : x.per_batch } : x)))} />
                  <button type="button" onClick={() => setUnits(us => us.filter((_, n) => n !== i))} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Remove")}><Trash2 size={15} /></button>
                  {batch > 0 && <span className="col-span-4 -mt-1 text-[11px] text-slate-400">1 {u.uom} = {fmtG(unitGrams(u, batch))} g</span>}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => setUnits(us => [...us, { uom: "", qty_base: 1, per_batch: null }])} className="text-xs font-medium text-blue-700 hover:underline">+ {tr("Add unit")}</button>
          </DrawerSection>

          <DrawerSection title={tr("Components")} description={tr("Grams of every component for one batch. Pick the stock item (ESB code) of each; water is not a stock item.")}>
            {r && r.versions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                {r.versions.map(v => (
                  <button key={v.id} type="button" onClick={() => { setVersionId(v.id); setDraft(v.status === "DRAFT" ? { batch: String(num(v.output_qty_base)), note: v.note ?? "", lines: v.lines.map(toDraft) } : null); }}
                    className={cx("rounded-lg border px-2.5 py-1 text-xs font-medium", v.id === versionId ? "border-slate-900 bg-slate-900 text-white" : "border-slate-200 text-slate-600 hover:border-slate-300")}>
                    v{v.version_no} · {v.status === "ACTIVE" ? tr("Active") : v.status === "DRAFT" ? tr("Draft") : tr("Retired")}
                  </button>
                ))}
                {(!draft || version) && !r.versions.some(v => v.status === "DRAFT") && (
                  <button type="button" onClick={newVersion} className="inline-flex items-center gap-1 rounded-lg border border-dashed border-blue-300 px-2.5 py-1 text-xs font-medium text-blue-700 hover:bg-blue-50">
                    <CopyPlus size={13} /> {tr("New version")}
                  </button>
                )}
              </div>
            )}
            {version && version.status !== "DRAFT" && (
              <p className="text-xs text-slate-500">
                {version.status === "ACTIVE" ? tr("Active since {0}", version.effective_from ? fmtDate(version.effective_from) : "-") : tr("Retired")}
                {version.approved_by_name ? ` · ${version.approved_by_name}` : ""} · {tr("read only: make a new version to change it")}
              </p>
            )}
            <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
              <Field label={tr("Batch (grams)")} hint={tr("A pail recipe: the grams of one pail")}>
                <Input inputMode="decimal" value={draft ? draft.batch : String(batch)} disabled={!draft} onChange={e => setDraft(d => d && ({ ...d, batch: e.target.value }))} />
              </Field>
              <div className={cx("flex items-end gap-2 pb-2 text-sm", Math.abs(ratio - 1) > 0.005 ? "text-amber-700" : "text-emerald-700")}>
                {tr("Components: {0} g = {1}% of the batch", fmtG(total), (ratio * 100).toFixed(1))}
              </div>
            </div>
            <ComponentTable lines={lines} batch={batch} editable={!!draft} onChange={setLine}
              onRemove={i => setDraft(d => d && ({ ...d, lines: d.lines.filter((_, n) => n !== i) }))} />
            {draft && (
              <button type="button" onClick={() => setDraft(d => d && ({ ...d, lines: [...d.lines, { item_id: null, item_code: null, item_name: null, component_name: "", qty_base: "", is_stock: true }] }))}
                className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"><Plus size={13} /> {tr("Add component")}</button>
            )}
            {issues.length > 0 && (
              <ul className="space-y-1">
                {issues.map((i, n) => <li key={n} className={cx("rounded-lg px-3 py-1.5 text-xs", i.level === "error" ? "bg-red-50 text-red-700" : "bg-amber-50 text-amber-800")}>{i.message}</li>)}
              </ul>
            )}
            {draft && <Field label={tr("Note")}><Input value={draft.note} onChange={e => setDraft(d => d && ({ ...d, note: e.target.value }))} placeholder={tr("What changed")} /></Field>}
          </DrawerSection>
          {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
        </div>
      )}
    </Drawer>
  );
}

function ComponentTable({ lines, batch, editable, onChange, onRemove }: {
  lines: DraftLine[]; batch: number; editable: boolean; onChange: (i: number, p: Partial<DraftLine>) => void; onRemove: (i: number) => void;
}) {
  if (!lines.length) return <p className="rounded-lg border border-dashed border-slate-200 py-6 text-center text-sm text-slate-400">{tr("No components yet")}</p>;
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
      <table className="w-full min-w-[640px] text-sm">
        <thead className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <tr><th className="px-3 py-2">{tr("Component")}</th><th className="px-3 py-2">{tr("Stock item")}</th>
            <th className="w-28 px-3 py-2 text-right">{tr("Grams / batch")}</th><th className="w-16 px-3 py-2 text-right">%</th>{editable && <th className="w-10" />}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {lines.map((l, i) => (
            <tr key={i} className="align-top">
              <td className="px-3 py-2">
                {editable ? <input className={cx(inputClass, "h-8 text-xs")} value={l.component_name} placeholder={tr("Name in the workbook")} onChange={e => onChange(i, { component_name: e.target.value })} />
                  : <span className="text-slate-800">{l.component_name}</span>}
              </td>
              <td className="px-3 py-2">
                {!l.is_stock ? (
                  <span className="inline-flex items-center gap-2 text-xs text-slate-500">{tr("Not stock (e.g. water)")}
                    {editable && <button type="button" className="font-medium text-blue-700 hover:underline" onClick={() => onChange(i, { is_stock: true })}>{tr("Make stock")}</button>}</span>
                ) : editable ? (
                  <ItemPicker value={l} onPick={f => onChange(i, { item_id: f.item_id, item_code: f.item_code, item_name: f.item_name, component_name: l.component_name || f.item_name })}
                    onNotStock={() => onChange(i, { is_stock: false, item_id: null, item_code: null, item_name: null })} />
                ) : l.item_id ? (
                  <span className="text-xs"><span className="font-mono text-slate-500">{l.item_code}</span> <span className="text-slate-800">{l.item_name}</span></span>
                ) : <Badge tone="red">{tr("Not mapped")}</Badge>}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {editable ? <input className={cx(inputClass, "h-8 text-right text-xs")} inputMode="decimal" value={l.qty_base} onChange={e => onChange(i, { qty_base: e.target.value.replace(",", ".") })} />
                  : fmtG(num(l.qty_base))}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-xs text-slate-500">{batch ? ((num(l.qty_base) / batch) * 100).toFixed(1) : "-"}</td>
              {editable && <td className="px-1 py-2"><button type="button" onClick={() => onRemove(i)} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Remove")}><Trash2 size={14} /></button></td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ItemPicker({ value, onPick, onNotStock }: { value: DraftLine; onPick: (f: Found) => void; onNotStock: () => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [found, setFound] = useState<Found[]>([]);
  const [loading, setLoading] = useState(false);
  const search = useMemo(() => q || value.component_name, [q, value.component_name]);
  useEffect(() => {
    if (!open || search.trim().length < 2) { setFound([]); return; }
    setLoading(true);
    const t = setTimeout(() => {
      api<Found[]>(`/api/so/recipes/items?q=${encodeURIComponent(search.trim().split(" ")[0])}&limit=20`).then(setFound).catch(() => setFound([])).finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(t);
  }, [open, search]);
  return (
    <div className="relative">
      {value.item_id && !open ? (
        <button type="button" onClick={() => setOpen(true)} className="w-full rounded-lg border border-slate-200 px-2 py-1 text-left text-xs hover:border-slate-300">
          <span className="font-mono text-slate-500">{value.item_code}</span> <span className="text-slate-800">{value.item_name}</span>
        </button>
      ) : (
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
          <input className={cx(inputClass, "h-8 pl-7 text-xs", !value.item_id && "border-red-300")} value={q} autoFocus={open} placeholder={tr("Search item for {0}", value.component_name || "…")}
            onFocus={() => setOpen(true)} onChange={e => { setQ(e.target.value); setOpen(true); }} onBlur={() => setTimeout(() => setOpen(false), 150)} />
          {loading && <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
        </div>
      )}
      {open && (
        <ul className="absolute inset-x-0 top-full z-30 mt-1 max-h-60 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
          {found.map(f => (
            <li key={f.item_id}><button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onPick(f); setOpen(false); setQ(""); }}
              className="w-full px-3 py-1.5 text-left text-xs hover:bg-slate-50"><span className="font-mono text-slate-500">{f.item_code}</span> {f.item_name} <span className="text-slate-400">· {f.base_uom}</span></button></li>
          ))}
          {!found.length && !loading && <li className="px-3 py-2 text-xs text-slate-400">{tr("Type a name or code")}</li>}
          <li className="border-t border-slate-100"><button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { onNotStock(); setOpen(false); }}
            className="w-full px-3 py-1.5 text-left text-xs font-medium text-slate-600 hover:bg-slate-50">{tr("Not a stock item (water)")}</button></li>
        </ul>
      )}
    </div>
  );
}

export type { Version };
