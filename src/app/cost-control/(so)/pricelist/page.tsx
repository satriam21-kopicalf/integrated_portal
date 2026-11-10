"use client";

// List & Pricelist Items (Cost Control, page cc.pricelist; the items active / inactive since 2026-11-09 — an inactive item
// leaves the stock opname forms and the pickers; integrated_portal_be app/menu_costing.py, migration 056): the price
// of every raw material per base unit from a date, with the average purchase price of the last 90 days (ESB goods
// received) as a reference. The price valid on a day costs the recipe cards of the Sales calculator by menu.

import { SortTh, useSort } from "@/so/ui/Sort";
import { BadgeAlert, CalendarDays, History, Package, Save, Tags } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, inputClass, Page, PageNav, Panel, theadClass, usePaged, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { ConfirmDialog } from "@/so/ui/Dialog";
import { Tabs } from "@/components/kc";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import { SkeletonList, SkeletonTable } from "@/components/kc/Skeleton";
import { type ActiveFilter, FilterToolbar } from "@/so/ui/Filters";
import { ComboFilter, FilterRow, MonitorFilterSheet } from "@/so/ui/MonitorFilters";
import { Segmented } from "@/so/ui/Simple";

type Item = { code: string; name: string; unit: string; active?: boolean; category: string | null; price: number | null; validFrom: string | null; note: string | null; purchaseAvg: number | null;
  /** median ESB HPP of one base unit over the outlets (inventory valuation, 2026-11-05) */ esbHpp?: number | null; esbHppLocations?: number };
type Data = { day: string; categories: string[]; data: Item[]; counts?: { active: number; inactive: number } };
type Status = "active" | "inactive" | "all";
type Hist = { validFrom: string; price: number; note: string | null; by: string | null; at: string };

type SortKey = "item" | "category" | "unit" | "purchase" | "hpp" | "price";
const sortValue = (i: Item, k: SortKey) => ({ item: i.name, category: i.category, unit: i.unit, purchase: i.purchaseAvg, hpp: i.esbHpp, price: i.price }[k]);
const rp = (v: number | null | undefined, d = 2) => (v === null || v === undefined ? "—" : `Rp ${v.toLocaleString("id-ID", { maximumFractionDigits: d })}`);
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

