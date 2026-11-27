"use client";

// The pages of page cotr.production (2026-11-22, the COTR team found one page of 18 tabs confusing): one page per
// job, each with its own few tabs. Pool Stock (/cotr/production), HUB Production (/cotr/hub), Warehouse
// (/cotr/warehouse) and Reports & Matching (/cotr/reports); the recipe cards and items (set up once) are a tab of Master.
// The production plan comes from the drivers' sales of the last days (average + a buffer, exploded through the BOMs
// down to raw materials: cup → premix → milk, espresso …).

import { StockTab, ReceiptsTab, CountsTab } from "@/cotr/Stock";
import { Banknote, Send, GitCompareArrows, UserRoundSearch, Boxes, Building2, ClipboardCheck, PackagePlus, BookOpen, Calculator, CalendarDays, CookingPot, Factory, FileBarChart, ListTree, Package, Percent, Trash2, TrendingDown, Truck, Warehouse } from "lucide-react";
import { BatchesTab } from "@/cotr/Batches";
import { PoolWaste } from "@/cotr/PoolWaste";
import { PoolLedger } from "@/cotr/PoolLedger";
import { ReportArmada } from "@/cotr/ReportArmada";
import { BatchCodes } from "@/cotr/BatchCodes";
import { EsbCotr } from "@/cotr/EsbCotr";
import { Reconcile } from "@/cotr/Reconcile";
import { DriverNames } from "@/cotr/DriverNames";
import { ShipmentPlan } from "@/cotr/ShipmentPlan";
import { MonthlyExport } from "@/cotr/MonthlyExport";
import { CashReconcile } from "@/cotr/CashReconcile";
import { StorageJournals } from "@/cotr/StorageJournals";
import { useFlowTab } from "@/cotr/FlowNav";
import { CardBody, WorkCard } from "@/so/ui/Jira";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { Badge, Empty, ErrorState, Input } from "@/so/ui";
import { Page, Panel } from "@/components/kc/compat";
import { StatCard, StatGrid, ValueSkeleton, kcTable } from "@/components/kc";
import { SkeletonTable } from "@/components/kc/Skeleton";
import { CotrFilterBar } from "@/cotr/FilterBar";
import { FilterRow, MonitorFilterSheet, Segments } from "@/so/ui/MonitorFilters";
import { call } from "@/so/features/checkin/checkin";
import { CalculatorTab, UsageTab } from "@/cotr/Recipes";
import { ReportSheet } from "@/cotr/ReportSheet";
import { locale, tr } from "@/lib/i18n";

type Tab = "input" | "cash" | "ship" | "pool" | "reconcile" | "names" | "report" | "codes" | "esb" | "stock" | "receipts" | "counts" | "calc" | "batch" | "plan" | "usage" | "waste";
type Plan = { days: number; menus: { code: string; name: string; average: number; highest: number; plan: number; bom: string | null }[]; materials: { item: string; qty: number; unit: string }[] };
export type Section = "pool" | "hub" | "warehouse" | "reports";

const I = (C: typeof Package) => <C size={15} />;
type SectionDef = { href: string; icon: ReactNode; title: () => string; subtitle: () => string; tabs: { key: Tab; label: () => string; icon: ReactNode }[] };
/** the pages in the order of the work: the pool stock of the night, the HUB production of the morning, the storage
 *  warehouse behind it, then the reports matched with the workbooks and ESB */
export const SECTIONS: Record<Section, SectionDef> = {
  pool: { href: "/cotr/production", icon: <Boxes size={19} />, title: () => tr("Pool Stock"), subtitle: () => tr("Every night: the leftover of every pool, its batch codes, waste and cupping"), tabs: [
    { key: "pool", label: () => tr("Pool Product Stock"), icon: I(Boxes) }, { key: "codes", label: () => tr("Batch Codes"), icon: I(ListTree) },
    { key: "waste", label: () => tr("Waste & Cupping"), icon: I(Trash2) }] },
  hub: { href: "/cotr/hub", icon: <Factory size={19} />, title: () => tr("HUB Production"), subtitle: () => tr("Every morning: what to produce, what to send to the pools, premix and batches"), tabs: [
    { key: "plan", label: () => tr("Production Plan"), icon: I(Factory) }, { key: "ship", label: () => tr("Shipment Plan"), icon: I(Send) },
    { key: "batch", label: () => tr("Batches"), icon: I(Truck) }, { key: "calc", label: () => tr("Calculator"), icon: I(Calculator) }] },
  warehouse: { href: "/cotr/warehouse", icon: <Warehouse size={19} />, title: () => tr("Warehouse"), subtitle: () => tr("The storage warehouse: stock, goods in, stock opname and usage"), tabs: [
    { key: "stock", label: () => tr("Stock"), icon: I(Boxes) }, { key: "receipts", label: () => tr("Goods In"), icon: I(PackagePlus) },
    { key: "counts", label: () => tr("Stock Opname"), icon: I(ClipboardCheck) }, { key: "usage", label: () => tr("Usage"), icon: I(TrendingDown) }] },
  reports: { href: "/cotr/reports", icon: <FileBarChart size={19} />, title: () => tr("Reports & Matching"), subtitle: () => tr("After the workbooks: Report Armada, the match with ESB, cash and the driver names"), tabs: [
    { key: "input", label: () => tr("Report Armada Input"), icon: I(ClipboardCheck) }, { key: "report", label: () => tr("Report Armada"), icon: I(ClipboardCheck) }, { key: "reconcile", label: () => tr("Reconciliation"), icon: I(GitCompareArrows) },
    { key: "cash", label: () => tr("Cash"), icon: I(Banknote) }, { key: "names", label: () => tr("Driver Names"), icon: I(UserRoundSearch) },
    { key: "esb", label: () => tr("ESB COTR"), icon: I(Building2) }] },
};

