"use client";

// Monitoring Stock → Stock List per month (page cc.stock-list; integrated_portal_be app/stock_list_month.py, 2026-11-19):
// one row per branch × material. Previous Balance = the stock opname at the end of the month before; Ending Stock = the
// latest checkpoint count of the month (7 / 14 / 21 / 28 / month end). Between them: Items In (Goods Receipt, Transfer
// In, Transit In) and Items Out (POS Sales, POS Non Sales, Transfer Out, Transit Out, Item Journal, Product Sales);
// Estimate Stock = Previous + In − Out; Actual Usage = Previous + In − Out (without POS usage) − Ending; Variance =
// Actual − System Usage. The other ESB moves (outlet purchase, production …) have no column but stay in the sum (tooltip).
// Transit In / Out are entered by Cost Control (Transit drawer, migration 123).

import { SortTh, useSort } from "@/so/ui/Sort";
import ExcelIconButton from "@/components/ExcelIconButton";
import { ArrowLeftRight, Boxes, Calculator, CalendarDays, Package, Plus, Store, Trash2 } from "lucide-react";
import Drawer from "@/so/ui/Drawer";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, Field, fmtNumber, inputClass, Page, PageNav, Panel, SkeletonRows, theadClass, usePaged, useToast } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { type ActiveFilter, FilterToolbar, dmy } from "@/so/ui/Filters";
import { ComboFilter, FilterRow, MonitorFilterSheet } from "@/so/ui/MonitorFilters";
import { Segmented } from "@/so/ui/Simple";
import { NativeSelect } from "@/so/ui/Jira";
import { call } from "@/so/features/checkin/checkin";
import { downloadXlsx } from "@/lib/xlsx";
import { tr } from "@/lib/i18n";
import { qtyText, rpText } from "@/so/features/stock-transfer/transfer";
import { DataSources } from '@/so/features/health/DataHealth';

type Row = { branch: string; branchName: string; code: string; name: string; category: string; unit: string;
  prev: number; received: number; transferIn: number; transitIn: number; /** other ESB moves: no column, inside the estimate */ other: number;
  sales: number; nonSales: number; transferOut: number; transitOut: number; journal: number; productSales: number;
  estimate: number; ending: number | null; system: number; actual: number | null; variance: number | null; variancePct: number | null;
  price: number | null; estimateValue: number | null };
type Head = { branch: string; branchName: string; prevDate: string | null; prevRefs: string[]; endDate: string | null; endRefs: string[];
  from: string; to: string; items: number; estimateValue: number };
type Data = { month: string; from: string; to: string; upto: string; branches: Head[]; rows: Row[] };
type Transit = { id: string; branch: string; code: string; name: string; unit: string; qty: number; direction: "in" | "out"; date: string; note: string | null; createdBy: string };
type View = "branch" | "material";
type SortKey = "branch" | "material" | "prev" | "received" | "tin" | "trin" | "sales" | "nonSales" | "tout" | "trout" | "journal" | "product"
  | "estimate" | "ending" | "system" | "actual" | "variance" | "variancePct" | "value";
const sortValue = (r: Row, k: SortKey) => ({ branch: r.branchName, material: r.name, prev: r.prev, received: r.received, tin: r.transferIn, trin: r.transitIn,
  sales: r.sales, nonSales: r.nonSales, tout: r.transferOut, trout: r.transitOut, journal: r.journal, product: r.productSales, estimate: r.estimate,
  ending: r.ending ?? -Infinity, system: r.system, actual: r.actual ?? -Infinity, variance: r.variance ?? -Infinity, variancePct: r.variancePct ?? -Infinity,
  value: r.estimateValue ?? -Infinity }[k]);
