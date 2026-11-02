"use client";

// Sales Calculator by Menu (Cost Control, page cc.sales-calc; integrated_portal_be app/menu_costing.py, migration 056):
// the recipe card of every menu as the production calculator (raw materials in their base unit, WIP / premix in grams
// exploded through their active recipe), the ESB POS menus assigned to a card, and from the POS sales of a period:
// 1. Material Required Planning, 2. Usage actual (ESB) vs system (sales × cards), 3. COGS bahan baku (Pricelist items).

import { BookOpen, Download, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, inputClass, Page, Panel, SkeletonRows, theadClass, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Segmented } from "@/so/ui/Simple";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { PeriodField, type Period, wibDay } from "@/so/ui/Filters";
import { call } from "@/so/features/checkin/checkin";
import { SearchSelect } from "@/cotr/ui";
import { downloadXlsx } from "@/lib/xlsx";
import { tr } from "@/lib/i18n";

type Line = { type: "item" | "wip"; code: string; name: string; qty: number; unit: string };
type Recipe = { code: string; name: string; category: string | null; lines: Line[]; note: string | null; isActive: boolean; menus: { id: string; name: string }[] };
type Menu = { id: string; name: string; category: string; qty: number; recipe: string | null };
type Item = { code: string; name: string; unit: string; category: string | null; price: number | null };
type Wip = { code: string; name: string; components: { code: string | null; name: string; unit: string; perGram: number }[] };
type Report = {
  period: { from: string; to: string; days: number; horizon: number; buffer: number };
  menus: { id: string; name: string; recipe: string; recipeName: string; qty: number; sales: number; hpp: number | null; cogs: number | null; ratio: number | null }[];
  unmapped: { id: string; name: string; category: string; qty: number; sales: number }[];
  usage: { code: string | null; name: string; unit: string; isStock: boolean; system: number; actual: number | null; variance: number | null; price: number | null; systemValue: number | null; actualValue: number | null }[];
  mrp: { code: string | null; name: string; unit: string; isStock: boolean; qty: number; value: number | null }[];
  total: { sales: number; cogs: number; ratio: number | null; menusMapped: number; menusUnmapped: number; unpriced: number; systemValue: number; actualValue: number };
};
type Branch = { branch_code: string; branch_name: string };

const num = (n: number | null | undefined, d = 2) => (n === null || n === undefined ? "—" : n.toLocaleString("id-ID", { maximumFractionDigits: d }));
const rp = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `Rp ${Math.round(n).toLocaleString("id-ID")}`);
const pct = (n: number | null | undefined) => (n === null || n === undefined ? "—" : `${(n * 100).toFixed(1)}%`);

export default function SalesCalculatorPage() {
  const [tab, setTab] = useState<"report" | "recipes" | "menus">("report");
  return (
    <Page title={tr("Sales calculator by menu")} subtitle={tr("Recipe cards per menu, the menus assigned to them, and from the POS sales: material planning, usage actual vs system and COGS bahan baku")}>
      <Segmented label={tr("Section")} value={tab} onChange={setTab} options={[
        { value: "report", label: tr("Calculator") }, { value: "recipes", label: tr("Recipe cards") }, { value: "menus", label: tr("Assign menus") }]} />
      {tab === "report" && <ReportView />}
      {tab === "recipes" && <Recipes />}
      {tab === "menus" && <MenuAssign />}
    </Page>
  );
}

