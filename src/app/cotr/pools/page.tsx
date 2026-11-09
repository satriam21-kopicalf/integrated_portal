"use client";

// Monitoring COTR → Master Pool / HUB (page cotr.pools): the main HUB, the parent pools under it where the drivers
// start and reload, and the storages (menus and raw materials) of each. A summary, the network per main HUB (its pools
// with drivers and fleet, location state), then the list with its filters (type, HUB, location, status).

import { Boxes, Building2, CheckCircle2, Clock, Factory, MapPin, Network, Truck, UserRound, Users, Warehouse } from "lucide-react";
import { Badge } from "@/so/ui";
import { Page } from "@/components/kc/compat";
import { Pill, StatCard, StatGrid, ValueSkeleton } from "@/components/kc";
import { Driver, Fleet, Pool } from "@/cotr/types";
import { type MasterFilter, MasterTable, useMaster } from "@/cotr/ui";
import { tr } from "@/lib/i18n";

const KIND: Record<Pool["kind"], { label: () => string; tone: "blue" | "violet" | "cyan"; icon: typeof Boxes }> = {
  main: { label: () => tr("Main HUB"), tone: "blue", icon: Building2 },
  parent: { label: () => tr("Parent Pool"), tone: "violet", icon: Warehouse },
  storage: { label: () => tr("Storage"), tone: "cyan", icon: Boxes },
};

