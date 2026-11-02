"use client";

// Sales Calculator by Menu (Cost Control, page cc.sales-calc; integrated_portal_be app/menu_costing.py, migrations 056-057).
// Four steps: 1. Recipe Cards — what one portion of a menu uses (raw materials and packaging of the item master, WIP /
// premix in grams through the Production Calculator, items typed by hand); 2. Assign Menus — the ESB POS menus sold by
// the branches and the card each one uses; 3. Additional Items — supplies no menu records (cable ties, plastic …) per
// bill, portion or outlet-day; 4. Calculator — from the POS transactions of the branches: Material Required Planning,
// Usage Actual vs System (ESB stock opname + purchases) and COGS Bahan Baku (Pricelist Items).

import { BookOpen, Calculator, ChevronDown, FlaskConical, ListChecks, Package, PenLine, Plus, Save, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, inputClass, Page, Panel, SkeletonRows, theadClass, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatStrip } from "@/so/ui/StatStrip";
import { type ActiveFilter, FilterSection, FilterSheet, FilterToolbar, PeriodField, type Period, dmy, wibDay } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { downloadXlsx } from "@/lib/xlsx";
import ExcelExportMenu from "@/components/ExcelExportMenu";
import { tr } from "@/lib/i18n";

type Kind = "item" | "wip" | "other";
type Line = { type: Kind; code: string; name: string; qty: number; unit: string; price?: number | null };
type Extra = { id: number; code: string | null; name: string; unit: string; price: number | null; basis: "bill" | "portion" | "day"; qty: number; note: string | null; isActive: boolean };
type Recipe = { code: string; name: string; category: string | null; lines: Line[]; note: string | null; isActive: boolean; menus: { id: string; name: string }[] };
type Menu = { id: string; name: string; category: string; detail?: string; kinds?: string[]; companies?: { code: string; name: string }[];
  qty: number; lastSold?: string | null; recipe: string | null };
type Item = { code: string; name: string; unit: string; category: string | null; price: number | null };
type Wip = { code: string; name: string; components: { code: string | null; name: string; unit: string; perGram: number }[] };
type Report = {
  period: { from: string; to: string; days: number; horizon: number; buffer: number };
  menus: { id: string; name: string; recipe: string; recipeName: string; qty: number; sales: number; hpp: number | null; cogs: number | null; ratio: number | null }[];
  unmapped: { id: string; name: string; category: string; qty: number; sales: number }[];
  usage: { code: string | null; name: string; unit: string; isStock: boolean; extra?: boolean; system: number; actual: number | null; variance: number | null; price: number | null; systemValue: number | null; actualValue: number | null }[];
  mrp: { code: string | null; name: string; unit: string; isStock: boolean; qty: number; value: number | null; extra?: boolean }[];
  extras?: (Extra & { count: number; used: number })[];
  total: { sales: number; cogs: number; menuCogs?: number; extraCogs?: number; ratio: number | null; menusMapped: number; menusUnmapped: number; unpriced: number; systemValue: number; actualValue: number };
};
type Branch = { branch_code: string; branch_name: string };
type Step = "recipes" | "menus" | "extras" | "report";