const thisMonth = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 7);
const pct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`);

export default function StockListPage() {
  const toast = useToast();
  const [month, setMonth] = useState(thisMonth);
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("branch");
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [category, setCategory] = useState("");
  const [sheet, setSheet] = useState(false);
  const [calc, setCalc] = useState<Row | null>(null);
  const [transit, setTransit] = useState(false);
  const load = () => { setError(null); setData(null); call<Data>(`/api/monitoring/stock/list?month=${month}`).then(setData).catch((e: Error) => setError(e.message)); };
  useEffect(load, [month]);
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => (!branch || r.branch === branch) && (!category || r.category === category)
    && (!q || `${r.name} ${r.code} ${r.branchName}`.toLowerCase().includes(q.toLowerCase()))), [data, branch, category, q]);
  const materials = useMemo(() => {
    const m = new Map<string, { code: string; name: string; unit: string; category: string; estimate: number; value: number; outlets: Row[] }>();
    for (const r of rows) {
      const x = m.get(r.code) ?? { code: r.code, name: r.name, unit: r.unit, category: r.category, estimate: 0, value: 0, outlets: [] };
      x.estimate += r.estimate; x.value += r.estimateValue ?? 0;
      if (r.estimate > 0) x.outlets.push(r);
      m.set(r.code, x);
    }
    return [...m.values()].sort((a, b) => b.value - a.value);
  }, [rows]);
  const sorted = useSort<Row, SortKey>(rows, sortValue);
  const paged = usePaged(sorted.rows, q + branch + category + view + month + JSON.stringify(sorted.sort), 50);
  const pagedM = usePaged(materials, q + branch + category + view + month, 50);
  const heads = data?.branches ?? [];
  const categories = [...new Set((data?.rows ?? []).map((r) => r.category).filter(Boolean))].sort();
  const estTotal = rows.reduce((a, r) => a + (r.estimateValue ?? 0), 0);
  const varValue = rows.reduce((a, r) => a + (r.variance != null && r.price != null ? r.variance * r.price : 0), 0);
  const counted = heads.filter((h) => h.endDate).length;
  const chips: ActiveFilter[] = [
    ...(branch ? [{ key: "b", label: heads.find((h) => h.branch === branch)?.branchName ?? branch, onRemove: () => setBranch("") }] : []),
    ...(category ? [{ key: "c", label: category, onRemove: () => setCategory("") }] : []),
  ];
  const exportRows = () => downloadXlsx({ fileName: `Stock List ${month}`, sheet: "Stock", title: `Stock List ${month}`,
    header: ["Cabang", "Previous Balance (tgl)", "Ending Stock (tgl)", "Kode", "Material", "Kategori", "Satuan", "Previous Balance",
      "IN: Goods Receipt", "IN: Transfer In", "IN: Transit In", "OUT: POS Sales", "OUT: POS Non Sales", "OUT: Transfer Out", "OUT: Transit Out",
      "OUT: Item Journal", "OUT: Product Sales", "Estimate Stock", "Ending Stock", "System Usage", "Actual Usage", "Variance (Qty)", "Variance (%)", "Harga", "Estimate Value"],
    rows: rows.map((r) => { const h = heads.find((x) => x.branch === r.branch); return [r.branchName, h?.prevDate ?? "", h?.endDate ?? "", r.code, r.name, r.category, r.unit,
      r.prev, r.received, r.transferIn, r.transitIn, r.sales, r.nonSales, r.transferOut, r.transitOut, r.journal, r.productSales, r.estimate, r.ending, r.system,
      r.actual, r.variance, r.variancePct, r.price, r.estimateValue]; }) });
  return (
    <Page title={tr("Stock List")} subtitle={tr("Per month: Previous Balance at the end of the month before, Ending Stock at the latest checkpoint SO")}
      stats={
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={tr("Branches")} emphasis icon={<Store size={13} />} value={data ? fmtNumber(heads.length) : <StatSkeleton />}>
            {data && <p>{tr("{0} with an Ending Stock", fmtNumber(counted))}</p>}</Stat>
          <Stat label={tr("Estimate Value")} icon={<Package size={13} />} value={data ? rpText(estTotal) : <StatSkeleton />}>{data && <p>{tr("{0} rows", fmtNumber(rows.length))}</p>}</Stat>
          <Stat label={tr("Variance Value")} icon={<Boxes size={13} />} value={data ? rpText(varValue) : <StatSkeleton />}>
            {data && <p>{tr("Actual − System Usage, valued")}</p>}</Stat>
          <Stat label={tr("Period")} icon={<CalendarDays size={13} />} value={data ? `${dmy(data.from)} – ${dmy(data.upto)}` : <StatSkeleton />} />
        </StatStrip>
      }>
      <DataSources keys={['esbIntegrity', 'so', 'gr', 'transfers', 'waste']} />
      <Panel toolbar={<div className="space-y-3">
        <FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search material or branch")} filters={chips} onOpen={() => setSheet(true)} onClear={() => { setBranch(""); setCategory(""); }}
          extra={<div className="ml-auto flex items-center gap-2">
            <input type="month" value={month} max={thisMonth()} onChange={(e) => e.target.value && setMonth(e.target.value)} aria-label={tr("Month")} className={cx(inputClass, "h-9 w-[10rem]")} />
            <Button size="sm" variant="secondary" onClick={() => setTransit(true)}><ArrowLeftRight size={14} />{tr("Transit")}</Button>
            <ExcelIconButton boxed label={tr("Export to Excel")} disabled={!rows.length} onClick={() => void exportRows().catch((e) => toast((e as Error).message, "error"))} />
          </div>} />
        <Segmented label={tr("View")} value={view} onChange={setView} options={[{ value: "branch", label: tr("Per Branch") }, { value: "material", label: tr("Per Material") }]} />
      </div>} footer={data ? <><span>{tr("{0} shown", fmtNumber(view === "branch" ? rows.length : materials.length))}</span><PageNav paged={view === "branch" ? paged : pagedM} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : !data ? <table className="w-full"><tbody><SkeletonRows cols={7} /></tbody></table>
          : !rows.length ? <Empty icon={<Boxes size={26} />} title={tr("No stock matches")} />
          : view === "branch" ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[2100px] border-separate border-spacing-0 text-[13px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead className={theadClass}>
                <tr className="[&>th]:border-b [&>th]:border-neutral-200 [&>th]:px-3 [&>th]:py-1.5 [&>th]:text-center">
                  <th colSpan={3} className="sticky left-0 z-[2] bg-white" /><th colSpan={3} className="border-l text-emerald-700">{tr("Items In")}</th>
                  <th colSpan={6} className="border-l text-red-700">{tr("Items Out")}</th><th colSpan={7} className="border-l" /></tr>
                <tr className="[&>th]:border-b-2 [&>th]:border-neutral-200">
                <SortTh k="branch" sort={sorted.sort} onSort={sorted.toggle} pad="sticky left-0 z-[2] w-[13rem] min-w-[13rem] bg-white py-2 pl-5 pr-3">{tr("Branch")}</SortTh>
                <SortTh k="material" sort={sorted.sort} onSort={sorted.toggle} pad="sticky left-[13rem] z-[2] w-[15rem] min-w-[15rem] border-r border-neutral-200 bg-white px-3 py-2">{tr("Material")}</SortTh>
                <SortTh k="prev" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Previous Balance")}</SortTh>
                <SortTh k="received" sort={sorted.sort} onSort={sorted.toggle} pad="border-l border-neutral-200 px-3 py-2" align="right" first="desc">{tr("Goods Receipt")}</SortTh>
                <SortTh k="tin" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Transfer In")}</SortTh>
                <SortTh k="trin" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Transit In")}</SortTh>
                <SortTh k="sales" sort={sorted.sort} onSort={sorted.toggle} pad="border-l border-neutral-200 px-3 py-2" align="right" first="desc">{tr("POS Sales")}</SortTh>
                <SortTh k="nonSales" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("POS Non Sales")}</SortTh>
                <SortTh k="tout" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Transfer Out")}</SortTh>
                <SortTh k="trout" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Transit Out")}</SortTh>
                <SortTh k="journal" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Item Journal")}</SortTh>
                <SortTh k="product" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Product Sales")}</SortTh>
                <SortTh k="estimate" sort={sorted.sort} onSort={sorted.toggle} pad="border-l border-neutral-200 px-3 py-2" align="right" first="desc">{tr("Estimate Stock")}</SortTh>
                <SortTh k="ending" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Ending Stock")}</SortTh>
                <SortTh k="system" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("System Usage")}</SortTh>
                <SortTh k="actual" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Actual Usage")}</SortTh>
                <SortTh k="variance" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Variance (Qty)")}</SortTh>
                <SortTh k="variancePct" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Variance (%)")}</SortTh>
                <SortTh k="value" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2 pr-5" align="right" first="desc">{tr("Estimate Value")}</SortTh></tr></thead>
              <tbody className="[&>tr>td]:border-b [&>tr>td]:border-neutral-100">{paged.rows.map((r) => {
                const h = heads.find((x) => x.branch === r.branch);
                const num = (v: number, sign: "+" | "−" | "", cls = "text-neutral-700") => (
                  <td className={cx("px-3 py-2 text-right tabular-nums", v ? cls : "text-neutral-300")}>{v ? `${sign}${qtyText(Math.abs(v))}` : "—"}</td>);
                const vTone = r.variance == null ? "text-neutral-300" : r.variance > 1e-6 ? "text-red-700" : r.variance < -1e-6 ? "text-emerald-700" : "text-neutral-500";
                return (
                  <tr key={`${r.branch}:${r.code}`} className="group cursor-pointer [&>td]:bg-white hover:[&>td]:bg-neutral-50" onClick={() => setCalc(r)} title={tr("See the calculation")}>
                    <td className="sticky left-0 z-[1] w-[13rem] max-w-[13rem] py-2 pl-5 pr-3"
                      title={`${r.branchName}${h ? ` · ${h.prevDate ? dmy(h.prevDate) : "—"} → ${h.endDate ? dmy(h.endDate) : tr("no checkpoint yet")}` : ""}`}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        {h && !h.endDate && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" aria-label={tr("no checkpoint yet")} />}
                        <span className="truncate text-neutral-800">{r.branchName}</span></span></td>
                    <td className="sticky left-[13rem] z-[1] w-[15rem] max-w-[15rem] border-r border-neutral-200 px-3 py-2" title={`${r.name} · ${r.code}${r.category ? ` · ${r.category}` : ""}`}>
                      <span className="block truncate font-medium text-neutral-900">{r.name}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums" title={h?.prevDate ? `${dmy(h.prevDate)} · ${h.prevRefs.join(", ")}` : tr("No count at the end of the month before")}>
                      {qtyText(r.prev)} <span className="text-neutral-400">{r.unit}</span></td>
                    {num(r.received, "+", "border-l border-neutral-100 text-emerald-700")}
                    {num(r.transferIn, "+", "text-emerald-700")}
                    {num(r.transitIn, "+", "text-emerald-700")}
                    {num(r.sales, "−", "border-l border-neutral-100 text-red-700")}
                    {num(r.nonSales, "−", "text-red-700")}
                    {num(r.transferOut, "−", "text-red-700")}
                    {num(r.transitOut, "−", "text-red-700")}
                    {num(r.journal, "−", "text-red-700")}
                    {num(r.productSales, "−", "text-red-700")}
                    <td className={cx("border-l border-neutral-100 px-3 py-2 text-right font-semibold tabular-nums", r.estimate < -1e-6 ? "text-red-700" : "text-neutral-900")}
                      title={r.other ? tr("Includes other ESB moves {0} (outlet purchase, production, delivery, supplier return)", `${r.other > 0 ? "+" : "−"}${qtyText(Math.abs(r.other))}`) : undefined}>
                      {qtyText(r.estimate)}{r.other ? <span className="text-neutral-400">*</span> : null}</td>
                    <td className="px-3 py-2 text-right tabular-nums" title={h?.endDate ? `${dmy(h.endDate)} · ${h.endRefs.join(", ")}` : tr("No checkpoint SO this month yet")}>
                      {r.ending == null ? <span className="text-neutral-300">—</span> : qtyText(r.ending)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{qtyText(r.system)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.actual == null ? <span className="text-neutral-300">—</span> : qtyText(r.actual)}</td>
                    <td className={cx("px-3 py-2 text-right font-medium tabular-nums", vTone)}>{r.variance == null ? "—" : `${r.variance > 0 ? "+" : ""}${qtyText(r.variance)}`}</td>
                    <td className={cx("px-3 py-2 text-right tabular-nums", vTone)}>{pct(r.variancePct)}</td>
                    <td className="px-3 py-2 pr-5 text-right tabular-nums">{r.estimateValue == null ? <Badge tone="amber">{tr("No price")}</Badge> : rpText(r.estimateValue)}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          ) : (
            <ul className="divide-y divide-neutral-100">{pagedM.rows.map((m) => (
              <li key={m.code} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span><span className="font-medium text-neutral-900">{m.name}</span> <span className="text-[11px] text-neutral-400">{m.code}{m.category ? ` · ${m.category}` : ""}</span></span>
                  <span className="text-xs tabular-nums text-neutral-600">{tr("{0} {1} at {2} outlets · {3}", qtyText(m.estimate), m.unit, m.outlets.length, rpText(m.value))}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">{m.outlets.sort((a, b) => b.estimate - a.estimate).slice(0, 12).map((o) => (
                  <span key={o.branch} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">{o.branchName} · {qtyText(o.estimate)}</span>))}
                  {m.outlets.length > 12 && <span className="px-1 text-[11px] text-neutral-400">{tr("+{0} more", m.outlets.length - 12)}</span>}</div>
              </li>))}</ul>
          )}
      </Panel>
      {calc && <CalcDrawer r={calc} h={heads.find((x) => x.branch === calc.branch)} onClose={() => setCalc(null)} />}
      {transit && data && <TransitDrawer month={month} data={data} onClose={() => setTransit(false)} onChanged={load} />}
      {sheet && <StockFilters branch={branch} category={category} heads={heads} categories={categories} onClose={() => setSheet(false)}
        onApply={(b, c) => { setBranch(b); setCategory(c); setSheet(false); }} />}
    </Page>
  );
}

function StockFilters({ branch, category, heads, categories, onApply, onClose }: {
  branch: string; category: string; heads: Head[]; categories: string[]; onApply: (b: string, c: string) => void; onClose: () => void;
}) {
  const [b, setB] = useState(branch);
  const [c, setC] = useState(category);
  return (
    <MonitorFilterSheet active={[b, c].filter(Boolean).length} onClose={onClose} onApply={() => onApply(b, c)} onReset={() => { setB(""); setC(""); }}>
      <FilterRow icon={<Store size={15} />} label={tr("Branch")} value={heads.find((h) => h.branch === b)?.branchName ?? null} onClear={() => setB("")}>
        <ComboFilter value={b} onChange={setB} allLabel={tr("All Branches")} placeholder={tr("Search branch")}
          options={heads.map((h) => ({ value: h.branch, label: h.branchName, hint: h.endDate ? tr("SO {0}", dmy(h.endDate)) : undefined }))} />
      </FilterRow>
      <FilterRow icon={<Package size={15} />} label={tr("Category")} value={c || null} onClear={() => setC("")}>
        <ComboFilter value={c} onChange={setC} allLabel={tr("All categories")} placeholder={tr("Search category")} options={categories.map((x) => ({ value: x, label: x }))} />
      </FilterRow>
    </MonitorFilterSheet>
  );
}

/** How one row is reached: Previous Balance, every move in and out, the estimate, the Ending Stock and the variance. */
function CalcDrawer({ r, h, onClose }: { r: Row; h?: Head; onClose: () => void }) {
  const line = (label: string, v: number | null | undefined, hint?: string, strong?: boolean, sign = "") => (
    <div className={cx("flex items-start justify-between gap-3 px-4 py-2.5", strong && "bg-neutral-50")}>
      <span className="min-w-0"><span className={cx("block text-sm", strong ? "font-semibold text-neutral-900" : "text-neutral-700")}>{label}</span>
        {hint && <span className="block text-[11px] text-neutral-400">{hint}</span>}</span>
      <span className={cx("whitespace-nowrap tabular-nums", strong ? "text-base font-semibold text-neutral-900" : "text-sm text-neutral-800")}>
        {v == null ? "—" : `${sign}${qtyText(v)}`} <span className="text-xs text-neutral-400">{r.unit}</span></span>
    </div>
  );
  return (
    <Drawer open onClose={onClose} icon={<Calculator size={18} />} title={r.name} description={`${r.branchName} · ${r.code}${h ? ` · ${dmy(h.from)} – ${dmy(h.to)}` : ""}`}>
      <div className="space-y-4">
        <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          {line(tr("Previous Balance"), r.prev, h?.prevDate ? `${dmy(h.prevDate)}${h.prevRefs.length ? ` · ${h.prevRefs.join(", ")}` : ""}` : tr("No count at the end of the month before"), true)}
          {line(tr("Goods Receipt"), r.received, undefined, false, "+")}
          {line(tr("Transfer In"), r.transferIn, undefined, false, "+")}
          {line(tr("Transit In"), r.transitIn, tr("Entered by Cost Control"), false, "+")}
          {!!r.other && line(tr("Other ESB moves"), r.other, tr("Outlet purchase, production, delivery, supplier return (no column)"), false, r.other > 0 ? "+" : "")}
          {line(tr("POS Sales"), r.sales, tr("Menus sold × recipe cards"), false, "−")}
          {line(tr("POS Non Sales"), r.nonSales, tr("ESB other-cost bills × recipe cards"), false, "−")}
          {line(tr("Transfer Out"), r.transferOut, undefined, false, "−")}
          {line(tr("Transit Out"), r.transitOut, tr("Entered by Cost Control"), false, "−")}
          {line(tr("Item Journal"), r.journal, tr("Waste approved"), false, "−")}
          {line(tr("Product Sales"), r.productSales, tr("Waste of the category Premix Tumpah / Human Error"), false, "−")}
          {line(tr("Estimate Stock"), r.estimate, tr("Previous Balance + Items In − Items Out"), true)}
        </section>
        <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          {line(tr("Ending Stock"), r.ending, h?.endDate ? `${dmy(h.endDate)}${h.endRefs.length ? ` · ${h.endRefs.join(", ")}` : ""}` : tr("No checkpoint SO this month yet"), true)}
          {line(tr("System Usage"), r.system, tr("POS Sales + POS Non Sales"))}
          {line(tr("Actual Usage"), r.actual, tr("Previous Balance + Items In − Transfer / Transit Out − Item Journal − Product Sales − Ending Stock"))}
          {line(tr("Variance (Qty)"), r.variance, `${tr("Actual − System Usage")} · ${pct(r.variancePct)}`, true, r.variance != null && r.variance > 0 ? "+" : "")}
        </section>
        <p className="px-1 text-xs text-neutral-500">{tr("Estimate Value")}: <span className="font-semibold text-neutral-800">{r.estimateValue == null ? tr("No price") : rpText(r.estimateValue)}</span>
          {r.price != null && <> · {tr("price {0} per {1}", rpText(r.price), r.unit)}</>}</p>
      </div>
    </Drawer>
  );
}

/** Transit In / Out of the month, entered by Cost Control (migration 123): goods on their way that no document carries yet. */
function TransitDrawer({ month, data, onClose, onChanged }: { month: string; data: Data; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const [list, setList] = useState<Transit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({ branch: "", code: "", qty: "", direction: "in" as "in" | "out", date: data.upto, note: "" });
  const reload = () => call<{ data: Transit[] }>(`/api/monitoring/stock/transit?month=${month}`).then((r) => setList(r.data)).catch((e: Error) => toast(e.message, "error"));
  useEffect(() => { void reload(); }, [month]); // eslint-disable-line react-hooks/exhaustive-deps
  const items = useMemo(() => {
    const m = new Map<string, { code: string; name: string; unit: string }>();
    for (const r of data.rows) if (!f.branch || r.branch === f.branch) m.set(r.code, { code: r.code, name: r.name, unit: r.unit });
    return [...m.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [data, f.branch]);
  const item = items.find((x) => x.code === f.code);
  const names = new Map(data.branches.map((h) => [h.branch, h.branchName]));
  const save = async () => {
    if (!f.branch || !item || !(Number(f.qty) > 0)) return;
    setBusy(true);
    try {
      await call("/api/monitoring/stock/transit", { method: "POST", json: { branch: f.branch, code: item.code, unit: item.unit, qty: Number(f.qty), direction: f.direction, date: f.date, note: f.note.trim() || null } });
      toast(tr("Transit saved"), "ok");
      setF({ ...f, code: "", qty: "", note: "" });
      await reload();
      onChanged();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const remove = async (t: Transit) => {
    try {
      await call(`/api/monitoring/stock/transit/${t.id}`, { method: "DELETE" });
      await reload();
      onChanged();
    } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <Drawer open size="lg" onClose={onClose} icon={<ArrowLeftRight size={18} />} title={tr("Transit In / Out")} description={tr("Goods on their way that no document carries yet; added to the Stock List of {0}", month)}>
      <div className="space-y-4">
        <section className="grid gap-3 rounded-md border border-neutral-200 bg-white p-4 sm:grid-cols-2">
          <Field label={tr("Branch")} required>
            <NativeSelect value={f.branch} onChange={(e) => setF({ ...f, branch: e.target.value, code: "" })} aria-label={tr("Branch")} className="w-full">
              <option value="">{tr("Choose the branch")}</option>
              {data.branches.map((h) => <option key={h.branch} value={h.branch}>{h.branchName}</option>)}
            </NativeSelect></Field>
          <Field label={tr("Material")} required>
            <NativeSelect value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} aria-label={tr("Material")} className="w-full" disabled={!f.branch}>
              <option value="">{tr("Choose the material")}</option>
              {items.map((x) => <option key={x.code} value={x.code}>{`${x.name} · ${x.code}`}</option>)}
            </NativeSelect></Field>
          <Field label={tr("Direction")}>
            <Segmented label={tr("Direction")} value={f.direction} onChange={(v) => setF({ ...f, direction: v })} options={[{ value: "in", label: tr("Transit In") }, { value: "out", label: tr("Transit Out") }]} /></Field>
          <Field label={item ? `${tr("Quantity")} (${item.unit})` : tr("Quantity")} required>
            <input type="number" min={0} step="any" value={f.qty} onChange={(e) => setF({ ...f, qty: e.target.value })} className={inputClass} /></Field>
          <Field label={tr("Date")} required>
            <input type="date" value={f.date} min={data.from} max={data.to} onChange={(e) => setF({ ...f, date: e.target.value })} className={inputClass} /></Field>
          <Field label={tr("Note")}>
            <input value={f.note} maxLength={500} onChange={(e) => setF({ ...f, note: e.target.value })} className={inputClass} /></Field>
          <div className="sm:col-span-2 flex justify-end">
            <Button onClick={() => void save()} disabled={busy || !f.branch || !item || !(Number(f.qty) > 0)}><Plus size={14} />{tr("Add transit")}</Button></div>
        </section>
        <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          {!list ? <p className="px-4 py-3 text-sm text-neutral-400">{tr("Loading…")}</p>
            : !list.length ? <p className="px-4 py-3 text-sm text-neutral-500">{tr("No transit this month")}</p>
            : <ul className="divide-y divide-neutral-100">{list.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Badge tone={t.direction === "in" ? "green" : "red"}>{t.direction === "in" ? tr("Transit In") : tr("Transit Out")}</Badge>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium text-neutral-900">{t.name}</span>
                  <span className="block truncate text-[11px] text-neutral-500">{names.get(t.branch) ?? t.branch} · {dmy(t.date)} · {t.createdBy}{t.note ? ` · ${t.note}` : ""}</span></span>
                <span className="whitespace-nowrap tabular-nums">{qtyText(t.qty)} <span className="text-neutral-400">{t.unit}</span></span>
                <Button size="sm" variant="ghost" aria-label={tr("Remove")} onClick={() => void remove(t)}><Trash2 size={14} /></Button>
              </li>))}</ul>}
        </section>
      </div>
    </Drawer>
  );
}
