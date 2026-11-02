"use client";

// Monitoring COTR → Storage & Production (page cotr.production): the items and recipe cards of COTR (src/cotr/Recipes),
// the premix calculator, the theoretical usage, the production plan from the drivers' sales of the last days (average + a buffer,
// exploded through the BOMs down to raw materials: cup → premix → milk, espresso …) and the waste of the pools.

import { BookOpen, Building2, Calculator, CalendarDays, ClipboardList, CookingPot, Factory, ListTree, Package, Percent, Plus, Trash2, TrendingDown, Truck } from "lucide-react";
import { BatchesTab } from "@/cotr/Batches";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge, Button, Empty, ErrorState, Field, Input, Select, useToast } from "@/so/ui";
import { Page, Panel } from "@/components/kc/compat";
import { EmptyState, IconButton, SearchInput, StatCard, StatGrid, Tabs, ValueSkeleton, kcTable } from "@/components/kc";
import Drawer, { DrawerSection } from "@/components/kc/Drawer";
import { SkeletonRows } from "@/components/kc/Skeleton";
import { ScopeBar, dmyOf } from "@/components/kc/ScopeBar";
import { ComboFilter, FilterRow, MonitorFilterSheet, Segments } from "@/so/ui/MonitorFilters";
import { call } from "@/so/features/checkin/checkin";
import { Pool } from "@/cotr/types";
import { useMaster } from "@/cotr/ui";
import { CalculatorTab, ItemsTab, RecipesTab, UsageTab } from "@/cotr/Recipes";
import { locale, tr } from "@/lib/i18n";

type Tab = "items" | "recipes" | "calc" | "batch" | "plan" | "usage" | "waste";
type Plan = { days: number; menus: { code: string; name: string; average: number; highest: number; plan: number; bom: string | null }[]; materials: { item: string; qty: number; unit: string }[] };
type Waste = { id: string; day: string; pool_code: string; item: string; qty: number; unit: string; reason: string };

const SECTIONS: { key: Tab; label: () => string; icon: typeof Package }[] = [
  { key: "items", label: () => tr("Items"), icon: Package }, { key: "recipes", label: () => tr("Recipe cards"), icon: BookOpen },
  { key: "calc", label: () => tr("Calculator"), icon: Calculator }, { key: "batch", label: () => tr("Batches"), icon: Truck },
  { key: "plan", label: () => tr("Production plan"), icon: Factory },
  { key: "usage", label: () => tr("Usage"), icon: TrendingDown }, { key: "waste", label: () => tr("Waste"), icon: Trash2 },
];

export default function CotrProductionPage() {
  const [tab, setTab] = useState<Tab>("recipes");
  return (
    <Page eyebrow="Monitoring COTR" media={<CookingPot size={19} />} title={tr("Storage & Production")} subtitle={tr("Items, recipe cards, premix calculator, production plan, theoretical usage and waste")}>
      <Tabs label={tr("Section")} value={tab} onChange={(k) => setTab(k as Tab)}
        tabs={SECTIONS.map((x) => ({ key: x.key, label: <span className="inline-flex items-center gap-1.5"><x.icon size={15} />{x.label()}</span> }))} />
      {tab === "items" && <ItemsTab />}
      {tab === "recipes" && <RecipesTab />}
      {tab === "calc" && <CalculatorTab />}
      {tab === "batch" && <BatchesTab />}
      {tab === "plan" && <PlanView />}
      {tab === "usage" && <UsageTab />}
      {tab === "waste" && <WasteList />}
    </Page>
  );
}

const BUFFERS = [0, 5, 10, 15, 20, 25];

