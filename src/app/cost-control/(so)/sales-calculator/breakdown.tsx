"use client";

// Sales Calculator → Breakdown (2026-11-10, management; integrated_portal_be app/menu_breakdown.py): the raw materials
// of every menu sold, category → sub category → menu → additional (No / Less / Normal / Extra Sugar and the other
// choices) → material, from the POS transactions and the recipe cards, every outlet together or one outlet. The Excel is
// an export job (the Sales Transactions design: title rows, a frozen header; a Data sheet ready for a Pivot Table) that
// the export notices follow and download.

import { CalendarDays, ChevronRight, Layers, Package, Store } from "lucide-react";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Badge, cx, Empty, ErrorState, fmtNumber, PageNav, Panel, theadClass, usePaged, useToast } from "@/so/ui";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { Tabs } from "@/components/kc";
import { SortTh, useSort } from "@/so/ui/Sort";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { type ActiveFilter, FilterToolbar, type Period, dmy, wibDay } from "@/so/ui/Filters";
import { ComboFilter, FilterRow, MonitorFilterSheet, QuickPeriod } from "@/so/ui/MonitorFilters";
import { call } from "@/so/features/checkin/checkin";
import ExcelExportMenu from "@/components/ExcelExportMenu";
import { type ExportJob, useExports } from "@/lib/exports";
import { tr } from "@/lib/i18n";
import { matches, num, rp } from "./parts";

type Material = { code: string | null; name: string; unit: string; qty: number; value: number; priced?: boolean; price?: number | null; menus?: number };
type MenuRow = { id: string; category: string; sub: string; menu: string; card: string; portions: number; value: number; unpriced: number;
  levels: Record<string, number>; choices: Record<string, number>; materials: Material[] };
type Data = { period: { from: string; to: string }; menus: MenuRow[]; materials: Material[]; totals: { portions: number; value: number; noCard: number } };
type Branch = { branch_code: string; branch_name: string };
const LEVELS = ["No Sugar", "Less Sugar", "Normal Sugar", "Extra Sugar"];
// the last 3 months up to yesterday (the data of today is still coming)
const DEFAULT = (): Period => ({ from: wibDay(-90), to: wibDay(-1) });

