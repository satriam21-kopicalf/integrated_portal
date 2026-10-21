"use client";

// Premix calculator (Cost Control, D-52): replaces the workbook "Kalkulator Premix WIP – SO BAR KITCHEN".
// Calculator: a quantity per WIP and unit (as the sheet "Isi Di sini") → grams of every ingredient, rounded up like the
// sheet, with the WIP entered, the share of each ingredient and the breakdown per WIP. Recipes: the recipes with
// versions (what the count form uses). The workbook import tab was removed (2026-10-20: not used).

import { Calculator, ChevronDown, Copy, Download, FlaskConical, Minus, Plus, RotateCcw, Scale, Search, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, Page, Panel, SearchBox, fmtNumber, theadClass, useToast, PageNav, usePaged } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar } from "@/so/ui/Filters";
import RecipeDrawer from "@/so/features/premix/RecipeDrawer";
import { CalcResult, num, Recipe, unitGrams, withGram } from "@/so/features/premix/types";
import { api, errorText } from "@/so/lib/api";
import { useMe } from "@/so/lib/me";
import { tr } from "@/lib/i18n";

type Tab = "calculator" | "recipes";
const fmtG = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 });
/** Grams of one unit, 0 when the recipe gives no conversion. */
const gramsOf = (u: Recipe["units"][number], batch: number) => { const g = unitGrams(u, batch); return Number.isFinite(g) && g > 0 ? g : 0; };

export default function PremixPage() {
  const { can } = useMe();
  const manage = can("recipe.wip.manage");
  const [tab, setTab] = useState<Tab>("calculator");
  const [rows, setRows] = useState<Recipe[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<string | "new" | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await api<Recipe[]>("/api/so/recipes"));
    } catch (e) {
      setError(errorText(e));
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: "calculator", label: tr("Calculator"), icon: <Calculator size={15} /> },
    { key: "recipes", label: `${tr("Recipes")}${rows ? ` (${rows.length})` : ""}`, icon: <FlaskConical size={15} /> },
  ];

  const all = rows ?? [];
  const active = all.filter(r => r.is_active && r.active).length;
  const toFix = all.filter(r => (r.active?.issues ?? []).some(i => i.level === "error")).length;
  const drafts = all.filter(r => r.drafts > 0).length;
  return (
    <Page title={tr("Premix calculator")} subtitle={tr("Premix recipes of Cost Control: grams of every ingredient, and the WIP form of the stock opname")}
      actions={manage && tab === "recipes" ? <Button onClick={() => setOpen("new")}><Plus size={16} /> {tr("New recipe")}</Button> : undefined}
      stats={
        <StatStrip label={tr("Summary")} columns={4} gridClassName="grid-cols-2 xl:grid-cols-4">
          <Stat label={tr("Recipes")} icon={<FlaskConical size={13} />} value={rows ? fmtNumber(all.length) : <StatSkeleton />}>
            {rows && <p>{tr("{0} inactive", fmtNumber(all.filter(r => !r.is_active).length))}</p>}
          </Stat>
          <Stat label={tr("Active in the count")} emphasis value={rows ? fmtNumber(active) : <StatSkeleton />}>
            {rows && <p>{tr("offered in the WIP form of the stock opname")}</p>}
          </Stat>
          <Stat label={tr("To fix")} value={rows ? fmtNumber(toFix) : <StatSkeleton />}>
            {rows && <p>{toFix ? tr("ingredients without a stock item") : tr("every ingredient is mapped")}</p>}
          </Stat>
          <Stat label={tr("Drafts")} value={rows ? fmtNumber(drafts) : <StatSkeleton />}>
            {rows && <p>{tr("versions waiting to be activated")}</p>}
          </Stat>
        </StatStrip>
      }>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map(t => (
          <button key={t.key} type="button" role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}
            className={cx("-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium",
              tab === t.key ? "border-blue-600 text-blue-700" : "border-transparent text-slate-500 hover:text-slate-800")}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>
      {error ? <Panel><ErrorState message={error} onRetry={load} /></Panel>
        : tab === "calculator" ? <CalculatorTab recipes={rows} />
        : <RecipesTab recipes={rows} onOpen={setOpen} />}
      {open && <RecipeDrawer recipeId={open} onClose={() => setOpen(null)} onChanged={load} />}
    </Page>
  );
}

