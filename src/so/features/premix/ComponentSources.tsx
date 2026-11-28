"use client";

// Where the components of a WIP recipe come from (recipe editor): the item master by category, the ESB bills of
// materials (take one line or the whole BOM) and the components other WIP recipes already use. Adding puts a line in
// the draft with the stock item already chosen.

import { NativeSelect } from "@/so/ui/Jira";
import { SkeletonList } from "@/components/kc/Skeleton";
import { ChevronRight, Layers, Package, Plus, Search, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { cx, inputClass, searchClass } from "@/so/ui";
import { api } from "@/so/lib/api";
import { tr } from "@/lib/i18n";

export type PickedComponent = { item_id: string | null; item_code: string | null; item_name: string | null; component_name: string; qty_base: number | null; is_stock: boolean };
type Category = { id: string; name: string; parent_name: string | null; items: number };
type Item = { item_id: string; item_code: string; item_name: string; base_uom: string; category_name: string | null };
type Bom = { bom_id: string; bom_code: string; bom_name: string; product_name: string; uom_name: string | null; lines: number };
type BomLine = { line_no: number; product_code: string; product_name: string; uom_name: string; qty: number; qty_base: number; item_id: string | null; item_code: string | null; item_name: string | null; base_uom: string | null };
type Used = { component_name: string; item_id: string | null; item_code: string | null; item_name: string | null; is_stock: boolean; recipes: number };
type Tab = "items" | "bom" | "used";

const fmt = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 2 });

export default function ComponentSources({ have, onAdd }: { have: Set<string>; onAdd: (c: PickedComponent[]) => void }) {
  const [tab, setTab] = useState<Tab>("items");
  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "items", label: tr("Item Master"), icon: <Package size={13} /> },
    { key: "bom", label: tr("ESB BOM"), icon: <Layers size={13} /> },
    { key: "used", label: tr("Used in Recipes"), icon: <Sparkles size={13} /> },
  ];
  return (
    <div className="rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-[color:var(--j-F7F8F9)]">
      <div className="flex gap-1 border-b border-[color:var(--j-DCDFE4)] px-2 pt-2" role="tablist">
        {tabs.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cx("-mb-px inline-flex items-center gap-1 rounded-t-lg border border-b-0 px-2.5 py-1.5 text-xs font-medium",
              tab === t.key ? "border-[color:var(--j-DCDFE4)] bg-white text-[color:var(--j-0C66E4)]" : "border-transparent text-[color:var(--j-626F86)] hover:text-[color:var(--j-172B4D)]")}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      <div className="max-h-[22rem] overflow-y-auto bg-white p-2">
        {tab === "items" ? <ItemsTab have={have} onAdd={onAdd} /> : tab === "bom" ? <BomTab have={have} onAdd={onAdd} /> : <UsedTab have={have} onAdd={onAdd} />}
      </div>
    </div>
  );
}

function AddButton({ added, onClick }: { added: boolean; onClick: () => void }) {
  return added ? <span className="text-[11px] font-medium text-[color:var(--j-216E4E)]">{tr("In recipe")}</span> : (
    <button type="button" onClick={onClick} className="inline-flex items-center gap-0.5 rounded-[3px] border border-[color:var(--j-85B8FF)] px-1.5 py-0.5 text-[11px] font-medium text-[color:var(--j-0C66E4)] hover:bg-[color:var(--j-E9F2FF)]">
      <Plus size={11} /> {tr("Add")}
    </button>
  );
}

