"use client";

// Sales Calculator by Menu (Cost Control, page cc.sales-calc; integrated_portal_be app/menu_costing.py, migrations 056-057).
// Four steps: 1. Recipe Cards — what one portion of a menu uses (raw materials and packaging of the item master, WIP /
// premix in grams through the Production Calculator, items typed by hand); 2. Assign Menus — the ESB POS menus sold by
// the branches and the card each one uses; 3. Additional Items — supplies no menu records (cable ties, plastic …) per
// bill, portion or outlet-day; 4. Calculator — from the POS transactions of the branches: Material Required Planning,
// Usage Actual vs System (ESB stock opname + purchases) and COGS Bahan Baku (Pricelist Items).

import { BookOpen, CalendarDays, Calculator, Check, ChevronDown, ChevronRight, CupSoda, FlaskConical, Layers, ListChecks, Package, PenLine, Plus, Receipt, Save, Search, Store, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, fmtNumber, inputClass, Page, PageNav, Panel, SkeletonRows, theadClass, usePaged, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatStrip } from "@/so/ui/StatStrip";
import { type ActiveFilter, FilterToolbar, type Period, dmy, wibDay } from "@/so/ui/Filters";
import { ComboFilter, FilterRow, MonitorFilterSheet, QuickPeriod, Segments } from "@/so/ui/MonitorFilters";
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
  const p = progress;
  const steps: { key: Step; label: string; hint: string; icon: typeof BookOpen; status: string | null; done: boolean; share?: number }[] = [
    { key: "recipes", label: tr("Recipe Cards"), hint: tr("Components per portion"), icon: BookOpen, status: p ? tr("{0} cards", p.cards) : null, done: !!p?.cards },
    { key: "menus", label: tr("Assign Menus"), hint: tr("ESB menus to a card"), icon: ListChecks, status: p ? tr("{0} of {1} menus", p.mapped, p.menus) : null,
      done: !!p && p.menus > 0 && p.mapped === p.menus, share: p && p.menus ? p.mapped / p.menus : undefined },
    { key: "extras", label: tr("Additional Items"), hint: tr("Outside the cards"), icon: Package, status: p ? tr("{0} active", p.extras) : null, done: !!p?.extras },
    { key: "report", label: tr("Calculator"), hint: tr("MRP, usage & COGS"), icon: Calculator, status: null, done: false },
  ];
  return (
    <Page title={tr("Sales Calculator by Menu")} subtitle={tr("Recipe cards per menu and, from the POS transactions of every branch: material planning, actual vs system usage and COGS")}>
      <nav aria-label={tr("Steps")} className="overflow-hidden rounded-xl border border-neutral-200/80 bg-white shadow-sm">
        <ol className="flex overflow-x-auto">
          {steps.map((s, i) => {
            const on = step === s.key;
            const Icon = s.icon;
            return (
              <li key={s.key} className="relative min-w-[12.5rem] flex-1 border-r border-neutral-100 last:border-r-0">
                <button type="button" onClick={() => setStep(s.key)} aria-current={on ? "step" : undefined}
                  className={cx("flex h-full w-full items-center gap-3 px-4 py-3.5 text-left transition-colors", on ? "bg-brand-50/70" : "hover:bg-neutral-50")}>
                  <span className={cx("relative flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold transition",
                    on ? "bg-brand-700 text-white ring-4 ring-brand-100" : s.done ? "bg-emerald-600 text-white" : "border-2 border-neutral-200 bg-white text-neutral-500")}>
                    {s.done && !on ? <Check size={18} strokeWidth={3} /> : <Icon size={17} />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx("block text-[10px] font-semibold uppercase tracking-[0.14em]", on ? "text-brand-700" : "text-neutral-400")}>{tr("Step {0}", i + 1)}</span>
                    <span className={cx("block truncate text-sm font-semibold", on ? "text-brand-900" : "text-neutral-800")}>{s.label}</span>
                    <span className="block truncate text-[11px] text-neutral-500">{s.status ?? s.hint}</span>
                    {s.share !== undefined && (
                      <span className="mt-1 block h-1 overflow-hidden rounded-full bg-neutral-100"><span className={cx("block h-full rounded-full", s.done ? "bg-emerald-500" : "bg-brand-600")} style={{ width: `${Math.round(s.share * 100)}%` }} /></span>
                    )}
                  </span>
                </button>
                {on && <span className="absolute inset-x-0 bottom-0 h-0.5 bg-brand-700" aria-hidden />}
              </li>
            );
          })}
        </ol>
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
        <span className={cx("truncate", !current && "text-neutral-400")}>{current ? current.label : placeholder}</span>
        <ChevronDown size={15} className="flex-shrink-0 text-neutral-400" />
      </button>
      {open && (
        <div className="absolute left-0 z-30 mt-1 w-[min(26rem,85vw)] overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-xl">
          <div className="relative border-b border-neutral-100 p-2">
            <Search size={14} className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search name or code")} className={cx(inputClass, "h-9 pl-8")} />
          </div>
          <ul className="max-h-72 overflow-y-auto py-1">
            {shown.map((o) => (
              <li key={o.value}>
                <button type="button" onClick={() => { onPick(o.value); setOpen(false); setQ(""); }}
                  className={cx("flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50", o.value === value && "bg-brand-50 text-brand-800")}>
                  <span className="truncate">{o.label}</span>{o.hint && <span className="flex-shrink-0 text-[11px] text-neutral-400">{o.hint}</span>}
                </button>
              </li>
            ))}
            {!shown.length && <li className="px-3 py-4 text-center text-xs text-neutral-400">{tr("No match")}</li>}
            {all.length > shown.length && <li className="px-3 py-2 text-center text-[11px] text-neutral-400">{tr("{0} more — type to narrow down", all.length - shown.length)}</li>}
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

/** cost of one portion line (null while a price is missing); WIP / premix through the grams of its components */
function lineCost(l: { type: Kind; code: string; qty: number; price?: number | null }, price: Map<string, number | null>, wips: Wip[]): number | null {
  if (l.type === "other") return l.price == null ? null : l.price * l.qty;
  if (l.type === "item") { const p = price.get(l.code); return p == null ? null : p * l.qty; }
  const w = wips.find((x) => x.code === l.code);
  if (!w) return null;
  let total = 0;
  for (const c of w.components) { if (!c.code) continue; const p = price.get(c.code); if (p == null) return null; total += p * l.qty * c.perGram; }
  return total;
}
const KIND_DOT: Record<Kind, string> = { item: "bg-brand-500", wip: "bg-violet-500", other: "bg-amber-500" };
const KIND_ICON: Record<Kind, typeof Package> = { item: Package, wip: FlaskConical, other: PenLine };
const KIND_CHIP: Record<Kind, string> = { item: "bg-brand-50 text-brand-700", wip: "bg-violet-50 text-violet-700", other: "bg-amber-50 text-amber-700" };

function Recipes() {
  const { items, wips } = useCatalog();
  const [rows, setRows] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [edit, setEdit] = useState<Recipe | "new" | null>(null);
  const [q, setQ] = useState("");
  const load = useCallback(() => { call<{ data: Recipe[] }>("/api/cost-control/sales-calc/recipes").then((r) => setRows(r.data)).catch((e: Error) => setError(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const price = useMemo(() => new Map(items.map((i) => [i.code, i.price])), [items]);
  const hppOf = (r: Recipe) => { if (!r.lines.length || !items.length) return null; const c = r.lines.map((l) => lineCost(l, price, wips)); return c.every((x) => x !== null) ? c.reduce<number>((a, x) => a + (x ?? 0), 0) : null; };
  const shown = (rows ?? []).filter((r) => !q || matches(`${r.name} ${r.code} ${r.category ?? ""}`, q));
  return (
    <Panel title={tr("Recipe Cards")} description={tr("What one portion of a menu uses: raw materials, packaging, WIP / premix and other items")}
      actions={<Button size="sm" onClick={() => setEdit("new")}><Plus size={14} />{tr("New Card")}</Button>}
      toolbar={<div className="relative sm:max-w-xs"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" /><input className={cx(inputClass, "pl-9")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search card")} /></div>}>
      {error ? <ErrorState message={error} onRetry={load} /> : !rows ? <SkeletonRows cols={4} /> : shown.length === 0 ? (
        <Empty icon={<BookOpen size={26} />} title={rows.length ? tr("No card matches") : tr("No recipe card yet")}>
          {!rows.length && <Button className="mt-3" onClick={() => setEdit("new")}><Plus size={14} />{tr("Make the first card")}</Button>}
        </Empty>
      ) : (
        <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((r) => <RecipeCard key={r.code} r={r} hpp={hppOf(r)} priced={!!items.length} onOpen={() => setEdit(r)} />)}
        </ul>
      )}
      {edit && <RecipeDrawer recipe={edit === "new" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); load(); }} />}
    </Panel>
  );
}

/** One recipe card: a band with the Kopi Calf mark, the name and code, then HPP / components / menus and the first lines. */
function RecipeCard({ r, hpp, priced, onOpen }: { r: Recipe; hpp: number | null; priced: boolean; onOpen: () => void }) {
  return (
    <li>
      <button type="button" onClick={onOpen}
        className={cx("group flex h-full w-full flex-col overflow-hidden rounded-xl border bg-white text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md",
          r.isActive ? "border-neutral-200 hover:border-brand-300" : "border-neutral-200 opacity-75")}>
        <div className="relative overflow-hidden bg-gradient-to-br from-[#0b1f4d] via-[#12307a] to-brand-600 px-4 pb-4 pt-3.5 text-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- decorative brand mark */}
          <img src="/assets/calf-logo.png" alt="" aria-hidden className="pointer-events-none absolute -bottom-6 -right-5 h-32 w-32 rotate-[-12deg] object-contain opacity-[0.13] brightness-0 invert" />
          <span className="pointer-events-none absolute -left-10 -top-12 h-28 w-28 rounded-full bg-white/5" aria-hidden />
          <div className="relative flex items-center justify-between gap-2">
            <span className="truncate rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-brand-50">{r.category || tr("Recipe Card")}</span>
            {!r.isActive ? <span className="rounded-full bg-neutral-900/40 px-2 py-0.5 text-[10px] font-semibold">{tr("Inactive")}</span>
              : r.menus.length ? <span className="rounded-full bg-emerald-400/90 px-2 py-0.5 text-[10px] font-semibold text-emerald-950">{tr("{0} menus", r.menus.length)}</span>
              : <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-semibold text-amber-950">{tr("No Menu Yet")}</span>}
          </div>
          <p className="relative mt-2.5 line-clamp-2 text-base font-semibold leading-snug">{r.name}</p>
          <p className="relative mt-0.5 font-mono text-[11px] text-brand-100/80">{r.code}</p>
        </div>
        <div className="flex flex-1 flex-col px-4 py-3">
          <div className="grid grid-cols-3 divide-x divide-neutral-200 rounded-xl bg-neutral-50 py-2 text-center">
            <span><span className="block text-[10px] uppercase tracking-wide text-neutral-400">{tr("HPP")}</span>
              <span className={cx("block text-sm font-semibold tabular-nums", hpp === null ? "text-amber-700" : "text-neutral-900")}>{hpp !== null ? rp(hpp) : priced && r.lines.length ? tr("Price missing") : "—"}</span></span>
            <span><span className="block text-[10px] uppercase tracking-wide text-neutral-400">{tr("Components")}</span><span className="block text-sm font-semibold tabular-nums text-neutral-900">{r.lines.length}</span></span>
            <span><span className="block text-[10px] uppercase tracking-wide text-neutral-400">{tr("Menus")}</span><span className="block text-sm font-semibold tabular-nums text-neutral-900">{r.menus.length}</span></span>
          </div>
          <ul className="mt-3 flex-1 space-y-1.5 text-xs text-neutral-600">
            {r.lines.slice(0, 4).map((l, i) => (
              <li key={i} className="flex items-center gap-2"><span className={cx("h-1.5 w-1.5 flex-shrink-0 rounded-full", KIND_DOT[l.type])} />
                <span className="min-w-0 flex-1 truncate">{l.name}</span><span className="flex-shrink-0 tabular-nums text-neutral-500">{num(l.qty)} {l.unit}</span></li>
            ))}
            {r.lines.length > 4 && <li className="pl-3.5 text-neutral-400">{tr("+{0} more", r.lines.length - 4)}</li>}
            {!r.lines.length && <li className="text-amber-700">{tr("No component yet")}</li>}
          </ul>
          <span className="mt-3 inline-flex items-center gap-1 self-end text-[11px] font-medium text-brand-700 opacity-0 transition group-hover:opacity-100">{tr("Open the card")} <ChevronRight size={13} /></span>
        </div>
      </button>
    </li>
  );
}

/** A line being edited: the quantity (and the price of an other item) kept as typed, so "0,5" can be entered. */
type Draft = Line & { qtyText: string; priceText: string };
const toDraft = (l: Line): Draft => ({ ...l, qtyText: l.qty ? String(l.qty).replace(".", ",") : "", priceText: l.price != null ? String(l.price).replace(".", ",") : "" });

/** A numbered block of a drawer form. */
function FormBlock({ n, title, hint, aside, children }: { n: number; title: string; hint?: string; aside?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-neutral-200/80 bg-white shadow-sm">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3">
        <div className="flex items-start gap-3">
          <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-brand-700 text-[11px] font-bold text-white">{n}</span>
          <div><h3 className="text-sm font-semibold text-neutral-900">{title}</h3>{hint && <p className="mt-0.5 text-xs text-neutral-500">{hint}</p>}</div>
        </div>
        {aside}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

/** On / off as a switch. */
function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} onClick={() => onChange(!on)} className="inline-flex items-center gap-2.5 text-sm text-neutral-700">
      <span className={cx("relative h-6 w-10 rounded-full transition", on ? "bg-brand-600" : "bg-neutral-300")}>
        <span className={cx("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-[1.125rem]" : "left-0.5")} />
      </span>{label}
    </button>
  );
}

/** A number typed as text ("0,5") with its unit inside the box. */
function UnitInput({ value, onChange, unit, placeholder, label, className }: { value: string; onChange: (v: string) => void; unit: string; placeholder?: string; label: string; className?: string }) {
  return (
    <span className={cx("relative block", className)}>
      <input inputMode="decimal" className={cx(inputClass, "h-9 pr-12 text-right tabular-nums")} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder ?? "0"} aria-label={label} />
      <span className="pointer-events-none absolute right-3 top-1/2 max-w-[2.5rem] -translate-y-1/2 truncate text-[11px] font-medium uppercase text-neutral-400">{unit || "—"}</span>
    </span>
  );
}

const fieldLabel = "block text-xs font-medium text-neutral-600";

function RecipeDrawer({ recipe, onClose, onSaved }: { recipe: Recipe | null; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { items, loading, wips, error } = useCatalog();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [head, setHead] = useState(() => ({ code: recipe?.code ?? "", name: recipe?.name ?? "", category: recipe?.category ?? "", note: recipe?.note ?? "", isActive: recipe?.isActive ?? true }));
  const [lines, setLines] = useState<Draft[]>(() => (recipe?.lines ?? []).map(toDraft));
  const [assigned, setAssigned] = useState(() => recipe?.menus ?? []);
  const [menuQ, setMenuQ] = useState("");
  const [onlyTicked, setOnlyTicked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tried, setTried] = useState(false);
  useEffect(() => { void call<{ data: Menu[] }>("/api/cost-control/sales-calc/menus").then((r) => setMenus(r.data)).catch(() => setMenus([])); }, []);
  const price = useMemo(() => new Map(items.map((i) => [i.code, i.price])), [items]);
  const itemOptions = useMemo(() => items.map((i) => ({ value: i.code, label: i.name, hint: `${i.code} · ${i.unit}` })), [items]);
  const wipOptions = useMemo(() => wips.map((w) => ({ value: w.code, label: w.name, hint: "gram" })), [wips]);
  const cost = useCallback((l: Draft) => lineCost({ ...l, qty: parse(l.qtyText) ?? 0, price: parse(l.priceText) }, price, wips), [price, wips]);
  const costs = lines.map(cost);
  const hpp = lines.length && costs.every((c) => c !== null) ? costs.reduce<number>((a, c) => a + (c ?? 0), 0) : null;
  const invalid = lines.findIndex((l) => !l.code || !l.name.trim() || (parse(l.qtyText) ?? 0) <= 0);
  const per = (k: Kind) => lines.filter((l) => l.type === k).length;

  const setLine = (i: number, patch: Partial<Draft>) => setLines((all) => all.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const add = (type: Kind) => setLines((all) => [...all, { type, code: type === "other" ? `other-${Date.now().toString(36)}` : "", name: "", qty: 0, unit: type === "wip" ? "GR" : type === "other" ? "PCS" : "", price: null, qtyText: "", priceText: "" }]);
  const pickItem = (i: number, code: string) => { const it = items.find((x) => x.code === code); setLine(i, { code, name: it?.name ?? code, unit: it?.unit ?? "" }); };
  const pickWip = (i: number, code: string) => { const w = wips.find((x) => x.code === code); setLine(i, { code, name: w?.name ?? code, unit: "GR" }); };

  const save = async () => {
    setTried(true);
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
  const menuShown = menus.filter((m) => (!onlyTicked || ids.has(m.id)) && (!menuQ || matches(`${m.name} ${m.category} ${m.detail ?? ""} ${brands(m)}`, menuQ))).slice(0, 400);

  return (
    <Drawer open onClose={onClose} size="xl" icon={<BookOpen size={18} />} title={recipe ? recipe.name : tr("New Card")} description={tr("What one portion of the menu uses")} focusFirstField={false}
      footer={<div className="flex w-full flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{tr("HPP per Portion")}</p>
          <p className="text-lg font-bold tabular-nums text-neutral-900">{hpp === null ? <span className="text-sm font-medium text-amber-700">{lines.length ? tr("Price missing") : "—"}</span> : rp(hpp)}</p>
        </div>
        {recipe && <Button variant="ghost" className="text-red-600" onClick={() => void remove()}><Trash2 size={14} />{tr("Delete")}</Button>}
        <Button variant="secondary" onClick={onClose}>{tr("Cancel")}</Button>
        <Button loading={busy} disabled={!head.code.trim() || !head.name.trim()} onClick={() => void save()}><Save size={15} />{tr("Save Card")}</Button>
      </div>}>
      <div className="space-y-4 text-sm">
        <FormBlock n={1} title={tr("Card Details")} hint={tr("The name the team knows the menu by; the code stays unique")}
          aside={<Switch on={head.isActive} onChange={(v) => setHead({ ...head, isActive: v })} label={head.isActive ? tr("Active") : tr("Inactive")} />}>
          <div className="grid gap-3 sm:grid-cols-6">
            <label className={cx(fieldLabel, "sm:col-span-2")}>{tr("Code")} <span className="text-red-500">*</span>
              <input className={cx(inputClass, "mt-1 font-mono uppercase")} value={head.code} onChange={(e) => setHead({ ...head, code: e.target.value })} placeholder="MN-MATCHA-ICE" /></label>
            <label className={cx(fieldLabel, "sm:col-span-4")}>{tr("Name")} <span className="text-red-500">*</span>
              <input className={cx(inputClass, "mt-1")} value={head.name} onChange={(e) => setHead({ ...head, name: e.target.value })} placeholder={tr("e.g. Iced Matcha Latte")} /></label>
            <label className={cx(fieldLabel, "sm:col-span-2")}>{tr("Category")}
              <input className={cx(inputClass, "mt-1")} value={head.category} onChange={(e) => setHead({ ...head, category: e.target.value })} placeholder={tr("e.g. Non Coffee")} /></label>
            <label className={cx(fieldLabel, "sm:col-span-4")}>{tr("Note")}
              <input className={cx(inputClass, "mt-1")} value={head.note} onChange={(e) => setHead({ ...head, note: e.target.value })} placeholder={tr("e.g. size 16 oz, with foam")} /></label>
          </div>
        </FormBlock>

        <FormBlock n={2} title={tr("Components per Portion")} hint={tr("Quantities in the unit of the item; WIP / premix in grams")}
          aside={<span className="flex flex-wrap gap-1.5 text-[11px]">{(["item", "wip", "other"] as Kind[]).map((k) => <span key={k} className={cx("rounded-full px-2 py-0.5 font-medium", KIND_CHIP[k])}>{KIND[k].label()} {per(k)}</span>)}</span>}>
          {error && <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{tr("The item list could not be loaded: {0}", error)}</p>}
          <ol className="space-y-2">
            {lines.map((l, i) => {
              const Icon = KIND_ICON[l.type];
              const bad = tried && (!l.code || !l.name.trim() || (parse(l.qtyText) ?? 0) <= 0);
              return (
                <li key={i} className={cx("rounded-xl border p-3", bad ? "border-red-300 bg-red-50/40" : "border-neutral-200 bg-neutral-50/40")}>
                  <div className="flex items-start gap-3">
                    <span className={cx("mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg", KIND_CHIP[l.type])} title={KIND[l.type].label()}><Icon size={15} /></span>
                    <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[minmax(0,1fr)_8.5rem_7rem] sm:items-center">
                      <div className="min-w-0">
                        <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{i + 1}. {KIND[l.type].label()}</p>
                        {l.type === "item" && <Picker value={l.code} options={itemOptions} onPick={(v) => pickItem(i, v)} placeholder={loading ? tr("Loading items…") : tr("Choose raw material / packaging")} />}
                        {l.type === "wip" && <Picker value={l.code} options={wipOptions} onPick={(v) => pickWip(i, v)} placeholder={tr("Choose WIP / premix")} />}
                        {l.type === "other" && (
                          <div className="grid gap-2 sm:grid-cols-[1fr_4.5rem_7rem]">
                            <input className={cx(inputClass, "h-9")} value={l.name} onChange={(e) => setLine(i, { name: e.target.value })} placeholder={tr("Item name, e.g. Sticker")} />
                            <input className={cx(inputClass, "h-9 uppercase")} value={l.unit} onChange={(e) => setLine(i, { unit: e.target.value })} aria-label={tr("Unit")} placeholder="PCS" />
                            <UnitInput value={l.priceText} onChange={(v) => setLine(i, { priceText: v })} unit="Rp" label={tr("Price / Unit")} placeholder={tr("Price")} />
                          </div>
                        )}
                      </div>
                      <label className="block"><span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{tr("Qty")}</span>
                        <UnitInput value={l.qtyText} onChange={(v) => setLine(i, { qtyText: v })} unit={l.unit} label={`${tr("Qty")} ${i + 1}`} /></label>
                      <div className="text-right">
                        <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{tr("Cost")}</span>
                        <span className="inline-block py-2 text-sm font-semibold tabular-nums text-neutral-800">{costs[i] === null ? <span className="text-xs font-medium text-amber-700">{tr("No price")}</span> : rp(costs[i])}</span>
                      </div>
                    </div>
                    <button type="button" aria-label={tr("Delete")} onClick={() => setLines((all) => all.filter((_, j) => j !== i))} className="mt-0.5 rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </li>
              );
            })}
          </ol>
          {!lines.length && <p className="rounded-xl border border-dashed border-neutral-200 px-3 py-6 text-center text-xs text-neutral-400">{tr("No component yet: add one below")}</p>}
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {([["item", tr("From the item master")], ["wip", tr("In grams, from the Production Calculator")], ["other", tr("Typed by hand with its price")]] as [Kind, string][]).map(([k, hint]) => {
              const Icon = KIND_ICON[k];
              return (
                <button key={k} type="button" onClick={() => add(k)} className="flex items-center gap-2.5 rounded-xl border border-dashed border-neutral-300 px-3 py-2.5 text-left hover:border-brand-400 hover:bg-brand-50/40">
                  <span className={cx("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg", KIND_CHIP[k])}><Icon size={15} /></span>
                  <span className="min-w-0"><span className="flex items-center gap-1 text-sm font-medium text-neutral-800"><Plus size={13} /> {KIND[k].label()}</span><span className="block truncate text-[11px] text-neutral-500">{hint}</span></span>
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-neutral-400">{tr("A missing price is filled in Pricelist Items; an other item carries its own price")}</p>
        </FormBlock>

        <FormBlock n={3} title={tr("ESB Menus with This Card")} hint={tr("Every menu of the POS transactions; a menu on another card moves here when ticked")}
          aside={<span className="rounded-full bg-brand-50 px-2.5 py-0.5 text-xs font-semibold text-brand-700">{tr("{0} ticked", assigned.length)}</span>}>
          {assigned.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {assigned.slice(0, 12).map((m) => (
                <span key={m.id} className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2.5 pr-1 text-xs text-brand-800">
                  <span className="truncate">{m.name}</span>
                  <button type="button" onClick={() => setAssigned(assigned.filter((x) => x.id !== m.id))} className="rounded-full p-0.5 hover:bg-brand-100" aria-label={tr("Remove")}><X size={12} /></button>
                </span>
              ))}
              {assigned.length > 12 && <span className="px-1 py-0.5 text-xs text-neutral-500">{tr("+{0} more", assigned.length - 12)}</span>}
            </div>
          )}
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <div className="relative min-w-0 flex-1 basis-48"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input className={cx(inputClass, "h-9 pl-8")} value={menuQ} onChange={(e) => setMenuQ(e.target.value)} placeholder={tr("Search menu")} /></div>
            <label className="flex items-center gap-2 text-xs text-neutral-600"><input type="checkbox" checked={onlyTicked} onChange={(e) => setOnlyTicked(e.target.checked)} />{tr("Ticked only")}</label>
          </div>
          <div className="max-h-72 overflow-auto rounded-xl border border-neutral-200">
            {menuShown.map((m) => (
              <label key={m.id} className={cx("flex cursor-pointer items-center gap-2.5 border-b border-neutral-100 px-3 py-2 text-xs last:border-0", ids.has(m.id) ? "bg-brand-50/50" : "hover:bg-neutral-50")}>
                <input type="checkbox" checked={ids.has(m.id)}
                  onChange={(e) => setAssigned(e.target.checked ? [...assigned, { id: m.id, name: m.name }] : assigned.filter((x) => x.id !== m.id))} />
                <span className="min-w-0 flex-1"><span className="block truncate font-medium text-neutral-800">{m.name}</span><span className="block truncate text-[11px] text-neutral-400">{m.category}{brands(m) ? ` · ${brands(m)}` : ""}</span></span>
                {m.recipe && m.recipe !== head.code && <Badge tone="amber">{m.recipe}</Badge>}
                <span className="w-16 text-right tabular-nums text-neutral-400" title={tr("Sold 90 Days")}>{num(m.qty, 0)}</span>
              </label>
            ))}
            {!menuShown.length && <p className="px-3 py-6 text-center text-xs text-neutral-400">{tr("No menu matches")}</p>}
          </div>
        </FormBlock>
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------- 2. assign menus

type AssignFilters = { status: "" | "with" | "without"; brand: string; category: string; recipe: string };
const NO_AF: AssignFilters = { status: "", brand: "", category: "", recipe: "" };

function MenuAssign() {
  const toast = useToast();
  const [menus, setMenus] = useState<Menu[] | null>(null);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [q, setQ] = useState("");
  const [f, setF] = useState<AssignFilters>(NO_AF);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
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
  const brandList = useMemo(() => [...new Map(all.flatMap((m) => m.companies ?? []).map((c) => [c.code, c.name])).entries()].map(([value, label]) => ({ value, label })), [all]);
  const categories = useMemo(() => [...new Set(all.map((m) => m.category).filter(Boolean))].sort().map((c) => ({ value: c, label: c })), [all]);
  const shown = useMemo(() => all.filter((m) => (f.status !== "without" || !m.recipe) && (f.status !== "with" || !!m.recipe)
    && (!f.brand || (m.companies ?? []).some((c) => c.code === f.brand)) && (!f.category || m.category === f.category)
    && (!f.recipe || m.recipe === f.recipe) && (!q || matches(`${m.name} ${m.category} ${m.detail ?? ""}`, q))), [all, f, q]);
  const paged = usePaged(shown, JSON.stringify(f) + q, 25);
  const free = all.filter((m) => !m.recipe).length;
  const recipeName = (code: string) => recipes.find((r) => r.code === code)?.name ?? code;
  const chips: ActiveFilter[] = [
    ...(f.status ? [{ key: "s", label: f.status === "with" ? tr("With a card") : tr("Without a card"), onRemove: () => setF({ ...f, status: "" }) }] : []),
    ...(f.brand ? [{ key: "b", label: brandList.find((b) => b.value === f.brand)?.label ?? f.brand, onRemove: () => setF({ ...f, brand: "" }) }] : []),
    ...(f.category ? [{ key: "c", label: f.category, onRemove: () => setF({ ...f, category: "" }) }] : []),
    ...(f.recipe ? [{ key: "r", label: recipeName(f.recipe), onRemove: () => setF({ ...f, recipe: "" }) }] : []),
  ];
  return (
    <Panel title={tr("Assign Menus")} description={tr("Every menu of the POS transactions of the branches and the recipe card it uses; several menus may share a card")}
      actions={menus ? <span className="flex items-center gap-2 text-xs text-neutral-500">
        <span className="h-1.5 w-24 overflow-hidden rounded-full bg-neutral-100"><span className="block h-full rounded-full bg-emerald-500" style={{ width: `${all.length ? ((all.length - free) / all.length) * 100 : 0}%` }} /></span>
        {tr("{0} of {1} menus have a card", all.length - free, all.length)}</span> : undefined}
      toolbar={<FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search menu, e.g. es kopi premium")} filters={chips} onOpen={() => setSheet(true)} onClear={() => setF(NO_AF)} />}
      footer={menus ? <><span>{tr("{0} shown", fmtNumber(shown.length))}</span><PageNav paged={paged} /></> : undefined}>
      {!menus ? <SkeletonRows cols={5} /> : (
        <>
          {!recipes.length && <p className="mx-4 mt-3 rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">{tr("No recipe card yet: make the cards in step 1, then choose them here.")}</p>}
          {shown.length === 0 ? <Empty title={tr("No menu matches")} /> : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className={theadClass}><tr><th className="py-2.5 pl-5 pr-3">{tr("Menu")}</th><th className="px-3 py-2.5">{tr("Category")}</th><th className="px-3 py-2.5">{tr("Brand")}</th>
                  <th className="px-3 py-2.5 text-right">{tr("Sold 90 Days")}</th><th className="px-3 py-2.5 pr-5">{tr("Recipe Card")}</th></tr></thead>
                <tbody className="divide-y divide-neutral-100">
                  {paged.rows.map((m) => (
                    <tr key={m.id} className={cx("hover:bg-neutral-50/60", busy === m.id && "opacity-50")}>
                      <td className="py-2.5 pl-5 pr-3">
                        <span className="font-medium text-neutral-900">{m.name}</span>
                        {(m.kinds ?? []).filter((k) => k !== "menu").map((k) => <Badge key={k} tone="slate">{k === "package" ? tr("Package") : tr("Extra")}</Badge>)}
                        {m.lastSold && <span className="block text-[11px] text-neutral-400">{tr("last sold {0}", m.lastSold)}</span>}
                      </td>
                      <td className="px-3 py-2.5 text-xs text-neutral-600">{m.category}{m.detail && m.detail !== m.category ? <span className="block text-[11px] text-neutral-400">{m.detail}</span> : null}</td>
                      <td className="px-3 py-2.5 text-xs text-neutral-600">{brands(m)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{num(m.qty, 0)}</td>
                      <td className="w-72 px-3 py-2.5 pr-5">
                        <div className="flex items-center gap-2">
                          <span className={cx("h-2 w-2 flex-shrink-0 rounded-full", m.recipe ? "bg-emerald-500" : "bg-amber-400")} aria-hidden />
                          <select className={cx(inputClass, "h-9", !m.recipe && "text-neutral-400")} value={m.recipe ?? ""} disabled={busy === m.id || !recipes.length} onChange={(e) => void assign(m, e.target.value)} aria-label={`${tr("Recipe Card")} ${m.name}`}>
                            <option value="">{tr("— No card —")}</option>{recipes.map((r) => <option key={r.code} value={r.code}>{r.name}</option>)}
                          </select>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {sheet && <AssignFilterSheet value={f} brands={brandList} categories={categories} recipes={recipes.map((r) => ({ value: r.code, label: r.name, hint: r.code }))}
        onClose={() => setSheet(false)} onApply={(v) => { setF(v); setSheet(false); }} />}
    </Panel>
  );
}

function AssignFilterSheet({ value, brands: brandOpts, categories, recipes, onApply, onClose }: {
  value: AssignFilters; brands: { value: string; label: string }[]; categories: { value: string; label: string }[]; recipes: { value: string; label: string; hint?: string }[];
  onApply: (v: AssignFilters) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  const active = [d.status, d.brand, d.category, d.recipe].filter(Boolean).length;
  return (
    <MonitorFilterSheet active={active} onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(NO_AF)}>
      <FilterRow icon={<ListChecks size={15} />} label={tr("Recipe card")} value={d.status === "with" ? tr("With a card") : d.status === "without" ? tr("Without a card") : null} onClear={() => setD({ ...d, status: "" })}>
        <Segments value={d.status} onChange={(v) => setD({ ...d, status: v as AssignFilters["status"] })}
          choices={[{ value: "", label: tr("All") }, { value: "with", label: tr("With a card") }, { value: "without", label: tr("Without a card") }]} />
      </FilterRow>
      {brandOpts.length > 1 && (
        <FilterRow icon={<Store size={15} />} label={tr("Brand")} value={brandOpts.find((b) => b.value === d.brand)?.label ?? null} onClear={() => setD({ ...d, brand: "" })}>
          <Segments value={d.brand} onChange={(v) => setD({ ...d, brand: v })} choices={[{ value: "", label: tr("All") }, ...brandOpts]} />
        </FilterRow>
      )}
      <FilterRow icon={<Layers size={15} />} label={tr("Category")} value={d.category || null} onClear={() => setD({ ...d, category: "" })}>
        <ComboFilter value={d.category} onChange={(v) => setD({ ...d, category: v })} options={categories} allLabel={tr("All categories")} placeholder={tr("Search category")} />
      </FilterRow>
      <FilterRow icon={<BookOpen size={15} />} label={tr("Uses the card")} value={recipes.find((r) => r.value === d.recipe)?.label ?? null} onClear={() => setD({ ...d, recipe: "" })}>
        <ComboFilter value={d.recipe} onChange={(v) => setD({ ...d, recipe: v })} options={recipes} allLabel={tr("Any card")} placeholder={tr("Search card")} />
      </FilterRow>
    </MonitorFilterSheet>
  );
}

// ---------------------------------------------------------------- 3. additional items

type ExtraDraft = Omit<Extra, "id"> & { id?: number; qtyText: string; priceText: string };
const BASIS_HINT: Record<Extra["basis"], () => string> = {
  bill: () => tr("Every receipt of the outlet uses it, e.g. a take-away bag"),
  portion: () => tr("Every portion sold uses it, e.g. a straw"),
  day: () => tr("Once per day an outlet sells, e.g. cleaning plastic"),
};
const BASIS_ICON: Record<Extra["basis"], typeof Receipt> = { bill: Receipt, portion: CupSoda, day: CalendarDays };

function Extras() {
  const toast = useToast();
  const { items } = useCatalog();
  const [rows, setRows] = useState<Extra[] | null>(null);
  const blank: Omit<Extra, "id"> = { code: null, name: "", unit: "PCS", price: null, basis: "bill", qty: 1, note: null, isActive: true };
  const [edit, setEdit] = useState<ExtraDraft | null>(null);
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
  const price = (x: Pick<Extra, "code" | "price">) => (x.code ? items.find((i) => i.code === x.code)?.price ?? null : x.price);
  return (
    <Panel title={tr("Additional Items")} description={tr("Items no menu records (cable ties, plastic bags …): counted per bill, per portion sold or per day of an outlet, and added to the planning, the usage and the COGS")}
      actions={<Button size="sm" onClick={() => open({ ...blank })}><Plus size={14} />{tr("Add Item")}</Button>}>
      {!rows ? <SkeletonRows cols={5} /> : rows.length === 0 ? (
        <Empty icon={<Package size={26} />} title={tr("No additional item yet")}><Button className="mt-3" onClick={() => open({ ...blank })}><Plus size={14} />{tr("Add Item")}</Button></Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[620px] text-sm">
            <thead className={theadClass}><tr><th className="py-2.5 pl-5 pr-3">{tr("Item")}</th><th className="px-3 py-2.5">{tr("Usage")}</th><th className="px-3 py-2.5 text-right">{tr("Price / Unit")}</th><th className="px-3 py-2.5">{tr("Status")}</th><th /></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {rows.map((x) => {
                const Icon = BASIS_ICON[x.basis];
                return (
                  <tr key={x.id} className="cursor-pointer hover:bg-neutral-50" onClick={() => open(x)}>
                    <td className="py-2.5 pl-5 pr-3"><span className="block font-medium text-neutral-900">{x.name}</span><span className="text-[11px] text-neutral-400">{x.code ?? tr("Typed by hand")}</span></td>
                    <td className="px-3 py-2.5 text-xs"><span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-100 px-2 py-0.5 text-neutral-700"><Icon size={12} /> {num(x.qty)} {x.unit} · {BASIS[x.basis]()}</span></td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{price(x) === null ? <Badge tone="amber">{tr("No price")}</Badge> : rp(price(x))}</td>
                    <td className="px-3 py-2.5">{x.isActive ? <Badge tone="green" dot>{tr("Active")}</Badge> : <Badge tone="slate">{tr("Inactive")}</Badge>}</td>
                    <td className="px-2"><button type="button" onClick={(e) => { e.stopPropagation(); void remove(x); }} className="rounded p-1.5 text-neutral-400 hover:text-red-600" aria-label={tr("Delete")}><Trash2 size={15} /></button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {edit && <ExtraDrawer edit={edit} setEdit={setEdit} items={items} unitPrice={price({ code: edit.code, price: parse(edit.priceText) })} onSave={() => void save()} />}
    </Panel>
  );
}

function ExtraDrawer({ edit, setEdit, items, unitPrice, onSave }: { edit: ExtraDraft; setEdit: (e: ExtraDraft | null) => void; items: Item[]; unitPrice: number | null; onSave: () => void }) {
  const options = useMemo(() => items.map((i) => ({ value: i.code, label: i.name, hint: `${i.code} · ${i.unit}` })), [items]);
  const qty = parse(edit.qtyText);
  const manual = edit.code === null;
  const each = qty !== null && unitPrice !== null ? qty * unitPrice : null;
  const per = { bill: tr("per bill"), portion: tr("per portion sold"), day: tr("per outlet-day") }[edit.basis];
  const ready = !!edit.name.trim() && (qty ?? 0) > 0;
  return (
    <Drawer open onClose={() => setEdit(null)} size="lg" icon={<Package size={18} />} title={edit.id ? edit.name : tr("Add Item")} description={tr("Additional Items")} focusFirstField={false}
      footer={<div className="flex w-full flex-wrap items-center gap-2">
        <div className="mr-auto min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-neutral-400">{tr("Cost")} {per}</p>
          <p className="text-lg font-bold tabular-nums text-neutral-900">{each === null ? <span className="text-sm font-medium text-amber-700">{unitPrice === null ? tr("No price") : "—"}</span> : rp(each)}</p>
        </div>
        <Button variant="secondary" onClick={() => setEdit(null)}>{tr("Cancel")}</Button>
        <Button disabled={!ready} onClick={onSave}><Save size={15} />{tr("Save")}</Button>
      </div>}>
      <div className="space-y-4 text-sm">
        <FormBlock n={1} title={tr("Item")} hint={tr("Take it from the item master (the price follows Pricelist Items) or type it by hand")}
          aside={<Switch on={edit.isActive} onChange={(v) => setEdit({ ...edit, isActive: v })} label={edit.isActive ? tr("Active") : tr("Inactive")} />}>
          <div className="mb-4 grid gap-2 sm:grid-cols-2" role="radiogroup">
            {[{ m: false, icon: Package, label: tr("From the Item Master"), hint: tr("Name, unit and price from Pricelist Items") },
              { m: true, icon: PenLine, label: tr("Typed by Hand"), hint: tr("Your own name, unit and price") }].map((o) => {
              const on = manual === o.m;
              return (
                <button key={o.label} type="button" role="radio" aria-checked={on} onClick={() => setEdit({ ...edit, code: o.m ? null : edit.code ?? "" })}
                  className={cx("flex items-start gap-3 rounded-xl border p-3 text-left transition", on ? "border-brand-600 bg-brand-50/60 ring-1 ring-brand-600" : "border-neutral-200 hover:border-neutral-300")}>
                  <span className={cx("flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg", on ? "bg-brand-700 text-white" : "bg-neutral-100 text-neutral-500")}><o.icon size={15} /></span>
                  <span><span className="block text-sm font-semibold text-neutral-900">{o.label}</span><span className="block text-xs text-neutral-500">{o.hint}</span></span>
                </button>
              );
            })}
          </div>
          {manual ? (
            <div className="grid gap-3 sm:grid-cols-6">
              <label className={cx(fieldLabel, "sm:col-span-3")}>{tr("Name")} <span className="text-red-500">*</span><input className={cx(inputClass, "mt-1")} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder={tr("e.g. Cable ties")} /></label>
              <label className={cx(fieldLabel, "sm:col-span-1")}>{tr("Unit")}<input className={cx(inputClass, "mt-1 uppercase")} value={edit.unit} onChange={(e) => setEdit({ ...edit, unit: e.target.value })} placeholder="PCS" /></label>
              <label className={cx(fieldLabel, "sm:col-span-2")}>{tr("Price per Unit")}<span className="mt-1 block"><UnitInput value={edit.priceText} onChange={(v) => setEdit({ ...edit, priceText: v })} unit="Rp" label={tr("Price per Unit (Rp)")} /></span></label>
            </div>
          ) : (
            <div>
              <p className={cx(fieldLabel, "mb-1")}>{tr("Item")} <span className="text-red-500">*</span></p>
              <Picker value={edit.code ?? ""} options={options} placeholder={tr("Choose an item")}
                onPick={(v) => { const it = items.find((i) => i.code === v); setEdit({ ...edit, code: v, name: it?.name ?? "", unit: it?.unit ?? edit.unit }); }} />
              {edit.code && <p className="mt-1.5 text-xs text-neutral-500">{edit.unit} · {unitPrice === null ? <span className="text-amber-700">{tr("No price in Pricelist Items yet")}</span> : tr("{0} per {1}", rp(unitPrice), edit.unit)}</p>}
            </div>
          )}
        </FormBlock>

        <FormBlock n={2} title={tr("How It Is Counted")} hint={tr("What one use is: the calculator multiplies it by the bills, the portions or the days of the period")}>
          <div className="grid gap-2 sm:grid-cols-3" role="radiogroup">
            {(["bill", "portion", "day"] as const).map((b) => {
              const on = edit.basis === b;
              const Icon = BASIS_ICON[b];
              return (
                <button key={b} type="button" role="radio" aria-checked={on} onClick={() => setEdit({ ...edit, basis: b })}
                  className={cx("rounded-xl border p-3 text-left transition", on ? "border-brand-600 bg-brand-50/60 ring-1 ring-brand-600" : "border-neutral-200 hover:border-neutral-300")}>
                  <span className={cx("mb-2 flex h-8 w-8 items-center justify-center rounded-lg", on ? "bg-brand-700 text-white" : "bg-neutral-100 text-neutral-500")}><Icon size={15} /></span>
                  <span className="block text-sm font-semibold text-neutral-900">{BASIS[b]()}</span>
                  <span className="mt-0.5 block text-[11px] leading-snug text-neutral-500">{BASIS_HINT[b]()}</span>
                </button>
              );
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className={fieldLabel}>{tr("Quantity")} {per} <span className="text-red-500">*</span>
              <span className="mt-1 block"><UnitInput value={edit.qtyText} onChange={(v) => setEdit({ ...edit, qtyText: v })} unit={edit.unit} label={tr("Quantity")} /></span></label>
            <div className="rounded-xl bg-neutral-50 px-3 py-2.5 text-xs text-neutral-600">
              <p className="font-semibold text-neutral-800">{tr("Preview")}</p>
              <p className="mt-0.5">{qty ? tr("{0} {1} {2}", num(qty), edit.unit || "—", per) : tr("Fill the quantity")}{each !== null ? ` · ${rp(each)}` : ""}</p>
            </div>
          </div>
        </FormBlock>

        <FormBlock n={3} title={tr("Note")} hint={tr("Optional: where or when it is used")}>
          <textarea rows={2} className={cx(inputClass, "py-2")} value={edit.note ?? ""} onChange={(e) => setEdit({ ...edit, note: e.target.value || null })} placeholder={tr("e.g. only at the outlets with dine-in")} />
        </FormBlock>
      </div>
    </Drawer>
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
              { key: "cogs", label: tr("COGS Bahan Baku"), hint: tr("Per menu: sold, sales, HPP per portion, COGS and ratio"), icon: <Calculator size={16} />, tone: "bg-brand-50 text-brand-600", count: data ? data.menus.length : null,
                run: guard((d) => downloadXlsx({ fileName: file("COGS Bahan Baku"), sheet: "COGS", title: file("COGS Bahan Baku"), header: ["Menu", "Kartu Resep", "Terjual", "Sales", "HPP / Porsi", "COGS", "Rasio"],
                  rows: d.menus.map((m) => [m.name, m.recipeName, m.qty, m.sales, m.hpp, m.cogs, m.ratio]) })) },
              { key: "mrp", label: tr("Material Required Planning"), hint: tr("Materials to prepare for the planned days"), icon: <Package size={16} />, tone: "bg-violet-50 text-violet-600", count: data ? data.mrp.length : null,
                run: guard((d) => downloadXlsx({ fileName: file("Material Required Planning"), sheet: "MRP", title: file("Material Required Planning"), header: ["Kode", "Bahan", "Qty", "Satuan", "Nilai"],
                  rows: d.mrp.map((r) => [r.code, r.name, r.qty, r.unit, r.value]) })) },
              { key: "usage", label: tr("Usage Actual vs System"), hint: tr("Per material: system, actual (ESB), difference and value"), icon: <ListChecks size={16} />, tone: "bg-emerald-50 text-emerald-600", count: data ? data.usage.length : null,
                run: guard((d) => downloadXlsx({ fileName: file("Usage Actual vs System"), sheet: "Usage", title: file("Usage Actual vs System"), header: ["Kode", "Bahan", "Satuan", "System", "Actual", "Selisih", "Harga", "Nilai System", "Nilai Actual"],
                  rows: d.usage.map((r) => [r.code, r.name, r.unit, r.system, r.actual, r.variance, r.price, r.systemValue, r.actualValue]) })) },
            ]} /></div>} />
          <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-neutral-200">
            {outputs.map((o) => (
              <button key={o.key} type="button" role="tab" aria-selected={view === o.key} onClick={() => setView(o.key)}
                className={cx("-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium", view === o.key ? "border-brand-700 text-brand-800" : "border-transparent text-neutral-500 hover:text-neutral-800")}>{o.label}</button>
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
                <caption className="px-4 py-2 text-left text-xs text-neutral-500">{tr("Average daily sales of {0} days × {1} days + {2}% buffer, exploded through the cards (rounded up)", data.period.days, data.period.horizon, data.period.buffer)}</caption>
                <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Material")}</th><th className="px-4 py-2.5 text-right">{tr("Required")}</th><th className="px-4 py-2.5 text-right">{tr("Value")}</th></tr></thead>
                <tbody className="divide-y divide-neutral-100">
                  {data.mrp.map((r) => (
                    <tr key={r.code ?? r.name} className={r.isStock ? "" : "text-neutral-400"}>
                      <td className="px-4 py-2">{r.name}{r.code && <span className="ml-1 text-[11px] text-neutral-400">{r.code}</span>}{r.extra && <Badge tone="cyan">{tr("Additional")}</Badge>}</td>
                      <td className="px-4 py-2 text-right font-semibold tabular-nums">{num(r.qty, 0)} {r.unit}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-neutral-600">{rp(r.value)}</td>
                    </tr>
                  ))}
                  {!data.mrp.length && <tr><td colSpan={3}><Empty title={tr("No sales of menus with a card in this period")} /></td></tr>}
                </tbody>
              </table>
            )}
            {view === "usage" && (
              <table className="w-full min-w-[820px] text-sm">
                <caption className="px-4 py-2 text-left text-xs text-neutral-500">{tr("System = menus sold × recipe cards; Actual = SO awal + purchases − SO akhir of the branches with both ESB stock opname documents")}</caption>
                <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Material")}</th><th className="px-4 py-2.5 text-right">{tr("System")}</th><th className="px-4 py-2.5 text-right">{tr("Actual")}</th>
                  <th className="px-4 py-2.5 text-right">{tr("Difference")}</th><th className="px-4 py-2.5 text-right">{tr("Value System")}</th><th className="px-4 py-2.5 text-right">{tr("Value Actual")}</th></tr></thead>
                <tbody className="divide-y divide-neutral-100">
                  {data.usage.map((r) => (
                    <tr key={r.code ?? r.name} className={r.isStock ? "" : "text-neutral-400"}>
                      <td className="px-4 py-2">{r.name}{r.code && <span className="ml-1 text-[11px] text-neutral-400">{r.code}</span>}{r.extra && <Badge tone="cyan">{tr("Additional")}</Badge>}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{num(r.system)} {r.unit}</td>
                      <td className="px-4 py-2 text-right tabular-nums">{num(r.actual)}</td>
                      <td className={cx("px-4 py-2 text-right tabular-nums", r.variance !== null && r.variance > 0 ? "text-red-700" : r.variance !== null && r.variance < 0 ? "text-emerald-700" : "")}>{r.variance === null ? "—" : `${r.variance > 0 ? "+" : ""}${num(r.variance)}`}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-neutral-600">{rp(r.systemValue)}</td>
                      <td className="px-4 py-2 text-right tabular-nums text-neutral-600">{rp(r.actualValue)}</td>
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
                  <tbody className="divide-y divide-neutral-100">
                    {data.menus.map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-2 font-medium text-neutral-900">{m.name}</td><td className="px-4 py-2 text-xs text-neutral-600">{m.recipeName}</td>
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
                    <caption className="px-4 py-2 text-left text-xs font-semibold text-neutral-700">{tr("Additional Items (Outside the Recipe Cards)")}</caption>
                    <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Item")}</th><th className="px-4 py-2.5">{tr("Basis")}</th><th className="px-4 py-2.5 text-right">{tr("Used")}</th><th className="px-4 py-2.5 text-right">{tr("Value")}</th></tr></thead>
                    <tbody className="divide-y divide-neutral-100">
                      {data.extras.map((e) => (
                        <tr key={e.id}>
                          <td className="px-4 py-2">{e.name}{e.code && <span className="ml-1 text-[11px] text-neutral-400">{e.code}</span>}</td>
                          <td className="px-4 py-2 text-xs text-neutral-600">{num(e.qty)} {e.unit} {BASIS[e.basis]()} × {num(e.count, 0)}</td>
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
  const days = Math.round((Date.parse(d.period.to) - Date.parse(d.period.from)) / 864e5) + 1;
  const active = 1 + [d.branch, d.horizon].filter(Boolean).length;
  const branchOpts = useMemo(() => branches.map((x) => ({ value: x.branch_code, label: x.branch_name, hint: x.branch_code })), [branches]);
  const h = Number(d.horizon) || 0;
  const b = Number(d.buffer) || 0;
  return (
    <MonitorFilterSheet active={active} onClose={onClose} onApply={() => onApply(d)} applyDisabled={days > 92}
      onReset={() => setD({ period: { from: wibDay(-6), to: wibDay(0) }, branch: "", horizon: "", buffer: "" })}>
      <FilterRow icon={<CalendarDays size={15} />} label={tr("Sales Period")} value={`${dmy(d.period.from)} – ${dmy(d.period.to)}`}>
        <QuickPeriod value={d.period} onChange={(period) => setD({ ...d, period })} maxDays={92} />
        <p className="mt-2 text-[11px] text-neutral-500">{tr("The POS transactions of the branches in this period")}</p>
      </FilterRow>
      <FilterRow icon={<Store size={15} />} label={tr("Branch")} value={branches.find((x) => x.branch_code === d.branch)?.branch_name ?? null} onClear={() => setD({ ...d, branch: "" })}>
        <ComboFilter value={d.branch} onChange={(v) => setD({ ...d, branch: v })} options={branchOpts} allLabel={tr("All branches")} placeholder={tr("Search branch")} />
      </FilterRow>
      <FilterRow icon={<Package size={15} />} label={tr("Material Required Planning")} value={d.horizon ? tr("{0} days + {1}%", h, b) : null}
        onClear={() => setD({ ...d, horizon: "", buffer: "" })}>
        <div className="grid grid-cols-2 gap-3">
          <label className={fieldLabel}>{tr("Plan for")}
            <span className="relative mt-1 block"><input inputMode="numeric" className={cx(inputClass, "h-10 pr-14 text-right tabular-nums")} value={d.horizon} placeholder="7"
              onChange={(e) => setD({ ...d, horizon: e.target.value.replace(/[^0-9]/g, "") })} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">{tr("days")}</span></span></label>
          <label className={fieldLabel}>{tr("Buffer")}
            <span className="relative mt-1 block"><input inputMode="numeric" className={cx(inputClass, "h-10 pr-8 text-right tabular-nums")} value={d.buffer} placeholder="10"
              onChange={(e) => setD({ ...d, buffer: e.target.value.replace(/[^0-9]/g, "") })} />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400">%</span></span></label>
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {[[7, 10], [14, 10], [30, 15]].map(([dd, bb]) => (
            <button key={dd} type="button" onClick={() => setD({ ...d, horizon: String(dd), buffer: String(bb) })}
              className={cx("rounded-full border px-2.5 py-1 text-[11px] font-medium", h === dd && b === bb ? "border-brand-600 bg-brand-50 text-brand-700" : "border-neutral-200 text-neutral-600 hover:border-neutral-300")}>
              {tr("{0} days + {1}%", dd, bb)}</button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-neutral-500">{tr("Average daily sales × the days planned, plus a buffer")}{h ? ` · ${tr("e.g. 100 portions a day → {0} portions", Math.ceil(100 * h * (1 + b / 100)))}` : ""}</p>
      </FilterRow>
    </MonitorFilterSheet>
  );
}
