"use client";

// Monitoring COTR → Storage & Production (page cotr.production): the menus produced at the HUB, their BOM / recipe
// (edited and saved per output), the production plan from the drivers' sales of the last days (average + a buffer,
// exploded through the BOMs down to raw materials: cup → premix → milk, espresso …) and the waste of the pools.

import { ClipboardList, Factory, ListTree, Plus, Save, Trash2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Empty, ErrorState, Field, Input, Page, Panel, Select, theadClass, useToast } from "@/so/ui";
import { Segmented } from "@/so/ui/Simple";
import { call } from "@/so/features/checkin/checkin";
import { Bom, Menu, Pool } from "@/cotr/types";
import { MasterTable, useMaster } from "@/cotr/ui";
import { locale, tr } from "@/lib/i18n";

type Tab = "menu" | "bom" | "plan" | "waste";
type Plan = { days: number; menus: { code: string; name: string; average: number; highest: number; plan: number; bom: string | null }[]; materials: { item: string; qty: number; unit: string }[] };
type Waste = { id: string; day: string; pool_code: string; item: string; qty: number; unit: string; reason: string };

export default function CotrProductionPage() {
  const [tab, setTab] = useState<Tab>("plan");
  const boms = useMaster<Bom>("boms");
  const menus = useMaster<Menu>("menus");
  return (
    <Page title={tr("Storage & Production")} subtitle={tr("Menus, recipes, production plan from daily sales, and waste")}>
      <Segmented label={tr("Section")} value={tab} onChange={setTab} options={[
        { value: "menu", label: tr("Menu list") }, { value: "bom", label: tr("BOM / recipes") },
        { value: "plan", label: tr("Production plan") }, { value: "waste", label: tr("Waste") },
      ]} />
      {tab === "menu" && <MenuList menus={menus.rows ?? []} boms={boms.rows ?? []} />}
      {tab === "bom" && <BomEditor master={boms} />}
      {tab === "plan" && <PlanView />}
      {tab === "waste" && <WasteList />}
    </Page>
  );
}