function ItemsTab({ have, onAdd }: { have: Set<string>; onAdd: (c: PickedComponent[]) => void }) {
  const [cats, setCats] = useState<Category[]>([]);
  const [cat, setCat] = useState("");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<Item[] | null>(null);
  useEffect(() => { void api<Category[]>("/api/so/recipes/item-categories").then(setCats).catch(() => setCats([])); }, []);
  useEffect(() => {
    if (!cat && q.trim().length < 2) { setRows(null); return; }
    const t = setTimeout(() => {
      const p = new URLSearchParams({ q: q.trim(), limit: cat ? "300" : "40" });
      if (cat) p.set("category_id", cat);
      void api<Item[]>(`/api/so/recipes/items?${p}`).then(setRows).catch(() => setRows([]));
    }, 250);
    return () => clearTimeout(t);
  }, [cat, q]);
  return (
    <div className="space-y-2">
      <div className="grid gap-2 sm:grid-cols-2">
        <NativeSelect value={cat} onChange={e => setCat(e.target.value)} className={cx(inputClass, "h-8 text-xs")} aria-label={tr("Category")}>
          <option value="">{tr("All categories")}</option>
          {cats.map(c => <option key={c.id} value={c.id}>{c.parent_name ? `${c.parent_name} › ${c.name}` : c.name} ({c.items})</option>)}
        </NativeSelect>
        <div className="relative">
          <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[color:var(--j-626F86)]" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr("Search item name or code")} className={cx(searchClass, "h-8 pl-7 text-xs")} />
        </div>
      </div>
      {rows === null ? <p className="py-4 text-center text-xs text-[color:var(--j-626F86)]">{tr("Choose a category or type at least 2 letters")}</p> : (
        <ul className="divide-y divide-[color:var(--j-F1F2F4)]">
          {rows.map(r => (
            <li key={r.item_id} className="flex items-center gap-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1"><span className="font-mono text-[color:var(--j-626F86)]">{r.item_code}</span> <span className="text-[color:var(--j-172B4D)]">{r.item_name}</span> <span className="text-[color:var(--j-626F86)]">· {r.base_uom}</span></span>
              <AddButton added={have.has(r.item_id)} onClick={() => onAdd([{ item_id: r.item_id, item_code: r.item_code, item_name: r.item_name, component_name: r.item_name, qty_base: null, is_stock: true }])} />
            </li>
          ))}
          {rows.length === 0 && <li className="py-4 text-center text-xs text-[color:var(--j-626F86)]">{tr("No item found")}</li>}
        </ul>
      )}
    </div>
  );
}

