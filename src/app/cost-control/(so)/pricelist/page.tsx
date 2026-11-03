"use client";

// Pricelist Items (Cost Control, page cc.pricelist; integrated_portal_be app/menu_costing.py, migration 056): the price
// of every raw material per base unit from a date, with the average purchase price of the last 90 days (ESB goods
// received) as a reference. The price valid on a day costs the recipe cards of the Sales calculator by menu.

import { History, Save, Tags } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, cx, Empty, ErrorState, inputClass, Page, PageNav, Panel, SkeletonRows, theadClass, usePaged, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Stat, StatSkeleton, StatStrip } from "@/so/ui/StatStrip";
import { call } from "@/so/features/checkin/checkin";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";
import { SkeletonList } from "@/components/kc/Skeleton";

type Item = { code: string; name: string; unit: string; category: string | null; price: number | null; validFrom: string | null; note: string | null; purchaseAvg: number | null };
type Data = { day: string; categories: string[]; data: Item[] };
type Hist = { validFrom: string; price: number; note: string | null; by: string | null; at: string };

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

  const load = useCallback(async () => {
    setError(null);
    try { setData(await call<Data>(`/api/cost-control/pricelist?category=${encodeURIComponent(category)}`)); } catch (e) { setError((e as Error).message); }
  }, [category]);
  useEffect(() => { void load(); }, [load]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (data?.data ?? []).filter((i) => (!q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q)) && (!onlyMissing || i.price === null));
  }, [data, search, onlyMissing]);
  const paged = usePaged(rows, rows.length + search + category + String(onlyMissing));
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
  const usePurchase = () => setDraft((d) => {
    const n = { ...d };
    for (const i of rows) if (i.purchaseAvg !== null && i.price === null && !n[i.code]) n[i.code] = String(Math.round(i.purchaseAvg * 100) / 100);
    return n;
  });

  return (
    <Page title={tr("Pricelist Items")} subtitle={tr("The price of every raw material per base unit, used for the COGS of the menu recipe cards")}
      stats={
        <StatStrip label={tr("Summary")} columns={3}>
          <Stat label={tr("Items")} icon={<Tags size={13} />} value={data ? data.data.length.toLocaleString("id-ID") : <StatSkeleton />} />
          <Stat label={tr("With a Price")} emphasis value={data ? priced.toLocaleString("id-ID") : <StatSkeleton />}>
            {data && <p>{tr("{0} without a price", data.data.length - priced)}</p>}
          </Stat>
          <Stat label={tr("Not Saved Yet")} value={changed.length.toLocaleString("id-ID")} />
        </StatStrip>
      }>
      <Panel toolbar={
        <div className="flex flex-wrap items-end gap-2">
          <input className={cx(inputClass, "sm:max-w-xs")} value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tr("Search item")} />
          <select className={cx(inputClass, "sm:max-w-[14rem]")} value={category} onChange={(e) => setCategory(e.target.value)} aria-label={tr("Category")}>
            <option value="">{tr("All categories")}</option>{data?.categories.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <label className="flex h-10 items-center gap-2 text-sm text-neutral-600"><input type="checkbox" checked={onlyMissing} onChange={(e) => setOnlyMissing(e.target.checked)} />{tr("Without a price only")}</label>
          <span className="flex-1" />
          <label className="text-xs text-neutral-500">{tr("Valid from")}<input type="date" className={cx(inputClass, "mt-1 w-40")} value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <Button variant="secondary" onClick={usePurchase} title={tr("Fill the items without a price with the average purchase price")}>{tr("Use purchase average")}</Button>
          <Button loading={busy} disabled={!changed.length} onClick={() => void save()}><Save size={15} />{tr("Save {0} prices", changed.length)}</Button>
        </div>
      } footer={data ? <><span>{tr("{0} of {1} shown", rows.length, data.data.length)}</span><PageNav paged={paged} /></> : undefined}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : !data ? <SkeletonRows cols={6} /> : rows.length === 0 ? <Empty title={tr("No item matches")} /> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-sm">
              <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Item")}</th><th className="px-4 py-2.5">{tr("Category")}</th><th className="px-4 py-2.5">{tr("Unit")}</th>
                <th className="px-4 py-2.5 text-right">{tr("Purchase Avg 90 Days")}</th><th className="px-4 py-2.5 text-right">{tr("Current Price")}</th><th className="px-4 py-2.5">{tr("New Price")}</th><th /></tr></thead>
              <tbody className="divide-y divide-neutral-100">
                {paged.rows.map((i) => (
                  <tr key={i.code} className={draft[i.code] ? "bg-brand-50/40" : ""}>
                    <td className="px-4 py-2"><span className="block font-medium text-neutral-900">{i.name}</span><span className="text-[11px] text-neutral-400">{i.code}</span></td>
                    <td className="px-4 py-2 text-xs text-neutral-600">{i.category ?? "—"}</td>
                    <td className="px-4 py-2 text-xs">{i.unit}</td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums text-neutral-500">{rp(i.purchaseAvg, 4)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{i.price === null ? <Badge tone="amber">{tr("No price")}</Badge> : <>{rp(i.price, 4)}<span className="block text-[10px] text-neutral-400">{tr("from {0}", i.validFrom ?? "")}</span></>}</td>
                    <td className="w-40 px-4 py-2"><input inputMode="decimal" className={cx(inputClass, "h-9 text-right")} placeholder={i.price !== null ? String(i.price) : "0"} value={draft[i.code] ?? ""}
                      onChange={(e) => setDraft({ ...draft, [i.code]: e.target.value })} aria-label={`${tr("New price")} ${i.name}`} /></td>
                    <td className="px-2"><button type="button" onClick={() => setHistory(i)} className="rounded p-1.5 text-neutral-400 hover:text-brand-700" aria-label={tr("Price History")}><History size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      {history && <HistoryDrawer item={history} onClose={() => setHistory(null)} />}
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