function PlanView() {
  const [days, setDays] = useState(7);
  const [buffer, setBuffer] = useState(10);
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState({ days: 7, buffer: 10 });
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setError(null); setLoading(true);
    try { setPlan(await call<Plan>(`/api/cotr/production?days=${days}&buffer=${buffer}`)); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [days, buffer]);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);
  const cups = plan?.menus.reduce((t, r) => t + r.plan, 0) ?? 0;
  return (
    <>
      <ScopeBar onOpen={() => { setDraft({ days, buffer }); setSheet(true); }} onRefresh={() => void load()} refreshing={loading}
        scopes={[
          { key: "days", icon: <CalendarDays />, label: tr("Days of sales"), value: tr("Last {0} days", days), active: days !== 7 },
          { key: "buffer", icon: <Percent />, label: tr("Buffer"), value: `${buffer}%`, active: buffer !== 10 },
        ]} />
      <StatGrid label={tr("Production plan for tomorrow")} cols={4}>
        <StatCard label={tr("Menus planned")} icon={<CookingPot />} value={plan ? plan.menus.length : <ValueSkeleton />} />
        <StatCard label={tr("Cups planned")} tone="brand" icon={<Factory />} value={plan ? cups.toLocaleString(locale()) : <ValueSkeleton />} sub={plan && tr("buffer {0}%", buffer)} />
        <StatCard label={tr("Without a recipe")} icon={<BookOpen />} tone={plan?.menus.some((r) => !r.bom) ? "warn" : "default"} value={plan ? plan.menus.filter((r) => !r.bom).length : <ValueSkeleton />} />
        <StatCard label={tr("Raw materials")} icon={<ListTree />} value={plan ? plan.materials.length : <ValueSkeleton />} />
      </StatGrid>
      {sheet && (
        <MonitorFilterSheet active={(draft.days !== 7 ? 1 : 0) + (draft.buffer !== 10 ? 1 : 0)} onClose={() => setSheet(false)} onReset={() => setDraft({ days: 7, buffer: 10 })}
          onApply={() => { setDays(draft.days); setBuffer(Math.min(100, Math.max(0, draft.buffer))); setSheet(false); }}>
          <FilterRow icon={<CalendarDays size={15} />} label={tr("Days of sales")} value={draft.days !== 7 ? tr("Last {0} days", draft.days) : null} onClear={() => setDraft({ ...draft, days: 7 })}>
            <Segments value={String(draft.days)} onChange={(v) => setDraft({ ...draft, days: Number(v) })} choices={[3, 7, 14, 30].map((d) => ({ value: String(d), label: tr("{0} days", d) }))} />
          </FilterRow>
          <FilterRow icon={<Percent size={15} />} label={tr("Buffer (%)")} value={draft.buffer !== 10 ? `${draft.buffer}%` : null} onClear={() => setDraft({ ...draft, buffer: 10 })}>
            <div className="space-y-2">
              <Segments value={BUFFERS.includes(draft.buffer) ? String(draft.buffer) : ""} onChange={(v) => setDraft({ ...draft, buffer: Number(v) })} choices={BUFFERS.map((b) => ({ value: String(b), label: `${b}%` }))} />
              <Input type="number" aria-label={tr("Buffer (%)")} value={draft.buffer} min={0} max={100} onChange={(e) => setDraft({ ...draft, buffer: Number(e.target.value) })} />
            </div>
          </FilterRow>
        </MonitorFilterSheet>
      )}
      <Panel title={tr("Production plan for tomorrow")} description={plan ? tr("Average cups sold per day by every driver over {0} days with sales, plus a buffer", plan.days) : undefined}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : !plan ? <SkeletonRows cols={4} /> : plan.days === 0 ? (
          <Empty title={tr("No sales yet")}>{tr("The plan follows the sales the drivers record in the COTR app.")}</Empty>
        ) : (
          <table className="m-cards w-full text-sm">
            <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Menu")}</th><th className="px-4 py-2.5 text-right">{tr("Average / day")}</th><th className="px-4 py-2.5 text-right">{tr("Highest day")}</th><th className="px-4 py-2.5 text-right">{tr("Plan (cups)")}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {plan.menus.map((r) => (
                <tr key={r.code} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5"><span className="font-medium text-neutral-900">{r.name}</span> {!r.bom && <Badge tone="amber">{tr("No recipe yet")}</Badge>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.average.toLocaleString(locale())}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-neutral-500">{r.highest}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-brand-700">{r.plan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {plan && plan.days > 0 && (
        <Panel title={tr("Raw materials needed")} description={tr("The plan exploded through the recipes (premix down to its materials), rounded up")}>
          <table className="m-cards w-full text-sm">
            <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Material")}</th><th className="px-4 py-2.5 text-right">{tr("Qty")}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {plan.materials.map((m) => (
                <tr key={m.item} className="hover:bg-neutral-50">
                  <td className="px-4 py-2.5"><span className="inline-flex items-center gap-2"><ListTree size={14} className="text-neutral-400" />{m.item}</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{m.qty.toLocaleString(locale())} {m.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}

const today = () => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10);

function WasteList() {
  const toast = useToast();
  const pools = useMaster<Pool>("pools");
  const [rows, setRows] = useState<Waste[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({ day: today(), pool_code: "", item: "", qty: 0, unit: "g", reason: "" }));
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pool, setPool] = useState("");
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false);
  const [draft, setDraft] = useState("");
  const load = useCallback(async () => {
    setError(null);
    try { setRows(await call<Waste[]>("/api/cotr/waste")); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const poolName = (code: string) => pools.rows?.find((p) => p.code === code)?.name ?? code;
  const add = async () => {
    setBusy(true);
    try { await call("/api/cotr/waste", { method: "POST", json: form }); setForm({ ...form, item: "", qty: 0, reason: "" }); setAdding(false); toast(tr("Saved")); await load(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    try { await call(`/api/cotr/waste/${id}`, { method: "DELETE" }); await load(); } catch (e) { toast((e as Error).message, "error"); }
  };
  const listed = useMemo(() => {
    const k = q.trim().toLowerCase();
    return (rows ?? []).filter((w) => (!pool || w.pool_code === pool) && (!k || `${w.item} ${w.reason}`.toLowerCase().includes(k)));
  }, [rows, pool, q]);
  const usedPools = new Set((rows ?? []).map((w) => w.pool_code));
  return (
    <>
      <ScopeBar onOpen={() => { setDraft(pool); setSheet(true); }} onRefresh={() => void load()}
        right={<div className="flex items-center gap-2"><SearchInput value={q} onChange={setQ} placeholder={tr("Search item or reason")} /><Button onClick={() => setAdding(true)}><Plus size={15} /> {tr("Record waste")}</Button></div>}
        scopes={[{ key: "pool", icon: <Building2 />, label: tr("Pool / HUB"), value: pool ? poolName(pool) : tr("All pools"), active: !!pool }]} />
      <StatGrid label={tr("Waste of the pools")} cols={3}>
        <StatCard label={tr("Entries")} icon={<ClipboardList />} value={rows ? listed.length : <ValueSkeleton />} sub={tr("Last 30 days")} />
        <StatCard label={tr("Pools / HUB")} icon={<Building2 />} value={rows ? new Set(listed.map((w) => w.pool_code)).size : <ValueSkeleton />} />
        <StatCard label={tr("Items")} icon={<Package />} value={rows ? new Set(listed.map((w) => w.item.toLowerCase())).size : <ValueSkeleton />} />
      </StatGrid>
      {sheet && (
        <MonitorFilterSheet active={draft ? 1 : 0} onClose={() => setSheet(false)} onReset={() => setDraft("")} onApply={() => { setPool(draft); setSheet(false); }}>
          <FilterRow icon={<Building2 size={15} />} label={tr("Pool / HUB")} value={draft ? poolName(draft) : null} onClear={() => setDraft("")}>
            <ComboFilter value={draft} onChange={setDraft} allLabel={tr("All pools")} placeholder={tr("Search pool")}
              options={(pools.rows ?? []).filter((p) => usedPools.has(p.code) || p.code === draft).map((p) => ({ value: p.code, label: p.name, hint: p.city }))} />
          </FilterRow>
        </MonitorFilterSheet>
      )}
      <Drawer open={adding} onClose={() => setAdding(false)} title={tr("Record waste")} description={tr("Waste of a pool or HUB: the item, how much and why")} icon={<Trash2 size={18} />}
        footer={<><Button variant="ghost" onClick={() => setAdding(false)}>{tr("Cancel")}</Button><Button loading={busy} disabled={!form.pool_code || !form.item.trim() || form.qty <= 0 || !form.reason.trim()} onClick={() => void add()}><Plus size={15} /> {tr("Add")}</Button></>}>
        <DrawerSection title={tr("Where and when")}>
          <Field label={tr("Day")}><Input type="date" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} /></Field>
          <Field label={tr("Pool / HUB")}>
            <Select value={form.pool_code} onChange={(e) => setForm({ ...form, pool_code: e.target.value })}>
              <option value="">—</option>{(pools.rows ?? []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </Select>
          </Field>
        </DrawerSection>
        <DrawerSection title={tr("Item")}>
          <Field label={tr("Item")}><Input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label={tr("Qty")}><Input type="number" value={form.qty || ""} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} /></Field>
            <Field label={tr("Unit")}><Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{["g", "ml", "pcs", "cup"].map((u) => <option key={u}>{u}</option>)}</Select></Field>
          </div>
          <Field label={tr("Reason")}><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
        </DrawerSection>
      </Drawer>
      <Panel title={tr("Waste of the pools")} description={tr("Last 30 days")}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : !rows ? <SkeletonRows cols={5} /> : listed.length === 0 ? (
          <EmptyState icon={<Trash2 />} title={rows.length ? tr("Nothing matches the filters") : tr("Nothing yet")}>{!rows.length && <div className="mt-3"><Button onClick={() => setAdding(true)}><Plus size={15} /> {tr("Record waste")}</Button></div>}</EmptyState>
        ) : (
          <table className="m-cards w-full text-sm">
            <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Day")}</th><th className="px-4 py-2.5">{tr("Pool / HUB")}</th><th className="px-4 py-2.5">{tr("Item")}</th><th className="px-4 py-2.5 text-right">{tr("Qty")}</th><th className="px-4 py-2.5">{tr("Reason")}</th><th className="w-10" /></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {listed.map((w) => (
                <tr key={w.id} className="hover:bg-neutral-50">
                  <td className="whitespace-nowrap px-4 py-2.5 tabular-nums">{dmyOf(w.day)}</td>
                  <td className="px-4 py-2.5">{poolName(w.pool_code)}</td>
                  <td className="px-4 py-2.5"><span className="inline-flex items-center gap-2 font-medium text-neutral-900"><Factory size={13} className="text-neutral-400" />{w.item}</span></td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{w.qty} {w.unit}</td>
                  <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1 text-xs text-neutral-600"><ClipboardList size={12} />{w.reason}</span></td>
                  <td className="px-1"><IconButton label={tr("Delete")} onClick={() => void remove(w.id)}><Trash2 size={15} /></IconButton></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </>
  );
}
