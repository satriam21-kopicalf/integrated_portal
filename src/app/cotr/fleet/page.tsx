"use client";

// Monitoring COTR → Master Fleet (page cotr.fleet): the armada the drivers sell from — name, type (a master the team
// extends: electric bike, bike, motorbike, cart, booth, car …), make / model, frame number, pool, capacity, condition,
// photo and the QRIS of the armada (bank, NMID, merchant, QR image; migration 050). Labels with a QR code are printed
// from here and stuck on the vehicle (/cotr/fleet/labels).

import Link from "next/link";
import { Bike, Printer, QrCode } from "lucide-react";
import { Badge, Button, Page } from "@/so/ui";
import { Driver, Fleet, FleetType, Pool } from "@/cotr/types";
import { MasterTable, imageUrl, useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

export default function CotrFleetPage() {
  const master = useMaster<Fleet>("fleet");
  const types = useMaster<FleetType>("fleet-types");
  const pools = useMaster<Pool>("pools");
  const drivers = useMaster<Driver>("drivers");
  const typeName = (code: string) => types.rows?.find((t) => t.code === code)?.name ?? code;
  const sec = { main: tr("Armada"), unit: tr("Vehicle"), qris: tr("QRIS") };
  return (
    <Page title={tr("Master Fleet")} subtitle={tr("Armada of COTR: vehicle, QRIS, photo and printed label")}
      actions={<Link href="/cotr/fleet/labels"><Button variant="secondary"><Printer size={16} /> {tr("Print labels")}</Button></Link>}>
      <MasterTable noun={tr("fleet")} title={tr("Fleet")} master={master}
        blank={(): Partial<Fleet> => ({ code: "", name: "", type: types.rows?.[0]?.code ?? "sepeda", plate: "", pool_code: pools.rows?.find((p) => p.kind !== "storage")?.code ?? "", capacity: 0, condition: "good", last_service: null, is_active: true })}
        rowActions={(f) => (
          <Link href={`/cotr/fleet/labels?codes=${encodeURIComponent(f.code)}`} aria-label={tr("Print label")} title={tr("Print label")}
            className="inline-flex rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><Printer size={15} /></Link>
        )}
        columns={[
          { label: tr("Fleet"), render: (f) => (
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-100 text-slate-400">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {f.has_photo ? <img src={imageUrl("fleet", f.code, "photo", f.updated_at)} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Bike size={16} />}
              </span>
              <span className="min-w-0"><span className="block truncate font-medium text-slate-900">{f.code}{f.name ? ` · ${f.name}` : ""}</span>
                <span className="text-[11px] text-slate-400">{typeName(f.type)}{f.brand ? ` · ${f.brand} ${f.model ?? ""}` : ""}{f.plate ? ` · ${f.plate}` : ""}</span></span>
            </span>
          ) },
          { label: tr("Pool / HUB"), render: (f) => pools.rows?.find((p) => p.code === f.pool_code)?.name ?? f.pool_code },
          { label: tr("Driver"), render: (f) => drivers.rows?.find((d) => d.fleet_code === f.code)?.name ?? <span className="text-slate-400">—</span> },
          { label: tr("QRIS"), render: (f) => f.qris_nmid || f.has_qris
            ? <Badge tone="blue" icon={<QrCode size={11} />}>{f.qris_bank ?? "QRIS"}{f.qris_nmid ? ` · ${f.qris_nmid}` : ""}</Badge> : <span className="text-slate-400">—</span> },
          { label: tr("Condition"), render: (f) => f.condition === "good" ? <Badge tone="green" dot>{tr("Good")}</Badge> : <Badge tone="amber" dot>{tr("In service")}</Badge> },
        ]}
        fields={[
          { key: "photo", label: tr("Photo of the armada"), type: "image", image: { entity: "fleet", slot: "photo" }, section: sec.main },
          { key: "code", label: tr("Code"), required: true, placeholder: "BNI 01", section: sec.main },
          { key: "name", label: tr("Name"), required: true, placeholder: tr("e.g. Armada Kwitang 01"), section: sec.main },
          { key: "type", label: tr("Type"), type: "search", required: true, section: sec.main, options: (types.rows ?? []).map((t) => ({ value: t.code, label: t.name })) },
          { key: "pool_code", label: tr("Pool / HUB"), type: "search", required: true, section: sec.main,
            options: (pools.rows ?? []).filter((p) => p.kind !== "storage").map((p) => ({ value: p.code, label: p.name, hint: p.city })) },
          { key: "condition", label: tr("Condition"), type: "select", required: true, section: sec.main, options: [{ value: "good", label: tr("Good") }, { value: "service", label: tr("In service") }] },
          { key: "is_active", label: tr("Active"), type: "bool", section: sec.main },

          { key: "brand", label: tr("Make"), section: sec.unit, placeholder: "Uwinfly / Genio …" },
          { key: "model", label: tr("Model"), section: sec.unit },
          { key: "plate", label: tr("Plate number"), section: sec.unit, hint: tr("Motorbikes and cars") },
          { key: "frame_no", label: tr("Frame number"), section: sec.unit },
          { key: "acquired_on", label: tr("Acquired on"), type: "date", section: sec.unit },
          { key: "capacity", label: tr("Capacity (cups)"), type: "number", section: sec.unit },
          { key: "last_service", label: tr("Last service"), type: "date", section: sec.unit },
          { key: "note", label: tr("Note"), type: "textarea", section: sec.unit },

          { key: "qris_bank", label: tr("QRIS bank"), section: sec.qris, placeholder: "BNI / BRI …" },
          { key: "qris_nmid", label: tr("NMID"), section: sec.qris, hint: tr("National Merchant ID printed under the QR") },
          { key: "qris_merchant", label: tr("Merchant name"), section: sec.qris },
          { key: "qris", label: tr("QRIS image"), type: "image", image: { entity: "fleet", slot: "qris" }, section: sec.qris, hint: tr("A photo or screenshot of the QRIS; printed on the label") },
        ]} />

      <MasterTable noun={tr("type")} title={tr("Armada types")} master={types}
        description={tr("The kinds of armada the team uses; add one when a new kind of vehicle comes")}
        blank={(): Partial<FleetType> => ({ code: "", name: "", sort: (types.rows?.length ?? 0) + 1 })}
        columns={[
          { label: tr("Type"), render: (t) => <><span className="block font-medium text-slate-900">{t.name}</span><span className="text-[11px] text-slate-400">{t.code}</span></> },
          { label: tr("Fleet"), className: "text-right", render: (t) => <span className="tabular-nums">{(master.rows ?? []).filter((f) => f.type === t.code).length}</span> },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true, placeholder: "sepeda_listrik", hint: tr("Lowercase, no spaces") },
          { key: "name", label: tr("Name"), required: true },
          { key: "sort", label: tr("Order"), type: "number" },
        ]} />
    </Page>
  );
}