export default function PricelistPage() {
  const toast = useToast();
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [onlyMissing, setOnlyMissing] = useState(false);
  const [from, setFrom] = useState(today);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Item | null>(null);
  const [sheet, setSheet] = useState(false);
  const [status, setStatus] = useState<Status>("active");
  const [toggling, setToggling] = useState<Item | null>(null);
  const [toggleBusy, setToggleBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try { setData(await call<Data>(`/api/cost-control/pricelist?category=${encodeURIComponent(category)}&status=${status}`)); } catch (e) { setError((e as Error).message); }
  }, [category, status]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.data ?? []).filter((i) => (!q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)) && (!onlyMissing || i.price === null));
  }, [data, search, onlyMissing]);
  const sorted = useSort<Item, SortKey>(rows, sortValue);
  const paged = usePaged(sorted.rows, rows.length + search + category + String(onlyMissing) + JSON.stringify(sorted.sort));
  const priced = (data?.data ?? []).filter((i) => i.price !== null).length;
  const changed = Object.entries(draft).filter(([, v]) => v.trim() !== "");

  const save = async () => {
    setBusy(true);
    try {
      const out = await call<{ saved: number }>("/api/cost-control/pricelist", { method: "PUT", json: {
        rows: changed.map(([code, v]) => ({ code, price: Number(v.replace(/\./g, "").replace(",", ".")), validFrom: from })) } });
      toast(tr("{0} prices saved", out.saved));
      setDraft({});
      await load();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const toggle = async (i: Item) => {
    setToggleBusy(true);
    try {
      await call(`/api/cost-control/pricelist/${encodeURIComponent(i.code)}/active`, { method: "PUT", json: { active: i.active === false } });
      toast(i.active === false ? tr("{0} activated", i.name) : tr("{0} deactivated", i.name));
      setToggling(null);
      await load();
    } catch (e) { toast((e as Error).message, "error"); } finally { setToggleBusy(false); }
  };
  const chips: ActiveFilter[] = [
    ...(category ? [{ key: "c", label: category, onRemove: () => setCategory("") }] : []),
    ...(onlyMissing ? [{ key: "m", label: tr("Without a price only"), onRemove: () => setOnlyMissing(false) }] : []),
  ];
  const usePurchase = () => setDraft((d) => {
    const n = { ...d };
    // the purchase average, else the ESB HPP (a pack bought in another unit has no purchase average)
    for (const i of rows) { const ref = i.purchaseAvg ?? i.esbHpp ?? null; if (ref !== null && i.price === null && !n[i.code]) n[i.code] = String(Math.round(ref * 100) / 100); }
    return n;
  });

  return (
    <Page title={tr("List & Pricelist Items")} subtitle={tr("Every stock item: active or not (the stock opname forms show the active ones) and its price per base unit for the COGS")}
      stats={
        <StatStrip label={tr("Summary")} columns={3}>
          <Stat label={tr("Items")} icon={<Tags size={13} />} value={data ? data.data.length.toLocaleString("id-ID") : <StatSkeleton />} />
          <Stat label={tr("With a Price")} emphasis value={data ? priced.toLocaleString("id-ID") : <StatSkeleton />}>
            {data && <p>{tr("{0} without a price", data.data.length - priced)}</p>}
          </Stat>
          <Stat label={tr("Not Saved Yet")} value={changed.length.toLocaleString("id-ID")} />
        </StatStrip>
      }>
      <Panel toolbar={<div className="space-y-3">
        <Tabs label={tr("Status")} value={status} onChange={(k) => { setStatus(k as Status); setDraft({}); setData(null); }} tabs={[
          { key: "active", label: tr("Active"), count: data?.counts?.active },
          { key: "inactive", label: tr("Inactive"), count: data?.counts?.inactive },
          { key: "all", label: tr("All") }]} />
        <FilterToolbar search={search} onSearch={setSearch} placeholder={tr("Search item")} filters={chips} onOpen={() => setSheet(true)}
          onClear={() => { setCategory(""); setOnlyMissing(false); }} />
        {/* the new prices: from which day, filled from the purchase average, saved together */}
        <div className="flex flex-col gap-2 rounded-xl border border-neutral-200 bg-neutral-50/60 p-2.5 sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 whitespace-nowrap text-xs font-medium text-neutral-600"><CalendarDays size={14} className="text-neutral-400" />{tr("Valid from")}
            <input type="date" className={cx(inputClass, "h-9 w-40 bg-white")} value={from} onChange={(e) => setFrom(e.target.value)} aria-label={tr("Valid from")} /></label>
          <span className="hidden flex-1 sm:block" />
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button size="sm" variant="secondary" onClick={usePurchase} title={tr("Fill the items without a price with the average purchase price, else the ESB HPP")}>{tr("Use Purchase Average")}</Button>
            <Button size="sm" loading={busy} disabled={!changed.length} onClick={() => void save()}><Save size={15} />{tr("Save {0} prices", changed.length)}</Button>
          </div>
        </div>
      </div>      } footer={data ? <><span>{tr("{0} of {1} shown", rows.length, data.data.length)}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : !data ? <SkeletonTable cols={6} /> : rows.length === 0 ? <Empty title={tr("No item matches")} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className={theadClass}><tr>
                <SortTh k="item" sort={sorted.sort} onSort={sorted.toggle}>{tr("Item")}</SortTh>
                <SortTh k="category" sort={sorted.sort} onSort={sorted.toggle}>{tr("Category")}</SortTh>
                <SortTh k="unit" sort={sorted.sort} onSort={sorted.toggle}>{tr("Unit")}</SortTh>
                <SortTh k="purchase" sort={sorted.sort} onSort={sorted.toggle} align="right" first="desc">{tr("Purchase Avg 90 Days")}</SortTh>
                <SortTh k="hpp" sort={sorted.sort} onSort={sorted.toggle} align="right" first="desc">{tr("ESB HPP")}</SortTh>
                <SortTh k="price" sort={sorted.sort} onSort={sorted.toggle} align="right" first="desc">{tr("Current Price")}</SortTh>
                <th className="px-4 py-2.5">{tr("New Price")}</th><th className="px-4 py-2.5">{tr("Status")}</th><th /></tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {paged.rows.map((i) => (
                  <tr key={i.code} className={cx(draft[i.code] && "bg-brand-50/40", i.active === false && "bg-neutral-50/70")}>
                    <td className="px-4 py-2"><span className="block font-medium text-neutral-900">{i.name}</span><span className="text-[11px] text-neutral-400">{i.code}</span></td>
                    <td className="px-4 py-2 text-xs text-neutral-600">{i.category ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{i.unit}</td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums text-neutral-500">{rp(i.purchaseAvg, 4)}</td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums text-neutral-500" title={i.esbHppLocations ? tr("Median of {0} outlets", i.esbHppLocations) : undefined}>{rp(i.esbHpp ?? null, 4)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{i.price === null ? <Badge tone="amber">{tr("No price")}</Badge> : <>{rp(i.price, 4)}<span className="block text-[10px] text-neutral-400">{tr("from {0}", i.validFrom ?? "")}</span></>}</td>
                    <td className="w-40 px-4 py-2"><input inputMode="decimal" className={cx(inputClass, "h-9 text-right")} placeholder={i.price !== null ? String(i.price) : "0"} value={draft[i.code] ?? ""}
                      onChange={(e) => setDraft({ ...draft, [i.code]: e.target.value })} aria-label={`${tr("New price")} ${i.name}`} /></td>
                    <td className="px-4 py-2">
                      <button type="button" role="switch" aria-checked={i.active !== false} onClick={() => setToggling(i)}
                        aria-label={i.active !== false ? tr("Deactivate {0}", i.name) : tr("Activate {0}", i.name)}
                        className="inline-flex items-center gap-2 text-xs font-medium text-neutral-600">
                        <span className={cx("relative h-5 w-9 rounded-full transition-colors", i.active !== false ? "bg-emerald-500" : "bg-neutral-300")}>
                          <span className={cx("absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all", i.active !== false ? "left-[18px]" : "left-0.5")} />
                        </span>
                        {i.active !== false ? tr("Active") : tr("Inactive")}
                      </button>
                    </td>
                    <td className="px-2"><button type="button" onClick={() => setHistory(i)} className="rounded p-1.5 text-neutral-400 hover:text-brand-700" aria-label={tr("Price History")}><History size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {sheet && <PriceFilters category={category} missing={onlyMissing} categories={data?.categories ?? []} onClose={() => setSheet(false)}
        onApply={(c, m) => { setCategory(c); setOnlyMissing(m); setSheet(false); }} />}
      {history && <HistoryDrawer item={history} onClose={() => setHistory(null)} />}
      <ConfirmDialog open={!!toggling} busy={toggleBusy} danger={toggling?.active !== false}
        title={toggling?.active !== false ? tr("Deactivate {0}?", toggling?.name ?? "") : tr("Activate {0}?", toggling?.name ?? "")}
        description={toggling?.active !== false
          ? tr("The item leaves the stock opname forms opened from now and the item pickers; its counts, prices and history stay.")
          : tr("The item shows again in the stock opname forms opened from now (it must be in the count list or template of the branch).")}
        confirmLabel={toggling?.active !== false ? tr("Deactivate") : tr("Activate")}
        onConfirm={() => toggling && void toggle(toggling)} onClose={() => setToggling(null)} />
    </Page>
  );
}

function HistoryDrawer({ item, onClose }: { item: Item; onClose: () => void }) {
  const [rows, setRows] = useState<Hist[] | null>(null);
  useEffect(() => { void call<{ data: Hist[] }>(`/api/cost-control/pricelist/${encodeURIComponent(item.code)}/history`).then((r) => setRows(r.data)); }, [item.code]);
  return (
    <Drawer open onClose={onClose} icon={<Tags size={18} />} title={item.name} description={`${item.code} · ${tr("price per {0}", item.unit)}`}>
      {!rows ? <SkeletonList rows={4} /> : rows.length === 0 ? <Empty title={tr("No price yet")} /> : (
        <ul className="divide-y divide-neutral-100 rounded-xl border border-neutral-200 text-sm">
          {rows.map((r) => (
            <li key={r.validFrom} className="flex items-center justify-between gap-3 px-3 py-2">
              <span><span className="font-medium">{rp(r.price, 4)}</span><span className="block text-[11px] text-neutral-400">{tr("from {0}", r.validFrom)} · {r.by ?? ""} · {wibDateTime(r.at)}</span></span>
              {r.note && <span className="text-xs text-neutral-500">{r.note}</span>}
            </li>
          ))}
        </ul>
      )}
    </Drawer>
  );
}

function PriceFilters({ category, missing, categories, onApply, onClose }: {
  category: string; missing: boolean; categories: string[]; onApply: (c: string, m: boolean) => void; onClose: () => void;
}) {
  const [c, setC] = useState(category);
  const [m, setM] = useState(missing);
  return (
    <MonitorFilterSheet active={[c, m].filter(Boolean).length} onClose={onClose} onApply={() => onApply(c, m)} onReset={() => { setC(""); setM(false); }}>
      <FilterRow icon={<Package size={15} />} label={tr("Category")} value={c || null} onClear={() => setC("")}>
        <ComboFilter value={c} onChange={setC} allLabel={tr("All categories")} placeholder={tr("Search category")} options={categories.map((x) => ({ value: x, label: x }))} />
      </FilterRow>
      <FilterRow icon={<BadgeAlert size={15} />} label={tr("Price")} value={m ? tr("Without a price only") : null} onClear={() => setM(false)}>
        <Segmented label={tr("Price")} value={m ? "missing" : "all"} onChange={(v) => setM(v === "missing")}
          options={[{ value: "all", label: tr("All items") }, { value: "missing", label: tr("Without a price only") }]} />
      </FilterRow>
    </MonitorFilterSheet>
  );
}