// ------------------------------------------------------------------------------------------------- calculator

type Entry = { recipe_id: string; uom: string; qty: number };

/** "2.5" from what is typed: digits and one decimal point (a comma counts as the point). */
const cleanQty = (v: string) => {
  const s = v.replace(",", ".").replace(/[^0-9.]/g, "");
  const [a, ...b] = s.split(".");
  return b.length ? `${a}.${b.join("")}` : a;
};

function Stepper({ value, label, unit, hint, onChange }: { value: string; label: string; unit: string; hint?: string; onChange: (v: string) => void }) {
  const n = num(value);
  const step = (d: number) => onChange(String(Math.max(0, Math.round((n + d) * 100) / 100) || ""));
  return (
    <div className="min-w-0">
      <div className={cx("flex h-10 items-stretch overflow-hidden rounded-lg border bg-white transition-colors",
        n > 0 ? "border-blue-500 ring-2 ring-blue-500/15" : "border-slate-200")}>
        <button type="button" onClick={() => step(-1)} disabled={n <= 0} aria-label={tr("Less {0}", label)}
          className="flex w-9 flex-shrink-0 items-center justify-center text-slate-500 hover:bg-slate-50 disabled:opacity-30"><Minus size={14} /></button>
        <input inputMode="decimal" value={value} placeholder="0" aria-label={label} onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => onChange(cleanQty(e.target.value))}
          className="w-full min-w-0 border-x border-slate-100 bg-transparent px-1 text-center text-sm font-semibold tabular-nums text-slate-900 outline-none placeholder:font-normal placeholder:text-slate-300" />
        <button type="button" onClick={() => step(1)} aria-label={tr("More {0}", label)}
          className="flex w-9 flex-shrink-0 items-center justify-center text-slate-500 hover:bg-slate-50"><Plus size={14} /></button>
      </div>
      <p className="mt-1 truncate text-center text-[11px] text-slate-500" title={hint}><span className="font-semibold text-slate-700">{unit}</span>{hint ? ` · ${hint}` : ""}</p>
    </div>
  );
}

