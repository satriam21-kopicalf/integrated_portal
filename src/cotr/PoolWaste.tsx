"use client";

// Monitoring COTR → Waste & Cupping of the pools / HUBs (migration 081, per menu and cupping since 088): what a pool or HUB
// wasted (storage: expired, spilled …; production: while making a batch) and gave for tasting (cupping), as cups of a
// menu, an item of the stock (deducted from the running stock) or another thing typed. Shown on Storage & Production
// (every pool) and on Storage & Assignment (the pool chosen there).

import { Building2, ClipboardList, Coffee, Factory, Package, Plus, Trash2, Warehouse } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, ErrorState, Field, Input, Select, usePaged, useToast } from "@/so/ui";
import { Panel } from "@/components/kc/compat";
import { EmptyState, IconButton, SearchInput, StatCard, StatGrid, ValueSkeleton, kcTable } from "@/components/kc";
import Drawer, { DrawerSection } from "@/components/kc/Drawer";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { dmyOf } from "@/components/kc/ScopeBar";
import { CotrFilterBar } from "@/cotr/FilterBar";
import { ComboFilter, FilterRow, MonitorFilterSheet, Segments } from "@/so/ui/MonitorFilters";
import { call } from "@/so/features/checkin/checkin";
import { Menu, Pool } from "@/cotr/types";
import { COTR_PAGE, CotrPager, useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

type Kind = "storage" | "production" | "cupping";
type Waste = { id: string; day: string; pool_code: string; item: string; qty: number; unit: string; reason: string; kind: Kind;
  menu_code: string | null; item_code: string | null; by_name?: string | null };
type Target = "menu" | "item" | "other";

const KIND: Record<Kind, { label: () => string; tone: "amber" | "red" | "violet" }> = {
  storage: { label: () => tr("Waste · storage"), tone: "amber" },
  production: { label: () => tr("Waste · production"), tone: "red" },
  cupping: { label: () => tr("Cupping"), tone: "violet" },
};
const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);
const blank = (pool: string) => ({ day: today(), pool_code: pool, kind: "storage" as Kind, target: "menu" as Target, menu_code: "", item_code: "", item: "", qty: 0, unit: "cup", reason: "" });

