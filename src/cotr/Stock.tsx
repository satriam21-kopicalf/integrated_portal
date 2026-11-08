"use client";

// Monitoring COTR → Storage & Production → Stock, Goods In and Stock Opname (migration 081), as the Cost Control of
// Kopi Calf: the running stock of every item of a pool / hub (latest approved count + goods in − used by the batches −
// waste) with how it is reached, the goods coming in, and the stock opname (counted against the running stock, sent,
// approved: the next running stock starts from it).

import { Boxes, Calculator, CheckCircle2, ClipboardCheck, PackagePlus, Plus, Save, Send, Trash2, Warehouse } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, ErrorState, cx, inputClass, theadClass, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Panel } from "@/components/kc/compat";
import { SearchInput, StatCard, StatGrid, ValueSkeleton } from "@/components/kc";
import { SkeletonList, SkeletonRows } from "@/components/kc/Skeleton";
import { call } from "@/so/features/checkin/checkin";
import { type Pool } from "@/cotr/types";
import { SearchSelect, rupiah, useMaster } from "@/cotr/ui";
import { SortTh, useSort } from "@/so/ui/Sort";
import { tr } from "@/lib/i18n";

type Row = { code: string; name: string; category: string; unit: string; packUnit: string | null; packQty: number | null; so: number; received: number;
  used: number; waste: number; estimate: number; cost: number | null; value: number | null };
type Stock = { pool: string; day: string; soDay: string | null; rows: Row[]; value: number; negative: number };
type Receipt = { id: string; pool: string; day: string; item: string; name: string; unit: string; qty: number; supplier: string | null; docNo: string | null; note: string | null };
type Count = { id: string; pool: string; poolName: string; day: string; status: "draft" | "submitted" | "approved"; note: string | null; lines: number };
type CountDetail = { id: string; pool: string; day: string; status: Count["status"]; note: string | null;
  lines: { item: string; name: string; unit: string; qty: number; expected: number | null; difference: number | null; value: number | null; note: string | null }[] };
type Item = { code: string; name: string; category: string; unit: string; pack_unit: string | null; pack_qty: number | null; is_stock: boolean; is_active: boolean };

const num = (n: number) => n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
const todayWib = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

/** The pool / hub the tab is about (the producing hubs first). */
function usePool() {
  const pools = useMaster<Pool>("pools");
  const list = useMemo(() => (pools.rows ?? []).filter((p) => p.kind !== "storage" && p.is_active)
    .sort((a, b) => Number(b.is_production) - Number(a.is_production) || a.name.localeCompare(b.name)), [pools.rows]);
  const [pool, setPool] = useState("");
  const code = pool || list[0]?.code || "";
  const picker = (
    <div className="w-full sm:w-72"><SearchSelect value={code} onChange={(v) => setPool(v ?? "")} placeholder={tr("Choose the pool / hub")}
      options={list.map((p) => ({ value: p.code, label: p.name, hint: p.is_production ? tr("Production Hub") : p.city }))} /></div>
  );
  return { pool: code, picker, loaded: !!pools.rows };
}

type Key = "name" | "so" | "received" | "used" | "waste" | "estimate" | "value";

