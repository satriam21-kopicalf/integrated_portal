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
import { dmy } from "@/so/ui/Filters";
import { DateField, Row as FRow } from "@/aggregator/fields";
import { JSelect } from "@/so/ui/Jira";
import { RotateCcw, Search } from "lucide-react";
import { Segmented } from "@/so/ui/Simple";
import { NativeSelect } from "@/so/ui/Jira";
import { locale } from "@/lib/i18n";
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
  from: string; to: string; items: number; estimateValue: number; /** the last day ESB has made its usage */ usageUntil?: string | null };
type Usage = "esb" | "recipe";
type Data = { usage?: Usage; month: string; from: string; to: string; upto: string; branches: Head[]; rows: Row[] };
type Transit = { id: string; branch: string; code: string; name: string; unit: string; qty: number; direction: "in" | "out"; date: string; note: string | null; createdBy: string };
type View = "branch" | "material";
type SortKey = "branch" | "material" | "prev" | "received" | "tin" | "trin" | "sales" | "nonSales" | "tout" | "trout" | "journal" | "product"
  | "estimate" | "ending" | "system" | "actual" | "variance" | "variancePct" | "value";
const sortValue = (r: Row, k: SortKey) => ({ branch: r.branchName, material: r.name, prev: r.prev, received: r.received, tin: r.transferIn, trin: r.transitIn,
  sales: r.sales, nonSales: r.nonSales, tout: r.transferOut, trout: r.transitOut, journal: r.journal, product: r.productSales, estimate: r.estimate,
  ending: r.ending ?? -Infinity, system: r.system, actual: r.actual ?? -Infinity, variance: r.variance ?? -Infinity, variancePct: r.variancePct ?? -Infinity,
  value: r.estimateValue ?? -Infinity }[k]);
