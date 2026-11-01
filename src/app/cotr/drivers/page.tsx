"use client";

// Monitoring COTR → Master Driver (page cotr.drivers, prototype 2026-11-01): the COTR drivers, their pool and fleet.
// The login of a driver is made in User Accounts (as the Operations accounts) and tied here by its username.

import Link from "next/link";
import { KeyRound } from "lucide-react";
import { Badge, Button, Page } from "@/so/ui";
import { DRIVERS, Driver, FLEET, POOLS } from "@/cotr/mock";
import { MasterTable, PrototypeNote, newId, useLocalList } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

const STATUS: Record<Driver["status"], { label: () => string; tone: "green" | "amber" | "slate" }> = {
  active: { label: () => tr("Active"), tone: "green" },
  leave: { label: () => tr("On leave"), tone: "amber" },
  inactive: { label: () => tr("Inactive"), tone: "slate" },
};

export default function CotrDriversPage() {
  const list = useLocalList<Driver>("drivers", DRIVERS);
  return (
    <Page title={tr("Master Driver")} subtitle={tr("COTR drivers, their pool and fleet")}
      actions={<Link href="/users"><Button variant="secondary"><KeyRound size={16} /> {tr("Driver accounts")}</Button></Link>}>
      <PrototypeNote>{tr("Driver logins are made in User Accounts like the Operations accounts; the username ties the account to the driver here.")}</PrototypeNote>
      <MasterTable noun={tr("driver")} title={tr("Drivers ({0})", list.rows.length)} rows={list.rows}
        onSave={list.upsert} onDelete={list.remove} onReset={list.reset}
        blank={(): Driver => ({ id: newId(), code: `DRV-${String(list.rows.length + 1).padStart(3, "0")}`, name: "", phone: "", pool: POOLS[1].code, fleet: null, status: "active", joined: new Date().toISOString().slice(0, 10), account: null })}
        columns={[
          { label: tr("Driver"), render: (d) => <><span className="block font-medium text-slate-900">{d.name || "—"}</span><span className="text-[11px] text-slate-400">{d.code} · {d.phone}</span></> },
          { label: tr("Pool / HUB"), render: (d) => POOLS.find((p) => p.code === d.pool)?.name ?? d.pool },
          { label: tr("Fleet"), render: (d) => d.fleet ?? <span className="text-slate-400">{tr("Not assigned")}</span> },
          { label: tr("Status"), render: (d) => <Badge tone={STATUS[d.status].tone} dot>{STATUS[d.status].label()}</Badge> },
          { label: tr("Account"), render: (d) => d.account ? <span className="font-mono text-xs">{d.account}</span> : <Badge tone="amber">{tr("No account yet")}</Badge> },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true },
          { key: "name", label: tr("Name"), required: true },
          { key: "phone", label: tr("Phone"), required: true },
          { key: "pool", label: tr("Pool / HUB"), type: "select", required: true, options: POOLS.filter((p) => p.kind !== "storage").map((p) => ({ value: p.code, label: p.name })) },
          { key: "fleet", label: tr("Fleet"), type: "select", options: FLEET.map((f) => ({ value: f.code, label: `${f.code} · ${f.plate ?? f.type}` })) },
          { key: "status", label: tr("Status"), type: "select", required: true, options: (Object.keys(STATUS) as Driver["status"][]).map((s) => ({ value: s, label: STATUS[s].label() })) },
          { key: "joined", label: tr("Joined"), type: "date" },
          { key: "account", label: tr("Account username"), hint: tr("From User Accounts (role Driver)") },
        ]} />
    </Page>
  );
}
