"use client";

// Monitoring Stock → Stock List (page cc.stock-list; integrated_portal_be app/stock_transfer.py stock_list): the stock of
// every branch from its latest stock opname in the portal, with the transfers received since (in / out), the transfers
// on their way out and what is available for a Transfer Stock; valued with the Pricelist (else the ESB HPP). Two views:
// per branch (its count and value, then its materials) and per material (which outlets have it). The running stock
// (2026-11-07, app/running_stock.py): the estimate now = SO + goods received and the other moves − waste approved −
// usage by the recipe cards since the count; an estimate below zero means the cards or the moves do not match.

import { wibDateTime } from "@/so/lib/wib";
import { SortTh, useSort } from "@/so/ui/Sort";
import ExcelIconButton from "@/components/ExcelIconButton";
import { Boxes, Calculator, CalendarDays, Package, Store } from "lucide-react";
import Drawer from "@/so/ui/Drawer";
import { useEffect, useMemo, useState } from "react";
import { Badge, cx, Empty, ErrorState, fmtNumber, Page, PageNav, Panel, SkeletonRows, theadClass, usePaged, useToast } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { type ActiveFilter, FilterToolbar, dmy } from "@/so/ui/Filters";
import { ComboFilter, FilterRow, MonitorFilterSheet } from "@/so/ui/MonitorFilters";
import { Segmented } from "@/so/ui/Simple";
import { call } from "@/so/features/checkin/checkin";
import { downloadXlsx } from "@/lib/xlsx";
import { tr } from "@/lib/i18n";
import { qtyText, rpText } from "@/so/features/stock-transfer/transfer";
import { DataSources } from '@/so/features/health/DataHealth';

type Row = { branch: string; branchName: string; code: string; name: string; category: string; unit: string; so: number; in: number; out: number;
  pending: number; stock: number; available: number; price: number | null; value: number | null;
  /** the quantity of the stock opname before the latest one (2026-11-08) */ prevSo?: number | null;
  received: number; otherMoves: number; waste: number; used: number; estimate: number; estimateValue: number | null;
  /** the columns of Cost Control (2026-11-18): transfers of the running stock, Waste Product Sales (Premix Tumpah / Human Error) */
  transferIn: number; transferOut: number; wasteProduct: number;
  /** Items Out: the usage of the menus sold and of the ESB other-cost bills (cupping, waste, compliment …) */ sales: number; nonSales: number };
type Head = { branch: string; branchName: string; soDate: string; refs: string[]; items: number; value: number; final?: boolean | null; estimateValue: number;
  prevSoDate?: string | null; prevRefs?: string[]; /** when the SO was sent: what happened before is in the count */ soAt?: string | null };
type Data = { branches: Head[]; rows: Row[] };
type View = "branch" | "material";
type SortKey = "branch" | "material" | "so" | "received" | "tin" | "other" | "tout" | "waste" | "wasteProduct" | "sales" | "nonSales" | "used" | "estimate" | "available" | "value";
const sortValue = (r: Row, k: SortKey) => ({ branch: r.branchName, material: r.name, so: r.so, received: r.received, tin: r.transferIn, other: r.otherMoves,
  tout: r.transferOut, waste: r.waste, wasteProduct: r.wasteProduct, sales: r.sales, nonSales: r.nonSales, used: r.used, estimate: r.estimate, available: r.available, value: r.estimateValue }[k]);

