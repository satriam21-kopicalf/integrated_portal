"use client";

// Monitoring COTR → Storage & Production (page cotr.production): the items and recipe cards of COTR (src/cotr/Recipes),
// the premix calculator, the theoretical usage, the production plan from the drivers' sales of the last days (average + a buffer,
// exploded through the BOMs down to raw materials: cup → premix → milk, espresso …) and the waste of the pools.

import { StockTab, ReceiptsTab, CountsTab } from "@/cotr/Stock";
import { Boxes, ClipboardCheck, PackagePlus, BookOpen, Calculator, CalendarDays, CookingPot, Factory, ListTree, Package, Percent, Trash2, TrendingDown, Truck } from "lucide-react";
import { BatchesTab } from "@/cotr/Batches";
import { PoolWaste } from "@/cotr/PoolWaste";
import { PoolLedger } from "@/cotr/PoolLedger";
import { useCallback, useEffect, useState } from "react";
import { Badge, Empty, ErrorState, Input } from "@/so/ui";
import { Page, Panel } from "@/components/kc/compat";
import { StatCard, StatGrid, Tabs, ValueSkeleton, kcTable } from "@/components/kc";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { ScopeBar } from "@/components/kc/ScopeBar";
import { FilterRow, MonitorFilterSheet, Segments } from "@/so/ui/MonitorFilters";
import { call } from "@/so/features/checkin/checkin";
import { CalculatorTab, ItemsTab, RecipesTab, UsageTab } from "@/cotr/Recipes";
import { locale, tr } from "@/lib/i18n";

type Tab = "pool" | "stock" | "receipts" | "counts" | "items" | "recipes" | "calc" | "batch" | "plan" | "usage" | "waste";
type Plan = { days: number; menus: { code: string; name: string; average: number; highest: number; plan: number; bom: string | null }[]; materials: { item: string; qty: number; unit: string }[] };

const SECTIONS: { key: Tab; label: () => string; icon: typeof Package }[] = [
  { key: "pool", label: () => tr("Pool Product Stock"), icon: Boxes },
  { key: "stock", label: () => tr("Stock"), icon: Boxes }, { key: "receipts", label: () => tr("Goods In"), icon: PackagePlus },
  { key: "counts", label: () => tr("Stock Opname"), icon: ClipboardCheck },
  { key: "items", label: () => tr("Items"), icon: Package }, { key: "recipes", label: () => tr("Recipe Cards"), icon: BookOpen },
  { key: "calc", label: () => tr("Calculator"), icon: Calculator }, { key: "batch", label: () => tr("Batches"), icon: Truck },
  { key: "plan", label: () => tr("Production Plan"), icon: Factory },
  { key: "usage", label: () => tr("Usage"), icon: TrendingDown }, { key: "waste", label: () => tr("Waste & Cupping"), icon: Trash2 },
];

export default function CotrProductionPage() {
  const [tab, setTab] = useState<Tab>("stock");
  return (
    <Page eyebrow="Calf On The Road" media={<CookingPot size={19} />} title={tr("Storage & Production")} subtitle={tr("Stock, goods in, stock opname, batches and their waste, recipe cards, production plan and usage")}>
      <Tabs label={tr("Section")} value={tab} onChange={(k) => setTab(k as Tab)}
        tabs={SECTIONS.map((x) => ({ key: x.key, label: <span className="inline-flex items-center gap-1.5"><x.icon size={15} />{x.label()}</span> }))} />
      {tab === "pool" && <PoolLedger />}
      {tab === "stock" && <StockTab />}
      {tab === "receipts" && <ReceiptsTab />}
      {tab === "counts" && <CountsTab />}
      {tab === "items" && <ItemsTab />}
      {tab === "recipes" && <RecipesTab />}
      {tab === "calc" && <CalculatorTab />}
      {tab === "batch" && <BatchesTab />}
      {tab === "plan" && <PlanView />}
      {tab === "usage" && <UsageTab />}
      {tab === "waste" && <PoolWaste />}
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
  const [, setLoading] = useState(false);
  const load = useCallback(async () => {
    setError(null); setLoading(true);
    try { setPlan(await call<Plan>(`/api/cotr/production?days=${days}&buffer=${buffer}`)); } catch (e) { setError((e as Error).message); } finally { setLoading(false); }
  }, [days, buffer]);
  useEffect(() => { const t = setTimeout(() => void load(), 250); return () => clearTimeout(t); }, [load]);
  const cups = plan?.menus.reduce((t, r) => t + r.plan, 0) ?? 0;
  return (
    <>
      <ScopeBar onOpen={() => { setDraft({ days, buffer }); setSheet(true); }}
        scopes={[
          { key: "days", icon: <CalendarDays />, label: tr("Days of Sales"), value: tr("Last {0} days", days), active: days !== 7 },
          { key: "buffer", icon: <Percent />, label: tr("Buffer"), value: `${buffer}%`, active: buffer !== 10 },
        ]} />
      <StatGrid label={tr("Production Plan for Tomorrow")} cols={4}>
        <StatCard label={tr("Menus Planned")} icon={<CookingPot />} value={plan ? plan.menus.length : <ValueSkeleton />} />
        <StatCard label={tr("Cups Planned")} tone="brand" icon={<Factory />} value={plan ? cups.toLocaleString(locale()) : <ValueSkeleton />} sub={plan && tr("buffer {0}%", buffer)} />
        <StatCard label={tr("Without a Recipe")} icon={<BookOpen />} tone={plan?.menus.some((r) => !r.bom) ? "warn" : "default"} value={plan ? plan.menus.filter((r) => !r.bom).length : <ValueSkeleton />} />
        <StatCard label={tr("Raw Materials")} icon={<ListTree />} value={plan ? plan.materials.length : <ValueSkeleton />} />
      </StatGrid>
      {sheet && (
        <MonitorFilterSheet active={(draft.days !== 7 ? 1 : 0) + (draft.buffer !== 10 ? 1 : 0)} onClose={() => setSheet(false)} onReset={() => setDraft({ days: 7, buffer: 10 })}
          onApply={() => { setDays(draft.days); setBuffer(Math.min(100, Math.max(0, draft.buffer))); setSheet(false); }}>
          <FilterRow icon={<CalendarDays size={15} />} label={tr("Days of Sales")} value={draft.days !== 7 ? tr("Last {0} days", draft.days) : null} onClear={() => setDraft({ ...draft, days: 7 })}>
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
      <Panel title={tr("Production Plan for Tomorrow")} description={plan ? tr("Average cups sold per day by every driver over {0} days with sales, plus a buffer", plan.days) : undefined}>
        {error ? <ErrorState message={error} onRetry={() => void load()} /> : !plan ? <SkeletonTable cols={4} /> : plan.days === 0 ? (
          <Empty title={tr("No sales yet")}>{tr("The plan follows the sales the drivers record in the COTR app.")}</Empty>
        ) : (
          <table className="m-cards w-full text-sm">
            <thead className={kcTable.thead}><tr><th className="px-4 py-2.5">{tr("Menu")}</th><th className="px-4 py-2.5 text-right">{tr("Average / Day")}</th><th className="px-4 py-2.5 text-right">{tr("Highest Day")}</th><th className="px-4 py-2.5 text-right">{tr("Plan (Cups)")}</th></tr></thead>
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
        <Panel title={tr("Raw Materials Needed")} description={tr("The plan exploded through the recipes (premix down to its materials), rounded up")}>
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


