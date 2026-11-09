"use client";

// Monitoring COTR → Master → Fleet & Accessories (migration 080): the accessories of the armada (umbrella, cooler box,
// banner, power bank …), assigned to a fleet with the day they were put on / taken off; every shift keeps what its fleet
// carried, so who took what and when is known (usage below the list).

import { Clock, Package, Plus, Tags, Trash2, Wrench } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge, Button, Empty, cx, inputClass, theadClass, useToast } from "@/so/ui";
import Drawer from "@/so/ui/Drawer";
import { Panel } from "@/components/kc/compat";
import { type Accessory, type Fleet, type FleetAccessory } from "@/cotr/types";
import { MasterTable, SearchSelect, useMaster } from "@/cotr/ui";
import { call } from "@/so/features/checkin/checkin";
import { SkeletonList } from "@/components/kc/Skeleton";
import { wibDateTime } from "@/so/lib/wib";
import { tr } from "@/lib/i18n";

const CONDITION: Record<Accessory["condition"], { label: () => string; tone: "green" | "amber" | "red" | "slate" }> = {
  good: { label: () => tr("Good"), tone: "green" }, service: { label: () => tr("In Service"), tone: "amber" },
  broken: { label: () => tr("Broken"), tone: "red" }, lost: { label: () => tr("Lost"), tone: "slate" },
};