export default function StockListPage() {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("branch");
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [category, setCategory] = useState("");
  const [sheet, setSheet] = useState(false);
  const [calc, setCalc] = useState<Row | null>(null);
  const load = () => { setError(null); setData(null); call<Data>("/api/monitoring/stock/list").then(setData).catch((e: Error) => setError(e.message)); };
  useEffect(load, []);
  const rows = useMemo(() => (data?.rows ?? []).filter((r) => (!branch || r.branch === branch) && (!category || r.category === category)
    && (!q || `${r.name} ${r.code} ${r.branchName}`.toLowerCase().includes(q.toLowerCase()))), [data, branch, category, q]);
  const materials = useMemo(() => {
    const m = new Map<string, { code: string; name: string; unit: string; category: string; stock: number; available: number; value: number; outlets: Row[] }>();
    for (const r of rows) {
      const x = m.get(r.code) ?? { code: r.code, name: r.name, unit: r.unit, category: r.category, stock: 0, available: 0, value: 0, outlets: [] };
      x.stock += r.stock; x.available += Math.max(0, r.available); x.value += r.value ?? 0;
      if (r.available > 0) x.outlets.push(r);
      m.set(r.code, x);
    }
    return [...m.values()].sort((a, b) => b.value - a.value);
  }, [rows]);
  const sorted = useSort<Row, SortKey>(rows, sortValue);
  const paged = usePaged(sorted.rows, q + branch + category + view + JSON.stringify(sorted.sort), 50);
  const pagedM = usePaged(materials, q + branch + category + view, 50);
  const heads = data?.branches ?? [];
  const categories = [...new Set((data?.rows ?? []).map((r) => r.category).filter(Boolean))].sort();
  const total = rows.reduce((a, r) => a + (r.value ?? 0), 0);
  const estTotal = rows.reduce((a, r) => a + (r.estimateValue ?? 0), 0);
  const negative = rows.filter((r) => r.estimate < -1e-6).length;
  const oldest = heads.length ? heads.map((h) => h.soDate).sort()[0] : null;
  const chips: ActiveFilter[] = [
    ...(branch ? [{ key: "b", label: heads.find((h) => h.branch === branch)?.branchName ?? branch, onRemove: () => setBranch("") }] : []),
    ...(category ? [{ key: "c", label: category, onRemove: () => setCategory("") }] : []),
  ];
  const exportRows = () => downloadXlsx({ fileName: "Stock List", sheet: "Stock", title: "Stock List (SO terakhir)",
    header: ["Cabang", "Tanggal SO", "SO Final", "Kode", "Material", "Kategori", "Satuan", "SO Awal", "IN: Good Receipt", "IN: Transfer In (TITO)", "Mutasi Lain",
      "OUT: Sales", "OUT: Non Sales", "OUT: Transfer Out (TITO)", "OUT: Waste", "OUT: Product Sales", "Usage System", "Estimate Stock", "Dalam Proses Keluar", "Available", "Harga", "Nilai Estimasi"],
    rows: rows.map((r) => { const h = heads.find((x) => x.branch === r.branch); return [r.branchName, h?.soDate ?? "", h?.final ? "Ya" : "Belum", r.code, r.name, r.category, r.unit,
      r.so, r.received, r.transferIn, r.otherMoves, r.sales, r.nonSales, r.transferOut, r.waste, r.wasteProduct, r.used, r.estimate, r.pending, r.available, r.price, r.estimateValue]; }) });
  return (
    <Page title={tr("Stock List")} subtitle={tr("The stock of every branch from its latest stock opname, with the transfers since")}
      stats={
        <StatStrip label={tr("Summary")} columns={4}>
          <Stat label={tr("Branches")} emphasis icon={<Store size={13} />} value={data ? fmtNumber(heads.length) : <StatSkeleton />}>{data && <p>{tr("with an SO in the last 60 days")}</p>}</Stat>
          <Stat label={tr("Stock Value (SO)")} icon={<Boxes size={13} />} value={data ? rpText(total) : <StatSkeleton />}>{data && <p>{tr("{0} rows", fmtNumber(rows.length))}</p>}</Stat>
          <Stat label={tr("Estimated Value Now")} icon={<Package size={13} />} value={data ? rpText(estTotal) : <StatSkeleton />}>
            {data && <p className={negative ? "text-amber-700" : undefined}>{negative ? tr("{0} materials estimated below zero", fmtNumber(negative)) : tr("SO + moves − waste − usage since")}</p>}</Stat>
          <Stat label={tr("Oldest SO")} icon={<CalendarDays size={13} />} value={data ? (oldest ? dmy(oldest) : "—") : <StatSkeleton />} />
        </StatStrip>
      }>
      <DataSources keys={['esbIntegrity', 'so', 'gr', 'transfers', 'waste']} />
      <Panel toolbar={<div className="space-y-3">
        <FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search material or branch")} filters={chips} onOpen={() => setSheet(true)} onClear={() => { setBranch(""); setCategory(""); }}
          extra={<ExcelIconButton boxed className="ml-auto" label={tr("Export to Excel")} disabled={!rows.length} onClick={() => void exportRows().catch((e) => toast((e as Error).message, "error"))} />} />
        <Segmented label={tr("View")} value={view} onChange={setView} options={[{ value: "branch", label: tr("Per Branch") }, { value: "material", label: tr("Per Material") }]} />
      </div>} footer={data ? <><span>{tr("{0} shown", fmtNumber(view === "branch" ? rows.length : materials.length))}</span><PageNav paged={view === "branch" ? paged : pagedM} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : !data ? <table className="w-full"><tbody><SkeletonRows cols={7} /></tbody></table>
          : !rows.length ? <Empty icon={<Boxes size={26} />} title={tr("No stock matches")} />
          : view === "branch" ? (
            // the format of Cost Control (2026-11-18): SO Awal | Items In | other moves | Items Out (Sales, Non Sales, Transfer Out,
            // Waste, Product Sales) | Usage System | Estimate | Available | Value — one line per row, the details in the tooltips
            <div className="overflow-x-auto"><table className="w-full min-w-[1560px] border-separate border-spacing-0 text-[13px] [&_td]:whitespace-nowrap [&_th]:whitespace-nowrap">
              <thead className={theadClass}>
                <tr className="[&>th]:border-b [&>th]:border-neutral-200 [&>th]:px-3 [&>th]:py-1.5 [&>th]:text-center">
                  <th colSpan={3} className="sticky left-0 z-[2] bg-white" /><th colSpan={2} className="border-l text-emerald-700">{tr("Items In")}</th><th className="border-l" />
                  <th colSpan={5} className="border-l text-red-700">{tr("Items Out")}</th><th colSpan={4} className="border-l" /></tr>
                <tr className="[&>th]:border-b-2 [&>th]:border-neutral-200">
                <SortTh k="branch" sort={sorted.sort} onSort={sorted.toggle} pad="sticky left-0 z-[2] w-[13rem] min-w-[13rem] bg-white py-2 pl-5 pr-3">{tr("Branch")}</SortTh>
                <SortTh k="material" sort={sorted.sort} onSort={sorted.toggle} pad="sticky left-[13rem] z-[2] w-[15rem] min-w-[15rem] border-r border-neutral-200 bg-white px-3 py-2">{tr("Material")}</SortTh>
                <SortTh k="so" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("SO Awal")}</SortTh>
                <SortTh k="received" sort={sorted.sort} onSort={sorted.toggle} pad="border-l border-neutral-200 px-3 py-2" align="right" first="desc">{tr("Good Receipt")}</SortTh>
                <SortTh k="tin" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Transfer In")}</SortTh>
                <SortTh k="other" sort={sorted.sort} onSort={sorted.toggle} pad="border-l border-neutral-200 px-3 py-2" align="right" first="desc">{tr("Other Moves")}</SortTh>
                <SortTh k="sales" sort={sorted.sort} onSort={sorted.toggle} pad="border-l border-neutral-200 px-3 py-2" align="right" first="desc">{tr("Sales")}</SortTh>
                <SortTh k="nonSales" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Non Sales")}</SortTh>
                <SortTh k="tout" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Transfer Out")}</SortTh>
                <SortTh k="waste" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Waste")}</SortTh>
                <SortTh k="wasteProduct" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Product Sales")}</SortTh>
                <SortTh k="used" sort={sorted.sort} onSort={sorted.toggle} pad="border-l border-neutral-200 px-3 py-2" align="right" first="desc">{tr("Usage System")}</SortTh>
                <SortTh k="estimate" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Estimate Stock")}</SortTh>
                <SortTh k="available" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2" align="right" first="desc">{tr("Available")}</SortTh>
                <SortTh k="value" sort={sorted.sort} onSort={sorted.toggle} pad="px-3 py-2 pr-5" align="right" first="desc">{tr("Value")}</SortTh></tr></thead>
              <tbody className="[&>tr>td]:border-b [&>tr>td]:border-neutral-100">{paged.rows.map((r) => {
                const h = heads.find((x) => x.branch === r.branch);
                const num = (v: number, sign: "+" | "−" | "", cls = "text-neutral-700") => (
                  <td className={cx("px-3 py-2 text-right tabular-nums", v ? cls : "text-neutral-300")}>{v ? `${sign}${qtyText(Math.abs(v))}` : "—"}</td>);
                return (
                  <tr key={`${r.branch}:${r.code}`} className="group cursor-pointer [&>td]:bg-white hover:[&>td]:bg-neutral-50" onClick={() => setCalc(r)} title={tr("See the calculation")}>
                    <td className="sticky left-0 z-[1] w-[13rem] max-w-[13rem] py-2 pl-5 pr-3"
                      title={`${r.branchName}${h ? ` · ${tr("SO {0}", dmy(h.soDate))}` : ""}${h && h.final === false ? ` · ${tr("not approved")}` : ""}`}>
                      <span className="flex min-w-0 items-center gap-1.5">
                        {h && h.final === false && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-500" aria-label={tr("not approved")} />}
                        <span className="truncate text-neutral-800">{r.branchName}</span></span></td>
                    <td className="sticky left-[13rem] z-[1] w-[15rem] max-w-[15rem] border-r border-neutral-200 px-3 py-2" title={`${r.name} · ${r.code}${r.category ? ` · ${r.category}` : ""}`}>
                      <span className="block truncate font-medium text-neutral-900">{r.name}</span></td>
                    <td className="px-3 py-2 text-right tabular-nums">{qtyText(r.so)} <span className="text-neutral-400">{r.unit}</span></td>
                    {num(r.received, "+", "border-l border-neutral-100 text-emerald-700")}
                    {num(r.transferIn, "+", "text-emerald-700")}
                    {num(r.otherMoves, r.otherMoves > 0 ? "+" : "−", cx("border-l border-neutral-100", r.otherMoves > 0 ? "text-emerald-700" : "text-red-700"))}
                    {num(r.sales, "−", "border-l border-neutral-100 text-red-700")}
                    {num(r.nonSales, "−", "text-red-700")}
                    {num(r.transferOut, "−", "text-red-700")}
                    {num(r.waste, "−", "text-red-700")}
                    {num(r.wasteProduct, "−", "text-red-700")}
                    {num(r.used, "−", "border-l border-neutral-100 text-neutral-700")}
                    <td className={cx("px-3 py-2 text-right font-semibold tabular-nums", r.estimate < -1e-6 ? "text-red-700" : "text-neutral-900")}
                      title={r.estimate < -1e-6 ? tr("Below zero: the recipe cards, a move or the SO does not match") : undefined}>{qtyText(r.estimate)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{r.pending ? <span title={tr("{0} on its way out", qtyText(r.pending))}>{qtyText(r.available)}*</span> : qtyText(r.available)}</td>
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
                  <span className="text-xs tabular-nums text-neutral-600">{tr("{0} {1} at {2} outlets · {3}", qtyText(m.available), m.unit, m.outlets.length, rpText(m.value))}</span>
                </div>
                <div className="mt-1.5 flex flex-wrap gap-1">{m.outlets.sort((a, b) => b.available - a.available).slice(0, 12).map((o) => (
                  <span key={o.branch} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">{o.branchName} · {qtyText(o.available)}</span>))}
                  {m.outlets.length > 12 && <span className="px-1 text-[11px] text-neutral-400">{tr("+{0} more", m.outlets.length - 12)}</span>}</div>
              </li>))}</ul>
          )}
      </Panel>
      {calc && <CalcDrawer r={calc} h={heads.find((x) => x.branch === calc.branch)} onClose={() => setCalc(null)} />}
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
          options={heads.map((h) => ({ value: h.branch, label: h.branchName, hint: tr("SO {0}", dmy(h.soDate)) }))} />
      </FilterRow>
      <FilterRow icon={<Package size={15} />} label={tr("Category")} value={c || null} onClear={() => setC("")}>
        <ComboFilter value={c} onChange={setC} allLabel={tr("All categories")} placeholder={tr("Search category")} options={categories.map((x) => ({ value: x, label: x }))} />
      </FilterRow>
    </MonitorFilterSheet>
  );
}

/** How the stock now of one material of one branch is reached (2026-11-08): the previous SO, the latest SO, every move,
 * waste and usage since the latest SO, the estimate and the available quantity. */
function CalcDrawer({ r, h, onClose }: { r: Row; h?: Head; onClose: () => void }) {
  const moves = r.received + r.transferIn + r.otherMoves - r.transferOut;
  const line = (label: string, v: number | null | undefined, hint?: string, strong?: boolean, sign = "") => (
    <div className={cx("flex items-start justify-between gap-3 px-4 py-2.5", strong && "bg-neutral-50")}>
      <span className="min-w-0"><span className={cx("block text-sm", strong ? "font-semibold text-neutral-900" : "text-neutral-700")}>{label}</span>
        {hint && <span className="block text-[11px] text-neutral-400">{hint}</span>}</span>
      <span className={cx("whitespace-nowrap tabular-nums", strong ? "text-base font-semibold text-neutral-900" : "text-sm text-neutral-800")}>
        {v == null ? "—" : `${sign}${qtyText(v)}`} <span className="text-xs text-neutral-400">{r.unit}</span></span>
    </div>
  );
  return (
    <Drawer open onClose={onClose} icon={<Calculator size={18} />} title={r.name} description={`${r.branchName} · ${r.code}`}>
      <div className="space-y-4">
        <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          <p className="border-b border-neutral-100 px-4 py-2 text-xs font-semibold capitalize text-neutral-500">{tr("Stock opname")}</p>
          {line(tr("Previous SO"), r.prevSo, h?.prevSoDate ? `${dmy(h.prevSoDate)}${h.prevRefs?.length ? ` · ${h.prevRefs.join(", ")}` : ""}` : tr("No earlier SO in the last 60 days"))}
          {line(tr("Latest SO"), r.so, h ? `${h.soAt ? tr("sent {0}", wibDateTime(h.soAt)) : dmy(h.soDate)}${h.refs.length ? ` · ${h.refs.join(", ")}` : ""}${h.final === false ? ` · ${tr("not approved")}` : ""}` : undefined, true)}
          {r.prevSo != null && line(tr("Change between the two SO"), r.so - r.prevSo, undefined, false, r.so - r.prevSo > 0 ? "+" : "")}
        </section>
        <section className="overflow-hidden rounded-md border border-neutral-200 bg-white">
          <p className="border-b border-neutral-100 px-4 py-2 text-xs font-semibold capitalize text-neutral-500">{tr("Since the latest SO")}</p>
          <p className="border-b border-neutral-100 bg-sky-50/60 px-4 py-2 text-[11px] text-sky-900">{tr("Waste, transfers and bills count from the time the SO was sent; goods receipts and other ESB documents from its day.")}</p>
          {line(tr("Goods Receipt"), r.received, undefined, false, "+")}
          {line(tr("Transfer In (TITO)"), r.transferIn, undefined, false, "+")}
          {line(tr("Other moves"), r.otherMoves, tr("Outlet purchases, production, deliveries, returns"), false, r.otherMoves > 0 ? "+" : "")}
          {line(tr("Transfer Out (TITO)"), r.transferOut, tr("From the Cost Control approval"), false, "−")}
          {line(tr("Waste approved"), r.waste, undefined, false, "−")}
          {line(tr("Product Sales"), r.wasteProduct, tr("Waste of the category Premix Tumpah / Human Error"), false, "−")}
          {line(tr("Sales"), r.sales, tr("Menus sold × recipe cards"), false, "−")}
          {line(tr("Non Sales"), r.nonSales, tr("ESB other-cost bills (cupping, waste, compliment …) × recipe cards"), false, "−")}
          {line(tr("Usage System"), r.used, tr("Sales + Non Sales"), false, "−")}
          {line(tr("Estimate Stock"), r.estimate, `${tr("SO")} ${qtyText(r.so)} ${moves >= 0 ? "+" : "−"} ${qtyText(Math.abs(moves))} − ${qtyText(r.waste + r.wasteProduct)} − ${qtyText(r.used)}`, true)}
          {line(tr("Available"), r.available, tr("For Transfer Stock: the SO with the transfers, less the ones on their way out"))}
        </section>
        <p className="px-1 text-xs text-neutral-500">{tr("Value")}: <span className="font-semibold text-neutral-800">{r.estimateValue == null ? tr("No price") : rpText(r.estimateValue)}</span>
          {r.price != null && <> · {tr("price {0} per {1}", rpText(r.price), r.unit)}</>}</p>
      </div>
    </Drawer>
  );
}
