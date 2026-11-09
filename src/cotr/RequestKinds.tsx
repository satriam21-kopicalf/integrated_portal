"use client";

// Monitoring COTR → Master → Pengajuan (migration 083): the kinds of a driver's request (BBM, es batu, parkir …) — the
// driver app shows the active ones in their order, with the hint; a kind may cap the amount and need the receipt photo.

import { Camera, CheckCircle2, Wallet } from "lucide-react";
import { Badge } from "@/so/ui";
import { Page } from "@/components/kc/compat";
import { StatCard, StatGrid, ValueSkeleton } from "@/components/kc";
import { type MasterFilter, MasterTable, rupiah, useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

export type RequestKind = { code: string; name: string; description: string; max_amount: number | null; needs_photo: boolean; sort: number; is_active: boolean };

export default function RequestKindsTab() {
  const master = useMaster<RequestKind>("request-kinds");
  const rows = master.rows ?? [];
  const loaded = !!master.rows;
  const filters: MasterFilter<RequestKind>[] = [
    { key: "photo", label: tr("Receipt photo"), icon: <Camera size={15} />, options: [
      { value: "yes", label: tr("Required"), test: (k) => k.needs_photo }, { value: "no", label: tr("Not required"), test: (k) => !k.needs_photo }] },
    { key: "active", label: tr("Status"), icon: <CheckCircle2 size={15} />, options: [
      { value: "on", label: tr("Active"), test: (k) => k.is_active }, { value: "off", label: tr("Inactive"), test: (k) => !k.is_active }] },
  ];
  return (
    <Page title={tr("Request Kinds")} subtitle={tr("The kinds of request a driver can send from the Calf On The Road app")}
      stats={
        <StatGrid label={tr("Summary")} cols={3}>
          <StatCard label={tr("Shown in the app")} tone="brand" icon={<Wallet />} value={loaded ? rows.filter((k) => k.is_active).length : <ValueSkeleton />}
            sub={loaded && tr("{0} inactive", rows.filter((k) => !k.is_active).length)} />
          <StatCard label={tr("With a limit")} icon={<Wallet />} value={loaded ? rows.filter((k) => k.max_amount).length : <ValueSkeleton />} />
          <StatCard label={tr("Without a receipt photo")} icon={<Camera />} value={loaded ? rows.filter((k) => !k.needs_photo).length : <ValueSkeleton />} />
        </StatGrid>
      }>
      <MasterTable noun={tr("request kind")} title={tr("Request Kinds")} master={master} filters={filters}
        blank={(): Partial<RequestKind> => ({ code: "", name: "", description: "", max_amount: null, needs_photo: true, sort: rows.length + 1, is_active: true })}
        columns={[
          { label: tr("Order"), className: "w-16", render: (k) => <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-xs font-semibold tabular-nums text-brand-700">{k.sort}</span> },
          { label: tr("Kind"), render: (k) => <><span className="block font-medium text-neutral-900">{k.name}</span><span className="text-[11px] text-neutral-400">{k.code}</span></> },
          { label: tr("Hint for the driver"), render: (k) => k.description || <span className="text-neutral-400">—</span> },
          { label: tr("Limit"), className: "text-right", render: (k) => k.max_amount ? <span className="tabular-nums">{rupiah(k.max_amount)}</span> : <span className="text-neutral-400">{tr("No limit")}</span> },
          { label: tr("Receipt photo"), render: (k) => <Badge tone={k.needs_photo ? "blue" : "slate"}>{k.needs_photo ? tr("Required") : tr("Not required")}</Badge> },
          { label: tr("Status"), render: (k) => <Badge tone={k.is_active ? "green" : "slate"}>{k.is_active ? tr("Active") : tr("Inactive")}</Badge> },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true, placeholder: "toll", hint: tr("Cannot be changed once requests use it") },
          { key: "name", label: tr("Name"), required: true, placeholder: tr("e.g. Tol") },
          { key: "description", label: tr("Hint for the driver"), type: "textarea", placeholder: tr("e.g. Attach the toll receipt or the e-money history") },
          { key: "max_amount", label: tr("Limit (Rp)"), type: "number", hint: tr("Empty = no limit") },
          { key: "needs_photo", label: tr("Receipt photo required"), type: "bool" },
          { key: "sort", label: tr("Order in the App"), type: "number" },
          { key: "is_active", label: tr("Shown in the app"), type: "bool" },
        ]} />
    </Page>
  );
}
