"use client";

// Monitoring COTR → Master Fleet (page cotr.fleet, prototype 2026-11-01): the motors, carts and bikes the drivers sell
// from, the pool they are kept at, the capacity (cups) and the service state.

import { Badge, Page } from "@/so/ui";
import { DRIVERS, FLEET, Fleet, POOLS } from "@/cotr/mock";
import { MasterTable, PrototypeNote, newId, useLocalList } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

const TYPE: Record<Fleet["type"], () => string> = { motor: () => tr("Motorbike"), gerobak: () => tr("Cart"), sepeda: () => tr("Bicycle") };

export default function CotrFleetPage() {
  const list = useLocalList<Fleet>("fleet", FLEET);
  return (
    <Page title={tr("Master Fleet")} subtitle={tr("Motorbikes, carts and bicycles of COTR")}>
      <PrototypeNote />
      <MasterTable noun={tr("fleet")} title={tr("Fleet ({0})", list.rows.length)} rows={list.rows}
        onSave={list.upsert} onDelete={list.remove} onReset={list.reset}
        blank={(): Fleet => ({ id: newId(), code: "", type: "motor", plate: "", pool: POOLS[1].code, capacity: 120, condition: "good", lastService: new Date().toISOString().slice(0, 10) })}
        columns={[
          { label: tr("Fleet"), render: (f) => <><span className="block font-medium text-slate-900">{f.code}</span><span className="text-[11px] text-slate-400">{TYPE[f.type]()}{f.plate ? ` · ${f.plate}` : ""}</span></> },
          { label: tr("Pool / HUB"), render: (f) => POOLS.find((p) => p.code === f.pool)?.name ?? f.pool },
          { label: tr("Driver"), render: (f) => DRIVERS.find((d) => d.fleet === f.code)?.name ?? <span className="text-slate-400">—</span> },
          { label: tr("Capacity"), className: "text-right", render: (f) => <span className="tabular-nums">{f.capacity} {tr("cups")}</span> },
          { label: tr("Condition"), render: (f) => f.condition === "good" ? <Badge tone="green" dot>{tr("Good")}</Badge> : <Badge tone="amber" dot>{tr("In service")}</Badge> },
          { label: tr("Last service"), render: (f) => f.lastService },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true, placeholder: "COTR-M04" },
          { key: "type", label: tr("Type"), type: "select", required: true, options: (Object.keys(TYPE) as Fleet["type"][]).map((t) => ({ value: t, label: TYPE[t]() })) },
          { key: "plate", label: tr("Plate number"), hint: tr("Motorbikes only") },
          { key: "pool", label: tr("Pool / HUB"), type: "select", required: true, options: POOLS.filter((p) => p.kind !== "storage").map((p) => ({ value: p.code, label: p.name })) },
          { key: "capacity", label: tr("Capacity (cups)"), type: "number", required: true },
          { key: "condition", label: tr("Condition"), type: "select", required: true, options: [{ value: "good", label: tr("Good") }, { value: "service", label: tr("In service") }] },
          { key: "lastService", label: tr("Last service"), type: "date" },
        ]} />
    </Page>
  );
}
