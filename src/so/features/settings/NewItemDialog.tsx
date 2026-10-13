"use client";

// Creates a product the item master does not have yet (Cost Control): code, name, category, base unit and pack units.
// Opened from a pending template row (prefilled) or from the items editor; template rows with the same code join
// their groups as soon as the item exists (kopicalf POST /count-settings/items).

import { Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Field, Input, inputClass, Select } from "@/so/ui";
import Dialog from "@/so/ui/Dialog";
import { api, errorText } from "@/so/lib/api";
import { tr } from "@/lib/i18n";

export type NewItem = { item_id: string; item_code: string; item_name: string; base_uom: string; units: string[]; groups: string[] };
export type ItemDraft = { code?: string; name?: string; category_id?: string | null; unit?: string | null };
type Category = { id: string; name: string; parent_name: string | null };

const BASE_UNITS = ["GR", "ML", "PCS", "KG", "LTR", "ROLL", "PACK", "BOX", "SHEET"];
/** "PACK@100PCS" → base PCS, factor 100; "BTL@760ML" → ML, 760; "KG@1000GR" → GR, 1000. */
function readPack(unit: string): { base: string; factor: number } | null {
  const m = /@\s*([\d.,]+)\s*([A-Z]+)/i.exec(unit);
  return m ? { base: m[2].toUpperCase(), factor: Number(m[1].replace(",", ".")) } : null;
}

export default function NewItemDialog({ draft, onClose, onCreated }: { draft: ItemDraft; onClose: () => void; onCreated: (i: NewItem) => void }) {
  const pack = draft.unit ? readPack(draft.unit) : null;
  const [code, setCode] = useState(draft.code ?? "");
  const [name, setName] = useState(draft.name ?? "");
  const [category, setCategory] = useState(draft.category_id ?? "");
  const [base, setBase] = useState(pack?.base ?? (draft.unit && !draft.unit.includes("@") ? draft.unit.toUpperCase() : "GR"));
  const [units, setUnits] = useState<{ uom: string; factor: string }[]>(pack && draft.unit ? [{ uom: draft.unit.toUpperCase(), factor: String(pack.factor) }] : []);
  const [cats, setCats] = useState<Category[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => { void api<Category[]>("/api/so/count-settings/item-categories").then(setCats).catch(() => setCats([])); }, []);

  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const out = await api<NewItem>("/api/so/count-settings/items", {
        method: "POST",
        json: { code: code.trim().toUpperCase(), name: name.trim(), base_uom: base.trim().toUpperCase(), category_id: category || null,
          units: units.filter(u => u.uom.trim() && Number(u.factor) > 0).map(u => ({ uom: u.uom.trim().toUpperCase(), factor: Number(u.factor) })) },
      });
      onCreated(out);
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open size="md" onClose={onClose} title={tr("New item")}
      description={tr("For a product that is not in the item master yet. Use the ESB product code so the ESB export matches.")}
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!code.trim() || !name.trim() || !base.trim()} onClick={save}>{tr("Create item")}</Button></>}>
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[10rem_1fr]">
          <Field label={tr("Code")} required><Input value={code} onChange={e => setCode(e.target.value.toUpperCase())} className="font-mono" placeholder="RMSY-00034" /></Field>
          <Field label={tr("Name")} required><Input value={name} onChange={e => setName(e.target.value)} /></Field>
        </div>
        <Field label={tr("Category")}>
          <Select value={category} onChange={e => setCategory(e.target.value)}>
            <option value="">{tr("No category")}</option>
            {cats.map(c => <option key={c.id} value={c.id}>{c.parent_name ? `${c.parent_name} › ${c.name}` : c.name}</option>)}
          </Select>
        </Field>
        <Field label={tr("Base unit")} required hint={tr("The unit the stock is counted in (GR, ML, PCS …)")}>
          <input list="base-units" className={inputClass} value={base} onChange={e => setBase(e.target.value.toUpperCase())} />
          <datalist id="base-units">{BASE_UNITS.map(u => <option key={u} value={u} />)}</datalist>
        </Field>
        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-700">{tr("Pack units")} <span className="font-normal text-slate-400">({tr("e.g. PACK@100PCS = 100 PCS")})</span></p>
          <ul className="space-y-2">
            {units.map((u, i) => (
              <li key={i} className="grid grid-cols-[1fr_8rem_auto] items-center gap-2">
                <input className={`${inputClass} h-9`} value={u.uom} placeholder="BTL@760ML" aria-label={tr("Unit")}
                  onChange={e => setUnits(us => us.map((x, n) => (n === i ? { ...x, uom: e.target.value.toUpperCase() } : x)))} />
                <input className={`${inputClass} h-9 text-right`} inputMode="decimal" value={u.factor} aria-label={tr("Base units in one pack")}
                  onChange={e => setUnits(us => us.map((x, n) => (n === i ? { ...x, factor: e.target.value.replace(",", ".") } : x)))} />
                <button type="button" onClick={() => setUnits(us => us.filter((_, n) => n !== i))} className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Remove")}><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setUnits(us => [...us, { uom: "", factor: "" }])} className="mt-1.5 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:underline"><Plus size={12} /> {tr("Add pack unit")}</button>
        </div>
        {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </Dialog>
  );
}

/** Adds a pack unit to an item that lacks it (factor = base units in one pack). */
export function NewUnitDialog({ item, unit, onClose, onAdded }: {
  item: { item_id: string; item_name: string; base_uom: string }; unit?: string; onClose: () => void; onAdded: (units: string[], uom: string) => void;
}) {
  const guess = unit ? readPack(unit) : null;
  const [uom, setUom] = useState(unit?.toUpperCase() ?? "");
  const [factor, setFactor] = useState(guess && guess.base === item.base_uom.toUpperCase() ? String(guess.factor) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      const out = await api<{ units: string[] }>(`/api/so/count-settings/items/${item.item_id}/units`, { method: "POST", json: { uom: uom.trim().toUpperCase(), factor: Number(factor) } });
      onAdded(out.units, uom.trim().toUpperCase());
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Dialog open size="sm" onClose={onClose} title={tr("Add unit")} description={item.item_name}
      footer={<><Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button><Button loading={busy} disabled={!uom.trim() || !(Number(factor) > 0)} onClick={save}>{tr("Add unit")}</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label={tr("Unit")} required><Input value={uom} onChange={e => setUom(e.target.value.toUpperCase())} placeholder="PACK@100PCS" /></Field>
        <Field label={tr("= {0} {1}", "…", item.base_uom)} required hint={tr("Base units in one {0}", uom || tr("unit"))}>
          <Input inputMode="decimal" value={factor} onChange={e => setFactor(e.target.value.replace(",", "."))} />
        </Field>
        {error && <p role="alert" className="col-span-2 text-sm text-red-600">{error}</p>}
      </div>
    </Dialog>
  );
}
