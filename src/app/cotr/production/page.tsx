"use client";

// Monitoring COTR → Storage & Production (page cotr.production, prototype 2026-11-01): the menus produced at the HUB,
// their BOM / recipe, a production plan from the daily sales of the drivers (average of the last 7 days + a buffer,
// exploded through the BOMs down to raw materials: cup → premix → milk, espresso …) and the waste of the pools.

import { ClipboardList, Factory, ListTree, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge, Button, Field, Input, Page, Panel, Select, theadClass } from "@/so/ui";
import { Segmented } from "@/so/ui/Simple";
import { BOMS, Bom, MENUS, POOLS, SALES, WASTE, Waste, poolName } from "@/cotr/mock";
import { MasterTable, PrototypeNote, newId, useLocalList } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

type Tab = "menu" | "bom" | "plan" | "waste";

export default function CotrProductionPage() {
  const [tab, setTab] = useState<Tab>("plan");
  const boms = useLocalList<Bom>("boms", BOMS);
  return (
    <Page title={tr("Storage & Production")} subtitle={tr("Menus, recipes, production plan from daily sales, and waste")}>
      <PrototypeNote />
      <Segmented label={tr("Section")} value={tab} onChange={setTab} options={[
        { value: "menu", label: tr("Menu list") }, { value: "bom", label: tr("BOM / recipes") },
        { value: "plan", label: tr("Production plan") }, { value: "waste", label: tr("Waste") },
      ]} />
      {tab === "menu" && <MenuList boms={boms.rows} />}
      {tab === "bom" && <BomEditor list={boms} />}
      {tab === "plan" && <Plan boms={boms.rows} />}
      {tab === "waste" && <WasteList />}
    </Page>
  );
}