const BASIS: Record<Extra["basis"], () => string> = { bill: () => tr("Per Bill"), portion: () => tr("Per Portion Sold"), day: () => tr("Per Outlet-Day") };
const KIND: Record<Kind, { label: () => string; tone: "blue" | "violet" | "amber" }> = {
  item: { label: () => tr("Raw Material / Packaging"), tone: "blue" }, wip: { label: () => tr("WIP / Premix"), tone: "violet" }, other: { label: () => tr("Other Item"), tone: "amber" },
};
const num = (n: number | null | undefined, d = 2) => (n === null || n === undefined ? "—" : n.toLocaleString("id-ID", { maximumFractionDigits: d }));
const rp = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `Rp ${Math.round(n).toLocaleString("id-ID")}`);
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${(n * 100).toFixed(1)}%`);
/** "1,5" / "1.5" → 1.5; an empty or unfinished value → null */
/** every word of the search in the text, in any order ("es kopi premium" finds "ES KOPI CALF - PREMIUM") */
const matches = (text: string, q: string) => { const t = text.toLowerCase(); return q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => t.includes(w)); };
const brands = (m: Menu) => (m.companies ?? []).map((c) => c.name).join(" · ");
const parse = (v: string) => { const n = Number(v.replace(",", ".")); return v.trim() === "" || Number.isNaN(n) ? null : n; };

export default function SalesCalculatorPage() {
  const [step, setStep] = useState<Step>("recipes");
  // progress of the steps, refreshed when a step is opened
  const [progress, setProgress] = useState<{ cards: number; menus: number; mapped: number; extras: number } | null>(null);
  useEffect(() => {
    Promise.all([call<{ data: Recipe[] }>("/api/cost-control/sales-calc/recipes"), call<{ data: Menu[] }>("/api/cost-control/sales-calc/menus"),
      call<{ data: Extra[] }>("/api/cost-control/sales-calc/extras")])
      .then(([r, m, e]) => setProgress({ cards: r.data.length, menus: m.data.length, mapped: m.data.filter((x) => x.recipe).length, extras: e.data.filter((x) => x.isActive).length }))
      .catch(() => setProgress(null));
  }, [step]);
  const status: Record<Step, string | null> = progress ? {
    recipes: tr("{0} cards", progress.cards), menus: tr("{0} of {1} menus", progress.mapped, progress.menus),
    extras: tr("{0} active", progress.extras), report: null,
  } : { recipes: null, menus: null, extras: null, report: null };
  const steps: { key: Step; label: string; hint: string; icon: typeof BookOpen }[] = [
    { key: "recipes", label: tr("Recipe Cards"), hint: tr("Components per portion"), icon: BookOpen },
    { key: "menus", label: tr("Assign Menus"), hint: tr("ESB menus to a card"), icon: ListChecks },
    { key: "extras", label: tr("Additional Items"), hint: tr("Outside the cards"), icon: Package },
    { key: "report", label: tr("Calculator"), hint: tr("MRP, usage & COGS"), icon: Calculator },
  ];
  return (
    <Page title={tr("Sales Calculator by Menu")} subtitle={tr("Recipe cards per menu and, from the POS transactions of every branch: material planning, actual vs system usage and COGS")}>
      <nav aria-label={tr("Steps")} className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {steps.map((s, i) => {
          const on = step === s.key;
          return (
            <button key={s.key} type="button" onClick={() => setStep(s.key)} aria-current={on ? "step" : undefined}
              className={cx("flex items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors",
                on ? "border-blue-600 bg-blue-50 shadow-sm" : "border-slate-200 bg-white hover:border-slate-300")}>
              <span className={cx("flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-sm font-bold", on ? "bg-blue-700 text-white" : "bg-slate-100 text-slate-500")}>{i + 1}</span>
              <span className="min-w-0">
                <span className={cx("block truncate text-sm font-semibold", on ? "text-blue-800" : "text-slate-800")}>{s.label}</span>
                <span className="block truncate text-[11px] text-slate-500">{status[s.key] ?? s.hint}</span>
              </span>
            </button>
          );
        })}
      </nav>
      {step === "recipes" && <Recipes />}
      {step === "menus" && <MenuAssign />}
      {step === "extras" && <Extras />}
      {step === "report" && <ReportView onGo={setStep} />}
    </Page>
  );
}

/** A searchable picker that renders the first matches only (the item master has thousands of items). */
function Picker({ value, options, onPick, placeholder }: {
  value: string; options: { value: string; label: string; hint?: string }[]; onPick: (v: string) => void; placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);
  const current = options.find((o) => o.value === value);
  const s = q.trim().toLowerCase();
  const all = s ? options.filter((o) => `${o.label} ${o.value} ${o.hint ?? ""}`.toLowerCase().includes(s)) : options;
  const shown = all.slice(0, 60);
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className={cx(inputClass, "flex h-9 items-center justify-between gap-2 text-left")}>
        <span className={cx("truncate", !current && "text-slate-400")}>{current ? current.label : placeholder}</span>
        <ChevronDown size={15} className="flex-shrink-0 text-slate-400" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-[min(26rem,85vw)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="relative border-b border-slate-100 p-2">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search name or code")} className={cx(inputClass, "h-9 pl-8")} />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {shown.map((o) => (
              <li key={o.value}>
                <button type="button" onClick={() => { onPick(o.value); setOpen(false); setQ(""); }}
                  className={cx("flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50", o.value === value && "bg-blue-50 text-blue-800")}>
                  <span className="truncate">{o.label}</span>{o.hint && <span className="flex-shrink-0 text-[11px] text-slate-400">{o.hint}</span>}
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-3 py-4 text-center text-xs text-slate-400">{tr("No match")}</li>}
            {all.length > shown.length && <li className="px-3 py-2 text-center text-[11px] text-slate-400">{tr("{0} more — type to narrow down", all.length - shown.length)}</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

function useCatalog() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [wips, setWips] = useState<Wip[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    call<{ data: Item[] }>("/api/cost-control/pricelist").then((r) => setItems(r.data)).catch((e: Error) => { setItems([]); setError(e.message); });
    void call<{ data: Wip[] }>("/api/cost-control/sales-calc/wips").then((r) => setWips(r.data)).catch(() => setWips([]));
  }, []);
  return { items: items ?? [], loading: items === null, wips, error };
}

// ---------------------------------------------------------------- 1. recipe cards

function Recipes() {
  const [rows, setRows] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Recipe | "new" | null>(null);
  const [q, setQ] = useState("");
  const load = useCallback(() => { call<{ data: Recipe[] }>("/api/cost-control/sales-calc/recipes").then((r) => setRows(r.data)).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const shown = (rows ?? []).filter((r) => !q || `${r.name} ${r.code} ${r.category ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Panel title={tr("Recipe Cards")} description={tr("What one portion of a menu uses: raw materials, packaging, WIP / premix and other items")}
      actions={<Button size="sm" onClick={() => setEdit("new")}><Plus size={14} />{tr("New Card")}</Button>}
      toolbar={<div className="relative sm:max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className={cx(inputClass, "pl-9")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search card")} /></div>}>
      {error ? <ErrorState message={error} onRetry={load} /> : !rows ? <SkeletonRows cols={4} /> : shown.length === 0 ? (
        <Empty icon={<BookOpen size={26} />} title={rows.length ? tr("No card matches") : tr("No recipe card yet")}>
          {!rows.length && <Button className="mt-3" onClick={() => setEdit("new")}><Plus size={14} />{tr("Make the first card")}</Button>}
        </Empty>
      ) : (
        <ul className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((r) => (
            <li key={r.code}>
              <button type="button" onClick={() => setEdit(r)} className="h-full w-full rounded-2xl border border-slate-200 p-4 text-left transition-colors hover:border-blue-300 hover:bg-blue-50/30">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{r.name}</p>
                    <p className="text-[11px] text-slate-400">{r.code}{r.category ? ` · ${r.category}` : ""}</p>
                  </div>
                  {!r.isActive ? <Badge tone="slate">{tr("Inactive")}</Badge> : r.menus.length ? <Badge tone="green">{tr("{0} menus", r.menus.length)}</Badge> : <Badge tone="amber">{tr("No Menu Yet")}</Badge>}
                </div>
                <ul className="mt-3 space-y-0.5 text-xs text-slate-600">
                  {r.lines.slice(0, 4).map((l, i) => <li key={i} className="flex justify-between gap-2"><span className="truncate">{l.name}</span><span className="flex-shrink-0 tabular-nums text-slate-500">{num(l.qty)} {l.unit}</span></li>)}
                  {r.lines.length > 4 && <li className="text-slate-400">{tr("+{0} more", r.lines.length - 4)}</li>}
                  {!r.lines.length && <li className="text-amber-700">{tr("No component yet")}</li>}
                </ul>
              </button>
            </li>
          ))}
        </ul>
      )}
      {edit && <RecipeDrawer recipe={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </Panel>
  );
}

/** A line being edited: the quantity (and the price of an other item) kept as typed, so "0,5" can be entered. */
type Draft = Line & { qtyText: string; priceText: string };
const toDraft = (l: Line): Draft => ({ ...l, qtyText: l.qty ? String(l.qty).replace(".", ",") : "", priceText: l.price != null ? String(l.price).replace(".", ",") : "" });

