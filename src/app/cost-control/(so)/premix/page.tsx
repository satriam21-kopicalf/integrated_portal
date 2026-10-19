"use client";

// Premix calculator (Cost Control, D-52): replaces the workbook "Kalkulator Premix WIP – SO BAR KITCHEN".
// Calculator: a quantity per WIP and unit (as the sheet "Isi Di sini") → grams of every component, rounded up like
// the sheet. Recipes: the WIP recipes with versions (what the count form uses). Import: the workbook, dry run first.

import { Calculator, Download, FileSpreadsheet, FlaskConical, Plus, RotateCcw, Search, Upload } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, Page, Panel, SearchBox, SkeletonRows, fmtNumber, theadClass, useToast } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { ActiveFilter, ChoiceGroup, FilterSection, FilterSheet, FilterToolbar } from "@/so/ui/Filters";
import RecipeDrawer from "@/so/features/premix/RecipeDrawer";
import { CalcResult, ImportReport, num, Recipe } from "@/so/features/premix/types";
import { api, errorText } from "@/so/lib/api";
import { useMe } from "@/so/lib/me";
import { tr } from "@/lib/i18n";

type Tab = "calculator" | "recipes" | "import";
const fmtG = (v: number, d = 0) => v.toLocaleString(undefined, { maximumFractionDigits: d, minimumFractionDigits: 0 });

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
    { key: "recipes", label: `${tr("WIP recipes")}${rows ? ` (${rows.length})` : ""}`, icon: <FlaskConical size={15} /> },
    ...(manage ? [{ key: "import" as Tab, label: tr("Import workbook"), icon: <FileSpreadsheet size={15} /> }] : []),
  ];

  const all = rows ?? [];
  const active = all.filter(r => r.is_active && r.active).length;
  const toFix = all.filter(r => (r.active?.issues ?? []).some(i => i.level === "error")).length;
  const drafts = all.filter(r => r.drafts > 0).length;
  return (
    <Page title={tr("Premix calculator")} subtitle={tr("WIP / premix recipes of Cost Control: grams of every ingredient, and the WIP form of the stock opname")}
      actions={manage && tab === "recipes" ? <Button onClick={() => setOpen("new")}><Plus size={16} /> {tr("New recipe")}</Button> : undefined}
      stats={
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={tr("WIP recipes")} icon={<FlaskConical size={13} />} value={rows ? fmtNumber(all.length) : <StatSkeleton />}>
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
      <div role="tablist" className="mb-4 flex gap-1 overflow-x-auto border-b border-slate-200">
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
        : tab === "recipes" ? <RecipesTab recipes={rows} onOpen={setOpen} />
        : <ImportTab onDone={() => { void load(); }} />}
      {open && <RecipeDrawer recipeId={open} onClose={() => setOpen(null)} onChanged={load} />}
    </Page>
  );
}

// ------------------------------------------------------------------------------------------------- calculator