const BODY: Record<Tab, () => ReactNode> = {
  pool: () => <PoolLedger />, codes: () => <BatchCodes />, waste: () => <><PoolWaste /><StorageJournals /></>,
  plan: () => <PlanView />, ship: () => <ShipmentPlan />, batch: () => <BatchesTab />, calc: () => <CalculatorTab />,
  stock: () => <StockTab />, receipts: () => <ReceiptsTab />, counts: () => <CountsTab />, usage: () => <UsageTab />,
  input: () => <ReportSheet />, report: () => <ReportArmada />, reconcile: () => <Reconcile />, cash: () => <CashReconcile />, names: () => <DriverNames />, esb: () => <EsbCotr />,
};

/** a page of Storage & Production; an old link (/cotr/production?tab=plan) goes to the page its tab is on now */
export function ProductionSection({ section }: { section: Section }) {
  const def = SECTIONS[section];
  const keys = def.tabs.map((t) => t.key);
  const [tab, setTab] = useFlowTab<Tab>(keys, keys[0]);
  useEffect(() => {
    const asked = new URLSearchParams(window.location.search).get("tab");
    if (!asked) return;
    if (asked === "recipes" || asked === "items") { window.location.replace("/cotr/master?tab=recipes"); return; }
    const home = (Object.keys(SECTIONS) as Section[]).find((s) => SECTIONS[s].tabs.some((t) => t.key === asked));
    if (home && home !== section) window.location.replace(`${SECTIONS[home].href}?tab=${asked}`);
  }, [section]);
  return (
    <Page eyebrow="Calf On The Road" media={def.icon} title={def.title()} subtitle={def.subtitle()} actions={section === "reports" ? <MonthlyExport /> : undefined}>
      {/* Jira-like (2026-11-23): one card, the tabs of the page in its head, the tab's own toolbar and content inside */}
      <WorkCard label={def.title()} active={tab} onTab={(k) => setTab(k)} tabs={def.tabs.map((t) => ({ key: t.key, label: t.label(), icon: t.icon }))}>
        <CardBody className="max-sm:p-1.5">{BODY[tab]()}</CardBody>
      </WorkCard>
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
      <CotrFilterBar onOpen={() => { setDraft({ days, buffer }); setSheet(true); }}
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
            <thead className={kcTable.thead}><tr><th className="px-3 py-2">{tr("Menu")}</th><th className="px-3 py-2 text-right">{tr("Average / Day")}</th><th className="px-3 py-2 text-right">{tr("Highest Day")}</th><th className="px-3 py-2 text-right">{tr("Plan (Cups)")}</th></tr></thead>
            <tbody className="divide-y divide-[color:var(--j-F1F2F4)]">
              {plan.menus.map((r) => (
                <tr key={r.code} className="hover:bg-[color:var(--j-F7F8F9)]">
                  <td className="px-3 py-2"><span className="font-medium text-[color:var(--j-172B4D)]">{r.name}</span> {!r.bom && <Badge tone="amber">{tr("No recipe yet")}</Badge>}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{r.average.toLocaleString(locale())}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-[color:var(--j-626F86)]">{r.highest}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums text-[color:var(--j-0C66E4)]">{r.plan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {plan && plan.days > 0 && (
        <Panel title={tr("Raw Materials Needed")} description={tr("The plan exploded through the recipes (premix down to its materials), rounded up")}>
          <table className="m-cards w-full text-sm">
            <thead className={kcTable.thead}><tr><th className="px-3 py-2">{tr("Material")}</th><th className="px-3 py-2 text-right">{tr("Qty")}</th></tr></thead>
            <tbody className="divide-y divide-[color:var(--j-F1F2F4)]">
              {plan.materials.map((m) => (
                <tr key={m.item} className="hover:bg-[color:var(--j-F7F8F9)]">
                  <td className="px-3 py-2"><span className="inline-flex items-center gap-2"><ListTree size={14} className="text-[color:var(--j-626F86)]" />{m.item}</span></td>
                  <td className="px-3 py-2 text-right tabular-nums">{m.qty.toLocaleString(locale())} {m.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
    </>
  );
}