export function StockTab() {
  const { pool, picker } = usePool();
  const [data, setData] = useState<Stock | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Row | null>(null);
  useEffect(() => {
    if (!pool) return;
    setData(null); setError(null);
    call<Stock>(`/api/cotr/stock?pool=${encodeURIComponent(pool)}`).then(setData).catch((e: Error) => setError(e.message));
  }, [pool]);
  const rows = (data?.rows ?? []).filter((r) => !q || `${r.name} ${r.code} ${r.category}`.toLowerCase().includes(q.toLowerCase()));
  const sorted = useSort<Row, Key>(rows, (r, k) => (k === "name" ? r.name : r[k]));
  const S = { sort: sorted.sort, onSort: sorted.toggle };
  return (
    <div className="space-y-4">
      <StatGrid label={tr("Summary")} cols={4}>
        <StatCard label={tr("Items in stock")} tone="brand" icon={<Boxes />} value={data ? data.rows.length : <ValueSkeleton />} />
        <StatCard label={tr("Stock value")} icon={<Warehouse />} value={data ? rupiah(data.value) : <ValueSkeleton />} sub={tr("at the item cost")} />
        <StatCard label={tr("Latest stock opname")} icon={<ClipboardCheck />} value={data ? (data.soDay ?? "—") : <ValueSkeleton />}
          sub={data && !data.soDay ? tr("No approved count yet: the stock starts from 0") : undefined} tone={data && !data.soDay ? "warn" : "default"} />
        <StatCard label={tr("Below zero")} icon={<Calculator />} tone={data?.negative ? "warn" : "default"} value={data ? data.negative : <ValueSkeleton />}
          sub={tr("check the recipe cards, goods in and waste")} />
      </StatGrid>
      <Panel title={tr("Running stock")} description={tr("Latest approved count + goods in − used by the batches (cups × recipe card) − waste. Tap a row for the calculation.")}
        actions={picker} toolbar={<SearchInput value={q} onChange={setQ} placeholder={tr("Search item")} />}>
        {error ? <ErrorState message={error} /> : !data ? <table className="w-full"><tbody><SkeletonRows cols={7} /></tbody></table>
          : !rows.length ? <Empty icon={<Boxes size={24} />} title={tr("No stock movement yet")}>{tr("Add the goods in or a stock opname first.")}</Empty> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm">
            <thead className={theadClass}><tr><SortTh k="name" {...S}>{tr("Item")}</SortTh><SortTh k="so" {...S} align="right" first="desc">{tr("Stock opname")}</SortTh>
              <SortTh k="received" {...S} align="right" first="desc">{tr("Goods in")}</SortTh><SortTh k="used" {...S} align="right" first="desc">{tr("Used")}</SortTh>
              <SortTh k="waste" {...S} align="right" first="desc">{tr("Waste")}</SortTh><SortTh k="estimate" {...S} align="right" first="desc">{tr("Estimate Now")}</SortTh>
              <SortTh k="value" {...S} align="right" first="desc">{tr("Value")}</SortTh></tr></thead>
            <tbody className="divide-y divide-neutral-100">{sorted.rows.map((r) => (
              <tr key={r.code} className="cursor-pointer hover:bg-neutral-50/70" onClick={() => setOpen(r)}>
                <td className="px-4 py-2.5"><span className="block font-medium text-neutral-900">{r.name}</span><span className="text-[11px] text-neutral-400">{r.code} · {r.category}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{num(r.so)} <span className="text-neutral-400">{r.unit}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700">{r.received ? `+${num(r.received)}` : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600">{r.used ? `−${num(r.used)}` : "—"}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-neutral-600">{r.waste ? `−${num(r.waste)}` : "—"}</td>
                <td className={cx("px-4 py-2.5 text-right font-semibold tabular-nums", r.estimate < -1e-6 ? "text-red-700" : "text-neutral-900")}>{num(r.estimate)}
                  {r.packUnit && r.packQty ? <span className="block text-[10px] font-normal text-neutral-400">≈ {num(r.estimate / r.packQty)} {r.packUnit}</span> : null}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.value == null ? <Badge tone="amber">{tr("No cost")}</Badge> : rupiah(r.value)}</td>
              </tr>))}</tbody>
          </table></div>
        )}
      </Panel>
      {open && data && (
        <Drawer open onClose={() => setOpen(null)} icon={<Calculator size={18} />} title={open.name} description={`${open.code} · ${data.pool}`}>
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200 text-sm">
            {[[tr("Stock opname"), open.so, data.soDay ? tr("approved count of {0}", data.soDay) : tr("no approved count: 0"), ""],
              [tr("Goods in"), open.received, tr("since the count"), "+"], [tr("Used by the batches"), open.used, tr("cups made × recipe card"), "−"],
              [tr("Waste"), open.waste, tr("storage and production"), "−"]].map(([l, v, h, sign]) => (
              <li key={String(l)} className="flex items-start justify-between gap-3 px-4 py-2.5"><span><span className="block text-neutral-800">{l}</span><span className="text-[11px] text-neutral-400">{h}</span></span>
                <span className="tabular-nums">{sign}{num(Number(v))} <span className="text-xs text-neutral-400">{open.unit}</span></span></li>))}
            <li className="flex justify-between gap-3 bg-neutral-50 px-4 py-2.5 font-semibold"><span>{tr("Estimate Now")}</span><span className="tabular-nums">{num(open.estimate)} {open.unit}</span></li>
          </ul>
          <p className="mt-3 text-xs text-neutral-500">{tr("Value")}: {open.value == null ? tr("set the cost of the item in Items") : `${rupiah(open.value)} (${rupiah(open.cost ?? 0)} / ${open.unit})`}</p>
        </Drawer>
      )}
    </div>
  );
}

