"use client";

// Monitoring COTR → Master Fleet (page cotr.fleet): the armada the drivers sell from — name, type (a master the team
// extends: electric bike, bike, motorbike, cart, booth, car …), make / model, frame number, pool, capacity, condition,
// photo and the QRIS of the armada (bank, NMID, merchant, QR image; migration 050), the papers and upkeep (asset number,
// colour, year, battery, STNK, insurance, odometer, next service, GPS; migration 063) with a due warning. Information
// labels (no QRIS: it is shown only for a payment) are printed from here; their QR opens /share/fleet/{token}.

import Link from "next/link";
import { Bike, Building2, CheckCircle2, ExternalLink, Printer, QrCode, Truck, Wrench } from "lucide-react";
import { useState } from "react";
import { Badge, Button } from "@/so/ui";
import { Page } from "@/components/kc/compat";
import { Driver, Fleet, FleetType, Pool } from "@/cotr/types";
import { MasterTable, imageUrl, useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

const DUE_DAYS = 30;
/** the papers and the service of an armada due within DUE_DAYS (or past) */
function dues(f: Fleet, now: number): { label: string; late: boolean }[] {
  const out: { label: string; late: boolean }[] = [];
  const check = (d: string | null | undefined, label: string) => {
    if (!d) return;
    const days = Math.floor((new Date(`${d}T00:00:00`).getTime() - now) / 86_400_000);
    if (days <= DUE_DAYS) out.push({ label, late: days < 0 });
  };
  check(f.stnk_expires, tr("STNK"));
  check(f.insurance_expires, tr("Insurance"));
  check(f.next_service, tr("Service"));
  return out;
}

export default function CotrFleetPage() {
  const master = useMaster<Fleet>("fleet");
  const types = useMaster<FleetType>("fleet-types");
  const pools = useMaster<Pool>("pools");
  const drivers = useMaster<Driver>("drivers");
  const typeName = (code: string) => types.rows?.find((t) => t.code === code)?.name ?? code;
  const sec = { main: tr("Armada"), unit: tr("Vehicle"), papers: tr("Papers & upkeep"), qris: tr("QRIS (payments only)") };
  const [now] = useState(() => Date.now());
  return (
    <Page eyebrow="Monitoring COTR" media={<Truck size={19} />} title={tr("Master Fleet")} subtitle={tr("Armada of COTR: vehicle, papers, upkeep, QRIS and information label")}
      actions={<Link href="/cotr/fleet/labels"><Button variant="secondary"><Printer size={16} /> {tr("Print labels")}</Button></Link>}>
      <MasterTable noun={tr("fleet")} title={tr("Fleet")} master={master} filters={[
        { key: "pool", label: tr("Pool / HUB"), icon: <Building2 size={15} />, options: (pools.rows ?? []).filter((p) => p.kind !== "storage").map((p) => ({ value: p.code, label: p.name, test: (f: Fleet) => f.pool_code === p.code })) },
        { key: "type", label: tr("Type"), icon: <Truck size={15} />, options: (types.rows ?? []).map((t) => ({ value: t.code, label: t.name, test: (f: Fleet) => f.type === t.code })) },
        { key: "condition", label: tr("Condition"), icon: <Wrench size={15} />, options: [
          { value: "good", label: tr("Good"), test: (f: Fleet) => f.condition === "good" }, { value: "service", label: tr("In service"), test: (f: Fleet) => f.condition === "service" },
          { value: "due", label: tr("Papers or service due"), test: (f: Fleet) => dues(f, now).length > 0 }] },
        { key: "active", label: tr("Status"), icon: <CheckCircle2 size={15} />, options: [
          { value: "on", label: tr("Active"), test: (f: Fleet) => f.is_active }, { value: "off", label: tr("Inactive"), test: (f: Fleet) => !f.is_active }] },
        { key: "qris", label: tr("QRIS"), icon: <QrCode size={15} />, options: [
          { value: "with", label: tr("With QRIS"), test: (f: Fleet) => !!(f.qris_nmid || f.has_qris) }, { value: "without", label: tr("No QRIS"), test: (f: Fleet) => !(f.qris_nmid || f.has_qris) }] },
      ]}
        blank={(): Partial<Fleet> => ({ code: "", name: "", type: types.rows?.[0]?.code ?? "sepeda", plate: "", pool_code: pools.rows?.find((p) => p.kind !== "storage")?.code ?? "", capacity: 0, condition: "good", last_service: null, is_active: true })}
        rowActions={(f) => (<>
          {f.label_token && <a href={`/share/fleet/${f.label_token}`} target="_blank" rel="noreferrer" aria-label={tr("Information page")} title={tr("Information page (what the QR opens)")}
            className="inline-flex rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><ExternalLink size={15} /></a>}
          <Link href={`/cotr/fleet/labels?codes=${encodeURIComponent(f.code)}`} aria-label={tr("Print label")} title={tr("Print label")}
            className="inline-flex rounded-md p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"><Printer size={15} /></Link>
        </>)}
        columns={[
          { label: tr("Fleet"), render: (f) => (
            <span className="flex items-center gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg bg-neutral-100 text-neutral-400">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {f.has_photo ? <img src={imageUrl("fleet", f.code, "photo", f.updated_at)} alt="" className="h-full w-full object-cover" loading="lazy" /> : <Bike size={16} />}
              </span>
              <span className="min-w-0"><span className="block truncate font-medium text-neutral-900">{f.code}{f.name ? ` · ${f.name}` : ""}</span>
                <span className="text-[11px] text-neutral-400">{typeName(f.type)}{f.brand ? ` · ${f.brand} ${f.model ?? ""}` : ""}{f.plate ? ` · ${f.plate}` : ""}{f.color ? ` · ${f.color}` : ""}</span></span>
            </span>
          ) },
          { label: tr("Pool / HUB"), render: (f) => pools.rows?.find((p) => p.code === f.pool_code)?.name ?? f.pool_code },
          { label: tr("Driver"), render: (f) => drivers.rows?.find((d) => d.fleet_code === f.code)?.name ?? <span className="text-neutral-400">—</span> },
          { label: tr("QRIS"), render: (f) => f.qris_nmid || f.has_qris
            ? <Badge tone="blue" icon={<QrCode size={11} />}>{f.qris_bank ?? "QRIS"}{f.qris_nmid ? ` · ${f.qris_nmid}` : ""}</Badge> : <span className="text-neutral-400">—</span> },
          { label: tr("Condition"), render: (f) => (
            <span className="flex flex-wrap gap-1">
              {f.condition === "good" ? <Badge tone="green" dot>{tr("Good")}</Badge> : <Badge tone="amber" dot>{tr("In service")}</Badge>}
              {dues(f, now).map((d) => <Badge key={d.label} tone={d.late ? "red" : "amber"}>{d.late ? tr("{0} overdue", d.label) : tr("{0} due", d.label)}</Badge>)}
            </span>
          ) },
        ]}
        fields={[
          { key: "photo", label: tr("Photo of the armada"), type: "image", image: { entity: "fleet", slot: "photo" }, section: sec.main },
          { key: "code", label: tr("Code"), required: true, placeholder: "BNI 01", section: sec.main },
          { key: "name", label: tr("Name"), required: true, placeholder: tr("e.g. Armada Kwitang 01"), section: sec.main },
          { key: "type", label: tr("Type"), type: "search", required: true, section: sec.main, options: (types.rows ?? []).map((t) => ({ value: t.code, label: t.name })) },
          { key: "pool_code", label: tr("Pool / HUB"), type: "search", required: true, section: sec.main,
            options: (pools.rows ?? []).filter((p) => p.kind !== "storage").map((p) => ({ value: p.code, label: p.name, hint: p.city })) },
          { key: "condition", label: tr("Condition"), type: "select", required: true, section: sec.main, options: [{ value: "good", label: tr("Good") }, { value: "service", label: tr("In service") }] },
          { key: "asset_no", label: tr("Asset number"), section: sec.main, placeholder: "AST-COTR-001", hint: tr("The number of the company asset register") },
          { key: "is_active", label: tr("Active"), type: "bool", section: sec.main },

          { key: "brand", label: tr("Make"), section: sec.unit, placeholder: "Uwinfly / Genio …" },
          { key: "model", label: tr("Model"), section: sec.unit },
          { key: "color", label: tr("Colour"), section: sec.unit },
          { key: "year_made", label: tr("Year made"), type: "number", section: sec.unit },
          { key: "plate", label: tr("Plate number"), section: sec.unit, hint: tr("Motorbikes and cars") },
          { key: "frame_no", label: tr("Frame number"), section: sec.unit },
          { key: "battery_no", label: tr("Battery number"), section: sec.unit, hint: tr("Electric bikes") },
          { key: "capacity", label: tr("Capacity (cups)"), type: "number", section: sec.unit },
          { key: "acquired_on", label: tr("Acquired on"), type: "date", section: sec.unit },
          { key: "gps_id", label: tr("GPS tracker ID"), section: sec.unit },
          { key: "note", label: tr("Note"), type: "textarea", section: sec.unit },

          { key: "stnk_no", label: tr("STNK number"), section: sec.papers, hint: tr("Motorbikes and cars") },
          { key: "stnk_expires", label: tr("STNK valid until"), type: "date", section: sec.papers },
          { key: "insurance_no", label: tr("Insurance policy"), section: sec.papers },
          { key: "insurance_expires", label: tr("Insurance valid until"), type: "date", section: sec.papers },
          { key: "last_service", label: tr("Last service"), type: "date", section: sec.papers },
          { key: "next_service", label: tr("Next service"), type: "date", section: sec.papers, hint: tr("Flagged {0} days before", DUE_DAYS) },
          { key: "odometer_km", label: tr("Odometer (km)"), type: "number", section: sec.papers },

          { key: "qris_bank", label: tr("QRIS bank"), section: sec.qris, placeholder: "BNI / BRI …" },
          { key: "qris_nmid", label: tr("NMID"), section: sec.qris, hint: tr("National Merchant ID printed under the QR") },
          { key: "qris_merchant", label: tr("Merchant name"), section: sec.qris },
          { key: "qris", label: tr("QRIS image"), type: "image", image: { entity: "fleet", slot: "qris" }, section: sec.qris, hint: tr("A photo or screenshot of the QRIS; shown to the customer only for a payment, never printed on the label") },
        ]} />

      <MasterTable noun={tr("type")} title={tr("Armada types")} master={types}
        description={tr("The kinds of armada the team uses; add one when a new kind of vehicle comes")}
        blank={(): Partial<FleetType> => ({ code: "", name: "", sort: (types.rows?.length ?? 0) + 1 })}
        columns={[
          { label: tr("Type"), render: (t) => <><span className="block font-medium text-neutral-900">{t.name}</span><span className="text-[11px] text-neutral-400">{t.code}</span></> },
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