/** `pool`: only that pool / HUB (Storage & Assignment); without it every pool with a filter. */
export function PoolWaste({ pool: fixed, day }: { pool?: string; day?: string }) {
  const toast = useToast();
  const pools = useMaster<Pool>("pools");
  const menus = useMaster<Menu>("menus");
  const items = useMaster<{ code: string; name: string; unit: string; pack_unit: string | null; is_stock: boolean; is_active: boolean }>("items");
  const [rows, setRows] = useState<Waste[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => blank(fixed ?? ""));
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [poolF, setPoolF] = useState("");
  const [kindF, setKindF] = useState<"" | "waste" | "cupping">("");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState("");
  const pool = fixed ?? poolF;
  const load = useCallback(async () => {
    setError(null);
    const p = new URLSearchParams();
    if (fixed) p.set("pool", fixed);
    if (day) { p.set("dateTo", day); }
    try { setRows(await call<Waste[]>(`/api/cotr/waste${p.size ? `?${p}` : ""}`)); } catch (e) { setError((e as Error).message); }
  }, [fixed, day]);
  useEffect(() => { setRows(null); void load(); }, [load]);
  const poolName = (code: string) => pools.rows?.find((p) => p.code === code)?.name ?? code;
  const open = (kind: Kind) => { setForm({ ...blank(fixed ?? ""), day: day ?? today(), kind }); setAdding(true); };
  const add = async () => {
    setBusy(true);
    const body = { day: form.day, pool_code: form.pool_code, kind: form.kind, qty: form.qty, reason: form.reason,
      ...(form.target === "menu" ? { menu_code: form.menu_code, unit: "cup" } : { item: form.item, unit: form.unit, item_code: form.target === "item" ? form.item_code : null }) };
    try { await call("/api/cotr/waste", { method: "POST", json: body }); setAdding(false); toast(tr("Saved")); await load(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    try { await call(`/api/cotr/waste/${id}`, { method: "DELETE" }); await load(); } catch (e) { toast((e as Error).message, "error"); }
  };
  const listed = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (rows ?? []).filter((w) => (!pool || w.pool_code === pool) && (!kindF || (kindF === "cupping") === (w.kind === "cupping"))
      && (!k || `${w.item} ${w.reason}`.toLowerCase().includes(k)));
  }, [rows, pool, kindF, q]);
  const paged = usePaged(listed, `${pool}|${kindF}|${q}|${listed.length}`, COTR_PAGE);
  const cupsOf = (f: (w: Waste) => boolean) => listed.filter((w) => w.menu_code && f(w)).reduce((a, w) => a + Number(w.qty), 0);
  const usedPools = new Set((rows ?? []).map((w) => w.pool_code));
  const valid = !!form.pool_code && form.qty > 0 && !!form.reason.trim() && (form.target === "menu" ? !!form.menu_code : !!form.item.trim());
  const actions = (
    <div className="flex flex-wrap items-center gap-2">
      <SearchInput value={q} onChange={setQ} placeholder={tr("Search item or reason")} />
      <Button variant="secondary" onClick={() => open("cupping")}><Coffee size={15} /> {tr("Record Cupping")}</Button>
      <Button onClick={() => open("storage")}><Plus size={15} /> {tr("Record Waste")}</Button>
    </div>
  );
  return (
    <>
      {fixed ? <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div> : (
        <CotrFilterBar onOpen={() => { setDraft(poolF); setSheet(true); }} right={actions}
          scopes={[{ key: "pool", icon: <Building2 />, label: tr("Pool / HUB"), value: poolF ? poolName(poolF) : tr("All pools"), active: !!poolF }]} />
      )}
      <Segments value={kindF} onChange={(v) => setKindF(v as "" | "waste" | "cupping")}
        choices={[{ value: "", label: tr("All") }, { value: "waste", label: tr("Waste") }, { value: "cupping", label: tr("Cupping") }]} />
      <StatGrid label={tr("Waste & Cupping of the Pools")} cols={4}>
        <StatCard label={tr("Entries")} icon={<ClipboardList />} value={rows ? listed.length : <ValueSkeleton />} sub={tr("Last 30 Days")} />
        <StatCard label={tr("Waste (cups)")} tone="warn" icon={<Trash2 />} value={rows ? cupsOf((w) => w.kind !== "cupping") : <ValueSkeleton />} sub={tr("menus")} />
        <StatCard label={tr("Cupping (cups)")} icon={<Coffee />} value={rows ? cupsOf((w) => w.kind === "cupping") : <ValueSkeleton />} sub={tr("menus")} />
        <StatCard label={tr("Items")} icon={<Package />} value={rows ? listed.filter((w) => !w.menu_code).length : <ValueSkeleton />} sub={tr("raw materials and others")} />
      </StatGrid>
      {sheet && (
        <MonitorFilterSheet active={draft ? 1 : 0} onClose={() => setSheet(false)} onReset={() => setDraft("")} onApply={() => { setPoolF(draft); setSheet(false); }}>
          <FilterRow icon={<Building2 size={15} />} label={tr("Pool / HUB")} value={draft ? poolName(draft) : null} onClear={() => setDraft("")}>
            <ComboFilter value={draft} onChange={setDraft} allLabel={tr("All pools")} placeholder={tr("Search pool")}
              options={(pools.rows ?? []).filter((p) => usedPools.has(p.code) || p.code === draft).map((p) => ({ value: p.code, label: p.name, hint: p.city }))} />
          </FilterRow>
        </MonitorFilterSheet>
      )}
      <Drawer open={adding} onClose={() => setAdding(false)} icon={form.kind === "cupping" ? <Coffee size={18} /> : <Trash2 size={18} />}
        title={form.kind === "cupping" ? tr("Record Cupping") : tr("Record Waste")}
        description={form.kind === "cupping" ? tr("Cups given for tasting at a pool or HUB") : tr("Waste of a pool or HUB: the item, how much and why")}
        footer={<><Button variant="ghost" onClick={() => setAdding(false)}>{tr("Cancel")}</Button><Button loading={busy} disabled={!valid} onClick={() => void add()}><Plus size={15} /> {tr("Add")}</Button></>}>
        <DrawerSection title={tr("Where and When")}>
          <Field label={tr("Day")}><Input type="date" value={form.day} max={today()} onChange={(e) => setForm({ ...form, day: e.target.value })} /></Field>
          <Field label={tr("Pool / HUB")}>
            <Select value={form.pool_code} disabled={!!fixed} onChange={(e) => setForm({ ...form, pool_code: e.target.value })}>
              <option value="">—</option>{(pools.rows ?? []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label={tr("Type")}><Select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>
            <option value="storage">{tr("Waste · storage (expired, damaged …)")}</option><option value="production">{tr("Waste · production (while making a batch)")}</option>
            <option value="cupping">{tr("Cupping (given for tasting)")}</option></Select></Field>
        </DrawerSection>
        <DrawerSection title={tr("What")}>
          <Field label={tr("Of")}>
            <Select value={form.target} onChange={(e) => { const t = e.target.value as Target; setForm({ ...form, target: t, unit: t === "menu" ? "cup" : "g", item: "", item_code: "", menu_code: "" }); }}>
              <option value="menu">{tr("A menu (cups)")}</option><option value="item">{tr("An item of the stock (deducted from the stock)")}</option><option value="other">{tr("Another thing (typed)")}</option>
            </Select>
          </Field>
          {form.target === "menu" && (
            <Field label={tr("Menu")}><Select value={form.menu_code} onChange={(e) => setForm({ ...form, menu_code: e.target.value })}>
              <option value="">—</option>{(menus.rows ?? []).filter((m) => m.is_active).map((m) => <option key={m.code} value={m.code}>{m.name}</option>)}
            </Select></Field>
          )}
          {form.target === "item" && (
            <Field label={tr("Item")}><Select value={form.item_code} onChange={(e) => { const it = (items.rows ?? []).find((i) => i.code === e.target.value); setForm({ ...form, item_code: e.target.value, item: it?.name ?? "", unit: it?.unit ?? form.unit }); }}>
              <option value="">—</option>{(items.rows ?? []).filter((i) => i.is_stock && i.is_active).map((i) => <option key={i.code} value={i.code}>{i.name} · {i.code}</option>)}
            </Select></Field>
          )}
          {form.target === "other" && <Field label={tr("Item name")}><Input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} /></Field>}
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("Qty")}><Input type="number" min={0} value={form.qty || ""} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} /></Field>
            <Field label={tr("Unit")}>{form.target === "menu" ? <Input value="cup" disabled /> : (
              <Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{[...new Set(["g", "ml", "pcs", ...((items.rows ?? []).filter((i) => i.code === form.item_code).flatMap((i) => [i.unit, i.pack_unit ?? ""]))])].filter(Boolean).map((u) => <option key={u}>{u}</option>)}</Select>)}
            </Field>
          </div>
          <Field label={form.kind === "cupping" ? tr("For whom / event") : tr("Reason")}>
            <Input value={form.reason} maxLength={300} placeholder={form.kind === "cupping" ? tr("e.g. tasting for the new team") : tr("e.g. expired")} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
          </Field>
        </DrawerSection>
      </Drawer>
      <Panel title={tr("Waste & Cupping of the Pools")} description={tr("Last 30 Days")}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : !rows ? <SkeletonTable cols={6} /> : listed.length === 0 ? (
          <EmptyState icon={<Trash2 />} title={rows.length ? tr("Nothing matches the filters") : tr("Nothing yet")}>{!rows.length && <div className="mt-3"><Button onClick={() => open("storage")}><Plus size={15} /> {tr("Record Waste")}</Button></div>}</EmptyState>
        ) : (
          <table className="m-cards w-full text-sm">
            <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Day")}</th>{!fixed && <th className="px-4 py-2.5">{tr("Pool / HUB")}</th>}<th className="px-4 py-2.5">{tr("Type")}</th><th className="px-4 py-2.5">{tr("Item")}</th><th className="px-4 py-2.5 text-right">{tr("Qty")}</th><th className="px-4 py-2.5">{tr("Reason")}</th><th className="w-10" /></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {paged.rows.map((w) => (
                <tr key={w.id} className="hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{dmyOf(w.day)}</td>
                  {!fixed && <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1.5"><Warehouse size={13} className="text-neutral-400" />{poolName(w.pool_code)}</span></td>}
                  <td className="px-4 py-2.5"><Badge tone={KIND[w.kind]?.tone ?? "amber"}>{KIND[w.kind]?.label() ?? w.kind}</Badge></td>
                  <td className="px-4 py-2.5"><span className="inline-flex items-center gap-2 font-medium text-neutral-900">{w.menu_code ? <Coffee size={13} className="text-neutral-400" /> : <Factory size={13} className="text-neutral-400" />}{w.item}</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{Number(w.qty)} {w.unit}</td>
                  <td className="px-4 py-2.5"><span className="block text-xs text-neutral-600">{w.reason}</span>{w.by_name && <span className="text-[11px] text-neutral-400">{w.by_name}</span>}</td>
                  <td className="px-1"><IconButton label={tr("Delete")} onClick={() => void remove(w.id)}><Trash2 size={15} /></IconButton></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <CotrPager paged={paged} className="px-4 pb-3" />
      </Panel>
    </>
  );
}
