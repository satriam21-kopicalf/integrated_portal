"use client";

// Monitoring Stock → Stock List (page cc.stock-list; integrated_portal_be app/stock_transfer.py stock_list): the stock of
// every branch from its latest stock opname in the portal, with the transfers received since (in / out), the transfers
// on their way out and what is available for a Transfer Stock; valued with the Pricelist (else the ESB HPP). Two views:
// per branch (its count and value, then its materials) and per material (which outlets have it). The running stock
// (2026-11-07, app/running_stock.py): the estimate now = SO + goods received and the other moves − waste approved −
// usage by the recipe cards since the count; an estimate below zero means the cards or the moves do not match.

import { Boxes, CalendarDays, FileText, Package, Store } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, fmtNumber, Page, PageNav, Panel, SkeletonRows, theadClass, usePaged, useToast } from "@/so/ui";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { type ActiveFilter, FilterToolbar, dmy } from "@/so/ui/Filters";
import { ComboFilter, FilterRow, MonitorFilterSheet } from "@/so/ui/MonitorFilters";
import { Segmented } from "@/so/ui/Simple";
import { call } from "@/so/features/checkin/checkin";
import { downloadXlsx } from "@/lib/xlsx";
import { tr } from "@/lib/i18n";
import { qtyText, rpText, shortBranch } from "@/so/features/stock-transfer/transfer";

type Row = { branch: string; branchName: string; code: string; name: string; category: string; unit: string; so: number; in: number; out: number;
  pending: number; stock: number; available: number; price: number | null; value: number | null;
  received: number; otherMoves: number; waste: number; used: number; estimate: number; estimateValue: number | null };
type Head = { branch: string; branchName: string; soDate: string; refs: string[]; items: number; value: number; final?: boolean | null; estimateValue: number };
type Data = { branches: Head[]; rows: Row[] };
type View = "branch" | "material";