function CalculatorTab({ recipes }: { recipes: Recipe[] | null }) {
  const [qty, setQty] = useState<Record<string, string>>({});
  const [q, setQ] = useState("");
  const [result, setResult] = useState<CalcResult | null>(null);
  const [error, setError] = useState("");
  const active = useMemo(() => (recipes ?? []).filter(r => r.is_active && r.active), [recipes]);
  const shown = active.filter(r => !q.trim() || r.name.toLowerCase().includes(q.trim().toLowerCase()));
  const entries = useMemo(() => Object.entries(qty).filter(([, v]) => num(v) > 0).map(([k, v]) => {
    const [recipe_id, uom] = k.split("|");
    return { recipe_id, uom, qty: num(v) };
  }), [qty]);

  useEffect(() => {
    if (!entries.length) { setResult(null); return; }
    const t = setTimeout(() => {
      api<CalcResult>("/api/so/recipes/calculate", { method: "POST", json: { entries } })
        .then(r => { setResult(r); setError(""); }).catch(e => setError(errorText(e)));
    }, 300);
    return () => clearTimeout(t);
  }, [entries]);

  const exportCsv = () => {
    if (!result) return;
    const lines = [["Component", "Item code", "Grams (rounded up)", "Grams (exact)", "Stock"].join(";"),
      ...result.totals.map(t => [t.name, t.item_code ?? "", t.rounded, t.qty_base.toFixed(2), t.is_stock ? "yes" : "no"].join(";")),
      "", ["WIP", "Unit", "Qty", "WIP grams"].join(";"),
      ...result.rows.map(r => [r.name, r.uom, r.qty, r.qty_base.toFixed(2)].join(";"))];
    const url = URL.createObjectURL(new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `premix-calculator-${new Date().toISOString().slice(0, 10)}.csv` });
    a.click();
    URL.revokeObjectURL(url);
  };

  if (recipes && !active.length) {
    return <Panel><Empty icon={<FlaskConical size={28} />} title={tr("No active WIP recipes yet")}>{tr("Import the calculator workbook or add a recipe under WIP recipes.")}</Empty></Panel>;
  }
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,28rem)]">
      <Panel toolbar={<div className="flex items-center gap-2"><div className="flex-1"><SearchBox value={q} onChange={setQ} placeholder={tr("Search WIP")} /></div>
        {entries.length > 0 && <Button variant="secondary" onClick={() => setQty({})}><RotateCcw size={15} /> {tr("Clear")}</Button>}</div>}>
        <div className="overflow-x-auto">
          <table className="m-cards w-full min-w-[520px] text-sm">
            <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("WIP")}</th><th className="px-4 py-2.5">{tr("Quantity per unit")}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {recipes === null ? <SkeletonRows cols={2} /> : shown.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-2.5">
                    <span className="block font-medium text-slate-900">{r.name}</span>
                    <span className="block text-[11px] text-slate-400">v{r.active!.version_no} · {tr("batch {0} g", fmtG(num(r.active!.output_qty_base)))}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-2">
                      {r.units.map(u => {
                        const key = `${r.id}|${u.uom}`;
                        return (
                          <label key={u.uom} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <input inputMode="decimal" value={qty[key] ?? ""} placeholder="0" aria-label={`${r.name} · ${u.uom}`}
                              onChange={e => setQty(v => ({ ...v, [key]: e.target.value.replace(",", ".").replace(/[^0-9.]/g, "") }))}
                              className={cx("h-9 w-20 rounded-lg border px-2 text-right text-sm tabular-nums", num(qty[key]) > 0 ? "border-blue-400 bg-blue-50/50" : "border-slate-200")} />
                            <span title={u.grams ? `1 ${u.uom} = ${fmtG(u.grams, 2)} g` : undefined}>{u.uom}</span>
                          </label>
                        );
                      })}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel title={tr("Ingredients")} description={tr("Grams per ingredient, rounded up to the gram as in the workbook")}
        actions={result ? <Button variant="secondary" onClick={exportCsv}><Download size={15} /> CSV</Button> : undefined}>
        {error ? <p className="p-4 text-sm text-red-600">{error}</p> : !result ? (
          <p className="p-6 text-center text-sm text-slate-400">{tr("Enter quantities on the left")}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Ingredient")}</th><th className="px-4 py-2.5 text-right">{tr("Grams")}</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {result.totals.map(t => (
                  <tr key={t.item_id ?? t.name} className={t.is_stock ? "" : "text-slate-400"}>
                    <td className="px-4 py-2">
                      <span className="block">{t.name}</span>
                      <span className="block text-[11px] text-slate-400">{t.is_stock ? (t.item_code ?? tr("not mapped")) : tr("not a stock item")}</span>
                    </td>
                    <td className="px-4 py-2 text-right font-semibold tabular-nums" title={`${fmtG(t.qty_base, 2)} g`}>{fmtG(t.rounded)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
              {tr("{0} WIP entries · {1} g of WIP", result.rows.length, fmtG(result.rows.reduce((s, r) => s + r.qty_base, 0)))}
            </p>
          </div>
        )}
      </Panel>
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
  const chips: ActiveFilter[] = [
    ...(f.status ? [{ key: "s", label: RSTATUS[f.status](), onRemove: () => setF({ ...f, status: "" }) }] : []),
    ...(f.type ? [{ key: "t", label: f.type, onRemove: () => setF({ ...f, type: "" }) }] : []),
    ...(f.facility ? [{ key: "f", label: f.facility, onRemove: () => setF({ ...f, facility: "" }) }] : []),
  ];
  return (
    <Panel toolbar={<FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search recipe")} filters={chips} onOpen={() => setSheet(true)} onClear={() => setF(RF_EMPTY)} />}
      footer={recipes ? <span>{tr("{0} of {1} shown", shown.length, all.length)}</span> : undefined}>
      {sheet && <RecipeFilters value={f} types={types} facilities={facilities} onClose={() => setSheet(false)} onApply={v => { setF(v); setSheet(false); }} />}
      {recipes && !recipes.length ? (
        <Empty icon={<FlaskConical size={28} />} title={tr("No WIP recipes yet")}>{tr("Import the calculator workbook to start.")}</Empty>
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
              {recipes === null ? <SkeletonRows cols={5} /> : shown.map(r => {
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

// ------------------------------------------------------------------------------------------------- import

function ImportTab({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [file, setFile] = useState<{ name: string; data: string } | null>(null);
  const [report, setReport] = useState<ImportReport | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = (f: File | undefined) => {
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFile({ name: f.name, data: String(reader.result).split(",").pop() ?? "" });
      setReport(null);
    };
    reader.readAsDataURL(f);
  };
  const run = async (apply: boolean) => {
    if (!file) return;
    setBusy(true);
    setError("");
    try {
      const r = await api<ImportReport>("/api/so/recipes/import", { method: "POST", json: { file: file.data, apply } });
      setReport(r);
      if (apply) { toast(tr("Workbook imported")); onDone(); }
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const tone = { NEW: "blue", CHANGED: "amber", SAME: "slate" } as const;
  return (
    <div className="space-y-4">
      <Panel>
        <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
          <label className="flex flex-1 cursor-pointer items-center gap-3 rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm hover:border-blue-400 hover:bg-blue-50/40">
            <Upload size={18} className="text-slate-400" />
            <span className="min-w-0 flex-1 truncate text-slate-700">{file ? file.name : tr("Choose the workbook (.xlsx) with the sheet Database")}</span>
            <input type="file" accept=".xlsx" className="sr-only" onChange={e => pick(e.target.files?.[0])} />
          </label>
          <Button variant="secondary" loading={busy && !report} disabled={!file} onClick={() => run(false)}><Search size={15} /> {tr("Check")}</Button>
          <Button loading={busy && !!report} disabled={!report || report.applied || (report.summary.NEW + report.summary.CHANGED === 0)} onClick={() => run(true)}>
            {tr("Import {0} recipes", report ? report.summary.NEW + report.summary.CHANGED : 0)}
          </Button>
        </div>
        <p className="border-t border-slate-100 px-4 py-2.5 text-xs text-slate-500">
          {tr("New recipes whose ingredients are all known become active; a changed recipe gets a draft to check and activate. Ingredient names are matched to stock items; choices made in the editor are remembered.")}
        </p>
      </Panel>
      {error && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700">{error}</p>}
      {report && (
        <Panel title={report.applied ? tr("Imported") : tr("Check result (nothing saved yet)")}
          description={tr("{0} new · {1} changed · {2} unchanged", report.summary.NEW, report.summary.CHANGED, report.summary.SAME)}>
          {report.unmapped.length > 0 && (
            <div className="mx-4 mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
              <span className="font-semibold">{tr("Ingredients without a stock item ({0}):", report.unmapped.length)}</span> {report.unmapped.join(", ")}.
              {" "}{tr("Pick their items in the recipe editor; until then the recipe stays a draft.")}
            </div>
          )}
          {report.only_in_input.length > 0 && (
            <div className="mx-4 mt-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
              <span className="font-semibold">{tr("In the input sheet but not in the database:")}</span> {report.only_in_input.join(", ")}
            </div>
          )}
          <div className="mt-3 overflow-x-auto">
            <table className="m-cards w-full min-w-[640px] text-sm">
              <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Recipe")}</th><th className="px-4 py-2.5">{tr("Result")}</th>
                <th className="px-4 py-2.5 text-right">{tr("Batch")}</th><th className="px-4 py-2.5">{tr("Notes")}</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {report.recipes.map(r => (
                  <tr key={r.code}>
                    <td className="px-4 py-2.5"><span className="block font-medium text-slate-900">{r.name}</span><span className="block text-[11px] text-slate-400">{r.units.join(" · ")} · {tr("{0} components", r.components)}</span></td>
                    <td className="px-4 py-2.5">
                      <Badge tone={tone[r.status]}>{r.status === "NEW" ? tr("New") : r.status === "CHANGED" ? tr("Changed") : tr("Unchanged")}</Badge>
                      {r.activated && <Badge tone="green">{tr("Active")}</Badge>}
                      {r.version_no && !r.activated && <Badge tone="amber">{tr("Draft v{0}", r.version_no)}</Badge>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtG(r.batch)} g</td>
                    <td className="px-4 py-2.5 text-xs text-slate-600">{[...r.notes, ...(r.unmapped.length ? [tr("not mapped: {0}", r.unmapped.join(", "))] : [])].join(" · ") || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