function CalculatorTab({ recipes }: { recipes: Recipe[] | null }) {
  const toast = useToast();
  const [qty, setQty] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [onlyPicked, setOnlyPicked] = useState(false);
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [breakdown, setBreakdown] = useState(false);
  const active = useMemo(() => (recipes ?? []).filter(r => r.is_active && r.active), [recipes]);
  const entries = useMemo<Entry[]>(() => Object.entries(qty).filter(([, v]) => num(v) > 0).map(([k, v]) => {
    const [recipe_id, uom] = k.split("|");
    return { recipe_id, uom, qty: num(v) };
  }), [qty]);
  const picked = useMemo(() => new Set(entries.map(e => e.recipe_id)), [entries]);
  const shown = active.filter(r => (!q.trim() || `${r.name} ${r.code}`.toLowerCase().includes(q.trim().toLowerCase())) && (!onlyPicked || picked.has(r.id)));

  useEffect(() => {
    if (!entries.length) { setResult(null); setError(""); return; }
    setLoading(true);
    const t = setTimeout(() => {
      api<CalcResult>("/api/so/recipes/calculate", { method: "POST", json: { entries } })
        .then(r => { setResult(r); setError(""); }).catch(e => setError(errorText(e))).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [entries]);

  const setOne = (key: string, v: string) => setQty(o => ({ ...o, [key]: v }));
  const wipGrams = result?.rows.reduce((s, r) => s + r.qty_base, 0) ?? 0;
  const totalRounded = result?.totals.reduce((s, t) => s + t.rounded, 0) ?? 0;
  const stockCount = result?.totals.filter(t => t.is_stock).length ?? 0;

  const table = () => result ? [
    ["Ingredient", "Item code", "Grams (rounded up)", "Grams (exact)", "Stock"],
    ...result.totals.map(t => [t.name, t.item_code ?? "", String(t.rounded), t.qty_base.toFixed(2), t.is_stock ? "yes" : "no"]),
    [], ["WIP", "Unit", "Qty", "WIP grams"],
    ...result.rows.map(r => [r.name, r.uom, String(r.qty), r.qty_base.toFixed(2)]),
  ] : [];
  const exportCsv = () => {
    const url = URL.createObjectURL(new Blob(["﻿" + table().map(r => r.join(";")).join("\n")], { type: "text/csv;charset=utf-8" }));
    Object.assign(document.createElement("a"), { href: url, download: `premix-calculator-${new Date().toISOString().slice(0, 10)}.csv` }).click();
    URL.revokeObjectURL(url);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(table().map(r => r.join("\t")).join("\n"));
      toast(tr("Copied: paste it into a spreadsheet"));
    } catch {
      toast(tr("Copying is not allowed in this browser"), "error");
    }
  };

  if (recipes && !active.length) {
    return <Panel><Empty icon={<FlaskConical size={28} />} title={tr("No active recipes yet")}>{tr("Add a recipe under Recipes and activate it.")}</Empty></Panel>;
  }
  return (
    <div className="grid gap-5 pb-20 xl:grid-cols-[minmax(0,1fr)_22rem] xl:pb-0 2xl:grid-cols-[minmax(0,1fr)_26rem]">
      {/* recipes and their quantities */}
      <section className="min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">{tr("1. Enter the WIP quantities")}</h2>
            <p className="text-xs text-slate-500">{tr("Per unit (pail, teko, gram…); the grams of the WIP appear under each recipe.")}</p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="min-w-0 flex-1"><SearchBox value={q} onChange={setQ} placeholder={tr("Search recipe")} /></div>
            <div className="flex rounded-lg bg-slate-100 p-0.5 text-sm" role="radiogroup" aria-label={tr("Show")}>
              {[[false, tr("All ({0})", active.length)], [true, tr("Entered ({0})", picked.size)]].map(([v, label]) => (
                <button key={String(v)} type="button" role="radio" aria-checked={onlyPicked === v} onClick={() => setOnlyPicked(v as boolean)}
                  className={cx("flex-1 whitespace-nowrap rounded-md px-3 py-1.5 font-medium transition-colors",
                    onlyPicked === v ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-800")}>{label as string}</button>
              ))}
            </div>
          </div>
        </div>
        {recipes === null ? (
          <div className="space-y-2 p-4">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-16 rounded-lg" />)}</div>
        ) : shown.length === 0 ? (
          <Empty icon={<Search size={26} />} title={onlyPicked ? tr("No quantity entered yet") : tr("Nothing matches the search")} />
        ) : (
          <ul className="divide-y divide-slate-100">
            {shown.map(r => {
              const batch = num(r.active!.output_qty_base);
              const units = withGram(r.units);
              const grams = units.reduce((s, u) => s + num(qty[`${r.id}|${u.uom}`]) * gramsOf(u, batch), 0);
              const on = grams > 0;
              return (
                <li key={r.id} className={cx("relative px-4 py-3.5 transition-colors", on && "bg-blue-50/40")}>
                  {on && <span className="absolute inset-y-0 left-0 w-1 bg-blue-600" aria-hidden />}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        <span className="font-mono">{r.code}</span> · v{r.active!.version_no} · {tr("batch {0} g", fmtG(batch))}
                        {r.facility_types.length ? ` · ${r.facility_types.join(", ")}` : ""}
                        {` · ${tr("SO in {0}", r.count_uom || "Gram")}`}
                      </p>
                    </div>
                    {on && (
                      <span className="inline-flex flex-shrink-0 items-center gap-1 rounded-full bg-blue-600 px-2.5 py-0.5 text-xs font-semibold text-white tabular-nums">
                        <Scale size={12} />{tr("{0} g of WIP", fmtG(grams, 1))}
                      </span>
                    )}
                  </div>
                  <div className={cx("mt-2.5 grid gap-2", units.length === 1 ? "max-w-[11rem] grid-cols-1" : units.length === 2 ? "max-w-[22rem] grid-cols-2" : "max-w-[33rem] grid-cols-3")}>
                    {units.map(u => {
                      const g = gramsOf(u, batch);
                      return (
                        <Stepper key={u.uom} value={qty[`${r.id}|${u.uom}`] ?? ""} label={`${r.name} · ${u.uom}`} unit={u.uom}
                          hint={u.uom.toLowerCase() === "gram" || !g ? undefined : `${fmtG(g, 0)} g`} onChange={v => setOne(`${r.id}|${u.uom}`, v)} />
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* the result */}
      <aside id="premix-result" className="min-w-0 xl:sticky xl:top-4 xl:self-start">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-start justify-between gap-3 border-b border-slate-100 p-4">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">{tr("2. Ingredients to prepare")}</h2>
              <p className="text-xs text-slate-500">{tr("Grams per ingredient, rounded up to the gram as in the workbook")}</p>
            </div>
            {entries.length > 0 && (
              <button type="button" onClick={() => setQty({})} title={tr("Reset")} aria-label={tr("Reset")}
                className="flex-shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"><RotateCcw size={16} /></button>
            )}
          </div>
          {!entries.length ? (
            <div className="flex flex-col items-center px-6 py-12 text-center">
              <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Calculator size={22} /></span>
              <p className="text-sm font-medium text-slate-800">{tr("Enter a WIP quantity to start")}</p>
              <p className="mt-1 max-w-xs text-xs text-slate-500">{tr("The grams of every ingredient appear here as you type, ready to copy or download.")}</p>
            </div>
          ) : error ? <p className="p-4 text-sm text-red-600">{error}</p> : (
            <div className={cx(loading && !result && "opacity-60")}>
              <dl className="grid grid-cols-3 divide-x divide-slate-100 border-b border-slate-100 text-center">
                <Tile k={tr("WIP")} v={fmtNumber(result?.rows.length ?? entries.length)} />
                <Tile k={tr("WIP grams")} v={result ? fmtG(wipGrams) : "…"} />
                <Tile k={tr("Ingredients")} v={result ? fmtNumber(result.totals.length) : "…"} />
              </dl>

              {result && (
                <>
                  <div className="border-b border-slate-100 px-4 py-3">
                    <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">{tr("WIP entered")}</p>
                    <ul className="space-y-1.5">
                      {result.rows.map(r => (
                        <li key={`${r.recipe_id}|${r.uom}`} className="flex items-center gap-2 text-sm">
                          <span className="min-w-0 flex-1 truncate text-slate-800">{r.name}</span>
                          <span className="whitespace-nowrap tabular-nums text-slate-600">{fmtG(r.qty, 2)} {r.uom}</span>
                          <span className="w-20 whitespace-nowrap text-right font-semibold tabular-nums text-slate-900">{fmtG(r.qty_base)} g</span>
                          <button type="button" onClick={() => setOne(`${r.recipe_id}|${r.uom}`, "")} aria-label={tr("Remove {0}", r.name)}
                            className="rounded p-0.5 text-slate-300 hover:bg-slate-100 hover:text-slate-700"><X size={14} /></button>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="max-h-[28rem] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className={cx(theadClass, "sticky top-0 z-10")}><tr><th className="px-4 py-2">{tr("Ingredient")}</th><th className="px-4 py-2 text-right">{tr("Grams")}</th></tr></thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.totals.map(t => {
                          const share = totalRounded ? (t.rounded / totalRounded) * 100 : 0;
                          return (
                            <tr key={t.item_id ?? t.name}>
                              <td className="px-4 py-2">
                                <span className={cx("block", t.is_stock ? "text-slate-800" : "text-slate-500")}>{t.name}</span>
                                <span className="mt-1 flex items-center gap-2">
                                  <span className="h-1 w-20 overflow-hidden rounded-full bg-slate-100"><span className="block h-full rounded-full bg-blue-500" style={{ width: `${Math.max(share, 2)}%` }} /></span>
                                  <span className="text-[11px] text-slate-400">{t.is_stock ? (t.item_code ?? tr("not mapped")) : tr("not a stock item")}</span>
                                </span>
                              </td>
                              <td className="px-4 py-2 text-right align-top">
                                <span className="block text-base font-semibold tabular-nums text-slate-900">{fmtG(t.rounded)}</span>
                                <span className="block text-[11px] tabular-nums text-slate-400">{fmtG(t.qty_base, 2)} g</span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div className="border-t border-slate-100">
                    <button type="button" onClick={() => setBreakdown(v => !v)} aria-expanded={breakdown}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                      {tr("Breakdown per WIP")} <ChevronDown size={16} className={cx("transition-transform", breakdown && "rotate-180")} />
                    </button>
                    {breakdown && (
                      <div className="space-y-3 px-4 pb-4">
                        {result.rows.map(r => (
                          <div key={`${r.recipe_id}|${r.uom}`} className="rounded-lg border border-slate-200">
                            <p className="flex justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                              <span className="truncate">{r.name}</span><span className="whitespace-nowrap tabular-nums">{fmtG(r.qty, 2)} {r.uom} · {fmtG(r.qty_base)} g</span>
                            </p>
                            <ul className="divide-y divide-slate-100 text-xs">
                              {r.components.map(c => (
                                <li key={c.item_id ?? c.name} className="flex justify-between gap-2 px-3 py-1.5">
                                  <span className={cx("truncate", c.is_stock ? "text-slate-700" : "text-slate-400")}>{c.name}</span>
                                  <span className="tabular-nums text-slate-600">{fmtG(c.qty_base, 2)} g</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="mr-auto text-xs text-slate-500">{tr("{0} stock items · {1} g in total", stockCount, fmtG(totalRounded))}</p>
                    <Button variant="secondary" size="sm" onClick={() => void copy()}><Copy size={14} /> {tr("Copy")}</Button>
                    <Button variant="secondary" size="sm" onClick={exportCsv}><Download size={14} /> CSV</Button>
                  </div>
                </>
              )}
            </div>
          )}
        </section>
      </aside>

      {/* phones: what is entered and a jump to the result */}
      {entries.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-4 pt-3 backdrop-blur xl:hidden"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}>
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">{tr("{0} WIP · {1} g", entries.length, result ? fmtG(wipGrams) : "…")}</p>
              <p className="truncate text-xs text-slate-500">{result ? tr("{0} ingredients", result.totals.length) : tr("Calculating…")}</p>
            </div>
            <Button size="sm" onClick={() => document.getElementById("premix-result")?.scrollIntoView({ behavior: "smooth" })}>{tr("See ingredients")}</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Tile({ k, v }: { k: string; v: string }) {
  return (
    <div className="px-2 py-3">
      <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{k}</dt>
      <dd className="mt-0.5 text-lg font-semibold tabular-nums text-slate-900">{v}</dd>
    </div>
  );
}

// ------------------------------------------------------------------------------------------------- recipes

type RF = { status: string; type: string; facility: string };
const RF_EMPTY: RF = { status: "", type: "", facility: "" };
const recipeStatus = (r: Recipe) => !r.is_active ? "INACTIVE" : (r.active?.issues ?? []).some(i => i.level === "error") ? "FIX" : !r.active ? "NO_VERSION" : r.drafts ? "DRAFT" : "ACTIVE";
const RSTATUS: Record<string, () => string> = {
  ACTIVE: () => tr("Active"), DRAFT: () => tr("Has a draft"), FIX: () => tr("To fix"), NO_VERSION: () => tr("No active version"), INACTIVE: () => tr("Inactive"),
};

function RecipesTab({ recipes, onOpen }: { recipes: Recipe[] | null; onOpen: (id: string) => void }) {
  const [q, setQ] = useState("");
  const [f, setF] = useState<RF>(RF_EMPTY);
  const [sheet, setSheet] = useState(false);
  const all = recipes ?? [];
  const types = Array.from(new Set(all.map(r => r.recipe_type)));
  const facilities = Array.from(new Set(all.flatMap(r => r.facility_types)));
  const shown = all.filter(r => (!q.trim() || `${r.name} ${r.code}`.toLowerCase().includes(q.trim().toLowerCase()))
    && (!f.status || recipeStatus(r) === f.status) && (!f.type || r.recipe_type === f.type) && (!f.facility || r.facility_types.includes(f.facility)));
  const paged = usePaged(shown, shown.length + q);
  const chips: ActiveFilter[] = [
    ...(f.status ? [{ key: "s", label: RSTATUS[f.status](), onRemove: () => setF({ ...f, status: "" }) }] : []),
    ...(f.type ? [{ key: "t", label: f.type, onRemove: () => setF({ ...f, type: "" }) }] : []),
    ...(f.facility ? [{ key: "f", label: f.facility, onRemove: () => setF({ ...f, facility: "" }) }] : []),
  ];
  return (
    <Panel toolbar={<FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search recipe")} filters={chips} onOpen={() => setSheet(true)} onClear={() => setF(RF_EMPTY)} />}
      footer={recipes ? <><span>{tr("{0} of {1} shown", shown.length, all.length)}</span><PageNav paged={paged} /></> : undefined}>
      {sheet && <RecipeFilters value={f} types={types} facilities={facilities} onClose={() => setSheet(false)} onApply={v => { setF(v); setSheet(false); }} />}
      {recipes && !recipes.length ? (
        <Empty icon={<FlaskConical size={28} />} title={tr("No recipes yet")}>{tr("Add the first recipe with New recipe.")}</Empty>
      ) : recipes && !shown.length ? (
        <Empty icon={<Search size={28} />} title={tr("Nothing matches the search or filters")} />
      ) : (
        <div className="overflow-x-auto">
          <table className="m-cards w-full min-w-[720px] text-sm">
            <thead className={theadClass}>
              <tr><th className="px-4 py-2.5">{tr("Recipe")}</th><th className="px-4 py-2.5">{tr("Units")}</th><th className="px-4 py-2.5 text-right">{tr("Batch")}</th>
                <th className="px-4 py-2.5 text-right">{tr("Components")}</th><th className="px-4 py-2.5">{tr("Status")}</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recipes === null ? Array.from({ length: 6 }, (_, i) => <tr key={i}><td colSpan={5} className="px-4 py-3"><div className="skeleton h-8 rounded" /></td></tr>) : paged.rows.map(r => {
                const errors = r.active?.issues.filter(i => i.level === "error").length ?? 0;
                const warnings = r.active?.issues.filter(i => i.level === "warning") ?? [];
                return (
                  <tr key={r.id} className="group cursor-pointer hover:bg-slate-50/70" onClick={() => onOpen(r.id)}>
                    <td className="px-4 py-3">
                      <span className="block font-medium text-slate-900 group-hover:text-blue-700">{r.name}</span>
                      <span className="block font-mono text-[11px] text-slate-400">{r.code} · {r.recipe_type}{r.facility_types.length ? ` · ${r.facility_types.join(", ")}` : ""}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-600">{r.units.map(u => u.uom).join(" · ")}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.active ? `${fmtG(num(r.active.output_qty_base))} g` : "-"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.active?.lines.length ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className="flex flex-wrap gap-1">
                        {!r.is_active ? <Badge>{tr("Inactive")}</Badge> : r.active ? <Badge tone="green">{tr("Active v{0}", r.active.version_no)}</Badge> : <Badge tone="amber">{tr("No active version")}</Badge>}
                        {r.drafts > 0 && <Badge tone="blue">{tr("Draft")}</Badge>}
                        {errors > 0 && <Badge tone="red">{tr("{0} to fix", errors)}</Badge>}
                        {warnings.map((w, i) => <Badge key={i} tone="amber" title={w.message}>{w.ratio ? `${(w.ratio * 100).toFixed(1)}%` : tr("Check")}</Badge>)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}

function RecipeFilters({ value, types, facilities, onApply, onClose }: {
  value: RF; types: string[]; facilities: string[]; onApply: (v: RF) => void; onClose: () => void;
}) {
  const [d, setD] = useState(value);
  return (
    <FilterSheet onClose={onClose} onApply={() => onApply(d)} onReset={() => setD(RF_EMPTY)}>
      <FilterSection title={tr("Status")}>
        <ChoiceGroup label="" value={d.status} onChange={v => setD({ ...d, status: v })}
          choices={[{ value: "", label: tr("All") }, ...Object.keys(RSTATUS).map(k => ({ value: k, label: RSTATUS[k]() }))]} />
      </FilterSection>
      <FilterSection title={tr("Recipe type")}>
        <ChoiceGroup label="" value={d.type} onChange={v => setD({ ...d, type: v })} choices={[{ value: "", label: tr("All") }, ...types.map(t => ({ value: t, label: t }))]} />
      </FilterSection>
      {facilities.length > 0 && (
        <FilterSection title={tr("Facility type")}>
          <ChoiceGroup label="" value={d.facility} onChange={v => setD({ ...d, facility: v })} choices={[{ value: "", label: tr("All") }, ...facilities.map(t => ({ value: t, label: t }))]} />
        </FilterSection>
      )}
    </FilterSheet>
  );
}