export default function CotrPoolsPage() {
  const master = useMaster<Pool>("pools");
  const drivers = useMaster<Driver>("drivers");
  const fleet = useMaster<Fleet>("fleet");
  const rows = master.rows ?? [];
  const mains = rows.filter((p) => p.kind === "main");
  // not every employee is a driver (2026-11-09): the employees of a pool per department
  const people = (code: string) => (drivers.rows ?? []).filter((d) => d.pool_code === code && d.status !== "inactive");
  const count = (code: string) => ({
    drivers: people(code).length,
    fleet: (fleet.rows ?? []).filter((f) => f.pool_code === code && f.is_active).length,
  });
  const departments = (code: string) => {
    const m = new Map<string, number>();
    for (const d of people(code)) m.set(d.department || tr("No department"), (m.get(d.department || tr("No department")) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  };
  const loaded = !!master.rows;
  const located = (p: Pool) => p.latitude !== null && p.longitude !== null;
  const filters: MasterFilter<Pool>[] = [
    { key: "kind", label: tr("Type"), icon: <Building2 size={15} />, options: (Object.keys(KIND) as Pool["kind"][]).map((k) => ({ value: k, label: KIND[k].label(), test: (p) => p.kind === k })) },
    { key: "under", label: tr("Under (Main HUB)"), icon: <Network size={15} />, options: mains.map((m) => ({ value: m.code, label: m.name, test: (p) => p.parent_code === m.code || p.code === m.code })) },
    { key: "coords", label: tr("Location"), icon: <MapPin size={15} />, options: [
      { value: "with", label: tr("With Coordinates"), test: located }, { value: "without", label: tr("No coordinates"), test: (p) => !located(p) }] },
    { key: "active", label: tr("Status"), icon: <CheckCircle2 size={15} />, options: [
      { value: "on", label: tr("Active"), test: (p) => p.is_active }, { value: "off", label: tr("Inactive"), test: (p) => !p.is_active }] },
  ];
  return (
    <Page eyebrow="Monitoring COTR" media={<Building2 size={19} />} title={tr("Master Pool / HUB")} subtitle={tr("Main HUB, parent pools and the storage of menus and raw materials")}
      stats={
        <StatGrid label={tr("Summary")} cols={4}>
          <StatCard label={tr("Main HUB")} tone="brand" icon={<Building2 />} value={loaded ? mains.length : <ValueSkeleton />}
            sub={loaded && tr("{0} producing", rows.filter((p) => p.is_production).length)} />
          <StatCard label={tr("Parent Pools")} icon={<Warehouse />} value={loaded ? rows.filter((p) => p.kind === "parent").length : <ValueSkeleton />}
            sub={loaded && tr("{0} storages", rows.filter((p) => p.kind === "storage").length)} />
          <StatCard label={tr("Employees & Fleet")} icon={<Users />} value={drivers.rows ? (drivers.rows ?? []).filter((d) => d.status !== "inactive").length : <ValueSkeleton />}
            sub={fleet.rows && tr("{0} armada in use", (fleet.rows ?? []).filter((f) => f.is_active).length)} />
          <StatCard label={tr("No coordinates")} icon={<MapPin />} tone={rows.some((p) => !located(p)) ? "warn" : "default"} value={loaded ? rows.filter((p) => !located(p)).length : <ValueSkeleton />}
            sub={tr("check-ins cannot be located there")} />
        </StatGrid>
      }>
      {/* the network at a glance: every main HUB with its pools and storages */}
      <div className="grid gap-4 xl:grid-cols-2">
        {mains.map((m) => {
          const children = rows.filter((p) => p.parent_code === m.code);
          const c = count(m.code);
          return (
            <section key={m.code} className="overflow-hidden rounded-xl border border-neutral-200 bg-white">
              <header className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-100 px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 items-start gap-3">
                  <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-brand-700 text-white"><Building2 size={18} /></span>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-neutral-900">{m.name}
                      {m.is_production && <Pill tone="brand" icon={<Factory size={11} />}>{tr("Production Hub")}</Pill>}
                      {!m.is_active && <Pill tone="gray">{tr("Inactive")}</Pill>}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-neutral-500">
                      <span className="font-mono">{m.code}</span>
                      {m.city && <span className="inline-flex items-center gap-1"><MapPin size={11} />{m.city}</span>}
                      {m.open_time && <span className="inline-flex items-center gap-1"><Clock size={11} />{m.open_time}–{m.close_time ?? ""}</span>}
                      {m.pic_name && <span className="inline-flex items-center gap-1"><UserRound size={11} />{m.pic_name}</span>}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 text-center">
                  <Mini label={tr("Pools")} value={children.length} />
                  <Mini label={tr("Employees")} value={c.drivers + children.reduce((a, p) => a + count(p.code).drivers, 0)} />
                  <Mini label={tr("Fleet")} value={c.fleet + children.reduce((a, p) => a + count(p.code).fleet, 0)} />
                </div>
              </header>
              {departments(m.code).length > 0 && (
                <div className="flex flex-wrap gap-1.5 border-b border-neutral-100 px-4 py-2.5 sm:px-5">
                  {departments(m.code).map(([dep, n]) => <span key={dep} className="rounded-md bg-neutral-100 px-2 py-0.5 text-[11px] text-neutral-700">{dep} · <b className="tabular-nums">{n}</b></span>)}
                </div>
              )}
              {children.length === 0 ? <p className="px-5 py-6 text-center text-xs text-neutral-400">{tr("No pool under this HUB yet")}</p> : (
                <ul className="divide-y divide-neutral-100">
                  {children.map((p) => {
                    const k = KIND[p.kind];
                    const n = count(p.code);
                    return (
                      <li key={p.code} className="flex items-center gap-3 px-4 py-3 sm:px-5">
                        <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-neutral-500"><k.icon size={15} /></span>
                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-[13px] font-medium text-neutral-900">{p.name}<Badge tone={k.tone}>{k.label()}</Badge>
                            {!located(p) && <Pill tone="amber" icon={<MapPin size={10} />}>{tr("No coordinates")}</Pill>}</p>
                          <p className="truncate text-[11px] text-neutral-500">
                            {p.kind === "storage" ? (p.storage.join(", ") || "—") : [p.address, p.city].filter(Boolean).join(", ") || p.code}
                          </p>
                          {p.kind !== "storage" && departments(p.code).length > 0 && (
                            <p className="mt-0.5 truncate text-[11px] text-neutral-500">{departments(p.code).map(([dep, n]) => `${dep} ${n}`).join(" · ")}</p>
                          )}
                        </div>
                        {p.kind !== "storage" && (
                          <span className="flex flex-shrink-0 items-center gap-3 text-xs tabular-nums text-neutral-600">
                            <span className="inline-flex items-center gap-1" title={tr("Employees")}><Users size={13} className="text-neutral-400" />{n.drivers}</span>
                            <span className="inline-flex items-center gap-1" title={tr("Fleet")}><Truck size={13} className="text-neutral-400" />{n.fleet}</span>
                          </span>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
        {loaded && mains.length === 0 && <p className="rounded-xl border border-dashed border-neutral-300 px-4 py-8 text-center text-sm text-neutral-500">{tr("No main HUB yet: add one below.")}</p>}
      </div>
      <MasterTable noun={tr("pool")} title={tr("Pools, HUBs & Storages")} master={master} filters={filters}
        blank={(): Partial<Pool> => ({ code: "", name: "", kind: "parent", parent_code: mains[0]?.code ?? null, city: "", address: "", storage: [], is_active: true, latitude: null, longitude: null, radius_m: 100 })}
        toForm={(p) => ({ ...p, storage: (p.storage ?? []).join(", ") })}
        fromForm={(v) => ({ ...v, storage: String(v.storage ?? "").split(",").map((s) => s.trim()).filter(Boolean) }) as Partial<Pool>}
        columns={[
          { label: tr("Name"), render: (p) => <><span className="block font-medium text-neutral-900">{p.name || "—"}</span><span className="text-[11px] text-neutral-400">{p.code}</span></> },
          { label: tr("Location"), render: (p) => p.latitude !== null && p.longitude !== null
            ? <a href={`https://maps.google.com/?q=${p.latitude},${p.longitude}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-700"><MapPin size={12} />{tr("Map")} · {p.radius_m} m</a>
            : <Badge tone="amber">{tr("No coordinates")}</Badge> },
          { label: tr("Type"), render: (p) => <Badge tone={KIND[p.kind].tone}>{KIND[p.kind].label()}</Badge> },
          { label: tr("Under"), render: (p) => (p.parent_code ? rows.find((x) => x.code === p.parent_code)?.name ?? p.parent_code : "—") },
          { label: tr("Address"), render: (p) => <><span className="block">{p.address}</span><span className="text-[11px] text-neutral-400">{p.city}</span></> },
          { label: tr("Employees per Department"), render: (p) => departments(p.code).length
            ? <span className="text-xs text-neutral-600">{departments(p.code).map(([dep, n]) => `${dep} ${n}`).join(" · ")}</span> : <span className="text-neutral-400">—</span> },
          { label: tr("Stores"), render: (p) => <span className="text-xs text-neutral-600">{p.storage.join(", ") || "—"}</span> },
        ]}
        fields={[
          { key: "code", label: tr("Code"), required: true, placeholder: "POOL-XXX", section: tr("Pool / HUB") },
          { key: "name", label: tr("Name"), required: true, section: tr("Pool / HUB") },
          { key: "kind", label: tr("Type"), type: "select", required: true, section: tr("Pool / HUB"), options: (Object.keys(KIND) as Pool["kind"][]).map((k) => ({ value: k, label: KIND[k].label() })) },
          { key: "parent_code", label: tr("Under (Main HUB)"), type: "search", hint: tr("Empty for a main HUB"), section: tr("Pool / HUB"), options: mains.map((m) => ({ value: m.code, label: m.name, hint: m.city })) },
          { key: "storage", label: tr("Stores"), hint: tr("Separate with commas: menus, raw materials, packaging …"), section: tr("Pool / HUB") },
          { key: "is_active", label: tr("Active"), type: "bool", section: tr("Pool / HUB") },

          { key: "city", label: tr("City"), required: true, section: tr("Location") },
          { key: "radius_m", label: tr("Check-in Radius (M)"), type: "number", section: tr("Location"), hint: tr("A check in further than this is flagged") },
          { key: "address", label: tr("Address"), type: "textarea", section: tr("Location") },
          { key: "coords", label: tr("Coordinates"), type: "coords", coords: ["latitude", "longitude"], section: tr("Location") },

          { key: "pic_name", label: tr("PIC"), section: tr("Contact & hours") },
          { key: "phone", label: tr("Phone"), section: tr("Contact & hours") },
          { key: "open_time", label: tr("Opens"), type: "time", section: tr("Contact & hours") },
          { key: "close_time", label: tr("Closes"), type: "time", section: tr("Contact & hours") },
          { key: "note", label: tr("Note"), type: "textarea", section: tr("Contact & hours") },
          { key: "is_production", label: tr("Production Hub"), type: "bool", hint: tr("The main hub where the products are made and sent to the pools") },
        ]} />
    </Page>
  );
}

function Mini({ label, value }: { label: string; value: number }) {
  return (
    <span className="min-w-[3.5rem] rounded-lg bg-neutral-50 px-2.5 py-1.5 ring-1 ring-inset ring-neutral-200">
      <span className="block text-base font-semibold tabular-nums leading-tight text-neutral-900">{value}</span>
      <span className="block text-[10px] font-medium uppercase tracking-wide text-neutral-500">{label}</span>
    </span>
  );
}