/** The accessories on every fleet (to show a count in the fleet list); reloaded after a change. */
export function useFleetAccessories() {
  const [rows, setRows] = useState<FleetAccessory[] | null>(null);
  const load = useCallback(async () => {
    try { setRows((await call<{ data: FleetAccessory[] }>("/api/cotr/fleet-accessories")).data); } catch { setRows([]); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  return { rows, load };
}

/** The master of the accessories and who carried them. */
export function AccessoriesSection({ onChanged }: { onChanged: () => void }) {
  const master = useMaster<Accessory>("accessories");
  const categories = [...new Set((master.rows ?? []).map((a) => a.category).filter(Boolean))].sort();
  return (
    <div className="space-y-4">
      <MasterTable noun={tr("accessory")} title={tr("Accessories")} description={tr("The items the armada carries; assign them to a fleet from its row")}
        master={{ ...master, save: async (row, key) => { const out = await master.save(row, key); onChanged(); return out; } }}
        filters={[
          { key: "category", label: tr("Category"), icon: <Tags size={15} />, options: categories.map((c) => ({ value: c, label: c, test: (a: Accessory) => a.category === c })) },
          { key: "condition", label: tr("Condition"), icon: <Wrench size={15} />, options: (Object.keys(CONDITION) as Accessory["condition"][]).map((k) => ({ value: k, label: CONDITION[k].label(), test: (a: Accessory) => a.condition === k })) },
        ]}
        blank={(): Partial<Accessory> => ({ code: "", name: "", category: "", unit: "pcs", serial_no: null, condition: "good", is_active: true })}
        columns={[
          { label: tr("Accessory"), render: (a) => <><span className="block font-medium text-neutral-900">{a.name}</span><span className="text-[11px] text-neutral-400">{a.code}{a.serial_no ? ` · SN ${a.serial_no}` : ""}</span></> },
          { label: tr("Category"), render: (a) => a.category || "—" },
          { label: tr("Unit"), render: (a) => a.unit },
          { label: tr("Condition"), render: (a) => <Badge tone={CONDITION[a.condition].tone} dot>{CONDITION[a.condition].label()}</Badge> },
          { label: tr("Status"), render: (a) => <Badge tone={a.is_active ? "green" : "slate"}>{a.is_active ? tr("Active") : tr("Inactive")}</Badge> },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true, placeholder: "ACC-XXX" },
          { key: "name", label: tr("Name"), required: true, placeholder: tr("e.g. Umbrella, Cooler Box") },
          { key: "category", label: tr("Category"), placeholder: tr("e.g. Equipment, Branding, Electronics") },
          { key: "unit", label: tr("Unit"), required: true },
          { key: "serial_no", label: tr("Serial Number"), hint: tr("With a serial number the item is on one fleet at a time") },
          { key: "condition", label: tr("Condition"), type: "select", options: (Object.keys(CONDITION) as Accessory["condition"][]).map((k) => ({ value: k, label: CONDITION[k].label() })) },
          { key: "is_active", label: tr("Active"), type: "bool" },
          { key: "note", label: tr("Note"), type: "textarea" },
        ]} />
      <AccessoryUsage />
    </div>
  );
}

type Usage = { shift: string; day: string; driver: string; driverName: string | null; fleet: string | null; code: string; name: string; qty: number; startedAt: string | null; endedAt: string | null };

/** Every shift of the last 30 days with the accessories of its fleet. */
function AccessoryUsage() {
  const [rows, setRows] = useState<Usage[] | null>(null);
  useEffect(() => { void call<{ data: Usage[] }>("/api/cotr/accessory-usage").then((r) => setRows(r.data)).catch(() => setRows([])); }, []);
  return (
    <Panel title={tr("Accessory Usage")} description={tr("What each driver carried on each shift (last 30 days), from the fleet at check in")}>
      {!rows ? <div className="p-4"><SkeletonList rows={3} /></div> : !rows.length ? <Empty icon={<Clock size={24} />} title={tr("No shift with accessories yet")} /> : (
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm">
          <thead className={theadClass}><tr><th className="px-4 py-2.5">{tr("Day")}</th><th className="px-4 py-2.5">{tr("Driver")}</th><th className="px-4 py-2.5">{tr("Fleet")}</th>
            <th className="px-4 py-2.5">{tr("Accessory")}</th><th className="px-4 py-2.5 text-right">{tr("Qty")}</th><th className="px-4 py-2.5">{tr("Used")}</th></tr></thead>
          <tbody className="divide-y divide-neutral-100">{rows.map((u) => (
            <tr key={`${u.shift}:${u.code}`}><td className="px-4 py-2.5 whitespace-nowrap">{u.day}</td><td className="px-4 py-2.5">{u.driverName ?? u.driver}</td>
              <td className="px-4 py-2.5">{u.fleet ?? "—"}</td><td className="px-4 py-2.5">{u.name}</td><td className="px-4 py-2.5 text-right tabular-nums">{u.qty}</td>
              <td className="px-4 py-2.5 text-xs text-neutral-500">{u.startedAt ? wibDateTime(u.startedAt) : "—"} – {u.endedAt ? wibDateTime(u.endedAt) : tr("on the road")}</td></tr>))}
          </tbody></table></div>
      )}
    </Panel>
  );
}

/** The accessories of one fleet: put one on (with the quantity), take one off. */
export function FleetAccessoryDrawer({ fleet, onClose, onChanged }: { fleet: Fleet; onClose: () => void; onChanged: () => void }) {
  const toast = useToast();
  const all = useMaster<Accessory>("accessories");
  const [rows, setRows] = useState<FleetAccessory[] | null>(null);
  const [pick, setPick] = useState("");
  const [qty, setQty] = useState("1");
  const [from, setFrom] = useState(() => new Date(Date.now() + 7 * 3600e3).toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setRows((await call<{ data: FleetAccessory[] }>(`/api/cotr/fleet-accessories?fleet=${encodeURIComponent(fleet.code)}`)).data);
  }, [fleet.code]);
  useEffect(() => { void load().catch(() => setRows([])); }, [load]);
  const on = (rows ?? []).filter((r) => !r.removedOn);
  const off = (rows ?? []).filter((r) => r.removedOn);
  const add = async () => {
    setBusy(true);
    try {
      await call(`/api/cotr/fleet/${encodeURIComponent(fleet.code)}/accessories`, { method: "POST", json: { code: pick, qty: Number(qty) || 1, assignedOn: from } });
      setPick(""); setQty("1"); await load(); onChanged();
    } catch (e) { toast((e as Error).message, "error"); } finally { setBusy(false); }
  };
  const remove = async (id: number) => {
    try { await call(`/api/cotr/fleet-accessories/${id}`, { method: "DELETE" }); await load(); onChanged(); } catch (e) { toast((e as Error).message, "error"); }
  };
  return (
    <Drawer open onClose={onClose} icon={<Package size={18} />} title={tr("Accessories of {0}", fleet.code)} description={fleet.name || undefined}>
      <div className="space-y-4">
        <section className="rounded-xl border border-neutral-200 bg-neutral-50/60 p-3">
          <p className="mb-2 text-xs font-medium text-neutral-600">{tr("Put an accessory on this fleet: the item, how many and the day it is used from")}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="min-w-0 flex-1"><SearchSelect value={pick} onChange={(v) => setPick(v ?? "")} placeholder={tr("Choose the accessory")}
              options={(all.rows ?? []).filter((a) => a.is_active && !on.some((r) => r.code === a.code)).map((a) => ({ value: a.code, label: a.name, hint: [a.code, a.category].filter(Boolean).join(" · ") }))} /></div>
            <input className={cx(inputClass, "h-10 w-full bg-white text-right sm:w-20")} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} aria-label={tr("Qty")} />
            <input type="date" className={cx(inputClass, "h-10 w-full bg-white sm:w-40")} value={from} onChange={(e) => setFrom(e.target.value)} aria-label={tr("Used from")} title={tr("Used from")} />
            <Button disabled={!pick} loading={busy} onClick={() => void add()}><Plus size={15} />{tr("Add")}</Button>
          </div>
        </section>
        {!rows ? <SkeletonList rows={3} /> : !on.length ? <Empty icon={<Package size={24} />} title={tr("No accessory on this fleet yet")} /> : (
          <ul className="divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-200">
            {on.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="min-w-0 flex-1"><span className="block text-sm font-medium text-neutral-900">{r.name} <span className="tabular-nums text-neutral-500">× {r.qty} {r.unit}</span></span>
                  <span className="block text-[11px] text-neutral-400">{r.code}{r.serialNo ? ` · SN ${r.serialNo}` : ""} · {tr("used since {0}", r.assignedOn)}</span></span>
                <Badge tone={CONDITION[r.condition].tone} dot>{CONDITION[r.condition].label()}</Badge>
                <button type="button" onClick={() => void remove(r.id)} title={tr("Take off")} aria-label={tr("Take off")}
                  className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        )}
        {off.length > 0 && (
          <details className="rounded-xl border border-neutral-200 px-3 py-2 text-sm">
            <summary className="cursor-pointer text-xs font-medium text-neutral-600">{tr("Taken off before ({0})", off.length)}</summary>
            <ul className="mt-2 space-y-1 text-xs text-neutral-500">{off.map((r) => <li key={r.id}>{r.name} × {r.qty} · {r.assignedOn} – {r.removedOn}</li>)}</ul>
          </details>
        )}
      </div>
    </Drawer>
  );
}