export function BreakdownStep() {
  const toast = useToast();
  const { follow } = useExports();
  const [period, setPeriod] = useState<Period>(DEFAULT);
  const [branch, setBranch] = useState("");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<"menus" | "materials">("menus");
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const [sheet, setSheet] = useState(false);
  useEffect(() => { void call<Branch[]>("/api/branches?company=all").then(setBranches).catch(() => setBranches([])); }, []);
  useEffect(() => {
    let alive = true;
    setData(null);
    setError(null);
    call<Data>(`/api/cost-control/sales-calc/breakdown?dateFrom=${period.from}&dateTo=${period.to}${branch ? `&branch=${encodeURIComponent(branch)}` : ""}`)
      .then((d) => { if (alive) setData(d); }).catch((e: Error) => { if (alive) setError(e.message); });
    return () => { alive = false; };
  }, [period, branch]);
  const branchName = branches.find((b) => b.branch_code === branch)?.branch_name;
  const menus = useMemo(() => (data?.menus ?? []).filter((m) => !q || matches(`${m.menu} ${m.sub} ${m.category} ${m.card}`, q)), [data, q]);
  const materials = useMemo(() => (data?.materials ?? []).filter((m) => !q || matches(`${m.name} ${m.code ?? ""}`, q)), [data, q]);
  const exportJob = (perBranch: boolean) => async () => {
    const job = await call<ExportJob>("/api/cost-control/sales-calc/breakdown/export", { method: "POST",
      json: { dateFrom: period.from, dateTo: period.to, branch: branch || null, perBranch } });
    follow(job, { dateFrom: period.from, dateTo: period.to, branch: branch || undefined, txType: "sales", report: "breakdown", format: "xlsx",
      branchLabel: branchName ?? tr("All Branches"), typeLabel: perBranch ? tr("Per outlet") : tr("All outlets combined") });
    toast(tr("The Excel is being prepared; it downloads by itself when ready"));
  };
  const chips: ActiveFilter[] = [
    { key: "p", label: `${dmy(period.from)} – ${dmy(period.to)}`, onRemove: () => setPeriod(DEFAULT()) },
    ...(branch ? [{ key: "b", label: branchName ?? branch, onRemove: () => setBranch("") }] : []),
  ];
  const t = data?.totals;
  return (
    <div className="space-y-4">
      <StatStrip label={tr("Summary")} columns={4}>
        <Stat label={tr("Portions Sold")} emphasis icon={<Layers size={13} />} value={t ? fmtNumber(Math.round(t.portions)) : <StatSkeleton />}>
          {data && <p>{tr("{0} menus", fmtNumber(data.menus.length))}</p>}
        </Stat>
        <Stat label={tr("Raw Material Value")} icon={<Package size={13} />} value={t ? rp(t.value) : <StatSkeleton />}>
          {data && <p>{tr("Pricelist, else the ESB HPP")}</p>}
        </Stat>
        <Stat label={tr("Raw Materials")} icon={<Package size={13} />} value={data ? fmtNumber(data.materials.length) : <StatSkeleton />} />
        <Stat label={tr("Menus without a Card")} icon={<Store size={13} />} value={t ? <span className={t.noCard ? "text-amber-600" : undefined}>{fmtNumber(t.noCard)}</span> : <StatSkeleton />}>
          {t && t.noCard > 0 && <p>{tr("their materials are not counted")}</p>}
        </Stat>
      </StatStrip>
      <Panel title={tr("Raw Materials per Menu")}
        description={tr("Category → sub category → menu → additional → raw materials, from the POS transactions and the recipe cards; sugar follows the grams per menu")}
        toolbar={<div className="space-y-3">
          <FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search menu, category or material")} filters={chips} onOpen={() => setSheet(true)}
            onClear={() => { setPeriod(DEFAULT()); setBranch(""); }}
            extra={<div className="ml-auto"><ExcelExportMenu title={tr("Export Breakdown")} choices={[
              { key: "branch", label: tr("Per outlet"), hint: tr("One row per month × outlet × menu × additional × material, ready for a Pivot Table"), icon: <Store size={16} />, tone: "bg-brand-50 text-brand-600", run: exportJob(true) },
              { key: "all", label: tr("All outlets combined"), hint: tr("One row per month × menu × additional × material"), icon: <Layers size={16} />, tone: "bg-violet-50 text-violet-600", run: exportJob(false) },
            ]} footer={<>{branchName ?? tr("All Branches")} · {dmy(period.from)} – {dmy(period.to)}</>} /></div>} />
          <Tabs label={tr("View")} value={view} onChange={(k) => setView(k as typeof view)} tabs={[
            { key: "menus", label: tr("Per Menu"), count: data ? fmtNumber(menus.length) : undefined },
            { key: "materials", label: tr("Per Raw Material"), count: data ? fmtNumber(materials.length) : undefined }]} />
        </div>}>
        {error ? <ErrorState message={error} /> : !data ? <SkeletonTable cols={view === "menus" ? 8 : 6} />
          : view === "menus" ? <MenuTable rows={menus} open={open} onOpen={(id) => setOpen(open === id ? null : id)} />
          : <MaterialTable rows={materials} />}
      </Panel>
      {sheet && (
        <MonitorFilterSheet active={1 + (branch ? 1 : 0)} onClose={() => setSheet(false)} onApply={() => setSheet(false)} onReset={() => { setPeriod(DEFAULT()); setBranch(""); }}>
          <FilterRow icon={<CalendarDays size={15} />} label={tr("Sales Period")} value={`${dmy(period.from)} – ${dmy(period.to)}`}>
            <QuickPeriod value={period} onChange={setPeriod} maxDays={92} />
            <p className="mt-2 text-[11px] text-neutral-500">{tr("Up to 3 months; the last 3 months by default")}</p>
          </FilterRow>
          <FilterRow icon={<Store size={15} />} label={tr("Branch")} value={branchName ?? null} onClear={() => setBranch("")}>
            <ComboFilter value={branch} onChange={setBranch} options={branches.map((x) => ({ value: x.branch_code, label: x.branch_name, hint: x.branch_code }))}
              allLabel={tr("All Branches")} placeholder={tr("Search Branch")} />
          </FilterRow>
        </MonitorFilterSheet>
      )}
    </div>
  );
}

