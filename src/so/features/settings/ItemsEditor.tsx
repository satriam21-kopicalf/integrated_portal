"use client";

// Edits the items of a count list or an item group: search & add items, area, package unit (counted in packs + loose),
// ESB unit (unit of the ESB import file), photo required, remove. Saved as a whole by the parent.

import { Camera, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, cx, inputClass } from "@/so/ui";
import { api } from "@/so/lib/api";
import { tr } from "@/lib/i18n";

export type EditorItem = {
  item_id: string;
  item_code: string;
  item_name: string;
  base_uom: string;
  units: string[];
  category_name?: string | null;
  area: string;
  pack_uom: string | null;
  esb_uom: string | null;
  photo_required: boolean;
};

type Found = { item_id: string; item_code: string; item_name: string; base_uom: string; category_name: string | null; units: string[] };
type Category = { id: string; name: string; parent_name: string | null; items: number };

export function toPayload(items: EditorItem[]) {
  return items.map((i, n) => ({ item_id: i.item_id, area: i.area, sort: n + 1, pack_uom: i.pack_uom, esb_uom: i.esb_uom, photo_required: i.photo_required }));
}

export default function ItemsEditor({ items, onChange, readOnly = false }: { items: EditorItem[]; onChange: (v: EditorItem[]) => void; readOnly?: boolean }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [found, setFound] = useState<Found[]>([]);
  const [searching, setSearching] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [adding, setAdding] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (readOnly) return;
    void api<Category[]>("/api/so/count-settings/item-categories").then(setCategories).catch(() => setCategories([]));
  }, [readOnly]);

  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) {
      setFound([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(() => {
      api<Found[]>(`/api/so/count-settings/items?q=${encodeURIComponent(s)}&limit=20`).then(setFound).catch(() => setFound([])).finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  const ids = useMemo(() => new Set(items.map((i) => i.item_id)), [items]);
  const toItem = (f: Found): EditorItem => ({ ...f, area: (f.category_name ?? "GENERAL").toUpperCase(), pack_uom: null, esb_uom: null, photo_required: false });
  const add = (f: Found) => {
    if (ids.has(f.item_id)) return;
    onChange([...items, toItem(f)]);
  };
  const addCategory = async (id: string) => {
    if (!id) return;
    setAdding(true);
    setNote("");
    try {
      const all = await api<Found[]>(`/api/so/count-settings/items?category_id=${encodeURIComponent(id)}&limit=500`);
      const fresh = all.filter((f) => !ids.has(f.item_id));
      onChange([...items, ...fresh.map(toItem)]);
      setNote(fresh.length ? tr("{0} items added", fresh.length) : tr("All items of this category are already in"));
    } catch {
      setNote(tr("Could not load the items of this category"));
    } finally {
      setAdding(false);
    }
  };
  const set = (id: string, patch: Partial<EditorItem>) => onChange(items.map((i) => (i.item_id === id ? { ...i, ...patch } : i)));
  const shown = useMemo(() => {
    const s = filter.trim().toLowerCase();
    return items.filter((i) => !s || i.item_name.toLowerCase().includes(s) || i.item_code.toLowerCase().includes(s) || i.area.toLowerCase().includes(s));
  }, [items, filter]);

  return (
    <div className="space-y-3">
      {!readOnly && categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <select value="" disabled={adding} onChange={(e) => void addCategory(e.target.value)} aria-label={tr("Add a whole category")}
            className={`${inputClass} h-9 max-w-xs flex-1 text-sm`}>
            <option value="">{adding ? tr("Adding…") : tr("+ Add a whole category")}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.parent_name ? `${c.parent_name} › ${c.name}` : c.name} ({c.items})</option>
            ))}
          </select>
          {adding && <Loader2 size={14} className="animate-spin text-slate-400" />}
          {note && <span className="text-xs text-slate-500">{note}</span>}
          {items.length > 0 && (
            <button type="button" className="ml-auto text-xs font-medium text-red-600 hover:underline"
              onClick={() => { if (window.confirm(tr("Remove all {0} items?", items.length))) onChange([]); }}>{tr("Remove all")}</button>
          )}
        </div>
      )}
      {!readOnly && (
        <div className="relative">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Add item: type a name or code")} aria-label={tr("Add item")}
            className={`${inputClass} pl-9`} />
          {searching && <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />}
          {found.length > 0 && (
            <ul className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              {found.map((f) => (
                <li key={f.item_id}>
                  <button type="button" disabled={ids.has(f.item_id)} onClick={() => add(f)}
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-40">
                    <Plus size={14} className="text-blue-600" />
                    <span className="min-w-0 flex-1"><span className="block truncate text-slate-900">{f.item_name}</span>
                      <span className="block truncate text-[11px] text-slate-400">{f.item_code} · {f.category_name ?? tr("No category")} · {f.base_uom}</span></span>
                    {ids.has(f.item_id) && <Badge>{tr("Added")}</Badge>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {items.length > 8 && (
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder={tr("Filter the {0} items", items.length)} className={`${inputClass} h-9`} />
      )}
      <ul className="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200">
        {shown.map((i) => (
          <li key={i.item_id} className="space-y-2 px-3 py-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{i.item_name}</p>
                <p className="truncate text-[11px] text-slate-400"><span className="font-mono">{i.item_code}</span> · {tr("base")} {i.base_uom}</p>
              </div>
              {!readOnly && (
                <button type="button" onClick={() => onChange(items.filter((x) => x.item_id !== i.item_id))}
                  className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600" aria-label={tr("Remove {0}", i.item_name)}><Trash2 size={15} /></button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <input value={i.area} disabled={readOnly} onChange={(e) => set(i.item_id, { area: e.target.value.toUpperCase() })}
                className={`${inputClass} h-8 text-xs`} aria-label={tr("Area")} placeholder={tr("Area")} />
              <select value={i.pack_uom ?? ""} disabled={readOnly} onChange={(e) => set(i.item_id, { pack_uom: e.target.value || null })}
                className={`${inputClass} h-8 text-xs`} aria-label={tr("Package unit")}>
                <option value="">{tr("No package")}</option>
                {i.units.filter((u) => u !== i.base_uom).map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
              <select value={i.esb_uom ?? ""} disabled={readOnly} onChange={(e) => set(i.item_id, { esb_uom: e.target.value || null })}
                className={`${inputClass} h-8 text-xs`} aria-label={tr("ESB unit")}>
                <option value="">{tr("ESB unit: {0}", i.base_uom)}</option>
                {i.units.filter((u) => u !== i.base_uom).map((u) => <option key={u} value={u}>{tr("ESB unit: {0}", u)}</option>)}
              </select>
              <button type="button" disabled={readOnly} onClick={() => set(i.item_id, { photo_required: !i.photo_required })} aria-pressed={i.photo_required}
                className={cx("inline-flex h-8 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium",
                  i.photo_required ? "border-blue-600 bg-blue-50 text-blue-700" : "border-slate-200 text-slate-500")}>
                <Camera size={13} /> {i.photo_required ? tr("Photo required") : tr("No photo")}
              </button>
            </div>
          </li>
        ))}
        {items.length === 0 && <li className="px-3 py-8 text-center text-sm text-slate-400">{tr("No items yet")}</li>}
      </ul>
    </div>
  );
}