/** The goods coming into a pool / hub (purchase, delivery), in the base unit or the pack of the item. */
export function ReceiptsTab() {
  const toast = useToast();
  const { pool, picker } = usePool();
  const items = useMaster<Item>("items");
  const [rows, setRows] = useState<Receipt[] | null>(null);
  const [form, setForm] = useState({ item: "", qty: "", unit: "", day: todayWib(), supplier: "", docNo: "", note: "" });
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    if (!pool) return;
    call<{ data: Receipt[] }>(`/api/cotr/receipts?pool=${encodeURIComponent(pool)}`).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [pool]);
  useEffect(() => { setRows(null); load(); }, [load]);
  const it = (items.rows ?? []).find((i) => i.code === form.item);
  const add = async () => {
    setBusy(true);
    try {
      await call("/api/cotr/receipts", { method: "POST", json: { pool, item: form.item, qty: Number(form.qty.replace(",", ".")), unit: form.unit || it?.unit,
        day: form.day, supplier: form.supplier || null, docNo: form.docNo || null, note: form.note || null } });
      toast(tr("Saved")); setForm({ ...form, item: "", qty: "", note: "", docNo: "" }); load();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    if (!window.confirm(tr("Delete this goods in?"))) return;
    try { await call(`/api/cotr/receipts/${id}`, { method: "DELETE" }); load(); } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <div className="space-y-4">
      <Panel title={tr("Add goods in")} description={tr("Raw materials, packaging and supplies coming into the pool / hub")} actions={picker}>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="text-[11px] font-medium text-neutral-500 sm:col-span-2">{tr("Item")}
            <div className="mt-1"><SearchSelect value={form.item} onChange={(v) => setForm({ ...form, item: v ?? "", unit: "" })} placeholder={tr("Choose the item")}
              options={(items.rows ?? []).filter((i) => i.is_stock && i.is_active).map((i) => ({ value: i.code, label: i.name, hint: `${i.code} · ${i.unit}` }))} /></div></div>
          <label className="text-[11px] font-medium text-neutral-500">{tr("Qty")}
            <span className="mt-1 flex gap-1.5"><input className={cx(inputClass, "h-10 text-right")} inputMode="decimal" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} />
              <select className={cx(inputClass, "h-10 w-28")} value={form.unit || it?.unit || ""} onChange={(e) => setForm({ ...form, unit: e.target.value })} disabled={!it}>
                {it && <option value={it.unit}>{it.unit}</option>}{it?.pack_unit && <option value={it.pack_unit}>{it.pack_unit} ({num(Number(it.pack_qty))} {it.unit})</option>}
              </select></span></label>
          <label className="text-[11px] font-medium text-neutral-500">{tr("Day")}<input type="date" className={cx(inputClass, "mt-1 h-10")} value={form.day} max={todayWib()} onChange={(e) => setForm({ ...form, day: e.target.value })} /></label>
          <label className="text-[11px] font-medium text-neutral-500">{tr("Supplier")}<input className={cx(inputClass, "mt-1 h-10")} value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} /></label>
          <label className="text-[11px] font-medium text-neutral-500">{tr("Document No.")}<input className={cx(inputClass, "mt-1 h-10")} value={form.docNo} onChange={(e) => setForm({ ...form, docNo: e.target.value })} /></label>
          <label className="text-[11px] font-medium text-neutral-500 sm:col-span-2">{tr("Note")}<input className={cx(inputClass, "mt-1 h-10")} value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></label>
        </div>
        <div className="flex justify-end border-t border-neutral-100 px-4 py-3"><Button disabled={!pool || !form.item || !Number(form.qty.replace(",", "."))} loading={busy} onClick={() => void add()}><PackagePlus size={15} />{tr("Add goods in")}</Button></div>
      </Panel>
      <Panel title={tr("Goods in (last 30 days)")}>
        {!rows ? <div className="p-4"><SkeletonList rows={3} /></div> : !rows.length ? <Empty icon={<PackagePlus size={24} />} title={tr("No goods in yet")} /> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[640px] text-sm">
            <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Day")}</th><th className="px-4 py-2.5">{tr("Item")}</th><th className="px-4 py-2.5 text-right">{tr("Qty")}</th><th className="px-4 py-2.5">{tr("Supplier / document")}</th><th /></tr></thead>
            <tbody className="divide-y divide-neutral-100">{rows.map((r) => (
              <tr key={r.id}><td className="whitespace-nowrap px-4 py-2.5">{r.day}</td><td className="px-4 py-2.5">{r.name}<span className="block text-[11px] text-neutral-400">{r.item}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{num(r.qty)} {r.unit}</td><td className="px-4 py-2.5 text-xs text-neutral-600">{[r.supplier, r.docNo, r.note].filter(Boolean).join(" · ") || "—"}</td>
                <td className="px-2"><button type="button" onClick={() => void remove(r.id)} aria-label={tr("Delete")} className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button></td></tr>))}</tbody>
          </table></div>
        )}
      </Panel>
    </div>
  );
}

