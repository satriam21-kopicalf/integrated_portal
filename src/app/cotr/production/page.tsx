"use client";

// Monitoring COTR → Storage & Production (page cotr.production): the items and recipe cards of COTR (src/cotr/Recipes),
// the premix calculator, the theoretical usage, the production plan from the drivers' sales of the last days (average + a buffer,
// exploded through the BOMs down to raw materials: cup → premix → milk, espresso …) and the waste of the pools.

import { BookOpen, Calculator, ClipboardList, CookingPot, Factory, ListTree, Package, Plus, Trash2, TrendingDown, Truck } from "lucide-react";
import { BatchesTab } from "@/cotr/Batches";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Empty, ErrorState, Field, Input, Select, useToast } from "@/so/ui";
import { kcTable } from "@/components/kc";
import { Page, Panel } from "@/components/kc/compat";
import { Tabs } from "@/components/kc";
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

function PlanView() {
  const [days, setDays] = useState(7);
  const [buffer, setBuffer] = useState(10);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try { setPlan(await call<Plan>(`/api/cotr/production?days=${days}&buffer=${buffer}`)); } catch (e) { setError((e as Error).message); }
  }, [days, buffer]);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);
  return (
    <>
      <Panel title={tr("Production plan for tomorrow")} description={plan ? tr("Average cups sold per day by every driver over {0} days with sales, plus a buffer", plan.days) : undefined}
        toolbar={
          <div className="flex flex-wrap gap-3">
            <Field label={tr("Days of sales")} className="w-36"><Select value={days} onChange={(e) => setDays(Number(e.target.value))}>{[3, 7, 14, 30].map((d) => <option key={d} value={d}>{tr("Last {0} days", d)}</option>)}</Select></Field>
            <Field label={tr("Buffer (%)")} className="w-28"><Input type="number" value={buffer} min={0} max={100} onChange={(e) => setBuffer(Number(e.target.value))} /></Field>
          </div>
        }>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : !plan ? <div className="skeleton m-4 h-32 rounded-xl" /> : plan.days === 0 ? (
          <Empty title={tr("No sales yet")}>{tr("The plan follows the sales the drivers record in the COTR app.")}</Empty>
        ) : (
          <table className="m-cards w-full text-sm">
            <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Menu")}</th><th className="px-4 py-2.5 text-right">{tr("Average / day")}</th><th className="px-4 py-2.5 text-right">{tr("Highest day")}</th><th className="px-4 py-2.5 text-right">{tr("Plan (cups)")}</th></tr></thead>
            <tbody className="divide-y divide-neutral-100">
              {plan.menus.map((r) => (
                <tr key={r.code}>
                  <td className="px-4 py-2.5 font-medium">{r.name} {!r.bom && <Badge tone="amber">{tr("No recipe yet")}</Badge>}</td>
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
                <tr key={m.item}>
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

function WasteList() {
  const toast = useToast();
  const pools = useMaster<Pool>("pools");
  const [rows, setRows] = useState<Waste[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => ({ day: new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10), pool_code: "", item: "", qty: 0, unit: "g", reason: "" }));
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setError(null);
    try { setRows(await call<Waste[]>("/api/cotr/waste")); } catch (e) { setError((e as Error).message); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  const poolName = (code: string) => pools.rows?.find((p) => p.code === code)?.name ?? code;
  const add = async () => {
    setBusy(true);
    try { await call("/api/cotr/waste", { method: "POST", json: form }); setForm({ ...form, item: "", qty: 0, reason: "" }); toast(tr("Saved")); await load(); }
    catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const remove = async (id: string) => {
    try { await call(`/api/cotr/waste/${id}`, { method: "DELETE" }); await load(); } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <Panel title={tr("Waste of the pools")} description={tr("Last 30 days")}
      toolbar={
        <div className="grid gap-3 sm:grid-cols-[9rem_1fr_1fr_6rem_6rem]">
          <Field label={tr("Day")}><Input type="date" value={form.day} onChange={(e) => setForm({ ...form, day: e.target.value })} /></Field>
          <Field label={tr("Pool / HUB")}>
            <Select value={form.pool_code} onChange={(e) => setForm({ ...form, pool_code: e.target.value })}>
              <option value="">—</option>{(pools.rows ?? []).map((p) => <option key={p.code} value={p.code}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label={tr("Item")}><Input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} /></Field>
          <Field label={tr("Qty")}><Input type="number" value={form.qty || ""} onChange={(e) => setForm({ ...form, qty: Number(e.target.value) })} /></Field>
          <Field label={tr("Unit")}><Select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })}>{["g", "ml", "pcs", "cup"].map((u) => <option key={u}>{u}</option>)}</Select></Field>
          <Field label={tr("Reason")} className="sm:col-span-4"><Input value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} /></Field>
          <div className="flex items-end"><Button className="w-full" loading={busy} disabled={!form.pool_code || !form.item.trim() || form.qty <= 0 || !form.reason.trim()} onClick={() => void add()}><Plus size={15} /> {tr("Add")}</Button></div>
        </div>
      }>
      {error ? <ErrorState message={error} onRetry={() => void load()} /> : !rows ? <div className="skeleton m-4 h-24 rounded-xl" /> : rows.length === 0 ? <Empty title={tr("Nothing yet")} /> : (
        <table className="m-cards w-full text-sm">
          <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Day")}</th><th className="px-4 py-2.5">{tr("Pool / HUB")}</th><th className="px-4 py-2.5">{tr("Item")}</th><th className="px-4 py-2.5 text-right">{tr("Qty")}</th><th className="px-4 py-2.5">{tr("Reason")}</th><th className="w-10" /></tr></thead>
          <tbody className="divide-y divide-neutral-100">
            {rows.map((w) => (
              <tr key={w.id}>
                <td className="px-4 py-2.5">{w.day}</td>
                <td className="px-4 py-2.5">{poolName(w.pool_code)}</td>
                <td className="px-4 py-2.5"><span className="inline-flex items-center gap-2"><Factory size={13} className="text-neutral-400" />{w.item}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{w.qty} {w.unit}</td>
                <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1 text-xs text-neutral-600"><ClipboardList size={12} />{w.reason}</span></td>
                <td className="px-1"><button type="button" aria-label={tr("Delete")} onClick={() => void remove(w.id)} className="rounded p-1.5 text-neutral-400 hover:text-red-600"><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
