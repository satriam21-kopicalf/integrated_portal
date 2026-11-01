"use client";

// Monitoring COTR → Master Fleet (page cotr.fleet): the motors, carts and bikes the drivers sell from, the pool they are
// kept at, the capacity (cups) and the service state.

import { Badge, Page } from "@/so/ui";
import { Driver, Fleet, Pool } from "@/cotr/types";
import { MasterTable, useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

const TYPE: Record<Fleet["type"], () => string> = { motor: () => tr("Motorbike"), gerobak: () => tr("Cart"), sepeda: () => tr("Bicycle") };

export default function CotrFleetPage() {
  const master = useMaster<Fleet>("fleet");
  const pools = useMaster<Pool>("pools");
  const drivers = useMaster<Driver>("drivers");
  return (
    <Page title={tr("Master Fleet")} subtitle={tr("Motorbikes, carts and bicycles of COTR")}>
      <MasterTable noun={tr("fleet")} title={tr("Fleet")} master={master}
        blank={(): Partial<Fleet> => ({ code: "", type: "motor", plate: "", pool_code: pools.rows?.find((p) => p.kind !== "storage")?.code ?? "", capacity: 120, condition: "good", last_service: null, is_active: true })}
        columns={[
          { label: tr("Fleet"), render: (f) => <><span className="block font-medium text-slate-900">{f.code}</span><span className="text-[11px] text-slate-400">{TYPE[f.type]()}{f.plate ? ` · ${f.plate}` : ""}</span></> },
          { label: tr("Pool / HUB"), render: (f) => pools.rows?.find((p) => p.code === f.pool_code)?.name ?? f.pool_code },
          { label: tr("Driver"), render: (f) => drivers.rows?.find((d) => d.fleet_code === f.code)?.name ?? <span className="text-slate-400">—</span> },
          { label: tr("Capacity"), className: "text-right", render: (f) => <span className="tabular-nums">{f.capacity} {tr("cups")}</span> },
          { label: tr("Condition"), render: (f) => f.condition === "good" ? <Badge tone="green" dot>{tr("Good")}</Badge> : <Badge tone="amber" dot>{tr("In service")}</Badge> },
          { label: tr("Last service"), render: (f) => f.last_service ?? "—" },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true, placeholder: "COTR-M04" },
          { key: "type", label: tr("Type"), type: "select", required: true, options: (Object.keys(TYPE) as Fleet["type"][]).map((t) => ({ value: t, label: TYPE[t]() })) },
          { key: "plate", label: tr("Plate number"), hint: tr("Motorbikes only") },
          { key: "pool_code", label: tr("Pool / HUB"), type: "select", required: true, options: (pools.rows ?? []).filter((p) => p.kind !== "storage").map((p) => ({ value: p.code, label: p.name })) },
          { key: "capacity", label: tr("Capacity (cups)"), type: "number", required: true },
          { key: "condition", label: tr("Condition"), type: "select", required: true, options: [{ value: "good", label: tr("Good") }, { value: "service", label: tr("In service") }] },
          { key: "last_service", label: tr("Last service"), type: "date" },
        ]} />
    </Page>
  );
}
