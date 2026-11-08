"use client";

// Monitoring COTR → Master → Area (migration 080): the places the drivers sell or stand by (a CFD, an office park …) with
// the full address and the coordinates; a roster slot of the Master Schedule sends a driver to an area.

import { CheckCircle2, MapPin, MapPinned, Warehouse } from "lucide-react";
import { Badge } from "@/so/ui";
import { Page } from "@/components/kc/compat";
import { StatCard, StatGrid, ValueSkeleton } from "@/components/kc";
import { type Area, Pool } from "@/cotr/types";
import { type MasterFilter, MasterTable, useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

export default function AreasTab() {
  const master = useMaster<Area>("areas");
  const pools = useMaster<Pool>("pools");
  const rows = master.rows ?? [];
  const loaded = !!master.rows;
  const located = (a: Area) => a.latitude !== null && a.longitude !== null;
  const poolName = (code: string | null) => (code ? (pools.rows ?? []).find((p) => p.code === code)?.name ?? code : "—");
  const cities = [...new Set(rows.map((a) => a.city).filter(Boolean))].sort();
  const filters: MasterFilter<Area>[] = [
    { key: "city", label: tr("City"), icon: <MapPinned size={15} />, options: cities.map((c) => ({ value: c, label: c, test: (a) => a.city === c })) },
    { key: "pool", label: tr("Served from"), icon: <Warehouse size={15} />, options: (pools.rows ?? []).filter((p) => p.kind !== "storage").map((p) => ({ value: p.code, label: p.name, test: (a) => a.pool_code === p.code })) },
    { key: "coords", label: tr("Location"), icon: <MapPin size={15} />, options: [
      { value: "with", label: tr("With Coordinates"), test: located }, { value: "without", label: tr("No coordinates"), test: (a) => !located(a) }] },
    { key: "active", label: tr("Status"), icon: <CheckCircle2 size={15} />, options: [
      { value: "on", label: tr("Active"), test: (a) => a.is_active }, { value: "off", label: tr("Inactive"), test: (a) => !a.is_active }] },
  ];
  return (
    <Page title={tr("Area")} subtitle={tr("The selling and standby places of the drivers, with the full address and coordinates")}
      stats={
        <StatGrid label={tr("Summary")} cols={3}>
          <StatCard label={tr("Areas")} tone="brand" icon={<MapPinned />} value={loaded ? rows.filter((a) => a.is_active).length : <ValueSkeleton />}
            sub={loaded && tr("{0} inactive", rows.filter((a) => !a.is_active).length)} />
          <StatCard label={tr("Cities")} icon={<MapPin />} value={loaded ? cities.length : <ValueSkeleton />} />
          <StatCard label={tr("No coordinates")} icon={<MapPin />} tone={rows.some((a) => !located(a)) ? "warn" : "default"}
            value={loaded ? rows.filter((a) => !located(a)).length : <ValueSkeleton />} sub={tr("the check-ins cannot be located there")} />
        </StatGrid>
      }>
      <MasterTable noun={tr("area")} title={tr("Areas")} master={master} filters={filters}
        blank={(): Partial<Area> => ({ code: "", name: "", address: "", district: "", city: "", province: "", postal_code: "", latitude: null, longitude: null, radius_m: 100, pool_code: null, is_active: true })}
        columns={[
          { label: tr("Area"), render: (a) => <><span className="block font-medium text-neutral-900">{a.name || "—"}</span><span className="text-[11px] text-neutral-400">{a.code}</span></> },
          { label: tr("Address"), render: (a) => <><span className="block">{a.address || "—"}</span><span className="text-[11px] text-neutral-400">{[a.district, a.city, a.province, a.postal_code].filter(Boolean).join(", ")}</span></> },
          { label: tr("Location"), render: (a) => located(a)
            ? <a href={`https://maps.google.com/?q=${a.latitude},${a.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-700"><MapPin size={12} />{tr("Map")} · {a.radius_m} m</a>
            : <Badge tone="amber">{tr("No coordinates")}</Badge> },
          { label: tr("Served from"), render: (a) => poolName(a.pool_code) },
          { label: tr("Status"), render: (a) => <Badge tone={a.is_active ? "green" : "slate"}>{a.is_active ? tr("Active") : tr("Inactive")}</Badge> },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true, placeholder: "AREA-XXX", section: tr("Area") },
          { key: "name", label: tr("Name"), required: true, placeholder: tr("e.g. CFD Sudirman"), section: tr("Area") },
          { key: "pool_code", label: tr("Served from"), type: "search", hint: tr("The pool the drivers usually come from"), section: tr("Area"),
            options: (pools.rows ?? []).filter((p) => p.kind !== "storage").map((p) => ({ value: p.code, label: p.name, hint: p.city })) },
          { key: "is_active", label: tr("Active"), type: "bool", section: tr("Area") },
          { key: "address", label: tr("Address"), type: "textarea", required: true, section: tr("Full address") },
          { key: "district", label: tr("District"), section: tr("Full address") },
          { key: "city", label: tr("City"), required: true, section: tr("Full address") },
          { key: "province", label: tr("Province"), section: tr("Full address") },
          { key: "postal_code", label: tr("Postal Code"), section: tr("Full address") },
          { key: "coords", label: tr("Coordinates"), type: "coords", coords: ["latitude", "longitude"], section: tr("Coordinates") },
          { key: "radius_m", label: tr("Radius (M)"), type: "number", section: tr("Coordinates"), hint: tr("A driver further than this is outside the area") },
          { key: "note", label: tr("Note"), type: "textarea", section: tr("Coordinates") },
        ]} />
    </Page>
  );
}