function RecipeDrawer({ recipe, onClose, onSaved }: { recipe: Recipe | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { items, loading, wips, error } = useCatalog();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [head, setHead] = useState(() => ({ code: recipe?.code ?? "", name: recipe?.name ?? "", category: recipe?.category ?? "", note: recipe?.note ?? "", isActive: recipe?.isActive ?? true }));
  const [lines, setLines] = useState<Draft[]>(() => (recipe?.lines ?? []).map(toDraft));
  const [assigned, setAssigned] = useState(() => recipe?.menus ?? []);
  const [menuQ, setMenuQ] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { void call<{ data: Menu[] }>("/api/cost-control/sales-calc/menus").then((r) => setMenus(r.data)).catch(() => setMenus([])); }, []);
  const price = useMemo(() => new Map(items.map((i) => [i.code, i.price])), [items]);
  const itemOptions = useMemo(() => items.map((i) => ({ value: i.code, label: i.name, hint: `${i.code} · ${i.unit}` })), [items]);
  const wipOptions = useMemo(() => wips.map((w) => ({ value: w.code, label: w.name, hint: "gram" })), [wips]);

  /** cost of one line (null while a price is missing) */
  const cost = useCallback((l: Draft): number | null => {
    const qty = parse(l.qtyText) ?? 0;
    if (l.type === "other") { const p = parse(l.priceText); return p === null ? null : p * qty; }
    if (l.type === "item") { const p = price.get(l.code); return p == null ? null : p * qty; }
    const w = wips.find((x) => x.code === l.code);
    if (!w) return null;
    let total = 0;
    for (const c of w.components) { if (!c.code) continue; const p = price.get(c.code); if (p == null) return null; total += p * qty * c.perGram; }
    return total;
  }, [price, wips]);
  const costs = lines.map(cost);
  const hpp = lines.length && costs.every((c) => c !== null) ? costs.reduce<number>((a, c) => a + (c ?? 0), 0) : null;
  const invalid = lines.findIndex((l) => !l.code || !l.name.trim() || (parse(l.qtyText) ?? 0) <= 0);

  const setLine = (i: number, patch: Partial<Draft>) => setLines((all) => all.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const add = (type: Kind) => setLines((all) => [...all, { type, code: type === "other" ? `other-${all.length + 1}` : "", name: "", qty: 0, unit: type === "wip" ? "GR" : type === "other" ? "PCS" : "", price: null, qtyText: "", priceText: "" }]);
  const pickItem = (i: number, code: string) => { const it = items.find((x) => x.code === code); setLine(i, { code, name: it?.name ?? code, unit: it?.unit ?? "" }); };
  const pickWip = (i: number, code: string) => { const w = wips.find((x) => x.code === code); setLine(i, { code, name: w?.name ?? code, unit: "GR" }); };

  const save = async () => {
    if (invalid >= 0) { toast(tr("Complete component {0}: choose it and fill a quantity above 0", invalid + 1), "error"); return; }
    setBusy(true);
    try {
      const body = { ...head, lines: lines.map((l) => ({ type: l.type, code: l.code, name: l.name.trim(), unit: l.unit, qty: parse(l.qtyText),
        ...(l.type === "other" ? { price: parse(l.priceText) } : {}) })), menus: assigned };
      await call(recipe ? `/api/cost-control/sales-calc/recipes/${encodeURIComponent(recipe.code)}` : "/api/cost-control/sales-calc/recipes", { method: recipe ? "PUT" : "POST", json: body });
      toast(tr("Saved"));
      onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!recipe || !window.confirm(tr("Delete the card {0}? Its menus become unassigned.", recipe.name))) return;
    try { await call(`/api/cost-control/sales-calc/recipes/${encodeURIComponent(recipe.code)}`, { method: "DELETE" }); onSaved(); } catch (e) { toast((e as Error).message, "error"); }
  };
  const ids = new Set(assigned.map((m) => m.id));
  const menuShown = menus.filter((m) => !menuQ || matches(`${m.name} ${m.category} ${m.detail ?? ""} ${brands(m)}`, menuQ)).slice(0, 400);

  return (
    <Drawer open onClose={onClose} size="lg" title={recipe ? recipe.name : tr("New Card")} description={tr("One portion of the menu")}
      footer={<div className="flex flex-wrap items-center justify-end gap-2">
        {recipe && <Button variant="ghost" className="mr-auto text-red-600" onClick={() => void remove()}><Trash2 size={14} />{tr("Delete")}</Button>}
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!head.code.trim() || !head.name.trim()} onClick={() => void save()}><Save size={15} />{tr("Save Card")}</Button>
      </div>}>
      <div className="space-y-6 text-sm">
        <section className="grid gap-3 sm:grid-cols-6">
          <label className="text-xs font-medium text-slate-600 sm:col-span-2">{tr("Code")}<input className={cx(inputClass, "mt-1 uppercase")} value={head.code} onChange={(e) => setHead({ ...head, code: e.target.value })} placeholder="MN-MATCHA-ICE" /></label>
          <label className="text-xs font-medium text-slate-600 sm:col-span-4">{tr("Name")}<input className={cx(inputClass, "mt-1")} value={head.name} onChange={(e) => setHead({ ...head, name: e.target.value })} placeholder={tr("e.g. Iced Matcha Latte")} /></label>
          <label className="text-xs font-medium text-slate-600 sm:col-span-3">{tr("Category")}<input className={cx(inputClass, "mt-1")} value={head.category} onChange={(e) => setHead({ ...head, category: e.target.value })} placeholder={tr("e.g. Non Coffee")} /></label>
          <label className="flex items-end gap-2 pb-2.5 text-xs font-medium text-slate-600 sm:col-span-3"><input type="checkbox" checked={head.isActive} onChange={(e) => setHead({ ...head, isActive: e.target.checked })} />{tr("Active")}</label>
        </section>

        <section>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900">{tr("Components per Portion")}</h3>
              <p className="text-xs text-slate-500">{tr("Quantities in the unit of the item; WIP / premix in grams")}</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] uppercase tracking-wide text-slate-400">{tr("HPP per Portion")}</p>
              <p className="text-lg font-bold tabular-nums text-slate-900">{hpp === null ? <span className="text-sm font-medium text-amber-700">{lines.length ? tr("Price missing") : "—"}</span> : rp(hpp)}</p>
            </div>
          </div>
          {error && <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{tr("The item list could not be loaded: {0}", error)}</p>}
          <div className="rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className={theadClass}><tr><th className="w-8 px-2 py-2">#</th><th className="px-2 py-2">{tr("Component")}</th><th className="w-24 px-2 py-2 text-right">{tr("Qty")}</th><th className="w-14 px-2 py-2">{tr("Unit")}</th><th className="w-28 px-2 py-2 text-right">{tr("Cost")}</th><th className="w-8" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {lines.map((l, i) => (
                  <tr key={i} className={cx(i === invalid && busy && "bg-red-50")}>
                    <td className="px-2 py-2 align-top text-xs text-slate-400">{i + 1}</td>
                    <td className="px-2 py-2">
                      <div className="mb-1"><Badge tone={KIND[l.type].tone}>{KIND[l.type].label()}</Badge></div>
                      {l.type === "item" && <Picker value={l.code} options={itemOptions} onPick={(v) => pickItem(i, v)} placeholder={loading ? tr("Loading items…") : tr("Choose raw material / packaging")} />}
                      {l.type === "wip" && <Picker value={l.code} options={wipOptions} onPick={(v) => pickWip(i, v)} placeholder={tr("Choose WIP / premix")} />}
                      {l.type === "other" && (
                        <div className="grid gap-2 sm:grid-cols-[1fr_5rem_7rem]">
                          <input className={cx(inputClass, "h-9")} value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} placeholder={tr("Item name, e.g. Sticker")} />
                          <input className={cx(inputClass, "h-9")} value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} aria-label={tr("Unit")} />
                          <input inputMode="decimal" className={cx(inputClass, "h-9 text-right")} value={l.priceText} onChange={(e) => setLine(i, { priceText: e.target.value })} placeholder={tr("Price / unit")} aria-label={tr("Price / Unit")} />
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2 align-bottom"><input inputMode="decimal" className={cx(inputClass, "h-9 text-right")} value={l.qtyText} onChange={(e) => setLine(i, { qtyText: e.target.value })} placeholder="0" aria-label={`${tr("Qty")} ${i + 1}`} /></td>
                    <td className="px-2 py-2 align-bottom text-xs text-slate-500"><span className="inline-block pb-2.5">{l.type === "other" ? "" : l.unit || "—"}</span></td>
                    <td className="px-2 py-2 text-right align-bottom text-xs tabular-nums text-slate-600"><span className="inline-block pb-2.5">{costs[i] === null ? <span className="text-amber-700">{tr("No price")}</span> : rp(costs[i])}</span></td>
                    <td className="px-1 py-2 align-bottom"><button type="button" aria-label={tr("Delete")} onClick={() => setLines((all) => all.filter((_, j) => j !== i))} className="mb-1.5 rounded p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={15} /></button></td>
                  </tr>
                ))}
                {!lines.length && <tr><td colSpan={6} className="px-3 py-6 text-center text-xs text-slate-400">{tr("No component yet: add one below")}</td></tr>}
              </tbody>
            </table>
            <div className="flex flex-wrap gap-2 border-t border-slate-100 p-2">
              <Button size="sm" variant="secondary" onClick={() => add("item")}><Package size={14} />{tr("Raw Material / Packaging")}</Button>
              <Button size="sm" variant="secondary" onClick={() => add("wip")}><FlaskConical size={14} />{tr("WIP / Premix")}</Button>
              <Button size="sm" variant="secondary" onClick={() => add("other")}><PenLine size={14} />{tr("Other Item")}</Button>
            </div>
          </div>
          <p className="mt-1.5 text-[11px] text-slate-400">{tr("A missing price is filled in Pricelist Items; an other item carries its own price")}</p>
        </section>

        <section>
          <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
            <div>
              <h3 className="font-semibold text-slate-900">{tr("ESB Menus with This Card")} <span className="font-normal text-slate-500">({assigned.length})</span></h3>
              <p className="text-xs text-slate-500">{tr("Every menu of the POS transactions; a menu on another card moves here when ticked")}</p>
            </div>
            <input className={cx(inputClass, "h-9 sm:max-w-[14rem]")} value={menuQ} onChange={(e) => setMenuQ(e.target.value)} placeholder={tr("Search menu")} />
          </div>
          <div className="max-h-72 overflow-auto rounded-xl border border-slate-200">
            {menuShown.map((m) => (
              <label key={m.id} className={cx("flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-xs last:border-0", ids.has(m.id) ? "bg-blue-50/50" : "hover:bg-slate-50")}>
                <input type="checkbox" checked={ids.has(m.id)}
                  onChange={(e) => setAssigned(e.target.checked ? [...assigned, { id: m.id, name: m.name }] : assigned.filter((x) => x.id !== m.id))} />
                <span className="min-w-0 flex-1 truncate"><span className="font-medium text-slate-800">{m.name}</span> <span className="text-slate-400">· {m.category}{brands(m) ? ` · ${brands(m)}` : ""}</span></span>
                {m.recipe && m.recipe !== head.code && <Badge tone="amber">{m.recipe}</Badge>}
                <span className="w-14 text-right tabular-nums text-slate-400">{num(m.qty, 0)}</span>
              </label>
            ))}
            {!menuShown.length && <p className="px-3 py-6 text-center text-xs text-slate-400">{tr("No menu matches")}</p>}
          </div>
        </section>
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------- 2. assign menus