function BomTab({ have, onAdd }: { have: Set<string>; onAdd: (c: PickedComponent[]) => void }) {
  const [q, setQ] = useState("");
  const [boms, setBoms] = useState<Bom[] | null>(null);
  const [open, setOpen] = useState<{ bom: Bom; lines: BomLine[] | null } | null>(null);
  useEffect(() => {
    const t = setTimeout(() => { void api<Bom[]>(`/api/so/recipes/esb-boms?q=${encodeURIComponent(q.trim())}`).then(setBoms).catch(() => setBoms([])); }, 250);
    return () => clearTimeout(t);
  }, [q]);
  const show = async (b: Bom) => {
    setOpen({ bom: b, lines: null });
    const d = await api<{ lines: BomLine[] }>(`/api/so/recipes/esb-boms/${encodeURIComponent(b.bom_id)}`).catch(() => ({ lines: [] }));
    setOpen({ bom: b, lines: d.lines });
  };
  const pick = (l: BomLine): PickedComponent => ({ item_id: l.item_id, item_code: l.item_code ?? l.product_code, item_name: l.item_name, component_name: l.item_name ?? l.product_name, qty_base: l.qty_base || null, is_stock: true });
  return open ? (
    <div className="space-y-2">
      <button type="button" onClick={() => setOpen(null)} className="text-xs font-medium text-[color:var(--j-0C66E4)] hover:underline">← {tr("All BOMs")}</button>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs"><span className="font-semibold text-[color:var(--j-172B4D)]">{open.bom.bom_name}</span> <span className="text-[color:var(--j-626F86)]">{open.bom.bom_code}{open.bom.uom_name ? ` · ${tr("output")} ${open.bom.uom_name}` : ""}</span></p>
        {open.lines && open.lines.length > 0 && (
          <button type="button" onClick={() => onAdd(open.lines!.filter(l => !l.item_id || !have.has(l.item_id)).map(pick))}
            className="inline-flex items-center gap-1 rounded-[3px] bg-[color:var(--j-0C66E4)] px-2 py-1 text-[11px] font-medium text-white hover:bg-[color:var(--j-0055CC)]"><Plus size={11} /> {tr("Add all components")}</button>
        )}
      </div>
      {open.lines === null ? <SkeletonList rows={3} /> : (
        <ul className="divide-y divide-[color:var(--j-F1F2F4)]">
          {open.lines.map(l => (
            <li key={l.line_no} className="flex items-center gap-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1">
                <span className="block text-[color:var(--j-172B4D)]">{l.item_name ?? l.product_name}</span>
                <span className="block text-[color:var(--j-626F86)]">{fmt(l.qty)} {l.uom_name}{l.base_uom && l.qty_base !== l.qty ? ` = ${fmt(l.qty_base)} ${l.base_uom}` : ""}{!l.item_id ? ` · ${tr("not in the item master")}` : ""}</span>
              </span>
              <AddButton added={!!l.item_id && have.has(l.item_id)} onClick={() => onAdd([pick(l)])} />
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-[color:var(--j-626F86)]">{tr("Quantities are those of the ESB BOM (per its output unit); set the grams per batch of your recipe after adding.")}</p>
    </div>
  ) : (
    <div className="space-y-2">
      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[color:var(--j-626F86)]" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr("Search ESB BOM (e.g. premix, cream, sauce)")} className={cx(searchClass, "h-8 pl-7 text-xs")} />
      </div>
      {boms === null ? <SkeletonList rows={3} /> : (
        <ul className="divide-y divide-[color:var(--j-F1F2F4)]">
          {boms.map(b => (
            <li key={b.bom_id}>
              <button type="button" onClick={() => void show(b)} className="flex w-full items-center gap-2 py-1.5 text-left text-xs hover:bg-[color:var(--j-F7F8F9)]">
                <span className="min-w-0 flex-1"><span className="block truncate text-[color:var(--j-172B4D)]">{b.bom_name}</span><span className="block text-[color:var(--j-626F86)]">{b.bom_code} · {tr("{0} components", b.lines)}</span></span>
                <ChevronRight size={13} className="text-[color:var(--j-8590A2)]" />
              </button>
            </li>
          ))}
          {boms.length === 0 && <li className="py-4 text-center text-xs text-[color:var(--j-626F86)]">{tr("No ESB BOM found")}</li>}
        </ul>
      )}
    </div>
  );
}

function UsedTab({ have, onAdd }: { have: Set<string>; onAdd: (c: PickedComponent[]) => void }) {
  const [rows, setRows] = useState<Used[] | null>(null);
  const [q, setQ] = useState("");
  useEffect(() => { void api<Used[]>("/api/so/recipes/components").then(setRows).catch(() => setRows([])); }, []);
  const shown = useMemo(() => (rows ?? []).filter(r => !q.trim() || `${r.component_name} ${r.item_name ?? ""} ${r.item_code ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())), [rows, q]);
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search size={13} className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-[color:var(--j-626F86)]" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr("Filter")} className={cx(searchClass, "h-8 pl-7 text-xs")} />
      </div>
      {rows === null ? <SkeletonList rows={4} /> : shown.length === 0 ? (
        <p className="py-4 text-center text-xs text-[color:var(--j-626F86)]">{tr("No recipe components yet")}</p>
      ) : (
        <ul className="divide-y divide-[color:var(--j-F1F2F4)]">
          {shown.map((r, i) => (
            <li key={`${r.component_name}-${i}`} className="flex items-center gap-2 py-1.5 text-xs">
              <span className="min-w-0 flex-1">
                <span className="block text-[color:var(--j-172B4D)]">{r.component_name}</span>
                <span className="block text-[color:var(--j-626F86)]">{r.is_stock ? (r.item_code ? `${r.item_code} ${r.item_name}` : tr("not mapped")) : tr("not a stock item")} · {tr("{0} recipes", r.recipes)}</span>
              </span>
              <AddButton added={!!r.item_id && have.has(r.item_id)} onClick={() => onAdd([{ item_id: r.item_id, item_code: r.item_code, item_name: r.item_name, component_name: r.component_name, qty_base: null, is_stock: r.is_stock }])} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