function ReportView() {
  const toast = useToast();
  const [period, setPeriod] = useState<Period>({ from: wibDay(-6), to: wibDay(0) });
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [horizon, setHorizon] = useState(7);
  const [buffer, setBuffer] = useState(10);
  const [view, setView] = useState<"mrp" | "usage" | "cogs">("cogs");
  const [data, setData] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => { void call<Branch[]>("/api/branches?company=all").then(setBranches).catch(() => setBranches([])); }, []);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    call<Report>(`/api/cost-control/sales-calc/report?dateFrom=${period.from}&dateTo=${period.to}&horizon=${horizon}&buffer=${buffer}${branch ? `&branch=${encodeURIComponent(branch)}` : ""}`)
      .then((d) => { if (alive) setData(d); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [period, branch, horizon, buffer, tick]);
  const t = data?.total;
  const exportView = async () => {
    if (!data) return;
    const name = `${view === "mrp" ? "MRP" : view === "usage" ? "Usage actual vs system" : "COGS bahan baku"} ${period.from} - ${period.to}`;
    try {
      if (view === "mrp") await downloadXlsx({ fileName: name, sheet: "MRP", title: name, header: ["Kode", "Bahan", "Qty", "Satuan", "Nilai"], rows: data.mrp.map((r) => [r.code, r.name, r.qty, r.unit, r.value]) });
      else if (view === "usage") await downloadXlsx({ fileName: name, sheet: "Usage", title: name, header: ["Kode", "Bahan", "Satuan", "System", "Actual", "Selisih", "Harga", "Nilai system", "Nilai actual"],
        rows: data.usage.map((r) => [r.code, r.name, r.unit, r.system, r.actual, r.variance, r.price, r.systemValue, r.actualValue]) });
      else await downloadXlsx({ fileName: name, sheet: "COGS", title: name, header: ["Menu", "Resep", "Terjual", "Sales", "HPP / porsi", "COGS", "Rasio"],
        rows: data.menus.map((m) => [m.name, m.recipeName, m.qty, m.sales, m.hpp, m.cogs, m.ratio]) });
    } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <>
      <StatStrip label={tr("Summary")} columns={4}>
        <Stat label={tr("Sales of mapped menus")} value={t ? rp(t.sales) : <StatSkeleton />}>{t && <p>{tr("{0} menus with a card · {1} without", t.menusMapped, t.menusUnmapped)}</p>}</Stat>
        <Stat label={tr("COGS bahan baku")} emphasis value={t ? rp(t.cogs) : <StatSkeleton />}>{t && <p>{tr("ratio {0}", pct(t.ratio))}{t.unpriced ? ` · ${tr("{0} cards miss a price", t.unpriced)}` : ""}</p>}</Stat>
        <Stat label={tr("Usage system")} value={t ? rp(t.systemValue) : <StatSkeleton />} />
        <Stat label={tr("Usage actual (ESB)")} value={t ? rp(t.actualValue) : <StatSkeleton />}>{t && t.systemValue ? <p>{tr("difference {0}", rp(t.actualValue - t.systemValue))}</p> : null}</Stat>
      </StatStrip>
      <Panel toolbar={
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <PeriodField value={period} onChange={setPeriod} maxDays={92} />
            <select className={inputClass} value={branch} onChange={(e) => setBranch(e.target.value)} aria-label={tr("Branch")}>
              <option value="">{tr("All branches")}</option>{branches.map((b) => <option key={b.branch_code} value={b.branch_code}>{b.branch_name}</option>)}
            </select>
            <label className="text-xs text-slate-500">{tr("Plan for (days)")}<input type="number" min={1} max={60} className={cx(inputClass, "mt-1")} value={horizon} onChange={(e) => setHorizon(Math.max(1, Number(e.target.value) || 1))} /></label>
            <label className="text-xs text-slate-500">{tr("Buffer (%)")}<input type="number" min={0} max={200} className={cx(inputClass, "mt-1")} value={buffer} onChange={(e) => setBuffer(Math.max(0, Number(e.target.value) || 0))} /></label>
            <div className="flex items-end gap-2"><Button variant="secondary" onClick={() => setTick((x) => x + 1)}><RefreshCw size={15} /></Button><Button variant="secondary" disabled={!data} onClick={() => void exportView()}><Download size={15} />Excel</Button></div>
          </div>
          <Segmented label={tr("Output")} value={view} onChange={setView} options={[
            { value: "mrp", label: tr("Material required planning") }, { value: "usage", label: tr("Usage actual vs system") }, { value: "cogs", label: tr("COGS bahan baku") }]} />
        </div>
      }>
        {error ? <ErrorState message={error} onRetry={() => setTick((x) => x + 1)} /> : !data ? <SkeletonRows cols={6} /> : (
          <div className="overflow-x-auto">
            {data.unmapped.length > 0 && view !== "usage" && (
              <p className="mx-4 mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {tr("{0} menus sold have no recipe card yet and are not counted (assign them in Assign menus): {1}", data.unmapped.length, data.unmapped.slice(0, 8).map((m) => m.name).join(", "))}{data.unmapped.length > 8 ? "…" : ""}
              </p>
            )}
            {view === "mrp" && (
              <table className="w-full min-w-[640px] text-sm">
                <caption className="px-4 py-2 text-left text-xs text-slate-500">{tr("Average daily sales of {0} days × {1} days + {2}% buffer, exploded through the cards (rounded up)", data.period.days, data.period.horizon, data.period.buffer)}</caption>
                <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Material")}</th><th className="px-4 py-2.5 text-right">{tr("Required")}</th><th className="px-4 py-2.5 text-right">{tr("Value")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.mrp.map((r) => (
                    <tr key={r.code ?? r.name} className={r.isStock ? "" : "text-slate-400"}>
                      <td className="px-4 py-2">{r.name}{r.code && <span className="ml-1 text-[11px] text-slate-400">{r.code}</span>}</td>
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
                <caption className="px-4 py-2 text-left text-xs text-slate-500">{tr("System = menus sold × recipe cards; Actual = ESB actual usage of the item (stock opname periods starting in the range)")}</caption>
                <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Material")}</th><th className="px-4 py-2.5 text-right">{tr("System")}</th><th className="px-4 py-2.5 text-right">{tr("Actual")}</th>
                  <th className="px-4 py-2.5 text-right">{tr("Difference")}</th><th className="px-4 py-2.5 text-right">{tr("Value system")}</th><th className="px-4 py-2.5 text-right">{tr("Value actual")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.usage.map((r) => (
                    <tr key={r.code ?? r.name} className={r.isStock ? "" : "text-slate-400"}>
                      <td className="px-4 py-2">{r.name}{r.code && <span className="ml-1 text-[11px] text-slate-400">{r.code}</span>}</td>
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
              <table className="w-full min-w-[760px] text-sm">
                <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Menu")}</th><th className="px-4 py-2.5">{tr("Recipe card")}</th><th className="px-4 py-2.5 text-right">{tr("Sold")}</th>
                  <th className="px-4 py-2.5 text-right">{tr("Sales")}</th><th className="px-4 py-2.5 text-right">{tr("HPP / portion")}</th><th className="px-4 py-2.5 text-right">COGS</th><th className="px-4 py-2.5 text-right">{tr("Ratio")}</th></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {data.menus.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-2 font-medium text-slate-900">{m.name}</td><td className="px-4 py-2 text-xs text-slate-600">{m.recipeName}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{num(m.qty, 0)}</td><td className="px-4 py-2 text-right tabular-nums">{rp(m.sales)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{m.hpp === null ? <Badge tone="amber">{tr("Price missing")}</Badge> : rp(m.hpp)}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{rp(m.cogs)}</td><td className="px-4 py-2 text-right tabular-nums">{pct(m.ratio)}</td>
                    </tr>
                  ))}
                  {!data.menus.length && <tr><td colSpan={7}><Empty title={tr("No sales of menus with a card in this period")} /></td></tr>}
                </tbody>
              </table>
            )}
          </div>
        )}
      </Panel>
    </>
  );
}

function useCatalog() {
  const [items, setItems] = useState<Item[]>([]);
  const [wips, setWips] = useState<Wip[]>([]);
  useEffect(() => {
    void call<{ data: Item[] }>("/api/cost-control/pricelist").then((r) => setItems(r.data)).catch(() => setItems([]));
    void call<{ data: Wip[] }>("/api/cost-control/sales-calc/wips").then((r) => setWips(r.data)).catch(() => setWips([]));
  }, []);
  return { items, wips };
}

function Recipes() {
  const [rows, setRows] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Recipe | "new" | null>(null);
  const [q, setQ] = useState("");
  const load = useCallback(() => { call<{ data: Recipe[] }>("/api/cost-control/sales-calc/recipes").then((r) => setRows(r.data)).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const shown = (rows ?? []).filter((r) => !q || `${r.name} ${r.code} ${r.category ?? ""}`.toLowerCase().includes(q.toLowerCase()));
  return (
    <Panel title={tr("Recipe cards")} description={tr("What one portion of a menu uses: raw materials and WIP / premix (grams, through the production calculator)")}
      actions={<Button size="sm" onClick={() => setEdit("new")}><Plus size={14} />{tr("New card")}</Button>}
      toolbar={<input className={cx(inputClass, "sm:max-w-xs")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search card")} />}>
      {error ? <ErrorState message={error} onRetry={load} /> : !rows ? <SkeletonRows cols={4} /> : shown.length === 0 ? <Empty icon={<BookOpen size={26} />} title={tr("No recipe card yet")} /> : (
        <table className="w-full text-sm">
          <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Card")}</th><th className="px-4 py-2.5">{tr("Category")}</th><th className="px-4 py-2.5">{tr("Components")}</th><th className="px-4 py-2.5">{tr("Menus")}</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {shown.map((r) => (
              <tr key={r.code} className="cursor-pointer hover:bg-slate-50" onClick={() => setEdit(r)}>
                <td className="px-4 py-2"><span className="block font-medium text-slate-900">{r.name}{!r.isActive && <Badge tone="slate">{tr("Inactive")}</Badge>}</span><span className="text-[11px] text-slate-400">{r.code}</span></td>
                <td className="px-4 py-2 text-xs text-slate-600">{r.category ?? "—"}</td>
                <td className="max-w-[22rem] truncate px-4 py-2 text-xs text-slate-600">{r.lines.map((l) => `${l.name} ${num(l.qty)} ${l.unit}`).join(" · ")}</td>
                <td className="px-4 py-2 text-xs">{r.menus.length ? tr("{0} menus", r.menus.length) : <Badge tone="amber">{tr("No menu yet")}</Badge>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {edit && <RecipeDrawer recipe={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </Panel>
  );
}

function RecipeDrawer({ recipe, onClose, onSaved }: { recipe: Recipe | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { items, wips } = useCatalog();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [d, setD] = useState<Recipe>(() => recipe ?? { code: "", name: "", category: "", lines: [], note: "", isActive: true, menus: [] });
  const [busy, setBusy] = useState(false);
  useEffect(() => { void call<{ data: Menu[] }>("/api/cost-control/sales-calc/menus").then((r) => setMenus(r.data)).catch(() => setMenus([])); }, []);
  const price = useMemo(() => new Map(items.map((i) => [i.code, i.price])), [items]);
  const hpp = useMemo(() => {
    let total = 0;
    for (const l of d.lines) {
      if (l.type === "item") { const p = price.get(l.code); if (p == null) return null; total += p * l.qty; continue; }
      const w = wips.find((x) => x.code === l.code);
      if (!w) return null;
      for (const c of w.components) { if (!c.code) continue; const p = price.get(c.code); if (p == null) return null; total += p * l.qty * c.perGram; }
    }
    return total;
  }, [d.lines, price, wips]);
  const options = [...wips.map((w) => ({ value: `wip:${w.code}`, label: w.name, hint: tr("WIP / premix (gram)") })),
    ...items.map((i) => ({ value: `item:${i.code}`, label: i.name, hint: `${i.code} · ${i.unit}` }))];
  const setLine = (i: number, patch: Partial<Line>) => setD({ ...d, lines: d.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) });
  const pick = (i: number, v: string | null) => {
    if (!v) return;
    const at = v.indexOf(":");
    const type = v.slice(0, at) as "item" | "wip";
    const code = v.slice(at + 1);
    const it = type === "item" ? items.find((x) => x.code === code) : null;
    const w = type === "wip" ? wips.find((x) => x.code === code) : null;
    setLine(i, { type, code, name: it?.name ?? w?.name ?? code, unit: type === "wip" ? "GR" : it?.unit ?? "" });
  };
  const save = async () => {
    setBusy(true);
    try {
      await call(recipe ? `/api/cost-control/sales-calc/recipes/${encodeURIComponent(recipe.code)}` : "/api/cost-control/sales-calc/recipes",
        { method: recipe ? "PUT" : "POST", json: d });
      toast(tr("Saved"));
      onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const remove = async () => {
    if (!recipe || !window.confirm(tr("Delete the card {0}? Its menus become unassigned.", recipe.name))) return;
    try { await call(`/api/cost-control/sales-calc/recipes/${encodeURIComponent(recipe.code)}`, { method: "DELETE" }); onSaved(); } catch (e) { toast((e as Error).message, "error"); }
  };
  const assigned = new Set(d.menus.map((m) => m.id));
  return (
    <Drawer open onClose={onClose} size="lg" title={recipe ? recipe.name : tr("New card")} description={tr("One portion of the menu")}
      footer={<div className="flex justify-end gap-2">
        {recipe && <Button variant="ghost" className="mr-auto text-red-600" onClick={() => void remove()}><Trash2 size={14} />{tr("Delete")}</Button>}
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!d.code.trim() || !d.name.trim()} onClick={() => void save()}><Save size={15} />{tr("Save")}</Button>
      </div>}>
      <div className="space-y-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-slate-600">{tr("Code")}<input className={cx(inputClass, "mt-1")} value={d.code} onChange={(e) => setD({ ...d, code: e.target.value })} placeholder="MN-MATCHA-ICE" /></label>
          <label className="text-xs text-slate-600 sm:col-span-2">{tr("Name")}<input className={cx(inputClass, "mt-1")} value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} /></label>
          <label className="text-xs text-slate-600">{tr("Category")}<input className={cx(inputClass, "mt-1")} value={d.category ?? ""} onChange={(e) => setD({ ...d, category: e.target.value })} placeholder="Coffee" /></label>
          <label className="flex items-end gap-2 pb-2 text-xs text-slate-600"><input type="checkbox" checked={d.isActive} onChange={(e) => setD({ ...d, isActive: e.target.checked })} />{tr("Active")}</label>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-700">{tr("Components per portion")}</p>
          <div className="space-y-2">
            {d.lines.map((l, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="min-w-0 flex-1"><SearchSelect value={l.code ? `${l.type}:${l.code}` : ""} options={options} onChange={(v) => pick(i, v)} placeholder={tr("Raw material or WIP")} /></div>
                <input inputMode="decimal" className={cx(inputClass, "h-10 w-24 text-right")} value={l.qty || ""} onChange={(e) => setLine(i, { qty: Number(e.target.value.replace(",", ".")) || 0 })} aria-label={tr("Qty")} />
                <span className="w-12 text-xs text-slate-500">{l.unit}</span>
                <button type="button" aria-label={tr("Delete")} onClick={() => setD({ ...d, lines: d.lines.filter((_, j) => j !== i) })} className="rounded p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={15} /></button>
              </div>
            ))}
            <Button size="sm" variant="secondary" onClick={() => setD({ ...d, lines: [...d.lines, { type: "item", code: "", name: "", qty: 0, unit: "" }] })}><Plus size={14} />{tr("Add component")}</Button>
          </div>
          <p className="mt-2 text-xs text-slate-500">{tr("HPP per portion")}: <span className="font-semibold text-slate-900">{hpp === null ? tr("fill the prices in Pricelist items") : rp(hpp)}</span></p>
        </div>
        <div>
          <p className="mb-1 text-xs font-semibold text-slate-700">{tr("ESB menus with this card")} ({d.menus.length})</p>
          <div className="max-h-64 overflow-auto rounded-xl border border-slate-200">
            {menus.map((m) => (
              <label key={m.id} className="flex items-center gap-2 border-b border-slate-100 px-3 py-1.5 text-xs last:border-0">
                <input type="checkbox" checked={assigned.has(m.id)}
                  onChange={(e) => setD({ ...d, menus: e.target.checked ? [...d.menus, { id: m.id, name: m.name }] : d.menus.filter((x) => x.id !== m.id) })} />
                <span className="flex-1">{m.name} <span className="text-slate-400">· {m.category}</span></span>
                {m.recipe && m.recipe !== d.code && <Badge tone="amber">{m.recipe}</Badge>}
                <span className="tabular-nums text-slate-400">{num(m.qty, 0)}</span>
              </label>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

function MenuAssign() {
  const toast = useToast();
  const [menus, setMenus] = useState<Menu[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [q, setQ] = useState("");
  const [onlyFree, setOnlyFree] = useState(true);
  const load = useCallback(() => {
    void call<{ data: Menu[] }>("/api/cost-control/sales-calc/menus").then((r) => setMenus(r.data));
    void call<{ data: Recipe[] }>("/api/cost-control/sales-calc/recipes").then((r) => setRecipes(r.data));
  }, []);
  useEffect(() => { load(); }, [load]);
  const assign = async (m: Menu, code: string) => {
    const target = recipes.find((r) => r.code === code);
    const prev = recipes.find((r) => r.code === m.recipe);
    try {
      if (prev && prev.code !== code) await call(`/api/cost-control/sales-calc/recipes/${encodeURIComponent(prev.code)}`, { method: "PUT", json: { ...prev, menus: prev.menus.filter((x) => x.id !== m.id) } });
      if (target) await call(`/api/cost-control/sales-calc/recipes/${encodeURIComponent(target.code)}`, { method: "PUT", json: { ...target, menus: [...target.menus.filter((x) => x.id !== m.id), { id: m.id, name: m.name }] } });
      load();
    } catch (e) { toast((e as Error).message, "error"); }
  };
  const shown = (menus ?? []).filter((m) => (!onlyFree || !m.recipe) && (!q || `${m.name} ${m.category}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <Panel title={tr("Assign menus")} description={tr("The ESB POS menus sold in the last 90 days and the recipe card each one uses; several menus may share a card")}
      toolbar={<div className="flex flex-wrap items-center gap-3">
        <input className={cx(inputClass, "sm:max-w-xs")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search menu")} />
        <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} />{tr("Without a card only")}</label>
      </div>}>
      {!menus ? <SkeletonRows cols={4} /> : shown.length === 0 ? <Empty title={onlyFree ? tr("Every menu has a card") : tr("No menu matches")} /> : (
        <table className="w-full text-sm">
          <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Menu")}</th><th className="px-4 py-2.5">{tr("Category")}</th><th className="px-4 py-2.5 text-right">{tr("Sold 90 days")}</th><th className="px-4 py-2.5">{tr("Recipe card")}</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {shown.slice(0, 300).map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 font-medium text-slate-900">{m.name}</td><td className="px-4 py-2 text-xs text-slate-600">{m.category}</td>
                <td className="px-4 py-2 text-right tabular-nums">{num(m.qty, 0)}</td>
                <td className="w-72 px-4 py-2">
                  <select className={cx(inputClass, "h-9")} value={m.recipe ?? ""} onChange={(e) => void assign(m, e.target.value)} aria-label={`${tr("Recipe card")} ${m.name}`}>
                    <option value="">—</option>{recipes.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