/** The menus grouped by category and sub category; a menu opens its raw materials. */
function MenuTable({ rows, open, onOpen }: { rows: MenuRow[]; open: string | null; onOpen: (id: string) => void }) {
  const paged = usePaged(rows, rows.length);
  if (!rows.length) return <Empty title={tr("No sale in this period")} />;
  const headOf = (m: MenuRow) => `${m.category} · ${m.sub}`;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[920px] text-sm">
          <thead className={theadClass}><tr>
            <th className="px-4 py-2.5">{tr("Menu")}</th><th className="px-3 py-2.5 text-right">{tr("Portions")}</th>
            {LEVELS.map((l) => <th key={l} className="px-3 py-2.5 text-right">{l}</th>)}
            <th className="px-3 py-2.5 text-right">{tr("Material Value")}</th><th className="w-8" />
          </tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {paged.rows.map((m, i) => {
              const showHead = i === 0 || headOf(m) !== headOf(paged.rows[i - 1]);
              const isOpen = open === m.id;
              return (
                <Fragment key={m.id}>
                  {showHead && <tr><td colSpan={8} className="bg-neutral-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">{m.category || "—"} · {m.sub || "—"}</td></tr>}
                  <tr className={cx("cursor-pointer", isOpen ? "bg-brand-50/50" : "hover:bg-neutral-50")} onClick={() => onOpen(m.id)}>
                    <td className="px-4 py-2.5"><span className="font-medium text-neutral-900">{m.menu}</span>
                      <span className="block text-[11px] text-neutral-400">{m.card ? tr("Card: {0}", m.card) : <Badge tone="amber">{tr("No recipe card")}</Badge>}
                        {Object.keys(m.choices).length > 0 && ` · ${Object.entries(m.choices).map(([k, v]) => `${k} ${num(v, 0)}`).join(", ")}`}</span></td>
                    <td className="px-3 py-2.5 text-right font-medium tabular-nums">{num(m.portions, 0)}</td>
                    {LEVELS.map((l) => <td key={l} className="px-3 py-2.5 text-right tabular-nums text-neutral-600">{m.levels[l] ? num(m.levels[l], 0) : <span className="text-neutral-300">—</span>}</td>)}
                    <td className="px-3 py-2.5 text-right tabular-nums">{rp(m.value)}{m.unpriced > 0 && <span className="block text-[11px] text-amber-600">{tr("{0} without a price", m.unpriced)}</span>}</td>
                    <td className="px-2 text-neutral-400"><ChevronRight size={15} className={cx("transition-transform", isOpen && "rotate-90")} /></td>
                  </tr>
                  {isOpen && (
                    <tr><td colSpan={8} className="bg-neutral-50/60 px-4 py-3">
                      {m.materials.length === 0 || !m.card ? <p className="text-xs text-neutral-500">{tr("This menu has no recipe card yet: assign one in Assign Menus.")}</p> : (
                        <table className="w-full text-xs">
                          <thead><tr className="text-left text-neutral-500"><th className="py-1 pr-3">{tr("Raw Material")}</th><th className="py-1 pr-3 text-right">{tr("Quantity")}</th>
                            <th className="py-1 pr-3">{tr("Unit")}</th><th className="py-1 text-right">{tr("Value")}</th></tr></thead>
                          <tbody className="divide-y divide-neutral-200/60">
                            {m.materials.map((x) => (
                              <tr key={x.code ?? x.name}><td className="py-1 pr-3 text-neutral-800">{x.name}<span className="ml-1.5 text-[10px] text-neutral-400">{x.code}</span></td>
                                <td className={cx("py-1 pr-3 text-right tabular-nums", x.qty < 0 && "text-sky-700")}>{num(x.qty)}</td><td className="py-1 pr-3 text-neutral-500">{x.unit}</td>
                                <td className="py-1 text-right tabular-nums">{x.priced === false ? <span className="text-amber-600">{tr("No price")}</span> : rp(x.value)}</td></tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </td></tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t border-neutral-100 px-4 py-2"><PageNav paged={paged} /></div>
    </>
  );
}

type MKey = "name" | "qty" | "value" | "menus";
const mValue = (m: Material, k: MKey) => ({ name: m.name, qty: m.qty, value: m.value, menus: m.menus ?? 0 }[k]);

/** Every raw material over the menus in scope: sortable, 50 a page. */
function MaterialTable({ rows }: { rows: Material[] }) {
  const sorted = useSort<Material, MKey>(rows, mValue, { key: "value", dir: "desc" });
  const paged = usePaged(sorted.rows, rows.length + JSON.stringify(sorted.sort));
  if (!rows.length) return <Empty title={tr("No raw material in this period")} />;
  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead className={theadClass}><tr>
            <SortTh k="name" sort={sorted.sort} onSort={sorted.toggle}>{tr("Raw Material")}</SortTh>
            <SortTh k="qty" sort={sorted.sort} onSort={sorted.toggle} align="right" first="desc">{tr("Quantity")}</SortTh>
            <th className="px-4 py-2.5">{tr("Unit")}</th><th className="px-4 py-2.5 text-right">{tr("Unit Price")}</th>
            <SortTh k="value" sort={sorted.sort} onSort={sorted.toggle} align="right" first="desc">{tr("Value")}</SortTh>
            <SortTh k="menus" sort={sorted.sort} onSort={sorted.toggle} align="right" first="desc">{tr("Menus")}</SortTh>
          </tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {paged.rows.map((m) => (
              <tr key={m.code ?? m.name} className="hover:bg-neutral-50">
                <td className="px-4 py-2.5"><span className="font-medium text-neutral-900">{m.name}</span><span className="block text-[11px] text-neutral-400">{m.code}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{num(m.qty)}</td><td className="px-4 py-2.5 text-neutral-500">{m.unit}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{m.price == null ? <span className="text-amber-600">{tr("No price")}</span> : rp(m.price)}</td>
                <td className="px-4 py-2.5 text-right font-medium tabular-nums">{rp(m.value)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmtNumber(m.menus ?? 0)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end border-t border-neutral-100 px-4 py-2"><PageNav paged={paged} /></div>
    </>
  );
}
