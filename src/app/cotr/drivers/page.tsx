"use client";

// Monitoring COTR → Master Driver (page cotr.drivers): the COTR drivers — photo, person, assignment (pool, armada, the
// account they sign in to the driver app with: role Driver made in User Accounts), employment, and for superadmins
// and the COTR management (page cotr.management) the monthly salary, allowance, NIK and bank account (migration 050).

import Link from "next/link";
import { Bike, Building2, KeyRound, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/so/ui";
import { Page } from "@/components/kc/compat";
import { IconButton } from "@/components/kc";
import { assetUrl, thumb } from "@/lib/assets";
import Image from "next/image";
import { call } from "@/so/features/checkin/checkin";
import { Driver, DriverAccount, Fleet, Pool } from "@/cotr/types";
import { MasterTable, imageUrl, rupiah, useMaster } from "@/cotr/ui";
import ImportDrivers from "@/cotr/ImportDrivers";
import { hasPage, useAuth } from "@/lib/auth";
import { tr } from "@/lib/i18n";

const STATUS: Record<Driver["status"], { label: () => string; tone: "green" | "amber" | "slate" }> = {
  active: { label: () => tr("Active"), tone: "green" },
  leave: { label: () => tr("On leave"), tone: "amber" },
  inactive: { label: () => tr("Inactive"), tone: "slate" },
};
const EMPLOYMENT: Record<NonNullable<Driver["employment_status"]>, () => string> = {
  permanent: () => tr("Permanent"), contract: () => tr("Contract"), daily: () => tr("Daily worker"), intern: () => tr("Intern"),
};

export default function CotrDriversPage() {
  const { user } = useAuth();
  const management = hasPage(user, "cotr.management");
  const master = useMaster<Driver>("drivers");
  const pools = useMaster<Pool>("pools");
  const fleet = useMaster<Fleet>("fleet");
  const [accounts, setAccounts] = useState<DriverAccount[]>([]);
  const [importing, setImporting] = useState(false);
  useEffect(() => { call<DriverAccount[]>("/api/cotr/driver-accounts").then(setAccounts).catch(() => setAccounts([])); }, [master.rows]);
  const poolName = (code: string) => pools.rows?.find((p) => p.code === code)?.name ?? code;
  // who uses each armada, shown next to it in the select
  const usedBy = useMemo(() => Object.fromEntries((master.rows ?? []).filter((d) => d.fleet_code).map((d) => [d.fleet_code!, d.name])), [master.rows]);
  const sec = { profile: tr("Profile"), job: tr("Assignment"), person: tr("Personal data"), work: tr("Employment"), pay: tr("Payroll"), bank: tr("Bank account") };
  return (
    <Page eyebrow="Monitoring COTR" media={<Bike size={19} />} title={tr("Master Driver")} subtitle={tr("COTR drivers: profile, assignment, employment, payroll and bank account")}
      actions={<>
        {/* icons only (2026-11-02): the real Excel icon for the import, a key for the driver accounts (User Accounts) */}
        <IconButton label={tr("Import Excel")} onClick={() => setImporting(true)}>
          <span className="relative h-5 w-5"><Image src={assetUrl("assets/xlsx.png")} alt="" fill sizes="20px" className="object-contain" /></span>
        </IconButton>
        <Link href="/users" title={tr("Driver accounts")} aria-label={tr("Driver accounts")}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-white text-neutral-500 transition-colors hover:bg-neutral-50 hover:text-neutral-900"><KeyRound size={17} /></Link>
      </>}>
      {importing && <ImportDrivers pools={pools.rows ?? []} onClose={() => setImporting(false)} onDone={() => { void master.load(); void fleet.load(); }} />}
      {!management && (
        <p className="flex items-center gap-2 rounded-xl bg-neutral-50 px-3 py-2 text-xs text-neutral-500">
          <ShieldCheck size={14} />{tr("Salary, bank account and NIK are shown to superadmins and the COTR management only.")}
        </p>
      )}
      <MasterTable noun={tr("driver")} title={tr("Drivers")} master={master} filters={[
        { key: "pool", label: tr("Pool / HUB"), icon: <Building2 size={15} />, options: (pools.rows ?? []).filter((p) => p.kind !== "storage").map((p) => ({ value: p.code, label: p.name, test: (d: Driver) => d.pool_code === p.code })) },
        { key: "status", label: tr("Status"), icon: <UserRound size={15} />, options: (Object.keys(STATUS) as Driver["status"][]).map((k) => ({ value: k, label: STATUS[k].label(), test: (d: Driver) => d.status === k })) },
        { key: "account", label: tr("Driver app account"), icon: <KeyRound size={15} />, options: [
          { value: "with", label: tr("With an account"), test: (d: Driver) => !!d.user_id }, { value: "without", label: tr("No account yet"), test: (d: Driver) => !d.user_id }] },
        { key: "fleet", label: tr("Armada"), icon: <Bike size={15} />, options: [
          { value: "with", label: tr("With an armada"), test: (d: Driver) => !!d.fleet_code }, { value: "without", label: tr("No armada"), test: (d: Driver) => !d.fleet_code }] },
      ]}
        description={tr("Driver logins are made in User Accounts (role Driver (COTR)); pick the account here to tie it to the driver.")}
        blank={(): Partial<Driver> => ({ code: `DRV-${String((master.rows?.length ?? 0) + 1).padStart(3, "0")}`, name: "", phone: "", pool_code: pools.rows?.find((p) => p.kind !== "storage")?.code ?? "", fleet_code: null, status: "active", joined_on: new Date().toISOString().slice(0, 10), user_id: null })}
        columns={[
          { label: tr("Driver"), render: (d) => (
            <span className="flex items-center gap-3">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-neutral-100 text-neutral-400">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {d.has_photo ? <img src={thumb(imageUrl("drivers", d.code, "photo", d.updated_at), 96)} decoding="async" alt="" className="h-full w-full object-cover" loading="lazy" /> : <UserRound size={16} />}
              </span>
              <span className="min-w-0"><span className="block truncate font-medium text-neutral-900">{d.name || "—"}</span><span className="text-[11px] text-neutral-400">{d.employee_id ?? d.code}{d.nickname ? ` · ${d.nickname}` : ""}{d.phone ? ` · ${d.phone}` : ""}</span></span>
            </span>
          ) },
          { label: tr("Department"), render: (d) => d.department ? <Badge tone={d.department === "Armada" ? "blue" : "slate"}>{d.department}</Badge> : <span className="text-neutral-400">—</span> },
          { label: tr("Pool / HUB"), render: (d) => poolName(d.pool_code) },
          { label: tr("Fleet"), render: (d) => (d.fleet_code || d.bike_code) ? <span className="text-xs">{d.fleet_code ?? "—"}{d.bike_code ? <span className="block text-[11px] text-neutral-400">{tr("Bike {0}", d.bike_code)}</span> : null}</span> : <span className="text-neutral-400">{tr("Not assigned")}</span> },
          { label: tr("Employment"), render: (d) => d.employment_status ? <span className="text-xs">{EMPLOYMENT[d.employment_status]()}{d.position ? ` · ${d.position}` : ""}</span> : <span className="text-neutral-400">—</span> },
          ...(management ? [{ label: tr("Salary / month"), className: "text-right", render: (d: Driver) => d.salary_monthly ? <span className="tabular-nums">{rupiah(d.salary_monthly)}</span> : <span className="text-neutral-400">—</span> }] : []),
          { label: tr("Status"), render: (d) => <Badge tone={STATUS[d.status].tone} dot>{STATUS[d.status].label()}</Badge> },
          { label: tr("Account"), render: (d) => d.account ? <span className="font-mono text-xs">{d.account}</span> : <Badge tone="amber">{tr("No account yet")}</Badge> },
        ]}
        fields={[
          { key: "photo", label: tr("Profile picture"), type: "image", image: { entity: "drivers", slot: "photo" }, section: sec.profile },
          { key: "code", label: tr("Code"), required: true, section: sec.profile },
          { key: "name", label: tr("Name"), required: true, section: sec.profile },
          { key: "nickname", label: tr("Nickname"), section: sec.profile, hint: tr("The name on the daily reports") },
          { key: "employee_id", label: tr("Employee ID"), section: sec.profile, placeholder: "CALF0000000" },
          { key: "phone", label: tr("Phone"), section: sec.profile },
          { key: "status", label: tr("Status"), type: "select", required: true, section: sec.profile, options: (Object.keys(STATUS) as Driver["status"][]).map((s) => ({ value: s, label: STATUS[s].label() })) },

          { key: "pool_code", label: tr("Pool / HUB"), type: "search", required: true, section: sec.job,
            options: (pools.rows ?? []).filter((p) => p.kind !== "storage").map((p) => ({ value: p.code, label: p.name, hint: p.city })) },
          { key: "fleet_code", label: tr("Fleet"), type: "search", section: sec.job, placeholder: tr("Not assigned"),
            options: (fleet.rows ?? []).map((f) => ({ value: f.code, label: `${f.code}${f.name ? ` · ${f.name}` : ""}`, hint: usedBy[f.code] ? tr("used by {0}", usedBy[f.code]) : tr("free") })) },
          { key: "user_id", label: tr("Account"), type: "search", section: sec.job, hint: tr("Accounts of role Driver (COTR) from User Accounts"), placeholder: tr("No account yet"),
            options: accounts.map((a) => ({ value: a.id, label: `${a.username} · ${a.name}`, hint: a.driver ?? tr("free") })) },
          { key: "joined_on", label: tr("Joined"), type: "date", section: sec.job },
          { key: "department", label: tr("Department"), section: sec.job, placeholder: tr("e.g. Armada, Storage, Stockist") },
          { key: "bike_code", label: tr("Bike"), section: sec.job, placeholder: "S7" },

          { key: "nik", label: tr("NIK (KTP)"), section: sec.person, when: management },
          { key: "gender", label: tr("Gender"), type: "select", section: sec.person, options: [{ value: "male", label: tr("Male") }, { value: "female", label: tr("Female") }] },
          { key: "birth_place", label: tr("Place of birth"), section: sec.person },
          { key: "birth_date", label: tr("Date of birth"), type: "date", section: sec.person },
          { key: "address", label: tr("Address"), type: "textarea", section: sec.person },
          { key: "emergency_name", label: tr("Emergency contact"), section: sec.person },
          { key: "emergency_phone", label: tr("Emergency phone"), section: sec.person },

          { key: "employment_status", label: tr("Employment status"), type: "select", section: sec.work, options: (Object.keys(EMPLOYMENT) as NonNullable<Driver["employment_status"]>[]).map((k) => ({ value: k, label: EMPLOYMENT[k]() })) },
          { key: "position", label: tr("Position"), section: sec.work, placeholder: tr("e.g. Driver, Senior driver") },
          { key: "contract_end", label: tr("Contract ends"), type: "date", section: sec.work },
          { key: "note", label: tr("Note"), type: "textarea", section: sec.work },

          { key: "salary_monthly", label: tr("Fixed salary / month (Rp)"), type: "number", section: sec.pay, when: management },
          { key: "allowance_monthly", label: tr("Allowance / month (Rp)"), type: "number", section: sec.pay, when: management },
          { key: "bank_name", label: tr("Bank"), section: sec.bank, when: management, placeholder: "BNI / BRI / BCA …" },
          { key: "bank_account", label: tr("Account number"), section: sec.bank, when: management },
          { key: "bank_holder", label: tr("Account holder"), section: sec.bank, when: management },
        ]} />
    </Page>
  );
}