function MenuAssign() {
  const toast = useToast();
  const [menus, setMenus] = useState<Menu[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [q, setQ] = useState("");
  const [brand, setBrand] = useState("");
  const [category, setCategory] = useState("");
  const [onlyFree, setOnlyFree] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const load = useCallback(() => {
    void call<{ data: Menu[] }>("/api/cost-control/sales-calc/menus").then((r) => setMenus(r.data));
    void call<{ data: Recipe[] }>("/api/cost-control/sales-calc/recipes").then((r) => setRecipes(r.data));
  }, []);
  useEffect(() => { load(); }, [load]);
  const assign = async (m: Menu, code: string) => {
    const target = recipes.find((r) => r.code === code);
    const prev = recipes.find((r) => r.code === m.recipe);
    setBusy(m.id);
    try {
      if (prev && prev.code !== code) await call(`/api/cost-control/sales-calc/recipes/${encodeURIComponent(prev.code)}`, { method: "PUT", json: { ...prev, menus: prev.menus.filter((x) => x.id !== m.id) } });
      if (target) await call(`/api/cost-control/sales-calc/recipes/${encodeURIComponent(target.code)}`, { method: "PUT", json: { ...target, menus: [...target.menus.filter((x) => x.id !== m.id), { id: m.id, name: m.name }] } });
      load();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(null); }
  };
  const all = useMemo(() => menus ?? [], [menus]);
  const brandList = useMemo(() => [...new Map(all.flatMap((m) => m.companies ?? []).map((c) => [c.code, c.name])).entries()], [all]);
  const categories = useMemo(() => [...new Set(all.map((m) => m.category).filter(Boolean))].sort(), [all]);
  const shown = all.filter((m) => (!onlyFree || !m.recipe) && (!brand || (m.companies ?? []).some((c) => c.code === brand))
    && (!category || m.category === category) && (!q || matches(`${m.name} ${m.category} ${m.detail ?? ""}`, q)));
  const SIZE = 100;
  const pages = Math.max(1, Math.ceil(shown.length / SIZE));
  const at = Math.min(page, pages);
  useEffect(() => { setPage(1); }, [q, brand, category, onlyFree]);
  const free = all.filter((m) => !m.recipe).length;
  return (
    <Panel title={tr("Assign Menus")} description={tr("Every menu of the POS transactions of the branches and the recipe card it uses; several menus may share a card")}
      toolbar={<div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 basis-56"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" /><input className={cx(inputClass, "pl-9")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search menu, e.g. es kopi premium")} /></div>
        <select className={cx(inputClass, "w-auto")} value={brand} onChange={(e) => setBrand(e.target.value)} aria-label={tr("Brand")}>
          <option value="">{tr("All brands")}</option>{brandList.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
        </select>
        <select className={cx(inputClass, "w-auto max-w-[14rem]")} value={category} onChange={(e) => setCategory(e.target.value)} aria-label={tr("Category")}>
          <option value="">{tr("All categories")}</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <label className="flex h-10 items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} />{tr("Without a card only")}</label>
      </div>}
      footer={menus ? <>
        <span>{tr("{0} of {1} menus have a card", all.length - free, all.length)} · {tr("{0} shown", shown.length)}</span>
        {pages > 1 && <span className="flex items-center gap-2">
          <Button size="sm" variant="secondary" disabled={at <= 1} onClick={() => setPage(at - 1)}>‹</Button>
          <span className="tabular-nums">{at} / {pages}</span>
          <Button size="sm" variant="secondary" disabled={at >= pages} onClick={() => setPage(at + 1)}>›</Button>
        </span>}
      </> : undefined}>
      {!menus ? <SkeletonRows cols={5} /> : (
        <>
          {!recipes.length && <p className="mx-4 mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{tr("No recipe card yet: make the cards in step 1, then choose them here.")}</p>}
          {shown.length === 0 ? <Empty title={tr("No menu matches")} /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-sm">
                <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Menu")}</th><th className="px-4 py-2.5">{tr("Category")}</th><th className="px-4 py-2.5">{tr("Brand")}</th>
                  <th className="px-4 py-2.5 text-right">{tr("Sold 90 Days")}</th><th className="px-4 py-2.5">{tr("Recipe Card")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {shown.slice((at - 1) * SIZE, at * SIZE).map((m) => (
                    <tr key={m.id} className={busy === m.id ? "opacity-50" : ""}>
                      <td className="px-4 py-2">
                        <span className="font-medium text-slate-900">{m.name}</span>
                        {(m.kinds ?? []).filter((k) => k !== "menu").map((k) => <Badge key={k} tone="slate">{k === "package" ? tr("Package") : tr("Extra")}</Badge>)}
                        {m.lastSold && <span className="block text-[11px] text-slate-400">{tr("last sold {0}", m.lastSold)}</span>}
                      </td>
                      <td className="px-4 py-2 text-xs text-slate-600">{m.category}{m.detail && m.detail !== m.category ? <span className="block text-[11px] text-slate-400">{m.detail}</span> : null}</td>
                      <td className="px-4 py-2 text-xs text-slate-600">{brands(m)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{num(m.qty, 0)}</td>
                      <td className="w-64 px-4 py-2">
                        <select className={cx(inputClass, "h-9", !m.recipe && "text-slate-400")} value={m.recipe ?? ""} disabled={busy === m.id || !recipes.length} onChange={(e) => void assign(m, e.target.value)} aria-label={`${tr("Recipe Card")} ${m.name}`}>
                          <option value="">{tr("— No card —")}</option>{recipes.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- 3. additional items

function Extras() {
  const toast = useToast();
  const { items } = useCatalog();
  const [rows, setRows] = useState<Extra[] | null>(null);
  const blank: Omit<Extra, "id"> = { code: null, name: "", unit: "PCS", price: null, basis: "bill", qty: 1, note: null, isActive: true };
  const [edit, setEdit] = useState<(Omit<Extra, "id"> & { id?: number; qtyText: string; priceText: string }) | null>(null);
  const load = useCallback(() => { void call<{ data: Extra[] }>("/api/cost-control/sales-calc/extras").then((r) => setRows(r.data)); }, []);
  useEffect(() => { load(); }, [load]);
  const open = (x: Omit<Extra, "id"> & { id?: number }) => setEdit({ ...x, qtyText: String(x.qty).replace(".", ","), priceText: x.price != null ? String(x.price).replace(".", ",") : "" });
  const save = async () => {
    if (!edit) return;
    const { qtyText, priceText, ...rest } = edit;
    try {
      await call(edit.id ? `/api/cost-control/sales-calc/extras/${edit.id}` : "/api/cost-control/sales-calc/extras",
        { method: edit.id ? "PUT" : "POST", json: { ...rest, qty: parse(qtyText), price: parse(priceText) } });
      setEdit(null); load(); toast(tr("Saved"));
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const remove = async (x: Extra) => {
    if (!window.confirm(tr("Delete {0}?", x.name))) return;
    try { await call(`/api/cost-control/sales-calc/extras/${x.id}`, { method: "DELETE" }); load(); } catch (e) { toast((e as Error).message, "error"); }
  };
  const price = (x: Extra) => (x.code ? items.find((i) => i.code === x.code)?.price ?? null : x.price);
  const options = useMemo(() => items.map((i) => ({ value: i.code, label: i.name, hint: `${i.code} · ${i.unit}` })), [items]);
  return (
    <Panel title={tr("Additional Items")} description={tr("Items no menu records (cable ties, plastic bags …): counted per bill, per portion sold or per day of an outlet, and added to the planning, the usage and the COGS")}
      actions={<Button size="sm" onClick={() => open({ ...blank })}><Plus size={14} />{tr("Add Item")}</Button>}>
      {!rows ? <SkeletonRows cols={5} /> : rows.length === 0 ? (
        <Empty icon={<Package size={26} />} title={tr("No additional item yet")}><Button className="mt-3" onClick={() => open({ ...blank })}><Plus size={14} />{tr("Add Item")}</Button></Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Item")}</th><th className="px-4 py-2.5">{tr("Usage")}</th><th className="px-4 py-2.5 text-right">{tr("Price / Unit")}</th><th className="px-4 py-2.5">{tr("Status")}</th><th /></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((x) => (
                <tr key={x.id} className="cursor-pointer hover:bg-slate-50" onClick={() => open(x)}>
                  <td className="px-4 py-2"><span className="block font-medium text-slate-900">{x.name}</span><span className="text-[11px] text-slate-400">{x.code ?? tr("Typed by hand")}</span></td>
                  <td className="px-4 py-2 text-xs">{num(x.qty)} {x.unit} · {BASIS[x.basis]()}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{price(x) === null ? <Badge tone="amber">{tr("No price")}</Badge> : rp(price(x))}</td>
                  <td className="px-4 py-2">{x.isActive ? <Badge tone="green" dot>{tr("Active")}</Badge> : <Badge tone="slate">{tr("Inactive")}</Badge>}</td>
                  <td className="px-2"><button type="button" onClick={(e) => { e.stopPropagation(); void remove(x); }} className="rounded p-1.5 text-slate-400 hover:text-red-600" aria-label={tr("Delete")}><Trash2 size={15} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {edit && (
        <Drawer open onClose={() => setEdit(null)} title={edit.id ? edit.name : tr("Add Item")} description={tr("Additional Items")}
          footer={<div className="flex justify-end gap-2"><Button variant="secondary" onClick={() => setEdit(null)}>{tr("Cancel")}</Button><Button onClick={() => void save()}><Save size={15} />{tr("Save")}</Button></div>}>
          <div className="space-y-4 text-sm">
            <div className="inline-flex rounded-lg bg-slate-100 p-1">
              {[{ manual: false, label: tr("From the Item Master") }, { manual: true, label: tr("Typed by Hand") }].map((o) => (
                <button key={o.label} type="button" onClick={() => setEdit({ ...edit, code: o.manual ? null : edit.code ?? "" })}
                  className={cx("rounded-md px-3 py-1.5 text-xs font-medium", (edit.code === null) === o.manual ? "bg-white text-slate-900 shadow-sm" : "text-slate-500")}>{o.label}</button>
              ))}
            </div>
            {edit.code === null ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="text-xs font-medium text-slate-600 sm:col-span-2">{tr("Name")}<input className={cx(inputClass, "mt-1")} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={tr("e.g. Cable ties")} /></label>
                <label className="text-xs font-medium text-slate-600">{tr("Unit")}<input className={cx(inputClass, "mt-1")} value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} /></label>
                <label className="text-xs font-medium text-slate-600">{tr("Price per Unit (Rp)")}<input inputMode="decimal" className={cx(inputClass, "mt-1")} value={edit.priceText} onChange={(e) => setEdit({ ...edit, priceText: e.target.value })} /></label>
              </div>
            ) : (
              <div><p className="mb-1 text-xs font-medium text-slate-600">{tr("Item")}</p><Picker value={edit.code} options={options} placeholder={tr("Choose an item")}
                onPick={(v) => { const it = items.find((i) => i.code === v); setEdit({ ...edit, code: v, name: it?.name ?? "", unit: it?.unit ?? edit.unit }); }} /></div>
            )}
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-slate-600">{tr("Quantity")} ({edit.unit || "—"})<input inputMode="decimal" className={cx(inputClass, "mt-1")} value={edit.qtyText} onChange={(e) => setEdit({ ...edit, qtyText: e.target.value })} /></label>
              <label className="text-xs font-medium text-slate-600">{tr("Counted")}
                <select className={cx(inputClass, "mt-1")} value={edit.basis} onChange={(e) => setEdit({ ...edit, basis: e.target.value as Extra["basis"] })}>
                  {(["bill", "portion", "day"] as const).map((b) => <option key={b} value={b}>{BASIS[b]()}</option>)}
                </select>
              </label>
            </div>
            <label className="block text-xs font-medium text-slate-600">{tr("Note")}<input className={cx(inputClass, "mt-1")} value={edit.note ?? ""} onChange={(e) => setEdit({ ...edit, note: e.target.value || null })} /></label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600"><input type="checkbox" checked={edit.isActive} onChange={(e) => setEdit({ ...edit, isActive: e.target.checked })} />{tr("Active")}</label>
          </div>
        </Drawer>
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------- 4. calculator

function ReportView({ onGo }: { onGo: (s: Step) => void }) {
  const toast = useToast();
  // no filter at first (2026-11-02): the calculator loads once the sales period is chosen
  const [period, setPeriod] = useState<Period | null>(null);
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [horizon, setHorizon] = useState("");
  const [buffer, setBuffer] = useState("");
  const [view, setView] = useState<"cogs" | "mrp" | "usage">("cogs");
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [sheet, setSheet] = useState(false);
  const planned = horizon.trim() !== "";
  const h = Math.min(60, Math.max(1, Number(horizon) || 1));
  const b = Math.min(200, Math.max(0, Number(buffer) || 0));
  useEffect(() => { void call<Branch[]>("/api/branches?company=all").then(setBranches).catch(() => setBranches([])); }, []);
  useEffect(() => {
    if (!period) return;
    let alive = true;
    setData(null);
    setError(null);
    call<Report>(`/api/cost-control/sales-calc/report?dateFrom=${period.from}&dateTo=${period.to}&horizon=${h}&buffer=${b}${branch ? `&branch=${encodeURIComponent(branch)}` : ""}`)
      .then((d) => { if (alive) setData(d); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [period, branch, h, b, tick]);
  const t = period ? data?.total : undefined;
  const file = (what: string) => `${what} ${period?.from ?? ""} - ${period?.to ?? ""}`;
  const guard = (f: (d: Report) => Promise<void>) => async () => {
    if (!data || !period) { toast(tr("Choose the sales period in Filters first"), "error"); return; }
    try { await f(data); } catch (e) { toast((e as Error).message, "error"); }
  };
  const branchName = branches.find((x) => x.branch_code === branch)?.branch_name ?? branch;
  const chips: ActiveFilter[] = [
    ...(period ? [{ key: "p", label: `${dmy(period.from)} – ${dmy(period.to)}`, onRemove: () => { setPeriod(null); setData(null); } }] : []),
    ...(branch ? [{ key: "b", label: branchName, onRemove: () => setBranch("") }] : []),
    ...(planned ? [{ key: "h", label: tr("Plan {0} days + {1}% buffer", h, b), onRemove: () => { setHorizon(""); setBuffer(""); } }] : []),
  ];
  const outputs = [{ key: "cogs", label: tr("COGS Bahan Baku") }, { key: "mrp", label: tr("Material Required Planning") }, { key: "usage", label: tr("Usage Actual vs System") }] as const;
  return (
    <>
      {t && (
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={tr("Sales of Mapped Menus")} value={rp(t.sales)}><p>{tr("{0} menus with a card · {1} without", t.menusMapped, t.menusUnmapped)}</p></Stat>
          <Stat label={tr("COGS Bahan Baku")} emphasis value={rp(t.cogs)}><p>{tr("Ratio {0}", pct(t.ratio))}{t.extraCogs ? ` · ${tr("additional items {0}", rp(t.extraCogs))}` : ""}</p></Stat>
          <Stat label={tr("Usage System")} value={rp(t.systemValue)} />
          <Stat label={tr("Usage Actual (ESB)")} value={rp(t.actualValue)}>{t.actualValue ? <p>{tr("difference {0}", rp(t.actualValue - t.systemValue))}</p> : <p>{tr("needs SO awal & akhir of the branch")}</p>}</Stat>
        </StatStrip>
      )}
      {sheet && <CalcFilterSheet value={{ period: period ?? { from: wibDay(-6), to: wibDay(0) }, branch, horizon, buffer }} branches={branches} onClose={() => setSheet(false)}
        onApply={(f) => { setPeriod(f.period); setBranch(f.branch); setHorizon(f.horizon); setBuffer(f.buffer); setSheet(false); }} />}
      <Panel toolbar={
        <div className="space-y-3">
          <FilterToolbar filters={chips} onOpen={() => setSheet(true)}
            onClear={() => { setPeriod(null); setData(null); setBranch(""); setHorizon(""); setBuffer(""); }}
            extra={<div className="ml-auto"><ExcelExportMenu footer={period ? <>{branch ? branchName : tr("All branches")} · {dmy(period.from)} – {dmy(period.to)}</> : tr("Choose the sales period in Filters first")} choices={[
              { key: "cogs", label: tr("COGS Bahan Baku"), hint: tr("Per menu: sold, sales, HPP per portion, COGS and ratio"), icon: <Calculator size={16} />, tone: "bg-blue-50 text-blue-600", count: data ? data.menus.length : null,
                run: guard((d) => downloadXlsx({ fileName: file("COGS Bahan Baku"), sheet: "COGS", title: file("COGS Bahan Baku"), header: ["Menu", "Kartu Resep", "Terjual", "Sales", "HPP / Porsi", "COGS", "Rasio"],
                  rows: d.menus.map((m) => [m.name, m.recipeName, m.qty, m.sales, m.hpp, m.cogs, m.ratio]) })) },
              { key: "mrp", label: tr("Material Required Planning"), hint: tr("Materials to prepare for the planned days"), icon: <Package size={16} />, tone: "bg-violet-50 text-violet-600", count: data ? data.mrp.length : null,
                run: guard((d) => downloadXlsx({ fileName: file("Material Required Planning"), sheet: "MRP", title: file("Material Required Planning"), header: ["Kode", "Bahan", "Qty", "Satuan", "Nilai"],
                  rows: d.mrp.map((r) => [r.code, r.name, r.qty, r.unit, r.value]) })) },
              { key: "usage", label: tr("Usage Actual vs System"), hint: tr("Per material: system, actual (ESB), difference and value"), icon: <ListChecks size={16} />, tone: "bg-emerald-50 text-emerald-600", count: data ? data.usage.length : null,
                run: guard((d) => downloadXlsx({ fileName: file("Usage Actual vs System"), sheet: "Usage", title: file("Usage Actual vs System"), header: ["Kode", "Bahan", "Satuan", "System", "Actual", "Selisih", "Harga", "Nilai System", "Nilai Actual"],
                  rows: d.usage.map((r) => [r.code, r.name, r.unit, r.system, r.actual, r.variance, r.price, r.systemValue, r.actualValue]) })) },
            ]} /></div>} />
          <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">
            {outputs.map((o) => (
              <button key={o.key} type="button" role="tab" aria-selected={view === o.key} onClick={() => setView(o.key)}
                className={cx("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", view === o.key ? "border-blue-700 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800")}>{o.label}</button>
            ))}
          </div>
        </div>
      }>
        {!period ? (
          <Empty icon={<Calculator size={28} />} title={tr("Choose the sales period")}>
            <p className="max-w-md">{tr("The calculator reads the POS transactions of the period and branch you choose; fill the planned days for the Material Required Planning.")}</p>
            <Button className="mt-3" onClick={() => setSheet(true)}>{tr("Open Filters")}</Button>
          </Empty>
        ) : view === "mrp" && !planned ? (
          <Empty icon={<Package size={28} />} title={tr("Fill the planned days")}>
            <p className="max-w-md">{tr("Material Required Planning needs the days to plan for (and a buffer, optional) in Filters.")}</p>
            <Button className="mt-3" onClick={() => setSheet(true)}>{tr("Open Filters")}</Button>
          </Empty>
        ) : error ? <ErrorState message={error} onRetry={() => setTick((x) => x + 1)} /> : !data ? <SkeletonRows cols={6} /> : (
          <div className="overflow-x-auto">
            {data.unmapped.length > 0 && (
              <div className="mx-4 mt-3 flex flex-wrap items-center gap-2 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span className="flex-1">{tr("{0} menus sold have no recipe card yet and are not counted: {1}", data.unmapped.length, data.unmapped.slice(0, 6).map((m) => m.name).join(", "))}{data.unmapped.length > 6 ? "…" : ""}</span>
                <Button size="sm" variant="secondary" onClick={() => onGo("menus")}>{tr("Assign Menus")}</Button>
              </div>
            )}
            {view === "mrp" && (
              <table className="w-full min-w-[640px] text-sm">
                <caption className="px-4 py-2 text-left text-xs text-slate-500">{tr("Average daily sales of {0} days × {1} days + {2}% buffer, exploded through the cards (rounded up)", data.period.days, data.period.horizon, data.period.buffer)}</caption>
                <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Material")}</th><th className="px-4 py-2.5 text-right">{tr("Required")}</th><th className="px-4 py-2.5 text-right">{tr("Value")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.mrp.map((r) => (
                    <tr key={r.code ?? r.name} className={r.isStock ? "" : "text-slate-400"}>
                      <td className="px-4 py-2">{r.name}{r.code && <span className="ml-1 text-[11px] text-slate-400">{r.code}</span>}{r.extra && <Badge tone="cyan">{tr("Additional")}</Badge>}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{num(r.qty, 0)} {r.unit}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">{rp(r.value)}</td>
                    </tr>
                  ))}
                  {!data.mrp.length && <tr><td colSpan={3}><Empty title={tr("No sales of menus with a card in this period")} /></td></tr>}
                </tbody>
              </table>
            )}
            {view === "usage" && (
              <table className="w-full min-w-[820px] text-sm">
                <caption className="px-4 py-2 text-left text-xs text-slate-500">{tr("System = menus sold × recipe cards; Actual = SO awal + purchases − SO akhir of the branches with both ESB stock opname documents")}</caption>
                <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Material")}</th><th className="px-4 py-2.5 text-right">{tr("System")}</th><th className="px-4 py-2.5 text-right">{tr("Actual")}</th>
                  <th className="px-4 py-2.5 text-right">{tr("Difference")}</th><th className="px-4 py-2.5 text-right">{tr("Value System")}</th><th className="px-4 py-2.5 text-right">{tr("Value Actual")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.usage.map((r) => (
                    <tr key={r.code ?? r.name} className={r.isStock ? "" : "text-slate-400"}>
                      <td className="px-4 py-2">{r.name}{r.code && <span className="ml-1 text-[11px] text-slate-400">{r.code}</span>}{r.extra && <Badge tone="cyan">{tr("Additional")}</Badge>}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{num(r.system)} {r.unit}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{num(r.actual)}</td>
                      <td className={cx("px-4 py-2 text-right tabular-nums", r.variance !== null && r.variance > 0 ? "text-red-700" : r.variance !== null && r.variance < 0 ? "text-emerald-700" : "")}>{r.variance === null ? "—" : `${r.variance > 0 ? "+" : ""}${num(r.variance)}`}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">{rp(r.systemValue)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-slate-600">{rp(r.actualValue)}</td>
                    </tr>
                  ))}
                  {!data.usage.length && <tr><td colSpan={6}><Empty title={tr("No sales of menus with a card in this period")} /></td></tr>}
                </tbody>
              </table>
            )}
            {view === "cogs" && (
              <>
                <table className="w-full min-w-[760px] text-sm">
                  <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Menu")}</th><th className="px-4 py-2.5">{tr("Recipe Card")}</th><th className="px-4 py-2.5 text-right">{tr("Sold")}</th>
                    <th className="px-4 py-2.5 text-right">{tr("Sales")}</th><th className="px-4 py-2.5 text-right">{tr("HPP / Portion")}</th><th className="px-4 py-2.5 text-right">COGS</th><th className="px-4 py-2.5 text-right">{tr("Ratio")}</th></tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.menus.map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-2 font-medium text-slate-900">{m.name}</td><td className="px-4 py-2 text-xs text-slate-600">{m.recipeName}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{num(m.qty, 0)}</td><td className="px-4 py-2 text-right tabular-nums">{rp(m.sales)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{m.hpp === null ? <Badge tone="amber">{tr("Price missing")}</Badge> : rp(m.hpp)}</td>
                        <td className="px-4 py-2 text-right tabular-nums">{rp(m.cogs)}</td><td className="px-4 py-2 text-right tabular-nums">{pct(m.ratio)}</td>
                      </tr>
                    ))}
                    {!data.menus.length && <tr><td colSpan={7}><Empty icon={<Calculator size={26} />} title={tr("No sales of menus with a card in this period")}>{tr("Make recipe cards (step 1) and assign the menus (step 2).")}</Empty></td></tr>}
                  </tbody>
                </table>
                {!!data.extras?.length && (
                  <table className="mt-2 w-full min-w-[760px] text-sm">
                    <caption className="px-4 py-2 text-left text-xs font-semibold text-slate-700">{tr("Additional Items (Outside the Recipe Cards)")}</caption>
                    <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Item")}</th><th className="px-4 py-2.5">{tr("Basis")}</th><th className="px-4 py-2.5 text-right">{tr("Used")}</th><th className="px-4 py-2.5 text-right">{tr("Value")}</th></tr></thead>
                    <tbody className="divide-y divide-slate-100">
                      {data.extras.map((e) => (
                        <tr key={e.id}>
                          <td className="px-4 py-2">{e.name}{e.code && <span className="ml-1 text-[11px] text-slate-400">{e.code}</span>}</td>
                          <td className="px-4 py-2 text-xs text-slate-600">{num(e.qty)} {e.unit} {BASIS[e.basis]()} × {num(e.count, 0)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{num(e.used)} {e.unit}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{rp(data.usage.find((u) => (u.code ?? u.name) === (e.code ?? e.name))?.systemValue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </>
            )}
          </div>
        )}
      </Panel>
    </>
  );
}

type CalcFilters = { period: Period; branch: string; horizon: string; buffer: string };

/** The filters of the calculator in one sheet: the sales period, the branch and the planning of the MRP. */
function CalcFilterSheet({ value, branches, onApply, onClose }: { value: CalcFilters; branches: Branch[]; onApply: (f: CalcFilters) => void; onClose: () => void }) {
  const [d, setD] = useState<CalcFilters>(value);
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)}
      onReset={() => setD({ period: { from: wibDay(-6), to: wibDay(0) }, branch: "", horizon: "", buffer: "" })}>
      <FilterSection title={tr("Sales Period")} hint={tr("The POS transactions of the branches in this period")}>
        <PeriodField value={d.period} onChange={(period) => setD({ ...d, period })} maxDays={92} />
      </FilterSection>
      <FilterSection title={tr("Branch")}>
        <select className={inputClass} value={d.branch} onChange={(e) => setD({ ...d, branch: e.target.value })} aria-label={tr("Branch")}>
          <option value="">{tr("All branches")}</option>{branches.map((x) => <option key={x.branch_code} value={x.branch_code}>{x.branch_name}</option>)}
        </select>
      </FilterSection>
      <FilterSection title={tr("Material Required Planning")} hint={tr("Average daily sales × the days planned, plus a buffer")}>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-xs font-medium text-slate-600">{tr("Plan for (days)")}<input inputMode="numeric" className={cx(inputClass, "mt-1")} value={d.horizon} placeholder={tr("e.g. 7")} onChange={(e) => setD({ ...d, horizon: e.target.value.replace(/[^0-9]/g, "") })} /></label>
          <label className="text-xs font-medium text-slate-600">{tr("Buffer (%)")}<input inputMode="numeric" className={cx(inputClass, "mt-1")} value={d.buffer} placeholder={tr("e.g. 10")} onChange={(e) => setD({ ...d, buffer: e.target.value.replace(/[^0-9]/g, "") })} /></label>
        </div>
      </FilterSection>
    </FilterSheet>
  );
}