const STATUS: Record<Count["status"], { label: () => string; tone: "slate" | "amber" | "green" }> = {
  draft: { label: () => tr("Draft"), tone: "slate" }, submitted: { label: () => tr("Waiting for approval"), tone: "amber" }, approved: { label: () => tr("Approved"), tone: "green" },
};

/** The stock opname of a pool / hub: count every item against the running stock, send, approve. */
export function CountsTab() {
  const { pool, picker } = usePool();
  const [rows, setRows] = useState<Count[] | null>(null);
  const [open, setOpen] = useState<string | "new" | null>(null);
  const load = useCallback(() => {
    if (!pool) return;
    call<{ data: Count[] }>(`/api/cotr/counts?pool=${encodeURIComponent(pool)}`).then((r) => setRows(r.data)).catch(() => setRows([]));
  }, [pool]);
  useEffect(() => { setRows(null); load(); }, [load]);
  return (
    <>
      <Panel title={tr("Stock Opname")} description={tr("Count every item of the pool / hub; the approved count is where the running stock starts again")}
        actions={<div className="flex flex-wrap items-center gap-2">{picker}<Button disabled={!pool} onClick={() => setOpen("new")}><Plus size={15} />{tr("New stock opname")}</Button></div>}>
        {!rows ? <div className="p-4"><SkeletonList rows={3} /></div> : !rows.length ? <Empty icon={<ClipboardCheck size={24} />} title={tr("No stock opname yet")} /> : (
          <ul className="divide-y divide-neutral-100">{rows.map((c) => (
            <li key={c.id}><button type="button" onClick={() => setOpen(c.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-neutral-50">
              <ClipboardCheck size={18} className="text-neutral-400" />
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-neutral-900">{c.day} · {c.poolName}</span><span className="text-[11px] text-neutral-500">{tr("{0} items", c.lines)}{c.note ? ` · ${c.note}` : ""}</span></span>
              <Badge tone={STATUS[c.status].tone}>{STATUS[c.status].label()}</Badge></button></li>))}</ul>
        )}
      </Panel>
      {open && <CountDrawer id={open === "new" ? null : open} pool={pool} onClose={() => setOpen(null)} onSaved={() => { load(); }} />}
    </>
  );
}

function CountDrawer({ id, pool, onClose, onSaved }: { id: string | null; pool: string; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [detail, setDetail] = useState<CountDetail | null>(null);
  const [stock, setStock] = useState<Stock | null>(null);
  const [qty, setQty] = useState<Record<string, string>>({});
  const [day, setDay] = useState(todayWib());
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  useEffect(() => {
    if (id) call<CountDetail>(`/api/cotr/counts/${id}`).then((d) => { setDetail(d); setDay(d.day); setNote(d.note ?? ""); setQty(Object.fromEntries(d.lines.map((l) => [l.item, String(l.qty)]))); });
    call<Stock>(`/api/cotr/stock?pool=${encodeURIComponent(pool)}`).then(setStock).catch(() => setStock({ pool, day: "", soDay: null, rows: [], value: 0, negative: 0 }));
  }, [id, pool]);
  const items = useMaster<Item>("items");
  const editable = !detail || detail.status === "draft";
  const list = (items.rows ?? []).filter((i) => i.is_stock && i.is_active && (!q || `${i.name} ${i.code}`.toLowerCase().includes(q.toLowerCase())));
  const expected = (code: string) => stock?.rows.find((r) => r.code === code)?.estimate ?? 0;
  const filled = Object.entries(qty).filter(([, v]) => v.trim() !== "");
  const save = async (submit: boolean) => {
    setBusy(true);
    try {
      const out = await call<CountDetail>("/api/cotr/counts", { method: "POST", json: { id: detail?.id ?? null, pool, day, note: note || null, submit,
        lines: Object.fromEntries(filled.map(([k, v]) => [k, { qty: Number(v.replace(",", ".")) }])) } });
      setDetail(out); toast(submit ? tr("Sent for approval") : tr("Saved")); onSaved();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const approve = async () => {
    setBusy(true);
    try { setDetail(await call<CountDetail>(`/api/cotr/counts/${detail!.id}/approve`, { method: "POST" })); toast(tr("Approved")); onSaved(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  return (
    <Drawer open onClose={onClose} size="xl" icon={<ClipboardCheck size={18} />} title={tr("Stock Opname")} description={`${pool} · ${day}`}
      footer={<div className="flex w-full flex-wrap items-center gap-2">
        <p className="min-w-0 flex-1 text-xs text-neutral-500">{detail ? STATUS[detail.status].label() : tr("{0} items counted", filled.length)}</p>
        {editable && <><Button variant="secondary" loading={busy} disabled={!filled.length} onClick={() => void save(false)}><Save size={15} />{tr("Save draft")}</Button>
          <Button loading={busy} disabled={!filled.length} onClick={() => void save(true)}><Send size={15} />{tr("Send")}</Button></>}
        {detail?.status === "submitted" && <Button loading={busy} onClick={() => void approve()}><CheckCircle2 size={15} />{tr("Approve")}</Button>}</div>}>
      {!stock || (id && !detail) ? <SkeletonList rows={5} /> : editable ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-[10rem_1fr]">
            <label className="text-[11px] font-medium text-neutral-500">{tr("Day")}<input type="date" className={cx(inputClass, "mt-1 h-10")} value={day} max={todayWib()} onChange={(e) => setDay(e.target.value)} /></label>
            <label className="text-[11px] font-medium text-neutral-500">{tr("Note")}<input className={cx(inputClass, "mt-1 h-10")} value={note} onChange={(e) => setNote(e.target.value)} /></label>
          </div>
          <SearchInput value={q} onChange={setQ} placeholder={tr("Search item")} />
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">{list.map((i) => {
            const v = qty[i.code] ?? "";
            const d = v.trim() !== "" ? Number(v.replace(",", ".")) - expected(i.code) : null;
            return (
              <li key={i.code} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-neutral-900">{i.name}</span>
                  <span className="block text-[11px] text-neutral-400">{i.code} · {tr("system {0} {1}", num(expected(i.code)), i.unit)}
                    {d !== null && Math.abs(d) > 1e-6 && <span className={cx("ml-1 font-semibold", d < 0 ? "text-red-600" : "text-emerald-700")}>{d > 0 ? "+" : ""}{num(d)}</span>}</span></span>
                <span className="relative w-32 flex-shrink-0"><input className={cx(inputClass, "h-11 pr-10 text-right text-base sm:h-10 sm:text-sm")} inputMode="decimal" placeholder="—" value={v}
                  onChange={(e) => setQty({ ...qty, [i.code]: e.target.value.replace(/[^0-9.,]/g, "") })} aria-label={i.name} />
                  <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] uppercase text-neutral-400">{i.unit}</span></span>
              </li>);
          })}</ul>
        </div>
      ) : (
        <div className="overflow-x-auto"><table className="w-full min-w-[600px] text-sm">
          <thead className={theadClass}><tr><th className="px-3 py-2">{tr("Item")}</th><th className="px-3 py-2 text-right">{tr("System")}</th><th className="px-3 py-2 text-right">{tr("Counted")}</th><th className="px-3 py-2 text-right">{tr("Difference")}</th><th className="px-3 py-2 text-right">{tr("Value")}</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">{detail!.lines.map((l) => (
            <tr key={l.item}><td className="px-3 py-2">{l.name}<span className="block text-[11px] text-neutral-400">{l.item}</span></td><td className="px-3 py-2 text-right tabular-nums">{l.expected == null ? "—" : num(l.expected)}</td>
              <td className="px-3 py-2 text-right tabular-nums">{num(l.qty)} {l.unit}</td>
              <td className={cx("px-3 py-2 text-right font-semibold tabular-nums", (l.difference ?? 0) < -1e-6 ? "text-red-600" : (l.difference ?? 0) > 1e-6 ? "text-emerald-700" : "text-neutral-400")}>{l.difference == null ? "—" : `${l.difference > 0 ? "+" : ""}${num(l.difference)}`}</td>
              <td className="px-3 py-2 text-right tabular-nums">{l.value == null ? "—" : rupiah(l.value)}</td></tr>))}</tbody>
        </table></div>
      )}
    </Drawer>
  );
}