const today = () => new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);
const lastDay = (m: string) => new Date(Date.UTC(Number(m.slice(0, 4)), Number(m.slice(5, 7)), 0)).toISOString().slice(0, 10);
/** the last 13 months, newest first */
const MONTHS = () => Array.from({ length: 13 }, (_, i) => { const d = new Date(Date.UTC(Number(thisMonth().slice(0, 4)), Number(thisMonth().slice(5, 7)) - 1 - i, 1)); return d.toISOString().slice(0, 7); });
const monthName = (m: string) => new Date(`${m}-15T00:00:00Z`).toLocaleDateString(locale(), { month: "long", year: "numeric", timeZone: "UTC" });
const pct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`);

export default function StockListPage() {
  const toast = useToast();
  const [month, setMonth] = useState(thisMonth);
  // 2026-11-26: up to a day of the month (empty = today / the end of the month)
  const [until, setUntil] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("branch");
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [category, setCategory] = useState("");
  const [calc, setCalc] = useState<Row | null>(null);
  const [transit, setTransit] = useState(false);
  // 2026-11-24: POS Sales from the material usage ESB books itself (its Stock Card) or from the recipe cards of the portal
  const [usage, setUsage] = useState<Usage>("esb");
  const [unexplained, setUnexplained] = useState(false);
  const load = () => { setError(null); setData(null); call<Data>(`/api/monitoring/stock/list?month=${month}&usage=${usage}${until ? `&until=${until}` : ""}`).then(setData).catch((e: Error) => setError(e.message)); };
  useEffect(load, [month, usage, until]);
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
  const changed = month !== thisMonth() || !!until || !!branch || !!category || !!q;
  const maxDay = month === thisMonth() ? today() : lastDay(month);
  const reset = () => { setMonth(thisMonth()); setUntil(""); setBranch(""); setCategory(""); setQ(""); };
  const exportRows = () => downloadXlsx({ fileName: `Stock List ${month}`, sheet: "Stock", title: `Stock List ${month}${data ? ` (${data.from} – ${data.upto})` : ""} · POS Sales: ${usage === "esb" ? "ESB" : "Recipe"}`,
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
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 basis-60"><Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[color:var(--j-626F86)]" />
            <input className={cx(inputClass, "h-10 pl-9")} value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search material or branch")} aria-label={tr("Search")} /></div>
          <Button size="sm" variant="secondary" className="!h-10" onClick={() => setUnexplained(true)}><Package size={14} />{tr("No recipe")}</Button>
          <Button size="sm" variant="secondary" className="!h-10" onClick={() => setTransit(true)}><ArrowLeftRight size={14} />{tr("Transit")}</Button>
          <ExcelIconButton boxed label={tr("Export to Excel")} disabled={!rows.length} onClick={() => void exportRows().catch((e) => toast((e as Error).message, "error"))} />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <FRow label={tr("Month")}><JSelect value={month} onChange={(v) => { setMonth(v); setUntil(""); }} label={tr("Month")} placeholder={tr("Month")} options={MONTHS().map((m) => ({ value: m, label: monthName(m) }))} /></FRow>
          <FRow label={tr("Up to date")}>
            {until ? <span className="flex items-center gap-1"><span className="min-w-0 flex-1"><DateField label={tr("Up to date")} value={until} min={`${month}-01`} max={maxDay} quick={false} onChange={setUntil} /></span>
              <button type="button" onClick={() => setUntil("")} aria-label={tr("Clear")} className="flex h-10 w-9 shrink-0 items-center justify-center rounded-[3px] text-[color:var(--j-626F86)] hover:bg-[color:var(--j-091E420F)]"><RotateCcw size={14} /></button></span>
              : <button type="button" onClick={() => setUntil(maxDay)} className="flex h-11 w-full items-center gap-2 rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white px-3 text-left text-sm text-[color:var(--j-44546F)] hover:border-[color:var(--j-8590A2)] sm:h-10"><CalendarDays size={15} className="text-[color:var(--j-626F86)]" />{month === thisMonth() ? tr("Today") : tr("End of the month")}</button>}
          </FRow>
          <FRow label={tr("Branch")}><JSelect value={branch} onChange={setBranch} label={tr("Branch")} placeholder={tr("All Branches")} options={[{ value: "", label: tr("All Branches") }, ...heads.map((h) => ({ value: h.branch, label: h.branchName, hint: h.endDate ? tr("SO {0}", dmy(h.endDate)) : tr("no SO") }))]} /></FRow>
          <FRow label={tr("Category")}><JSelect value={category} onChange={setCategory} label={tr("Category")} placeholder={tr("All categories")} options={[{ value: "", label: tr("All categories") }, ...categories.map((x) => ({ value: x, label: x }))]} /></FRow>
          <FRow label={tr("POS Sales from")}><JSelect value={usage} onChange={(v) => setUsage(v as Usage)} label={tr("POS Sales from")} placeholder="" options={[{ value: "esb", label: tr("ESB usage") }, { value: "recipe", label: tr("Recipe cards") }]} /></FRow>
          <FRow label={tr("View")}><JSelect value={view} onChange={(v) => setView(v as View)} label={tr("View")} placeholder="" options={[{ value: "branch", label: tr("Per Branch") }, { value: "material", label: tr("Per Material") }]} /></FRow>
        </div>
        <div className="flex flex-wrap items-start justify-between gap-2 text-xs text-[color:var(--j-626F86)]">
          <p className="max-w-3xl">{data ? <b className="font-semibold text-[color:var(--j-44546F)]">{dmy(data.from)} – {dmy(data.upto)} · </b> : null}{usage === "esb"
            ? tr("SO, receipts and waste of the portal; POS Sales as ESB books it (its Stock Card), today from the recipe cards. POS Non Sales stays apart: ESB takes no stock for cupping.")
            : tr("SO, receipts and waste of the portal; POS Sales from the recipe cards.")}</p>
          {changed && <button type="button" onClick={reset} className="inline-flex items-center gap-1 font-medium text-[color:var(--j-0C66E4)] hover:underline"><RotateCcw size={12} /> {tr("Clear the filters")}</button>}
        </div>
      </div>} footer={data ? <><span>{tr("{0} shown", fmtNumber(view === "branch" ? rows.length : materials.length))}</span><PageNav paged={view === "branch" ? paged : pagedM} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : !data ? <table className="w-full"><tbody><SkeletonRows cols={7} /></tbody></table>
          : !rows.length ? <Empty icon={<Boxes size={26} />} title={tr("No stock matches")} />
          : view === "branch" ? (<>
            <ul className="divide-y divide-[color:var(--j-F1F2F4)] md:hidden">{paged.rows.map((r) => {
              const vTone = r.variance == null ? "text-[color:var(--j-626F86)]" : r.variance > 1e-6 ? "text-red-700" : r.variance < -1e-6 ? "text-emerald-700" : "text-[color:var(--j-44546F)]";
              return (
                <li key={`${r.branch}:${r.code}`}><button type="button" onClick={() => setCalc(r)} className="block w-full px-4 py-3 text-left active:bg-[color:var(--j-F7F8F9)]">
                  <span className="block font-medium text-[color:var(--j-172B4D)]">{r.name}</span>
                  <span className="block text-[11px] text-[color:var(--j-626F86)]">{r.branchName} · {r.code}</span>
                  <span className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <span><span className="block text-[10px] uppercase text-[color:var(--j-626F86)]">{tr("Estimate Stock")}</span><span className="font-semibold tabular-nums text-[color:var(--j-172B4D)]">{qtyText(r.estimate)} {r.unit}</span></span>
                    <span><span className="block text-[10px] uppercase text-[color:var(--j-626F86)]">{tr("Ending Stock")}</span><span className="tabular-nums">{r.ending == null ? "—" : qtyText(r.ending)}</span></span>
                    <span><span className="block text-[10px] uppercase text-[color:var(--j-626F86)]">{tr("Variance (Qty)")}</span><span className={cx("font-semibold tabular-nums", vTone)}>{r.variance == null ? "—" : `${r.variance > 0 ? "+" : ""}${qtyText(r.variance)}`}</span></span>
                  </span>
                </button></li>);
            })}</ul>
            <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[2100px] border-separate border-spacing-0 text-[13px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead className={theadClass}>
                <tr className="[&>th]:border-b [&>th]:border-[color:var(--j-DCDFE4)] [&>th]:px-3 [&>th]:py-1.5 [&>th]:text-center">
                  <th colSpan={3} className="sticky left-0 z-[2] bg-white" /><th colSpan={3} className="border-l text-emerald-700">{tr("Items In")}</th>
                  <th colSpan={6} className="border-l text-red-700">{tr("Items Out")}</th><th colSpan={7} className="border-l" /></tr>
                <tr className="[&>th]:border-b-2 [&>th]:border-[color:var(--j-DCDFE4)]">
                <SortTh k="branch" sort={sorted.sort} onSort={sorted.toggle} pad="sticky left-0 z-[2] w-[13rem] min-w-[13rem] bg-white py-2 pl-5 pr-3">{tr("Branch")}</SortTh>
                <SortTh k="material" sort={sorted.sort} onSort={sorted.toggle} pad="sticky left-[13rem] z-[2] w-[15rem] min-w-[15rem] border-r border-[color:var(--j-DCDFE4)] bg-white px-3 py-2">{tr("Material")}</SortTh>
                <SortTh k="prev" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Previous Balance")}</SortTh>
                <SortTh k="received" sort={sorted.sort} onSort={sorted.toggle} pad="border-l border-[color:var(--j-DCDFE4)] px-3 py-2" align="right" first="desc">{tr("Goods Receipt")}</SortTh>
                <SortTh k="tin" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Transfer In")}</SortTh>
                <SortTh k="trin" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Transit In")}</SortTh>
                <SortTh k="sales" sort={sorted.sort} onSort={sorted.toggle} pad="border-l border-[color:var(--j-DCDFE4)] px-3 py-2" align="right" first="desc">{tr("POS Sales")}</SortTh>
                <SortTh k="nonSales" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("POS Non Sales")}</SortTh>
                <SortTh k="tout" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Transfer Out")}</SortTh>
                <SortTh k="trout" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Transit Out")}</SortTh>
                <SortTh k="journal" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Item Journal")}</SortTh>
                <SortTh k="product" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Product Sales")}</SortTh>
                <SortTh k="estimate" sort={sorted.sort} onSort={sorted.toggle} pad="border-l border-[color:var(--j-DCDFE4)] px-3 py-2" align="right" first="desc">{tr("Estimate Stock")}</SortTh>
                <SortTh k="ending" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Ending Stock")}</SortTh>
                <SortTh k="system" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("System Usage")}</SortTh>
                <SortTh k="actual" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Actual Usage")}</SortTh>
                <SortTh k="variance" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Variance (Qty)")}</SortTh>
                <SortTh k="variancePct" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Variance (%)")}</SortTh>
                <SortTh k="value" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2 pr-5" align="right" first="desc">{tr("Estimate Value")}</SortTh></tr></thead>
              <tbody className="[&>tr>td]:border-b [&>tr>td]:border-[color:var(--j-F1F2F4)]">{paged.rows.map((r) => {
                const h = heads.find((x) => x.branch === r.branch);
                const num = (v: number, sign: "+" | "−" | "", cls = "text-[color:var(--j-44546F)]") => (
                  <td className={cx("px-3 py-2 text-right tabular-nums", v ? cls : "text-[color:var(--j-8590A2)]")}>{v ? `${sign}${qtyText(Math.abs(v))}` : "—"}</td>);
                const vTone = r.variance == null ? "text-[color:var(--j-8590A2)]" : r.variance > 1e-6 ? "text-red-700" : r.variance < -1e-6 ? "text-emerald-700" : "text-[color:var(--j-626F86)]";
                return (
                  <tr key={`${r.branch}:${r.code}`} className="group cursor-pointer [&>td]:bg-white hover:[&>td]:bg-[color:var(--j-F7F8F9)]" onClick={() => setCalc(r)} title={tr("See the calculation")}>
                    <td className="sticky left-0 z-[1] w-[13rem] max-w-[13rem] py-2 pl-5 pr-3"
                      title={`${r.branchName}${h ? ` · ${h.prevDate ? dmy(h.prevDate) : "—"} → ${h.endDate ? dmy(h.endDate) : tr("no checkpoint yet")}` : ""}`}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        {h && !h.endDate && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" aria-label={tr("no checkpoint yet")} />}
                        <span className="truncate text-[color:var(--j-172B4D)]">{r.branchName}</span></span></td>
                    <td className="sticky left-[13rem] z-[1] w-[15rem] max-w-[15rem] border-r border-[color:var(--j-DCDFE4)] px-3 py-2" title={`${r.name} · ${r.code}${r.category ? ` · ${r.category}` : ""}`}>
                      <span className="block truncate font-medium text-[color:var(--j-172B4D)]">{r.name}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums" title={h?.prevDate ? `${dmy(h.prevDate)} · ${h.prevRefs.join(", ")}` : tr("No count at the end of the month before")}>
                      {qtyText(r.prev)} <span className="text-[color:var(--j-626F86)]">{r.unit}</span></td>
                    {num(r.received, "+", "border-l border-[color:var(--j-F1F2F4)] text-emerald-700")}
                    {num(r.transferIn, "+", "text-emerald-700")}
                    {num(r.transitIn, "+", "text-emerald-700")}
                    {num(r.sales, "−", "border-l border-[color:var(--j-F1F2F4)] text-red-700")}
                    {num(r.nonSales, "−", "text-red-700")}
                    {num(r.transferOut, "−", "text-red-700")}
                    {num(r.transitOut, "−", "text-red-700")}
                    {num(r.journal, "−", "text-red-700")}
                    {num(r.productSales, "−", "text-red-700")}
                    <td className={cx("border-l border-[color:var(--j-F1F2F4)] px-3 py-2 text-right font-semibold tabular-nums", r.estimate < -1e-6 ? "text-red-700" : "text-[color:var(--j-172B4D)]")}
                      title={r.other ? tr("Includes other ESB moves {0} (outlet purchase, production, delivery, supplier return)", `${r.other > 0 ? "+" : "−"}${qtyText(Math.abs(r.other))}`) : undefined}>
                      {qtyText(r.estimate)}{r.other ? <span className="text-[color:var(--j-626F86)]">*</span> : null}</td>
                    <td className="px-3 py-2 text-right tabular-nums" title={h?.endDate ? `${dmy(h.endDate)} · ${h.endRefs.join(", ")}` : tr("No checkpoint SO this month yet")}>
                      {r.ending == null ? <span className="text-[color:var(--j-8590A2)]">—</span> : qtyText(r.ending)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{qtyText(r.system)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.actual == null ? <span className="text-[color:var(--j-8590A2)]">—</span> : qtyText(r.actual)}</td>
                    <td className={cx("px-3 py-2 text-right font-medium tabular-nums", vTone)}>{r.variance == null ? "—" : `${r.variance > 0 ? "+" : ""}${qtyText(r.variance)}`}</td>
                    <td className={cx("px-3 py-2 text-right tabular-nums", vTone)}>{pct(r.variancePct)}</td>
                    <td className="px-3 py-2 pr-5 text-right tabular-nums">{r.estimateValue == null ? <Badge tone="amber">{tr("No price")}</Badge> : rpText(r.estimateValue)}</td>
                  </tr>
                );
              })}</tbody>
            </table></div>
          </>) : (
            <ul className="divide-y divide-[color:var(--j-F1F2F4)]">{pagedM.rows.map((m) => (
              <li key={m.code} className="px-5 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span><span className="font-medium text-[color:var(--j-172B4D)]">{m.name}</span> <span className="text-[11px] text-[color:var(--j-626F86)]">{m.code}{m.category ? ` · ${m.category}` : ""}</span></span>
                  <span className="text-xs tabular-nums text-[color:var(--j-44546F)]">{tr("{0} {1} at {2} outlets · {3}", qtyText(m.estimate), m.unit, m.outlets.length, rpText(m.value))}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">{m.outlets.sort((a, b) => b.estimate - a.estimate).slice(0, 12).map((o) => (
                  <span key={o.branch} className="rounded-full bg-[color:var(--j-091E420F)] px-2 py-0.5 text-[11px] text-[color:var(--j-44546F)]">{o.branchName} · {qtyText(o.estimate)}</span>))}
                  {m.outlets.length > 12 && <span className="px-1 text-[11px] text-[color:var(--j-626F86)]">{tr("+{0} more", m.outlets.length - 12)}</span>}</div>
              </li>))}</ul>
          )}
      </Panel>
      {calc && <CalcDrawer r={calc} h={heads.find((x) => x.branch === calc.branch)} onClose={() => setCalc(null)} />}
      {unexplained && <UnexplainedDrawer month={month} onClose={() => setUnexplained(false)} />}
      {transit && data && <TransitDrawer month={month} data={data} onClose={() => setTransit(false)} onChanged={load} />}
    </Page>
  );
}

/** How one row is reached: Previous Balance, every move in and out, the estimate, the Ending Stock and the variance. */
function CalcDrawer({ r, h, onClose }: { r: Row; h?: Head; onClose: () => void }) {
  const line = (label: string, v: number | null | undefined, hint?: string, strong?: boolean, sign = "") => (
    <div className={cx("flex items-start justify-between gap-3 px-4 py-2.5", strong && "bg-[color:var(--j-F7F8F9)]")}>
      <span className="min-w-0"><span className={cx("block text-sm", strong ? "font-semibold text-[color:var(--j-172B4D)]" : "text-[color:var(--j-44546F)]")}>{label}</span>
        {hint && <span className="block text-[11px] text-[color:var(--j-626F86)]">{hint}</span>}</span>
      <span className={cx("whitespace-nowrap tabular-nums", strong ? "text-base font-semibold text-[color:var(--j-172B4D)]" : "text-sm text-[color:var(--j-172B4D)]")}>
        {v == null ? "—" : `${sign}${qtyText(v)}`} <span className="text-xs text-[color:var(--j-626F86)]">{r.unit}</span></span>
    </div>
  );
  return (
    <Drawer open onClose={onClose} icon={<Calculator size={18} />} title={r.name} description={`${r.branchName} · ${r.code}${h ? ` · ${dmy(h.from)} – ${dmy(h.to)}` : ""}`}>
      <div className="space-y-4">
        <section className="overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white">
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
        <section className="overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white">
          {line(tr("Ending Stock"), r.ending, h?.endDate ? `${dmy(h.endDate)}${h.endRefs.length ? ` · ${h.endRefs.join(", ")}` : ""}` : tr("No checkpoint SO this month yet"), true)}
          {line(tr("System Usage"), r.system, tr("POS Sales + POS Non Sales"))}
          {line(tr("Actual Usage"), r.actual, tr("Previous Balance + Items In − Transfer / Transit Out − Item Journal − Product Sales − Ending Stock"))}
          {line(tr("Variance (Qty)"), r.variance, `${tr("Actual − System Usage")} · ${pct(r.variancePct)}`, true, r.variance != null && r.variance > 0 ? "+" : "")}
        </section>
        <p className="px-1 text-xs text-[color:var(--j-626F86)]">{tr("Estimate Value")}: <span className="font-semibold text-[color:var(--j-172B4D)]">{r.estimateValue == null ? tr("No price") : rpText(r.estimateValue)}</span>
          {r.price != null && <> · {tr("price {0} per {1}", rpText(r.price), r.unit)}</>}</p>
      </div>
    </Drawer>
  );
}

type Unexplained = { code: string; name: string; category: string; unit: string; outlets: number; used: number; perDay: number | null; per100Bills: number | null; value: number };

/** The items no recipe, option or additional item uses (plastic clips, gloves …): all they lose reads as a difference. What
 *  the counts show they really use, to be entered as an Additional item of the recipe calculator. */
function UnexplainedDrawer({ month, onClose }: { month: string; onClose: () => void }) {
  const [rows, setRows] = useState<Unexplained[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => { call<{ data: Unexplained[] }>(`/api/monitoring/stock/unexplained?month=${month}`).then((r) => setRows(r.data)).catch((e: Error) => setError(e.message)); }, [month]);
  return (
    <Drawer open onClose={onClose} size="xl" icon={<Package size={18} />} title={tr("Items without a recipe")} description={tr("Nothing uses them, so everything they lose is a difference. Enter the usage under Sales Calculator → Additional items and the Stock List estimates them.")}>
      {error ? <ErrorState message={error} /> : !rows ? <p className="text-sm text-[color:var(--j-626F86)]">{tr("Working it out …")}</p> : !rows.length ? <Empty icon={<Boxes size={26} />} title={tr("Every item is used by something")} /> : (
        <div className="overflow-x-auto rounded border border-[color:var(--j-DCDFE4)]">
          <table className="w-full min-w-[640px] text-sm"><thead className={theadClass}><tr>{[tr("Material"), tr("Outlets"), tr("Used"), tr("Per outlet a day"), tr("Per 100 bills"), tr("Value")].map((h, i) => <th key={h} className={cx("px-3 py-2", i ? "text-right" : "text-left")}>{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-[color:var(--j-F1F2F4)]">{rows.map((r) => (
              <tr key={r.code}><td className="px-3 py-2"><span className="block font-medium text-[color:var(--j-172B4D)]">{r.name}</span><span className="block text-[11px] text-[color:var(--j-626F86)]">{r.code} · {r.unit}</span></td>
                <td className="px-3 py-2 text-right tabular-nums">{r.outlets}</td><td className="px-3 py-2 text-right tabular-nums">{fmtNumber(r.used)}</td><td className="px-3 py-2 text-right tabular-nums">{r.perDay ?? "—"}</td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">{r.per100Bills ?? "—"}</td><td className="px-3 py-2 text-right tabular-nums">{rpText(r.value)}</td></tr>))}</tbody></table>
        </div>
      )}
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
        <section className="grid gap-3 rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white p-4 sm:grid-cols-2">
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
        <section className="overflow-hidden rounded-[3px] border border-[color:var(--j-DCDFE4)] bg-white">
          {!list ? <p className="px-4 py-3 text-sm text-[color:var(--j-626F86)]">{tr("Loading…")}</p>
            : !list.length ? <p className="px-4 py-3 text-sm text-[color:var(--j-626F86)]">{tr("No transit this month")}</p>
            : <ul className="divide-y divide-[color:var(--j-F1F2F4)]">{list.map((t) => (
              <li key={t.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <Badge tone={t.direction === "in" ? "green" : "red"}>{t.direction === "in" ? tr("Transit In") : tr("Transit Out")}</Badge>
                <span className="min-w-0 flex-1"><span className="block truncate font-medium text-[color:var(--j-172B4D)]">{t.name}</span>
                  <span className="block truncate text-[11px] text-[color:var(--j-626F86)]">{names.get(t.branch) ?? t.branch} · {dmy(t.date)} · {t.createdBy}{t.note ? ` · ${t.note}` : ""}</span></span>
                <span className="whitespace-nowrap tabular-nums">{qtyText(t.qty)} <span className="text-[color:var(--j-626F86)]">{t.unit}</span></span>
                <Button size="sm" variant="ghost" aria-label={tr("Remove")} onClick={() => void remove(t)}><Trash2 size={14} /></Button>
              </li>))}</ul>}
        </section>
      </div>
    </Drawer>
  );
}
