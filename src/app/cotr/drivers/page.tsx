"use client";

// Monitoring COTR → Master Driver (page cotr.drivers): the COTR drivers, their pool and fleet, and the account they
// sign in to the driver app with (an account of role Driver made in User Accounts, tied here).

import Link from "next/link";
import { FileSpreadsheet, KeyRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Badge, Button, Page } from "@/so/ui";
import { call } from "@/so/features/checkin/checkin";
import { Driver, DriverAccount, Fleet, Pool } from "@/cotr/types";
import { MasterTable, useMaster } from "@/cotr/ui";
import ImportDrivers from "@/cotr/ImportDrivers";
import { tr } from "@/lib/i18n";

const STATUS: Record<Driver["status"], { label: () => string; tone: "green" | "amber" | "slate" }> = {
  active: { label: () => tr("Active"), tone: "green" },
  leave: { label: () => tr("On leave"), tone: "amber" },
  inactive: { label: () => tr("Inactive"), tone: "slate" },
};

export default function CotrDriversPage() {
  const master = useMaster<Driver>("drivers");
  const pools = useMaster<Pool>("pools");
  const fleet = useMaster<Fleet>("fleet");
  const [accounts, setAccounts] = useState<DriverAccount[]>([]);
  const [importing, setImporting] = useState(false);
  useEffect(() => { call<DriverAccount[]>("/api/cotr/driver-accounts").then(setAccounts).catch(() => setAccounts([])); }, [master.rows]);
  const poolName = (code: string) => pools.rows?.find((p) => p.code === code)?.name ?? code;
  return (
    <Page title={tr("Master Driver")} subtitle={tr("COTR drivers, their pool and fleet")}
      actions={<>
        <Button variant="secondary" onClick={() => setImporting(true)}><FileSpreadsheet size={16} /> {tr("Import Excel")}</Button>
        <Link href="/users"><Button variant="secondary"><KeyRound size={16} /> {tr("Driver accounts")}</Button></Link>
      </>}>
      {importing && <ImportDrivers pools={pools.rows ?? []} onClose={() => setImporting(false)} onDone={() => { void master.load(); void fleet.load(); }} />}
      <MasterTable noun={tr("driver")} title={tr("Drivers")} master={master}
        description={tr("Driver logins are made in User Accounts (role Driver (COTR)); pick the account here to tie it to the driver.")}
        blank={(): Partial<Driver> => ({ code: `DRV-${String((master.rows?.length ?? 0) + 1).padStart(3, "0")}`, name: "", phone: "", pool_code: pools.rows?.find((p) => p.kind !== "storage")?.code ?? "", fleet_code: null, status: "active", joined_on: new Date().toISOString().slice(0, 10), user_id: null })}
        columns={[
          { label: tr("Driver"), render: (d) => <><span className="block font-medium text-slate-900">{d.name || "—"}</span><span className="text-[11px] text-slate-400">{d.code} · {d.phone}</span></> },
          { label: tr("Pool / HUB"), render: (d) => poolName(d.pool_code) },
          { label: tr("Fleet"), render: (d) => d.fleet_code ?? <span className="text-slate-400">{tr("Not assigned")}</span> },
          { label: tr("Status"), render: (d) => <Badge tone={STATUS[d.status].tone} dot>{STATUS[d.status].label()}</Badge> },
          { label: tr("Account"), render: (d) => d.account ? <span className="font-mono text-xs">{d.account}</span> : <Badge tone="amber">{tr("No account yet")}</Badge> },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true },
          { key: "name", label: tr("Name"), required: true },
          { key: "phone", label: tr("Phone") },
          { key: "pool_code", label: tr("Pool / HUB"), type: "select", required: true, options: (pools.rows ?? []).filter((p) => p.kind !== "storage").map((p) => ({ value: p.code, label: p.name })) },
          { key: "fleet_code", label: tr("Fleet"), type: "select", options: (fleet.rows ?? []).map((f) => ({ value: f.code, label: `${f.code} · ${f.plate ?? f.type}` })) },
          { key: "status", label: tr("Status"), type: "select", required: true, options: (Object.keys(STATUS) as Driver["status"][]).map((s) => ({ value: s, label: STATUS[s].label() })) },
          { key: "joined_on", label: tr("Joined"), type: "date" },
          { key: "user_id", label: tr("Account"), type: "select", hint: tr("Accounts of role Driver (COTR) from User Accounts"),
            options: accounts.map((a) => ({ value: a.id, label: `${a.username} · ${a.name}${a.driver ? ` (${a.driver})` : ""}` })) },
        ]} />
    </Page>
  );
}