function MenuList({ menus, boms }: { menus: Menu[]; boms: Bom[] }) {
  return (
    <Panel title={tr("Menus produced")} description={tr("Menus of Master Menu and the recipe each one is made with")}>
      <table className="w-full text-sm">
        <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Menu")}</th><th className="px-4 py-2.5">{tr("Recipe (BOM)")}</th><th className="px-4 py-2.5">{tr("Components")}</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {menus.filter((m) => m.is_active).map((m) => {
            const b = boms.find((x) => x.code === m.bom_code);
            return (
              <tr key={m.code}>
                <td className="px-4 py-2.5 font-medium">{m.name}</td>
                <td className="px-4 py-2.5">{b ? b.name : <Badge tone="amber">{tr("No recipe yet")}</Badge>}</td>
                <td className="px-4 py-2.5 text-xs text-slate-500">{b?.lines.map((l) => `${l.item} ${l.qty} ${l.unit}`).join(" · ") ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Panel>
  );
}

function BomEditor({ master }: { master: ReturnType<typeof useMaster<Bom>> }) {
  const toast = useToast();
  const rows = master.rows ?? [];
  const [code, setCode] = useState<string | null>(null);
  const [draft, setDraft] = useState<Bom | null>(null);
  const [busy, setBusy] = useState(false);
  const current = code ?? rows[0]?.code ?? null;
  useEffect(() => { setDraft(rows.find((b) => b.code === current) ?? null); }, [current, master.rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const setLines = (lines: Bom["lines"]) => draft && setDraft({ ...draft, lines });
  const save = async () => {
    if (!draft) return;
    setBusy(true);
    try { await master.save({ ...draft }, draft.code); toast(tr("Saved")); } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  if (master.error) return <Panel><ErrorState message={master.error} onRetry={() => void master.load()} /></Panel>;
  return (
    <>
      <Panel title={tr("BOM / recipes")} description={tr("Per output: what one cup or one batch uses; a premix line is exploded by its own BOM")}
        actions={draft && <Button size="sm" loading={busy} onClick={() => void save()}><Save size={14} /> {tr("Save recipe")}</Button>}>
        <div className="grid gap-0 lg:grid-cols-[16rem_1fr]">
          <ul className="divide-y divide-slate-100 border-b border-slate-100 lg:border-b-0 lg:border-r">
            {rows.map((b) => (
              <li key={b.code}>
                <button type="button" onClick={() => setCode(b.code)}
                  className={`w-full px-4 py-2.5 text-left text-sm ${b.code === current ? "bg-blue-50 text-blue-800" : "hover:bg-slate-50"}`}>
                  <span className="block font-medium">{b.name}</span>
                  <span className="text-[11px] text-slate-400">{b.code} · {tr("yields {0} {1}", b.yield_qty, b.yield_unit)}</span>
                </button>
              </li>
            ))}
          </ul>
          {draft && (
            <div className="p-4">
              <table className="w-full text-sm">
                <thead className={theadClass}><tr><th className="px-3 py-2">{tr("Component")}</th><th className="px-3 py-2 text-right">{tr("Qty")}</th><th className="px-3 py-2">{tr("Unit")}</th><th className="w-10" /></tr></thead>
                <tbody className="divide-y divide-slate-100">
                  {draft.lines.map((l, i) => (
                    <tr key={i}>
                      <td className="px-3 py-1.5"><Input value={l.item} onChange={(e) => setLines(draft.lines.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))} className="h-9" /></td>
                      <td className="w-28 px-3 py-1.5"><Input type="number" value={l.qty} onChange={(e) => setLines(draft.lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} className="h-9 text-right" /></td>
                      <td className="w-24 px-3 py-1.5">
                        <Select value={l.unit} onChange={(e) => setLines(draft.lines.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} className="h-9">
                          {["g", "ml", "pcs"].map((u) => <option key={u}>{u}</option>)}
                        </Select>
                      </td>
                      <td className="px-1"><button type="button" aria-label={tr("Delete")} onClick={() => setLines(draft.lines.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={15} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => setLines([...draft.lines, { item: "", qty: 0, unit: "g" }])}><Plus size={14} /> {tr("Add component")}</Button>
            </div>
          )}
        </div>
      </Panel>
      <MasterTable noun={tr("recipe")} title={tr("Recipes")} master={master}
        blank={() => ({ code: "BOM-", name: "", output: "", yield_qty: 1, yield_unit: "cup", lines: [] })}
        columns={[
          { label: tr("Recipe"), render: (b) => <><span className="block font-medium text-slate-900">{b.name}</span><span className="text-[11px] text-slate-400">{b.code}</span></> },
          { label: tr("Output"), render: (b) => b.output },
          { label: tr("Yield"), render: (b) => `${b.yield_qty} ${b.yield_unit}` },
          { label: tr("Components"), render: (b) => b.lines.length },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true },
          { key: "name", label: tr("Name"), required: true },
          { key: "output", label: tr("Output"), required: true, hint: tr("A component with this name in another recipe is exploded by this one (premix)") },
          { key: "yield_qty", label: tr("Yield"), type: "number", required: true },
          { key: "yield_unit", label: tr("Unit"), type: "select", required: true, options: ["cup", "g", "ml", "pcs"].map((u) => ({ value: u, label: u })) },
        ]} />
    </>
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
          <table className="w-full text-sm">
            <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Menu")}</th><th className="px-4 py-2.5 text-right">{tr("Average / day")}</th><th className="px-4 py-2.5 text-right">{tr("Highest day")}</th><th className="px-4 py-2.5 text-right">{tr("Plan (cups)")}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {plan.menus.map((r) => (
                <tr key={r.code}>
                  <td className="px-4 py-2.5 font-medium">{r.name} {!r.bom && <Badge tone="amber">{tr("No recipe yet")}</Badge>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{r.average.toLocaleString(locale())}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{r.highest}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-blue-700">{r.plan}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
      {plan && plan.days > 0 && (
        <Panel title={tr("Raw materials needed")} description={tr("The plan exploded through the recipes (premix down to its materials), rounded up")}>
          <table className="w-full text-sm">
            <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Material")}</th><th className="px-4 py-2.5 text-right">{tr("Qty")}</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {plan.materials.map((m) => (
                <tr key={m.item}>
                  <td className="px-4 py-2.5"><span className="inline-flex items-center gap-2"><ListTree size={14} className="text-slate-400" />{m.item}</span></td>
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
        <table className="w-full text-sm">
          <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Day")}</th><th className="px-4 py-2.5">{tr("Pool / HUB")}</th><th className="px-4 py-2.5">{tr("Item")}</th><th className="px-4 py-2.5 text-right">{tr("Qty")}</th><th className="px-4 py-2.5">{tr("Reason")}</th><th className="w-10" /></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((w) => (
              <tr key={w.id}>
                <td className="px-4 py-2.5">{w.day}</td>
                <td className="px-4 py-2.5">{poolName(w.pool_code)}</td>
                <td className="px-4 py-2.5"><span className="inline-flex items-center gap-2"><Factory size={13} className="text-slate-400" />{w.item}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{w.qty} {w.unit}</td>
                <td className="px-4 py-2.5"><span className="inline-flex items-center gap-1 text-xs text-slate-600"><ClipboardList size={12} />{w.reason}</span></td>
                <td className="px-1"><button type="button" aria-label={tr("Delete")} onClick={() => void remove(w.id)} className="rounded p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