export default function StockListPage() {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>("branch");
  const [q, setQ] = useState("");
  const [branch, setBranch] = useState("");
  const [category, setCategory] = useState("");
  const [sheet, setSheet] = useState(false);
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
  const paged = usePaged(rows, q + branch + category + view, 50);
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
    header: ["Cabang", "Tanggal SO", "SO Final", "Kode", "Material", "Kategori", "Satuan", "SO", "Transfer Masuk", "Transfer Keluar", "Good Receipt", "Pergerakan Lain",
      "Waste Approved", "Terpakai (Resep)", "Estimasi Saat Ini", "Dalam Proses Keluar", "Tersedia (TITO)", "Harga", "Nilai SO", "Nilai Estimasi"],
    rows: rows.map((r) => { const h = heads.find((x) => x.branch === r.branch); return [r.branchName, h?.soDate ?? "", h?.final ? "Ya" : "Belum", r.code, r.name, r.category, r.unit,
      r.so, r.in, r.out, r.received, r.otherMoves, r.waste, r.used, r.estimate, r.pending, r.available, r.price, r.value, r.estimateValue]; }) });
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
      <Panel toolbar={<div className="space-y-3">
        <FilterToolbar search={q} onSearch={setQ} placeholder={tr("Search material or branch")} filters={chips} onOpen={() => setSheet(true)} onClear={() => { setBranch(""); setCategory(""); }}
          extra={<Button size="sm" variant="secondary" className="ml-auto" disabled={!rows.length} onClick={() => void exportRows().catch((e) => toast((e as Error).message, "error"))}><FileText size={14} />{tr("Export")}</Button>} />
        <Segmented label={tr("View")} value={view} onChange={setView} options={[{ value: "branch", label: tr("Per Branch") }, { value: "material", label: tr("Per Material") }]} />
      </div>} footer={data ? <><span>{tr("{0} shown", fmtNumber(view === "branch" ? rows.length : materials.length))}</span><PageNav paged={view === "branch" ? paged : pagedM} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={load} /> : !data ? <table className="w-full"><tbody><SkeletonRows cols={7} /></tbody></table>
          : !rows.length ? <Empty icon={<Boxes size={26} />} title={tr("No stock matches")} />
          : view === "branch" ? (
            <div className="overflow-x-auto"><table className="w-full min-w-[1180px] text-sm">
              <thead className={theadClass}><tr><th className="py-2.5 pl-5 pr-3">{tr("Branch")}</th><th className="px-3 py-2.5">{tr("Material")}</th>
                <th className="px-3 py-2.5 text-right">{tr("SO")}</th><th className="px-3 py-2.5 text-right" title={tr("Goods receipts, outlet purchases, production, deliveries, returns and transfers since the SO")}>{tr("In − Out")}</th>
                <th className="px-3 py-2.5 text-right">{tr("Waste")}</th><th className="px-3 py-2.5 text-right" title={tr("Menus sold and made since the SO × recipe cards")}>{tr("Used")}</th>
                <th className="px-3 py-2.5 text-right">{tr("Estimate Now")}</th><th className="px-3 py-2.5 text-right" title={tr("For Transfer Stock: the SO with the transfers, less the ones on their way out")}>{tr("Available")}</th>
                <th className="px-3 py-2.5 pr-5 text-right">{tr("Value")}</th></tr></thead>
              <tbody className="divide-y divide-neutral-100">{paged.rows.map((r) => {
                const h = heads.find((x) => x.branch === r.branch);
                return (
                  <tr key={`${r.branch}:${r.code}`} className="hover:bg-neutral-50/70">
                    <td className="max-w-[13rem] py-2 pl-5 pr-3"><p className="truncate text-neutral-800">{shortBranch(r.branchName)}</p>
                      <p className="text-[11px] text-neutral-400">{h ? tr("SO {0}", dmy(h.soDate)) : ""}{h && h.final === false ? <span className="ml-1 text-amber-700">· {tr("not approved")}</span> : null}</p></td>
                    <td className="max-w-[16rem] px-3 py-2"><p className="truncate font-medium text-neutral-900">{r.name}</p><p className="text-[11px] text-neutral-400">{r.code}{r.category ? ` · ${r.category}` : ""}</p></td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{qtyText(r.so)} <span className="text-neutral-400">{r.unit}</span></td>
                    {(() => { const mv = r.received + r.otherMoves + r.in - r.out; return (
                      <td className={cx("whitespace-nowrap px-3 py-2 text-right tabular-nums", mv > 0 ? "text-emerald-700" : mv < 0 ? "text-red-700" : "text-neutral-300")}
                        title={`${tr("Goods Receipt")} ${qtyText(r.received)} · ${tr("Transfer")} +${qtyText(r.in)} / −${qtyText(r.out)} · ${tr("Other")} ${qtyText(r.otherMoves)}`}>{mv ? `${mv > 0 ? "+" : ""}${qtyText(mv)}` : "—"}</td>); })()}
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{r.waste ? `−${qtyText(r.waste)}` : "—"}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-neutral-600">{r.used ? `−${qtyText(r.used)}` : "—"}</td>
                    <td className={cx("whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums", r.estimate < -1e-6 ? "text-red-700" : "text-neutral-900")}
                      title={r.estimate < -1e-6 ? tr("Below zero: the recipe cards, a move or the SO does not match") : undefined}>{qtyText(r.estimate)}</td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">{r.pending ? <span title={tr("{0} on its way out", qtyText(r.pending))}>{qtyText(r.available)}*</span> : qtyText(r.available)}</td>
                    <td className="whitespace-nowrap px-3 py-2 pr-5 text-right tabular-nums">{r.estimateValue == null ? <Badge tone="amber">{tr("No price")}</Badge> : rpText(r.estimateValue)}
                      {r.value != null && <span className="block text-[10px] text-neutral-400">{tr("SO {0}", rpText(r.value))}</span>}</td>
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
                  <span key={o.branch} className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">{shortBranch(o.branchName)} · {qtyText(o.available)}</span>))}
                  {m.outlets.length > 12 && <span className="px-1 text-[11px] text-neutral-400">{tr("+{0} more", m.outlets.length - 12)}</span>}</div>
              </li>))}</ul>
          )}
      </Panel>
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