function MenuList({ boms }: { boms: Bom[] }) {
  return (
    <Panel title={tr("Menus produced")} description={tr("Menus of Master Menu and the recipe each one is made with")}>
      <table className="w-full text-sm">
        <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Menu")}</th><th className="px-4 py-2.5">{tr("Recipe (BOM)")}</th><th className="px-4 py-2.5">{tr("Components")}</th></tr></thead>
        <tbody className="divide-y divide-slate-100">
          {MENUS.filter((m) => m.active).map((m) => {
            const b = boms.find((x) => x.code === m.bom);
            return (
              <tr key={m.id}>
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

function BomEditor({ list }: { list: ReturnType<typeof useLocalList<Bom>> }) {
  const [code, setCode] = useState(list.rows[0]?.code ?? "");
  const bom = list.rows.find((b) => b.code === code);
  const setLines = (lines: Bom["lines"]) => bom && list.upsert({ ...bom, lines });
  return (
    <Panel title={tr("BOM / recipes")} description={tr("Per output: what one cup or one batch uses; a premix line is exploded by its own BOM")}
      actions={<Button size="sm" variant="ghost" onClick={list.reset}>{tr("Reset sample")}</Button>}>
      <div className="grid gap-0 lg:grid-cols-[16rem_1fr]">
        <ul className="divide-y divide-slate-100 border-b border-slate-100 lg:border-b-0 lg:border-r">
          {list.rows.map((b) => (
            <li key={b.id}>
              <button type="button" onClick={() => setCode(b.code)}
                className={`w-full px-4 py-2.5 text-left text-sm ${b.code === code ? "bg-blue-50 text-blue-800" : "hover:bg-slate-50"}`}>
                <span className="block font-medium">{b.name}</span>
                <span className="text-[11px] text-slate-400">{b.code} · {tr("yields {0} {1}", b.yieldQty, b.yieldUnit)}</span>
              </button>
            </li>
          ))}
        </ul>
        {bom && (
          <div className="p-4">
            <table className="w-full text-sm">
              <thead className={theadClass}><tr><th className="px-3 py-2">{tr("Component")}</th><th className="px-3 py-2 text-right">{tr("Qty")}</th><th className="px-3 py-2">{tr("Unit")}</th><th className="w-10" /></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {bom.lines.map((l, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1.5"><Input value={l.item} onChange={(e) => setLines(bom.lines.map((x, j) => (j === i ? { ...x, item: e.target.value } : x)))} className="h-9" /></td>
                    <td className="w-28 px-3 py-1.5"><Input type="number" value={l.qty} onChange={(e) => setLines(bom.lines.map((x, j) => (j === i ? { ...x, qty: Number(e.target.value) } : x)))} className="h-9 text-right" /></td>
                    <td className="w-24 px-3 py-1.5">
                      <Select value={l.unit} onChange={(e) => setLines(bom.lines.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)))} className="h-9">
                        {["g", "ml", "pcs"].map((u) => <option key={u}>{u}</option>)}
                      </Select>
                    </td>
                    <td className="px-1"><button type="button" aria-label={tr("Delete")} onClick={() => setLines(bom.lines.filter((_, j) => j !== i))} className="rounded p-1.5 text-slate-400 hover:text-red-600"><Trash2 size={15} /></button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Button size="sm" variant="secondary" className="mt-3" onClick={() => setLines([...bom.lines, { item: "", qty: 0, unit: "g" }])}><Plus size={14} /> {tr("Add component")}</Button>
          </div>
        )}
      </div>
    </Panel>
  );
}

/** Raw materials per one unit of a BOM output, a component that is the output of another BOM exploded through it. */
function explode(boms: Bom[], code: string, qty: number, out: Map<string, { qty: number; unit: string }>, depth = 0) {
  const bom = boms.find((b) => b.code === code);
  if (!bom || depth > 5) return;
  for (const l of bom.lines) {
    const need = (l.qty * qty) / bom.yieldQty;
    const sub = boms.find((b) => b.output === l.item && b !== bom);
    if (sub) explode(boms, sub.code, need, out, depth + 1);
    else {
      const cur = out.get(l.item) ?? { qty: 0, unit: l.unit };
      cur.qty += need;
      out.set(l.item, cur);
    }
  }
}

function Plan({ boms }: { boms: Bom[] }) {
  const [buffer, setBuffer] = useState(10);
  const [days, setDays] = useState(7);
  const rows = useMemo(() => {
    const last = [...new Set(SALES.map((s) => s.day))].sort().slice(-days);
    return MENUS.filter((m) => m.active).map((m) => {
      const qty = SALES.filter((s) => s.menu === m.name && last.includes(s.day)).map((s) => s.qty);
      const avg = qty.length ? qty.reduce((a, b) => a + b, 0) / qty.length : 0;
      return { menu: m, avg, max: Math.max(0, ...qty), plan: Math.ceil(avg * (1 + buffer / 100)) };
    });
  }, [buffer, days]);
  const materials = useMemo(() => {
    const out = new Map<string, { qty: number; unit: string }>();
    rows.forEach((r) => r.menu.bom && explode(boms, r.menu.bom, r.plan, out));
    return [...out.entries()].sort((a, b) => b[1].qty - a[1].qty);
  }, [rows, boms]);
  return (
    <>
      <Panel title={tr("Production plan for tomorrow")} description={tr("Average cups sold per day by every driver, plus a buffer")}
        toolbar={
          <div className="flex flex-wrap gap-3">
            <Field label={tr("Days of sales")} className="w-36"><Select value={days} onChange={(e) => setDays(Number(e.target.value))}>{[3, 7].map((d) => <option key={d} value={d}>{tr("Last {0} days", d)}</option>)}</Select></Field>
            <Field label={tr("Buffer (%)")} className="w-28"><Input type="number" value={buffer} min={0} max={50} onChange={(e) => setBuffer(Number(e.target.value))} /></Field>
          </div>
        }>
        <table className="w-full text-sm">
          <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Menu")}</th><th className="px-4 py-2.5 text-right">{tr("Average / day")}</th><th className="px-4 py-2.5 text-right">{tr("Highest day")}</th><th className="px-4 py-2.5 text-right">{tr("Plan (cups)")}</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => (
              <tr key={r.menu.id}>
                <td className="px-4 py-2.5 font-medium">{r.menu.name}{!r.menu.bom && <Badge tone="amber">{tr("No recipe yet")}</Badge>}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{r.avg.toFixed(0)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{r.max}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-blue-700">{r.plan}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
      <Panel title={tr("Raw materials needed")} description={tr("The plan exploded through the recipes (premix down to its materials), rounded up")}>
        <table className="w-full text-sm">
          <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Material")}</th><th className="px-4 py-2.5 text-right">{tr("Qty")}</th></tr></thead>
          <tbody className="divide-y divide-slate-100">
            {materials.map(([item, v]) => (
              <tr key={item}>
                <td className="px-4 py-2.5"><span className="inline-flex items-center gap-2"><ListTree size={14} className="text-slate-400" />{item}</span></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{Math.ceil(v.qty).toLocaleString("id-ID")} {v.unit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </>
  );
}

function WasteList() {
  const list = useLocalList<Waste>("waste", WASTE);
  return (
    <MasterTable noun={tr("waste")} title={tr("Waste of the pools ({0})", list.rows.length)} rows={list.rows}
      onSave={list.upsert} onDelete={list.remove} onReset={list.reset}
      blank={(): Waste => ({ id: newId(), day: new Date().toISOString().slice(0, 10), pool: POOLS[0].code, item: "", qty: 0, unit: "g", reason: "" })}
      columns={[
        { label: tr("Day"), render: (w) => w.day },
        { label: tr("Pool / HUB"), render: (w) => poolName(w.pool) },
        { label: tr("Item"), render: (w) => <span className="inline-flex items-center gap-2"><Factory size={13} className="text-slate-400" />{w.item}</span> },
        { label: tr("Qty"), className: "text-right", render: (w) => <span className="tabular-nums">{w.qty} {w.unit}</span> },
        { label: tr("Reason"), render: (w) => <span className="inline-flex items-center gap-1 text-xs text-slate-600"><ClipboardList size={12} />{w.reason}</span> },
      ]}
      fields={[
        { key: "day", label: tr("Day"), type: "date", required: true },
        { key: "pool", label: tr("Pool / HUB"), type: "select", required: true, options: POOLS.map((p) => ({ value: p.code, label: p.name })) },
        { key: "item", label: tr("Item"), required: true },
        { key: "qty", label: tr("Qty"), type: "number", required: true },
        { key: "unit", label: tr("Unit"), type: "select", required: true, options: ["g", "ml", "pcs", "cup"].map((u) => ({ value: u, label: u })) },
        { key: "reason", label: tr("Reason"), type: "textarea", required: true },
      ]} />
  );
}
